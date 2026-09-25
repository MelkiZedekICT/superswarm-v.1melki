import { mkdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import type { TaskJournalEntry } from "./journal.ts";

export async function exportTaskEvidence(
	root: string,
	entry: TaskJournalEntry,
	output: string,
): Promise<string> {
	const target = resolve(root, output);
	const projectRelative = relative(root, target).replaceAll("\\", "/");
	if (
		projectRelative === "" ||
		projectRelative === ".." ||
		projectRelative.startsWith("../") ||
		projectRelative === ".git" ||
		projectRelative.startsWith(".git/")
	)
		throw new Error("Task evidence output must be a file inside the project.");
	await mkdir(dirname(target), { recursive: true });
	await Bun.write(
		target,
		`${JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), task: entry }, null, 2)}\n`,
	);
	return target;
}
