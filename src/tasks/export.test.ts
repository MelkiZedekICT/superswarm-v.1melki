import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportTaskEvidence } from "./export.ts";

let root = "";
const entry = {
	taskId: "task-1",
	status: "completed" as const,
	instruction: "change one file",
	model: "local",
	startedAt: "2026-09-25T00:00:00Z",
	completedAt: "2026-09-25T00:00:01Z",
	branch: "task-1",
	commit: "abc",
	changedFiles: ["src/a.ts"],
	error: null,
};

afterEach(async () => {
	if (root) await rm(root, { recursive: true, force: true });
});

describe("task evidence export", () => {
	test("writes a versioned portable report inside the project", async () => {
		root = await mkdtemp(join(tmpdir(), "superswarm-export-"));
		const output = await exportTaskEvidence(root, entry, "reports/task-1.json");
		const report = await Bun.file(output).json();
		expect(report.schemaVersion).toBe(1);
		expect(report.task.taskId).toBe("task-1");
	});

	test("rejects output outside the project", async () => {
		root = await mkdtemp(join(tmpdir(), "superswarm-export-"));
		expect(exportTaskEvidence(root, entry, "../task.json")).rejects.toThrow("inside");
	});
});
