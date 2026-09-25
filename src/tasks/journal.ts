import { createReadStream } from "node:fs";
import { appendFile, mkdir, open } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";

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
	timeoutMinutes?: number;
	branch: string;
	worktree?: string;
	commit: string | null;
	changedFiles: string[];
	quality?: unknown;
	error: string | null;
	stderr?: string | null;
}

export interface TaskHistoryQuery {
	limit?: number;
	status?: TaskJournalEntry["status"];
	model?: string;
	since?: string;
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

export async function findTaskJournalEntry(
	root: string,
	taskId: string,
): Promise<TaskJournalEntry | null> {
	const path = join(root, ".overstory", "task-journal.jsonl");
	try {
		await open(path, "r").then((handle) => handle.close());
	} catch (cause) {
		if ((cause as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw cause;
	}
	let match: TaskJournalEntry | null = null;
	const lines = createInterface({
		input: createReadStream(path),
		crlfDelay: Number.POSITIVE_INFINITY,
	});
	for await (const line of lines) {
		try {
			const entry = JSON.parse(line) as TaskJournalEntry;
			if (entry.taskId === taskId) match = entry;
		} catch {
			// A partial or corrupt record does not hide valid journal entries.
		}
	}
	return match;
}

export async function queryTaskHistory(
	root: string,
	query: TaskHistoryQuery = {},
): Promise<TaskJournalEntry[]> {
	const limit = query.limit ?? 10;
	if (!Number.isInteger(limit) || limit < 1 || limit > 100)
		throw new Error("History limit must be an integer from 1 to 100.");
	const path = join(root, ".overstory", "task-journal.jsonl");
	if (!(await Bun.file(path).exists())) return [];
	const matches: TaskJournalEntry[] = [];
	const lines = createInterface({
		input: createReadStream(path),
		crlfDelay: Number.POSITIVE_INFINITY,
	});
	for await (const line of lines) {
		try {
			const entry = JSON.parse(line) as TaskJournalEntry;
			if (query.status && entry.status !== query.status) continue;
			if (query.model && entry.model !== query.model) continue;
			if (query.since && entry.completedAt < query.since) continue;
			matches.push(entry);
			if (matches.length > limit) matches.shift();
		} catch {
			// Ignore an incomplete record while retaining valid history.
		}
	}
	return matches.reverse();
}
