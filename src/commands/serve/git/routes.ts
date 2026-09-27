import { apiError, apiJson } from "../../../json.ts";
import { registerApiHandler } from "../../serve.ts";
import { resolveRepoPath, runGit, runGitChecked } from "./process.ts";
import { getGitSnapshot } from "./repository.ts";

async function readHistory(projectRoot: string) {
	const output = await runGitChecked(projectRoot, [
		"log",
		"-n",
		"40",
		"--format=%H%x00%h%x00%s%x00%an%x00%aI%x00",
	]);
	const fields = output.split("\0");
	const commits = [];
	for (let index = 0; index + 4 < fields.length; index += 5) {
		const [hash, shortHash, subject, author, committedAt] = fields.slice(index, index + 5);
		if (hash && shortHash && subject !== undefined && author !== undefined && committedAt)
			commits.push({ hash, shortHash, subject, author, committedAt });
	}
	return commits;
}

async function readBranches(projectRoot: string) {
	const output = await runGitChecked(projectRoot, [
		"for-each-ref",
		"--format=%(refname:short)%09%(HEAD)",
		"refs/heads",
	]);
	return output
		.split(/\r?\n/)
		.filter(Boolean)
		.map((line) => {
			const [name, head] = line.split("\t");
			return { name, current: head === "*" };
		});
}

/** Register the project-scoped Git API separately from the agent REST routes. */
export function registerGitApi(projectRoot: string): void {
	registerApiHandler(async (req) => {
		const { pathname } = new URL(req.url);
		if (req.method === "GET" && pathname === "/api/git/status") {
			try {
				return apiJson(await getGitSnapshot(projectRoot));
			} catch (error) {
				return apiError(error instanceof Error ? error.message : "Could not read Git status.", 400);
			}
		}
		if (req.method === "GET" && pathname === "/api/git/history") {
			try {
				return apiJson(await readHistory(projectRoot));
			} catch (error) {
				return apiError(error instanceof Error ? error.message : "Could not read Git history.", 400);
			}
		}
		if (req.method === "GET" && pathname === "/api/git/branches") {
			try {
				return apiJson(await readBranches(projectRoot));
			} catch (error) {
				return apiError(error instanceof Error ? error.message : "Could not read Git branches.", 400);
			}
		}
		if (req.method === "GET" && pathname === "/api/git/diff") {
			try {
				const url = new URL(req.url);
				const path = resolveRepoPath(projectRoot, url.searchParams.get("path") ?? "");
				const staged = url.searchParams.get("staged") === "true";
				const snapshot = await getGitSnapshot(projectRoot);
				const change = snapshot.changes.find((item) => item.path === path);
				if (!change) return apiError("File has no uncommitted changes.", 404);
				const args = change.kind === "untracked" && !staged
					? ["diff", "--no-index", "--no-ext-diff", "--no-textconv", "--unified=3", "--", "/dev/null", path]
					: [
							"--literal-pathspecs",
							"diff",
							"--no-ext-diff",
							"--no-textconv",
							"--unified=3",
							...(staged ? ["--cached"] : []),
							"--",
							path,
						];
				const result = await runGit(projectRoot, args);
				if (result.exitCode !== 0 && !(change.kind === "untracked" && result.exitCode === 1))
					return apiError(result.stderr.trim() || "Could not read the file diff.", 400);
				const maxChars = 120_000;
				return apiJson({
					path,
					staged,
					diff: result.stdout.slice(0, maxChars),
					truncated: result.stdout.length > maxChars,
				});
			} catch (error) {
				return apiError(error instanceof Error ? error.message : "Could not read the file diff.", 400);
			}
		}
		return null;
	});
}
