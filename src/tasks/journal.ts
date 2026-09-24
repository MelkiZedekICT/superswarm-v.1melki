import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export async function appendTaskJournal(root: string, entry: object): Promise<void> {
	const directory = join(root, ".overstory");
	await mkdir(directory, { recursive: true });
	await appendFile(join(directory, "task-journal.jsonl"), `${JSON.stringify(entry)}\n`, "utf8");
}
