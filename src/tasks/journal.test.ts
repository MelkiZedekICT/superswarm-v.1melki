import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendTaskJournal, readTaskHistory } from "./journal.ts";

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
});
