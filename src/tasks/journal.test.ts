import { afterEach, describe, expect, test } from "bun:test";
import { appendFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	appendTaskJournal,
	findTaskJournalEntry,
	queryTaskHistory,
	readTaskHistory,
	readTaskStatistics,
	verifyTaskJournal,
} from "./journal.ts";

let root = "";

afterEach(async () => {
	if (root) await rm(root, { recursive: true, force: true });
});

describe("task journal", () => {
	test("appends entries without replacing prior evidence", async () => {
		root = await mkdtemp(join(tmpdir(), "superswarm-journal-"));
		await appendTaskJournal(root, { taskId: "first" });
		await appendTaskJournal(root, { taskId: "second" });
		const lines = (await Bun.file(join(root, ".overstory", "task-journal.jsonl")).text())
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line));
		expect(lines).toEqual([{ taskId: "first" }, { taskId: "second" }]);
	});

	test("reads only the newest requested task entries", async () => {
		root = await mkdtemp(join(tmpdir(), "superswarm-history-"));
		for (const taskId of ["first", "second", "third"]) {
			await appendTaskJournal(root, {
				taskId,
				status: "failed",
				instruction: taskId,
				model: "local",
				startedAt: "2026-09-24T00:00:00Z",
				completedAt: "2026-09-24T00:00:01Z",
				branch: taskId,
				commit: null,
				changedFiles: [],
				error: "fixture",
			});
		}
		const entries = await readTaskHistory(root, 2);
		expect(entries.map((entry) => entry.taskId)).toEqual(["third", "second"]);
	});

	test("validates the requested history limit", async () => {
		root = await mkdtemp(join(tmpdir(), "superswarm-history-"));
		expect(readTaskHistory(root, 0)).rejects.toThrow("1 to 100");
	});

	test("preserves launch metadata used for inspection and retry", async () => {
		root = await mkdtemp(join(tmpdir(), "superswarm-journal-metadata-"));
		await appendTaskJournal(root, {
			taskId: "task-1",
			status: "completed",
			instruction: "Update the greeting",
			model: "qwen",
			modelDigest: "sha256:abc",
			scope: ["src/greeting.ts"],
			startedAt: "2026-09-25T00:00:00Z",
			completedAt: "2026-09-25T00:00:02Z",
			durationMs: 2000,
			branch: "task-1",
			worktree: "worktrees/task-1",
			commit: "abc",
			changedFiles: ["src/greeting.ts"],
			error: null,
		});
		const [entry] = await readTaskHistory(root, 1);
		expect(entry?.scope).toEqual(["src/greeting.ts"]);
		expect(entry?.durationMs).toBe(2000);
		expect(entry?.modelDigest).toBe("sha256:abc");
	});

	test("finds a task without limiting lookup to recent history", async () => {
		root = await mkdtemp(join(tmpdir(), "superswarm-find-task-"));
		for (let index = 0; index < 120; index++)
			await appendTaskJournal(root, { taskId: `task-${index}`, instruction: `item ${index}` });
		expect((await findTaskJournalEntry(root, "task-2"))?.instruction).toBe("item 2");
		expect(await findTaskJournalEntry(root, "missing")).toBeNull();
	});

	test("filters history by completion status before applying the limit", async () => {
		root = await mkdtemp(join(tmpdir(), "superswarm-filter-history-"));
		for (const [taskId, status] of [
			["one", "failed"],
			["two", "completed"],
			["three", "failed"],
		] as const)
			await appendTaskJournal(root, { taskId, status });
		const entries = await queryTaskHistory(root, { limit: 2, status: "failed" });
		expect(entries.map((entry) => entry.taskId)).toEqual(["three", "one"]);
	});

	test("filters history by exact model tag", async () => {
		root = await mkdtemp(join(tmpdir(), "superswarm-filter-model-"));
		await appendTaskJournal(root, { taskId: "small", model: "qwen:1.5b" });
		await appendTaskJournal(root, { taskId: "large", model: "qwen:7b" });
		const entries = await queryTaskHistory(root, { model: "qwen:7b" });
		expect(entries.map((entry) => entry.taskId)).toEqual(["large"]);
	});

	test("filters history by completion date", async () => {
		root = await mkdtemp(join(tmpdir(), "superswarm-filter-date-"));
		await appendTaskJournal(root, {
			taskId: "old",
			completedAt: "2026-09-24T23:59:59.000Z",
		});
		await appendTaskJournal(root, {
			taskId: "today",
			completedAt: "2026-09-25T00:00:00.000Z",
		});
		const entries = await queryTaskHistory(root, { since: "2026-09-25T00:00:00.000Z" });
		expect(entries.map((entry) => entry.taskId)).toEqual(["today"]);
	});

	test("summarizes outcomes, duration, and model usage", async () => {
		root = await mkdtemp(join(tmpdir(), "superswarm-task-stats-"));
		await appendTaskJournal(root, {
			taskId: "one",
			status: "completed",
			model: "qwen",
			durationMs: 100,
		});
		await appendTaskJournal(root, {
			taskId: "two",
			status: "failed",
			model: "qwen",
			durationMs: 300,
		});
		expect(await readTaskStatistics(root)).toEqual({
			total: 2,
			completed: 1,
			failed: 1,
			successRate: 0.5,
			averageDurationMs: 200,
			models: { qwen: 2 },
		});
	});

	test("reports malformed, duplicate, and incomplete task evidence", async () => {
		root = await mkdtemp(join(tmpdir(), "superswarm-verify-journal-"));
		await appendTaskJournal(root, { taskId: "duplicate" });
		await appendTaskJournal(root, { taskId: "duplicate" });
		await appendFile(join(root, ".overstory", "task-journal.jsonl"), '{"taskId":\n');
		const report = await verifyTaskJournal(root);
		expect(report.valid).toBe(false);
		expect(report.malformedLines).toEqual([3]);
		expect(report.duplicateTaskIds).toEqual(["duplicate"]);
		expect(report.invalidRecords).toHaveLength(2);
	});
});
