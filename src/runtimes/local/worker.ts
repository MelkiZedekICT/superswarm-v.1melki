/** Pi SDK tools with a fixed, local Ollama provider and Overstory stream-json transport. */
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
	createAgentSession,
	DefaultResourceLoader,
	ModelRuntime,
	SessionManager,
	SettingsManager,
} from "@earendil-works/pi-coding-agent";
import type { HooksDef } from "../types.ts";
import { localPolicy } from "./policy.ts";
import { assertQualifiedLocalModel, localProjectRoot } from "./qualification.ts";
import { localFetch } from "./transport.ts";

const { values } = parseArgs({
	args: process.argv.slice(2),
	options: { model: { type: "string" }, resume: { type: "string" }, print: { type: "string" } },
});
const modelName = values.model;
const print = values.print !== undefined;
const emit = (event: object) => process.stdout.write(`${JSON.stringify(event)}\n`);

async function main() {
	if (!modelName || modelName.includes("cloud"))
		throw new Error("An installed local model is required.");
	// Enforce the boundary for SDK requests as well as preflight, including redirects.
	globalThis.fetch = localFetch(globalThis.fetch);
	const check = await fetch("http://127.0.0.1:11434/api/show", {
		method: "POST",
		body: JSON.stringify({ model: modelName }),
		headers: { "Content-Type": "application/json" },
		signal: AbortSignal.timeout(10000),
	});
	if (!check.ok)
		throw new Error(`Local model unavailable: ${modelName}. Install it in Ollama first.`);
	const info = (await check.json()) as Record<string, unknown>;
	if (info.remote_model || info.remote_host) throw new Error("Ollama cloud models are disabled.");
	const cwd = process.cwd();
	if (process.env.SUPERSWARM_QUALIFICATION !== "1") {
		await assertQualifiedLocalModel(await localProjectRoot(cwd), modelName);
	}
	const state = join(cwd, ".superswarm");
	await mkdir(join(state, "sessions"), { recursive: true });
	const modelRuntime = await ModelRuntime.create({
		authPath: join(state, "auth.json"),
		modelsPath: null,
		modelsStorePath: join(state, "models-cache.json"),
		allowModelNetwork: false,
		refreshOnCreate: false,
	});
	modelRuntime.registerProvider("superswarm-local", {
		baseUrl: "http://127.0.0.1:11434/v1",
		apiKey: "local-only",
		api: "openai-completions",
		models: [
			{
				id: modelName,
				name: modelName,
				reasoning: false,
				input: ["text"],
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				contextWindow: 8192,
				maxTokens: 2048,
				compat: {
					supportsDeveloperRole: false,
					supportsStore: false,
					supportsReasoningEffort: false,
				},
			},
		],
	});
	const model = modelRuntime.getModel("superswarm-local", modelName);
	if (!model) throw new Error("Local model registration failed.");
	let hooks: HooksDef | undefined;
	if (!print) hooks = await Bun.file(join(state, "agent.json")).json();
	const settingsManager = SettingsManager.inMemory({
		compaction: { enabled: false },
		retry: { enabled: false },
	});
	const resourceLoader = new DefaultResourceLoader({
		cwd,
		agentDir: state,
		settingsManager,
		noExtensions: true,
		noSkills: true,
		noPromptTemplates: true,
		noThemes: true,
		noContextFiles: true,
		extensionFactories: hooks ? [localPolicy(hooks)] : [],
		appendSystemPrompt: hooks ? [await Bun.file(join(cwd, "AGENTS.md")).text()] : [],
	});
	await resourceLoader.reload();
	let sessionManager = SessionManager.create(cwd, join(state, "sessions"));
	if (values.resume) {
		if (!/^[a-f0-9-]{36}$/.test(values.resume)) throw new Error("Invalid session ID.");
		const files = await readdir(join(state, "sessions"));
		const file = files.find((name) => name.endsWith(`_${values.resume}.jsonl`));
		if (!file)
			throw new Error("Local session missing; refusing to silently discard conversation history.");
		sessionManager = SessionManager.open(join(state, "sessions", file));
	}
	const { session, extensionsResult } = await createAgentSession({
		cwd,
		agentDir: state,
		modelRuntime,
		model,
		sessionManager,
		settingsManager,
		resourceLoader,
		thinkingLevel: "off",
		tools: print ? [] : ["read", "bash", "edit", "write", "ls", "find", "grep"],
	});
	if (extensionsResult.errors.length) throw new Error("Local agent guard failed to load.");
	await session.bindExtensions({});
	const sessionId = session.sessionId;
	if (!print) emit({ type: "system", subtype: "init", session_id: sessionId });
	let failed = false;
	let terminalSignal = false;
	const terminalToolCalls = new Set<string>();
	session.subscribe((event) => {
		if (event.type === "message_end" && event.message.role === "assistant") {
			const message = event.message;
			failed ||= message.stopReason === "error" || message.stopReason === "aborted";
			const content = message.content.flatMap((block) => {
				if (block.type === "text")
					return [{ type: "text", text: block.text } as Record<string, unknown>];
				if (block.type === "toolCall")
					return [{ type: "tool_use", id: block.id, name: block.name, input: block.arguments }];
				return [];
			});
			if (print) {
				for (const block of message.content)
					if (block.type === "text") process.stdout.write(block.text);
			} else
				emit({
					type: "assistant",
					session_id: sessionId,
					message: {
						content,
						model: modelName,
						usage: { input_tokens: message.usage.input, output_tokens: message.usage.output },
					},
				});
			if (message.errorMessage) process.stderr.write(`${message.errorMessage}\n`);
		}
		if (!print && event.type === "tool_execution_end") {
			if (terminalToolCalls.has(event.toolCallId)) {
				terminalToolCalls.delete(event.toolCallId);
				if (event.isError) failed = true;
				else terminalSignal = true;
			}
			emit({
				type: "user",
				session_id: sessionId,
				message: {
					content: [
						{
							type: "tool_result",
							tool_use_id: event.toolCallId,
							content: event.result.content,
							is_error: event.isError,
						},
					],
				},
			});
		}
		if (!print && event.type === "tool_execution_start" && event.toolName === "bash") {
			const command =
				typeof event.args === "object" && event.args !== null && "command" in event.args
					? String((event.args as { command: unknown }).command)
					: "";
			if (
				/\bov mail send\b[\s\S]*--type (worker_done|result|merged|merge_failed)\b/.test(command)
			) {
				terminalToolCalls.add(event.toolCallId);
			}
		}
	});
	const run = async (text: string) => {
		failed = false;
		terminalSignal = false;
		terminalToolCalls.clear();
		const started = Date.now();
		const timeout = setTimeout(() => {
			failed = true;
			void session.abort();
		}, 300000);
		try {
			await session.prompt(text);
			if (!print && process.env.SUPERSWARM_QUALIFICATION !== "1") {
				for (let attempt = 1; attempt <= 5 && !failed && !terminalSignal; attempt++) {
					await session.prompt(
						"Continue the assigned task now. Use tools and complete the remaining edits, checks, commit, and terminal mail. Do not describe future actions.",
					);
				}
				if (!terminalSignal) failed = true;
			}
			if (!print)
				emit({
					type: "result",
					session_id: sessionId,
					is_error: failed,
					result: failed ? "Local agent failed; inspect the error log." : "Turn finished.",
					duration_ms: Date.now() - started,
				});
			if (failed) process.exitCode = 1;
		} finally {
			clearTimeout(timeout);
		}
	};
	try {
		if (print) await run(values.print ?? "");
		else {
			let buffer = "";
			const decoder = new TextDecoder();
			for await (const chunk of Bun.stdin.stream()) {
				buffer += decoder.decode(chunk, { stream: true });
				let newline = buffer.indexOf("\n");
				while (newline >= 0) {
					const line = buffer.slice(0, newline).trim();
					buffer = buffer.slice(newline + 1);
					if (line) {
						const input = JSON.parse(line) as {
							type: string;
							message?: { content?: Array<{ type: string; text?: string }> };
						};
						if (input.type !== "user") throw new Error("Expected a user turn.");
						await run(
							input.message?.content
								?.filter((b) => b.type === "text")
								.map((b) => b.text ?? "")
								.join("\n") ?? "",
						);
					}
					newline = buffer.indexOf("\n");
				}
			}
		}
	} finally {
		session.dispose();
	}
}

main().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	process.stderr.write(`Superswarm local agent: ${message}\n`);
	if (process.env.SUPERSWARM_DEBUG === "1" && error instanceof Error && error.stack) {
		process.stderr.write(`${error.stack}\n`);
	}
	if (!print) emit({ type: "result", is_error: true, result: message });
	process.exitCode = 1;
});
