import { GitCommandError, resolveRepoPath, runGit, runGitChecked } from "./process.ts";
import { getGitSnapshot } from "./repository.ts";

async function requireChangedPath(projectRoot: string, rawPath: string, requireStaged: boolean) {
	const path = resolveRepoPath(projectRoot, rawPath);
	const snapshot = await getGitSnapshot(projectRoot);
	const change = snapshot.changes.find((item) => item.path === path);
	if (!change) throw new GitCommandError("File no longer has uncommitted changes.");
	if (requireStaged && !change.staged)
		throw new GitCommandError("File has no staged changes to unstage.");
	return { path, change };
}

export async function stageChange(projectRoot: string, rawPath: string) {
	const { path } = await requireChangedPath(projectRoot, rawPath, false);
	const result = await runGit(projectRoot, ["--literal-pathspecs", "add", "--", path]);
	if (result.exitCode !== 0)
		throw new GitCommandError(result.stderr.trim() || `Could not stage ${path}.`);
	return getGitSnapshot(projectRoot);
}

export async function unstageChange(projectRoot: string, rawPath: string) {
	const { path, change } = await requireChangedPath(projectRoot, rawPath, true);
	const result =
		change.kind === "added"
			? await runGit(projectRoot, ["--literal-pathspecs", "rm", "--cached", "--force", "--", path])
			: await runGit(projectRoot, ["--literal-pathspecs", "reset", "-q", "HEAD", "--", path]);
	if (result.exitCode !== 0)
		throw new GitCommandError(result.stderr.trim() || `Could not unstage ${path}.`);
	return getGitSnapshot(projectRoot);
}

export async function commitStaged(projectRoot: string, rawMessage: unknown) {
	if (typeof rawMessage !== "string" || rawMessage.trim().length === 0)
		throw new GitCommandError("Enter a commit message.");
	const message = rawMessage.trim();
	if (message.length > 2000)
		throw new GitCommandError("Commit message must be 2,000 characters or fewer.");
	const snapshot = await getGitSnapshot(projectRoot);
	if (!snapshot.changes.some((change) => change.staged))
		throw new GitCommandError("Stage at least one file before committing.");
	await runGitChecked(projectRoot, ["commit", "-m", message]);
	const hash = (await runGitChecked(projectRoot, ["rev-parse", "HEAD"])).trim();
	return { hash, message, snapshot: await getGitSnapshot(projectRoot) };
}
