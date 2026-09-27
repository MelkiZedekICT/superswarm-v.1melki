import { runGit, runGitChecked, type GitResult } from "./process.ts";

export interface GitFileChange {
	path: string;
	indexStatus: string;
	worktreeStatus: string;
	kind: "modified" | "added" | "deleted" | "renamed" | "untracked" | "conflict";
	staged: boolean;
	unstaged: boolean;
}

export interface GitSnapshot {
	root: string;
	branch: string;
	detached: boolean;
	upstream: string | null;
	ahead: number;
	behind: number;
	changes: GitFileChange[];
}

function statusKind(indexStatus: string, worktreeStatus: string): GitFileChange["kind"] {
	const status = indexStatus + worktreeStatus;
	if (status.includes("U") || status === "DD" || status === "AA") return "conflict";
	if (status === "??") return "untracked";
	if (status.includes("R")) return "renamed";
	if (status.includes("D")) return "deleted";
	if (status.includes("A")) return "added";
	return "modified";
}

function parsePorcelain(output: string): GitFileChange[] {
	const fields = output.split("\0");
	const changes: GitFileChange[] = [];
	for (let index = 0; index < fields.length; index += 1) {
		const record = fields[index];
		if (!record || record.length < 4) continue;
		const indexStatus = record[0] ?? " ";
		const worktreeStatus = record[1] ?? " ";
		const path = record.slice(3);
		if (!path) continue;
		changes.push({
			path: path.replaceAll("\\", "/"),
			indexStatus,
			worktreeStatus,
			kind: statusKind(indexStatus, worktreeStatus),
			staged: indexStatus !== " " && indexStatus !== "?",
			unstaged: worktreeStatus !== " " || indexStatus === "?",
		});
		// Porcelain v1 -z emits a second NUL field containing the old path for
		// renames and copies. Keep the destination as the actionable path.
		if (
			indexStatus === "R" ||
			indexStatus === "C" ||
			worktreeStatus === "R" ||
			worktreeStatus === "C"
		)
			index += 1;
	}
	return changes.sort((a, b) => a.path.localeCompare(b.path));
}

async function upstreamState(
	cwd: string,
): Promise<{ upstream: string | null; ahead: number; behind: number }> {
	const upstream = await runGit(cwd, [
		"rev-parse",
		"--abbrev-ref",
		"--symbolic-full-name",
		"@{upstream}",
	]);
	if (upstream.exitCode !== 0) return { upstream: null, ahead: 0, behind: 0 };
	const counts = await runGit(cwd, ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"]);
	if (counts.exitCode !== 0) return { upstream: upstream.stdout.trim(), ahead: 0, behind: 0 };
	const [aheadText, behindText] = counts.stdout.trim().split(/\s+/);
	return {
		upstream: upstream.stdout.trim(),
		ahead: Number.parseInt(aheadText ?? "0", 10) || 0,
		behind: Number.parseInt(behindText ?? "0", 10) || 0,
	};
}

export async function getGitSnapshot(cwd: string): Promise<GitSnapshot> {
	const root = (await runGitChecked(cwd, ["rev-parse", "--show-toplevel"])).trim();
	const [branchResult, headResult, statusResult, tracking] = await Promise.all([
		runGit(root, ["symbolic-ref", "--quiet", "--short", "HEAD"]),
		runGit(root, ["rev-parse", "--short", "HEAD"]),
		runGit(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]),
		upstreamState(root),
	]);
	if (statusResult.exitCode !== 0)
		throw new Error(statusResult.stderr.trim() || "Could not read Git status.");
	const detached = branchResult.exitCode !== 0;
	return {
		root,
		branch: detached
			? `detached at ${headResult.stdout.trim() || "unknown"}`
			: branchResult.stdout.trim(),
		detached,
		...tracking,
		changes: parsePorcelain(statusResult.stdout),
	};
}

export function gitFailure(result: GitResult): string {
	return result.stderr.trim() || "Git command failed.";
}
