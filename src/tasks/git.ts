const INTERNAL_TASK_PATH = ".superswarm/";

export interface GitResult {
	exitCode: number;
	stdout: string;
	stderr: string;
}

export async function runGit(cwd: string, args: string[]): Promise<GitResult> {
	const child = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
	const [exitCode, stdout, stderr] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);
	return { exitCode, stdout, stderr };
}

export async function currentBranch(cwd: string): Promise<string> {
	const result = await runGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
	if (result.exitCode !== 0) throw new Error(result.stderr.trim() || "Cannot read Git branch.");
	return result.stdout.trim() || "HEAD";
}

export async function listTaskChanges(cwd: string): Promise<string[]> {
	const [tracked, untracked] = await Promise.all([
		runGit(cwd, ["diff", "--name-only", "-z", "HEAD"]),
		runGit(cwd, ["ls-files", "--others", "--exclude-standard", "-z"]),
	]);
	return [
		...new Set(
			[tracked.stdout, untracked.stdout]
				.flatMap((value) => value.split("\0"))
				.filter(Boolean)
				.map((value) => value.replaceAll("\\", "/"))
				.filter((file) => file !== ".superswarm" && !file.startsWith(INTERNAL_TASK_PATH)),
		),
	].sort();
}

export async function commitTaskChanges(
	cwd: string,
	taskId: string,
	files: string[],
): Promise<string> {
	const staged = await runGit(cwd, ["add", "--", ...files]);
	if (staged.exitCode !== 0) throw new Error(staged.stderr.trim() || "Could not stage changes.");
	const committed = await runGit(cwd, ["commit", "-m", `Complete Superswarm task ${taskId}`]);
	if (committed.exitCode !== 0)
		throw new Error(committed.stderr.trim() || "Could not commit changes.");
	const revision = await runGit(cwd, ["rev-parse", "HEAD"]);
	if (revision.exitCode !== 0) throw new Error(revision.stderr.trim() || "Cannot read commit.");
	return revision.stdout.trim();
}
