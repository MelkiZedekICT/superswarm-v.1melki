import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ResolvedModel } from "../types.ts";
import { ClaudeRuntime } from "./claude.ts";
import type {
	AgentRuntime,
	DirectSpawnOpts,
	HooksDef,
	OverlayContent,
	ReadyState,
	SpawnOpts,
} from "./types.ts";

export const DEFAULT_LOCAL_MODEL = "qwen2.5:1.5b";

function overlayField(content: string, label: string): string | undefined {
	const match = content.match(new RegExp(`^- \\*\\*${label}:\\*\\*\\s*(.+)$`, "m"));
	return match?.[1]?.trim();
}

export function compactLocalInstructions(
	content: string,
	hooks: HooksDef,
	specContent?: string,
): string {
	const taskId = overlayField(content, "Task ID") ?? "the assigned task";
	const spec = overlayField(content, "Spec");
	const parent = overlayField(content, "Parent") ?? "operator";
	const branch = overlayField(content, "Branch");
	const scopeSection = content.match(/## File Scope[^\n]*\n([\s\S]*?)(?=\n## )/)?.[1] ?? "";
	const files = [...scopeSection.matchAll(/^- `([^`]+)`$/gm)].map((match) => match[1]);
	const mayWrite = ["builder", "merger"].includes(hooks.capability);
	const terminalType = hooks.capability === "merger" ? "merged" : "worker_done";
	const lines = [
		`You are Superswarm agent ${hooks.agentName} with role ${hooks.capability}.`,
		`Task: ${taskId}. Work immediately; use tools instead of only explaining.`,
	];
	if (spec) lines.push(`First read the task specification at: ${spec}`);
	if (specContent) lines.push(`Task specification:\n${specContent.trim()}`);
	if (files.length) lines.push(`You may modify only: ${files.join(", ")}.`);
	if (!mayWrite) lines.push("This role is read-only. Inspect and report; do not edit files.");
	if (branch) lines.push(`Stay on branch ${branch}; never push.`);
	if (mayWrite) {
		lines.push("Make the requested edits, then run the relevant tests.");
		for (const gate of hooks.qualityGates ?? []) lines.push(`Quality gate: ${gate.command}`);
		lines.push("Commit only the assigned files when the checks pass.");
	}
	lines.push(
		`Your final action must be: ov mail send --to ${parent} --subject "Done: ${taskId}" --body "Summarize changes and checks." --type ${terminalType} --agent ${hooks.agentName}`,
		"If blocked, send an error mail to the same parent. Do not claim success without evidence.",
	);
	return `${lines.join("\n")}\n`;
}

/** Local inference only. The worker rejects remote inference and cloud model tags. */
export class LocalRuntime implements AgentRuntime {
	readonly id = "local";
	readonly stability = "experimental" as const;
	readonly headless = true;
	readonly instructionPath = "AGENTS.md";
	private readonly events = new ClaudeRuntime();
	private readonly worker = fileURLToPath(new URL("./local/worker.ts", import.meta.url));

	buildSpawnCommand(_opts: SpawnOpts): string {
		throw new Error(
			"Superswarm local agents use the headless console. Start with superswarm serve.",
		);
	}

	buildDirectSpawn(opts: DirectSpawnOpts): string[] {
		const argv = [process.execPath, this.worker, "--model", this.model(opts.model)];
		argv.push("--instructions", opts.instructionPath);
		if (opts.resumeSessionId) argv.push("--resume", opts.resumeSessionId);
		return argv;
	}

	buildPrintCommand(prompt: string, model?: string): string[] {
		return [process.execPath, this.worker, "--model", this.model(model), "--print", prompt];
	}

	private model(model?: string): string {
		if (!model || ["sonnet", "opus", "haiku"].includes(model)) {
			throw new Error(
				"No qualified local model is assigned. Run `superswarm local qualify --model TAG`, then `superswarm local configure --model TAG`.",
			);
		}
		const name = model;
		if (name.includes("cloud") || !/^[a-zA-Z0-9_.:/-]+$/.test(name)) {
			throw new Error(`Invalid local model: ${name}`);
		}
		return name;
	}

	async deployConfig(worktreePath: string, overlay: OverlayContent | undefined, hooks: HooksDef) {
		await mkdir(join(worktreePath, ".superswarm"), { recursive: true });
		const instructionFile = Bun.file(join(worktreePath, this.instructionPath));
		const source =
			overlay?.content ?? ((await instructionFile.exists()) ? await instructionFile.text() : null);
		if (source) {
			const specPath = overlayField(source, "Spec");
			const specFile = specPath ? Bun.file(specPath) : null;
			const specContent =
				specFile && (await specFile.exists()) ? (await specFile.text()).slice(0, 16000) : undefined;
			await Bun.write(
				join(worktreePath, this.instructionPath),
				compactLocalInstructions(source, hooks, specContent),
			);
		}
		await Bun.write(join(worktreePath, ".superswarm", "agent.json"), JSON.stringify(hooks));
	}

	detectReady(): ReadyState {
		return { phase: "ready" };
	}
	requiresBeaconVerification() {
		return false;
	}
	async parseTranscript(_path: string) {
		return null;
	}
	getTranscriptDir(projectRoot: string) {
		return join(projectRoot, ".superswarm", "sessions");
	}
	buildEnv(_model: ResolvedModel): Record<string, string> {
		return { OLLAMA_NO_CLOUD: "1" };
	}
	parseEvents = (
		stream: ReadableStream<Uint8Array>,
		opts?: { onSessionId?: (sessionId: string) => void },
	) => this.events.parseEvents(stream, opts);
}
