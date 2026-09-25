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

export interface TaskStatistics {
	total: number;
	completed: number;
	failed: number;
	successRate: number;
	averageDurationMs: number | null;
	models: Record<string, number>;
}

export interface TaskJournalIntegrity {
	valid: boolean;
	entries: number;
	malformedLines: number[];
	duplicateTaskIds: string[];
	invalidRecords: Array<{ line: number; reason: string }>;
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

export async function readTaskStatistics(root: string): Promise<TaskStatistics> {
	const path = join(root, ".overstory", "task-journal.jsonl");
	const statistics: TaskStatistics = {
		total: 0,
		completed: 0,
		failed: 0,
		successRate: 0,
		averageDurationMs: null,
		models: {},
	};
	if (!(await Bun.file(path).exists())) return statistics;
	let durationTotal = 0;
	let durationCount = 0;
	const lines = createInterface({
		input: createReadStream(path),
		crlfDelay: Number.POSITIVE_INFINITY,
	});
	for await (const line of lines) {
		try {
			const entry = JSON.parse(line) as TaskJournalEntry;
			statistics.total++;
			if (entry.status === "completed") statistics.completed++;
			if (entry.status === "failed") statistics.failed++;
			if (entry.model) statistics.models[entry.model] = (statistics.models[entry.model] ?? 0) + 1;
			if (typeof entry.durationMs === "number") {
				durationTotal += entry.durationMs;
				durationCount++;
			}
		} catch {
			// Malformed lines are excluded from operational statistics.
		}
	}
	statistics.successRate =
		statistics.total === 0 ? 0 : Number((statistics.completed / statistics.total).toFixed(4));
	statistics.averageDurationMs =
		durationCount === 0 ? null : Math.round(durationTotal / durationCount);
	return statistics;
}

export async function verifyTaskJournal(root: string): Promise<TaskJournalIntegrity> {
	const path = join(root, ".overstory", "task-journal.jsonl");
	const report: TaskJournalIntegrity = {
		valid: true,
		entries: 0,
		malformedLines: [],
		duplicateTaskIds: [],
		invalidRecords: [],
	};
	if (!(await Bun.file(path).exists())) return report;
	const seen = new Set<string>();
	const duplicates = new Set<string>();
	const lines = createInterface({
		input: createReadStream(path),
		crlfDelay: Number.POSITIVE_INFINITY,
	});
	let lineNumber = 0;
	for await (const line of lines) {
		lineNumber++;
		let entry: Partial<TaskJournalEntry>;
		try {
			entry = JSON.parse(line) as Partial<TaskJournalEntry>;
		} catch {
			report.malformedLines.push(lineNumber);
			continue;
		}
		report.entries++;
		const requiredStrings = [
			"taskId",
			"status",
			"instruction",
			"model",
			"startedAt",
			"completedAt",
			"branch",
		] as const;
		const missing: string[] = requiredStrings.filter(
			(field) => typeof entry[field] !== "string" || entry[field]?.length === 0,
		);
		if (!Array.isArray(entry.changedFiles)) missing.push("changedFiles");
		if (missing.length > 0)
			report.invalidRecords.push({
				line: lineNumber,
				reason: `Missing or invalid: ${missing.join(", ")}`,
			});
		if (entry.taskId) {
			if (seen.has(entry.taskId)) duplicates.add(entry.taskId);
			seen.add(entry.taskId);
		}
	}
	report.duplicateTaskIds = [...duplicates].sort();
	report.valid =
		report.malformedLines.length === 0 &&
		report.duplicateTaskIds.length === 0 &&
		report.invalidRecords.length === 0;
	return report;
}
