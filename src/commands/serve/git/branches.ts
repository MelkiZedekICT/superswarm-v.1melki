import { GitCommandError, runGit, runGitChecked } from "./process.ts";
import { getGitSnapshot } from "./repository.ts";

async function requireCleanTree(projectRoot: string): Promise<void> {
	const snapshot = await getGitSnapshot(projectRoot);
	if (snapshot.changes.length > 0)
		throw new GitCommandError("Commit or stash working changes before switching branches.");
}

export async function switchBranch(projectRoot: string, rawName: unknown, create: boolean) {
	if (typeof rawName !== "string" || rawName.trim().length === 0)
		throw new GitCommandError("Enter a branch name.");
	const name = rawName.trim();
	if (name.startsWith("-")) throw new GitCommandError("Branch names cannot start with a dash.");
	const checked = await runGit(projectRoot, ["check-ref-format", "--branch", name]);
	if (checked.exitCode !== 0) throw new GitCommandError("That is not a valid Git branch name.");
	await requireCleanTree(projectRoot);
	const result = create
		? await runGit(projectRoot, ["switch", "-c", name])
		: await runGit(projectRoot, ["switch", name]);
	if (result.exitCode !== 0)
		throw new GitCommandError(result.stderr.trim() || `Could not switch to ${name}.`);
	return getGitSnapshot(projectRoot);
}

export async function syncRepository(projectRoot: string, operation: "fetch" | "pull" | "push") {
	const snapshot = await getGitSnapshot(projectRoot);
	if (operation !== "fetch" && snapshot.upstream === null)
		throw new GitCommandError("This branch has no upstream. Set one with git push --set-upstream.");
	const args =
		operation === "fetch"
			? ["fetch", "--prune"]
			: operation === "pull"
				? ["pull", "--ff-only"]
				: ["push"];
	await runGitChecked(projectRoot, args);
	return getGitSnapshot(projectRoot);
}
