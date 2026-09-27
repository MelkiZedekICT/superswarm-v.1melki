import { resolve, sep } from "node:path";
import { runGit, type GitResult } from "../../../git/process.ts";

export { runGit, type GitResult };

export class GitCommandError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "GitCommandError";
	}
}

export async function runGitChecked(cwd: string, args: string[]): Promise<string> {
	const result = await runGit(cwd, args);
	if (result.exitCode !== 0)
		throw new GitCommandError(result.stderr.trim() || `git ${args[0] ?? "command"} failed.`);
	return result.stdout;
}

/** Accept only a path relative to the selected repository root. */
export function resolveRepoPath(root: string, input: string): string {
	if (input.length === 0 || input.includes("\0"))
		throw new GitCommandError("A file path is required.");
	const normalized = input.replaceAll("\\", "/");
	if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized))
		throw new GitCommandError("Git file paths must be relative to the repository.");
	const segments = normalized.split("/");
	if (segments.some((segment) => segment === ".." || segment.toLowerCase() === ".git"))
		throw new GitCommandError("Git file path is outside the allowed repository area.");
	const absoluteRoot = resolve(root);
	const absolutePath = resolve(absoluteRoot, normalized);
	if (!absolutePath.startsWith(`${absoluteRoot}${sep}`))
		throw new GitCommandError("Git file path is outside the repository.");
	return normalized;
}
