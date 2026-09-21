import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evaluateLocalToolCall, withinWorktree } from "./local/policy.ts";
import { assertLocalUrl } from "./local/transport.ts";
import { compactLocalInstructions, LocalRuntime } from "./local.ts";
import type { HooksDef } from "./types.ts";

describe("LocalRuntime", () => {
	test("refuses legacy cloud aliases until a local model is configured", () => {
		expect(() =>
			new LocalRuntime().buildDirectSpawn({
				cwd: process.cwd(),
				env: {},
				model: "sonnet",
				instructionPath: "AGENTS.md",
			}),
		).toThrow("No qualified local model is assigned");
	});

	test("rejects cloud tags and passes no remote credentials", () => {
		const runtime = new LocalRuntime();
		expect(() => runtime.buildPrintCommand("x", "qwen3-coder:cloud")).toThrow(
			"Invalid local model",
		);
		expect(runtime.buildEnv({ model: "qwen2.5:1.5b", isExplicitOverride: true })).toEqual({
			OLLAMA_NO_CLOUD: "1",
		});
	});

	test("keeps the stream parser bound when the turn runner passes it as a callback", async () => {
		const runtime = new LocalRuntime();
		const parse = runtime.parseEvents;
		const stream = new Blob([
			'{"type":"system","subtype":"init","session_id":"11111111-1111-1111-1111-111111111111"}\n',
		]).stream();
		let sessionId = "";
		const events = [];
		for await (const event of parse(stream, { onSessionId: (id) => (sessionId = id) })) {
			events.push(event);
		}
		expect(sessionId).toBe("11111111-1111-1111-1111-111111111111");
		expect(events[0]?.type).toBe("status");
	});

	test("compiles the large upstream overlay into a small-model assignment", () => {
		const prompt = compactLocalInstructions(
			[
				"## Your Assignment",
				"- **Task ID:** task-1",
				"- **Spec:** C:\\\\repo\\\\TASK.md",
				"- **Branch:** overstory/builder/task-1",
				"- **Parent:** operator",
				"## File Scope (exclusive ownership)",
				"- `src/a.ts`",
				"- `src/a.test.ts`",
				"## Expertise",
			].join("\n"),
			{
				agentName: "builder-1",
				capability: "builder",
				worktreePath: "C:\\\\repo",
				qualityGates: [{ name: "Tests", command: "bun test", description: "tests pass" }],
			},
			"Change the greeting and its test.",
		);
		expect(prompt).toContain("Task: task-1");
		expect(prompt).toContain("src/a.ts, src/a.test.ts");
		expect(prompt).toContain("Quality gate: bun test");
		expect(prompt).toContain("Task specification:\nChange the greeting and its test.");
		expect(prompt).toContain("--type worker_done");
		expect(prompt.length).toBeLessThan(1000);
	});
});

describe("local inference boundary", () => {
	test("accepts only the fixed loopback Ollama origin", () => {
		expect(assertLocalUrl("http://127.0.0.1:11434/v1/chat/completions").pathname).toBe(
			"/v1/chat/completions",
		);
		for (const url of [
			"http://localhost:11434/v1/chat/completions",
			"http://127.0.0.1:8080/v1/chat/completions",
			"https://127.0.0.1:11434/v1/chat/completions",
			"http://user:password@127.0.0.1:11434/v1/chat/completions",
		]) {
			expect(() => assertLocalUrl(url)).toThrow("Remote inference is disabled");
		}
	});
});

describe("local tool policy", () => {
	test("keeps edits in the worktree and protects orchestration metadata", () => {
		const root = mkdtempSync(join(tmpdir(), "superswarm-local-policy-"));
		try {
			mkdirSync(join(root, ".overstory"));
			const hooks: HooksDef = { agentName: "builder-1", capability: "builder", worktreePath: root };
			expect(withinWorktree(root, "src/new.ts")).toBe(true);
			expect(withinWorktree(root, join(root, "..", "outside.ts"))).toBe(false);
			expect(evaluateLocalToolCall(hooks, "write", { path: "src/new.ts" })).toBeUndefined();
			expect(evaluateLocalToolCall(hooks, "write", { path: ".overstory/config.yaml" })?.block).toBe(
				true,
			);
			expect(
				evaluateLocalToolCall(hooks, "edit", { path: join(root, "..", "outside.ts") })?.block,
			).toBe(true);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});

	test("reviewers cannot edit but may send coordination mail", () => {
		const root = mkdtempSync(join(tmpdir(), "superswarm-review-policy-"));
		try {
			const hooks: HooksDef = {
				agentName: "reviewer-1",
				capability: "reviewer",
				worktreePath: root,
			};
			expect(evaluateLocalToolCall(hooks, "write", { path: "review.txt" })?.block).toBe(true);
			expect(evaluateLocalToolCall(hooks, "bash", { command: "rm -rf src" })?.block).toBe(true);
			expect(
				evaluateLocalToolCall(hooks, "bash", { command: "ov mail send --to lead --body done" }),
			).toBeUndefined();
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});
