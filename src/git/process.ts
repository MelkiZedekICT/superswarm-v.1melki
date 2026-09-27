export interface GitResult {
	exitCode: number;
	stdout: string;
	stderr: string;
}

/** Execute Git without a shell so all callers pass command arguments as data. */
export async function runGit(cwd: string, args: string[]): Promise<GitResult> {
	const child = Bun.spawn(["git", "--no-pager", ...args], {
		cwd,
		stdout: "pipe",
		stderr: "pipe",
		env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" },
	});
	const [exitCode, stdout, stderr] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);
	return { exitCode, stdout, stderr };
}
