import { describe, expect, test } from "bun:test";
import type { TaskJournalEntry } from "./journal.ts";
import { taskRetryInput } from "./retry.ts";

const entry = {
	taskId: "task-1",
	status: "failed",
	instruction: "Fix the greeting",
	model: "qwen:7b",
	scope: ["src/a.ts", "src/b.ts"],
	startedAt: "2026-09-25T00:00:00Z",
	completedAt: "2026-09-25T00:00:01Z",
	branch: "task-1",
	commit: null,
	changedFiles: [],
	error: "model stopped",
} satisfies TaskJournalEntry;

describe("task retry", () => {
	test("reuses the original instruction, model, and scope", () => {
		expect(taskRetryInput(entry)).toEqual({
			instruction: "Fix the greeting",
			files: "src/a.ts,src/b.ts",
			model: "qwen:7b",
		});
	});

	test("refuses legacy records without a recoverable scope", () => {
		expect(() => taskRetryInput({ ...entry, scope: undefined })).toThrow("predates");
	});
});
