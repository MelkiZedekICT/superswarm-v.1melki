import { appendFile, mkdir, open } from "node:fs/promises";
import { join } from "node:path";

const READ_CHUNK_BYTES = 64 * 1024;

export interface TaskJournalEntry {
	taskId: string;
	status: "completed" | "failed";
	instruction: string;
	model: string;
	modelDigest?: string;
	scope?: string[];
	startedAt: string;
	completedAt: string;
	durationMs?: number;
	branch: string;
	worktree?: string;
	commit: string | null;
	changedFiles: string[];
	quality?: unknown;
	error: string | null;
	stderr?: string | null;
}

export async function appendTaskJournal(root: string, entry: object): Promise<void> {
	const directory = join(root, ".overstory");
	await mkdir(directory, { recursive: true });
	await appendFile(join(directory, "task-journal.jsonl"), `${JSON.stringify(entry)}\n`, "utf8");
}

export async function readTaskHistory(root: string, limit = 10): Promise<TaskJournalEntry[]> {
	if (!Number.isInteger(limit) || limit < 1 || limit > 100)
		throw new Error("History limit must be an integer from 1 to 100.");
	const path = join(root, ".overstory", "task-journal.jsonl");
	let handle: Awaited<ReturnType<typeof open>>;
	try {
		handle = await open(path, "r");
	} catch (cause) {
		if ((cause as NodeJS.ErrnoException).code === "ENOENT") return [];
		throw cause;
	}
	try {
		const { size } = await handle.stat();
		let position = size;
		let lineCount = 0;
		const chunks: Buffer[] = [];
		while (position > 0 && lineCount <= limit) {
			const bytes = Math.min(READ_CHUNK_BYTES, position);
			position -= bytes;
			const buffer = Buffer.allocUnsafe(bytes);
			await handle.read(buffer, 0, bytes, position);
			chunks.unshift(buffer);
			for (const byte of buffer) if (byte === 10) lineCount++;
		}
		return Buffer.concat(chunks)
			.toString("utf8")
			.trim()
			.split("\n")
			.slice(-limit)
			.reverse()
			.flatMap((line) => {
				try {
					return [JSON.parse(line) as TaskJournalEntry];
				} catch {
					return [];
				}
			});
	} finally {
		await handle.close();
	}
}
