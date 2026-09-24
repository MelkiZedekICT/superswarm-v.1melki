import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendTaskJournal } from "./journal.ts";

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
});
