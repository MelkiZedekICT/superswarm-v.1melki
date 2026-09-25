import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { loadConfig } from "../config.ts";
import { runQualityGates } from "../insights/quality-gates.ts";
import { qualifiedLocalModel } from "../runtimes/local/qualification.ts";
import { LocalRuntime } from "../runtimes/local.ts";
import { createWorktree } from "../worktree/manager.ts";
import {
	assessTaskEvidence,
	isFileInTaskScope,
	normalizeTaskScope,
	streamHasCleanResult,
} from "./evidence.ts";
import { commitTaskChanges, currentBranch, listTaskChanges } from "./git.ts";
import { appendTaskJournal } from "./journal.ts";

export interface VerifiedTaskOptions {
	files: string;
	model?: string;
	json?: boolean;
}

function taskInstructions(agentName: string, scope: string[]): string {
	return [
		`You are Superswarm builder ${agentName}. Work immediately using tools.`,
		`Change only: ${scope.join(", ")}. A path ending / includes children.`,
		"For a whole-file replacement, call the write tool with the complete final content.",
		"Never print or describe a shell command instead of calling the bash tool.",
		"Do not change .git, .overstory, or .superswarm. Do not commit; Superswarm verifies and commits.",
		"Finish only after making the requested change and checking it.",
	].join("\n");
}

async function prepareAgentState(
	path: string,
	agentName: string,
	scope: string[],
	qualityGates: unknown,
) {
	const state = join(path, ".superswarm");
	await mkdir(state, { recursive: true });
	const instructions = join(state, "task.md");
	await Bun.write(instructions, taskInstructions(agentName, scope));
	await Bun.write(
		join(state, "agent.json"),
		JSON.stringify({ agentName, capability: "builder", worktreePath: path, qualityGates }),
	);
	return instructions;
}

async function executeAgent(
	path: string,
	root: string,
	model: string,
	instructions: string,
	instruction: string,
) {
	const runtime = new LocalRuntime();
	const child = Bun.spawn(
		runtime.buildDirectSpawn({
			cwd: path,
			env: {},
			model,
			instructionPath: relative(path, instructions),
		}),
		{
			cwd: path,
			env: {
				...process.env,
				OLLAMA_NO_CLOUD: "1",
				OVERSTORY_PROJECT_ROOT: root,
				SUPERSWARM_TASK_MODE: "1",
			},
			stdin: "pipe",
			stdout: "pipe",
			stderr: "pipe",
		},
	);
	child.stdin.write(
		`${JSON.stringify({ type: "user", message: { role: "user", content: [{ type: "text", text: instruction }] } })}\n`,
	);
	child.stdin.end();
	const [exitCode, output, stderr] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);
	return { exitCode, output, stderr };
}

export async function runVerifiedTask(
	projectDirectory: string,
	instruction: string,
	options: VerifiedTaskOptions,
) {
	const startedAt = new Date().toISOString();
	const config = await loadConfig(projectDirectory);
	const root = config.project.root;
	const scope = normalizeTaskScope(options.files);
	for (const file of scope)
		if (relative(root, resolve(root, file)).startsWith(".."))
			throw new Error(`Scope escapes project: ${file}`);
	const modelName = options.model ?? config.models.builder;
	if (!modelName) throw new Error("Pass --model or configure a local builder model.");
	const model = await qualifiedLocalModel(root, modelName);
	const suffix = `${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`;
	const taskId = `task-${suffix}`;
	const agentName = `builder-${suffix}`;
	const baseDir = isAbsolute(config.worktrees.baseDir)
		? config.worktrees.baseDir
		: join(root, config.worktrees.baseDir);
	const worktree = await createWorktree({
		repoRoot: root,
		baseDir,
		agentName,
		baseBranch: await currentBranch(root),
		taskId,
	});
	const instructions = await prepareAgentState(
		worktree.path,
		agentName,
		scope,
		config.project.qualityGates,
	);
	const agent = await executeAgent(worktree.path, root, modelName, instructions, instruction);
	const changedFiles = await listTaskChanges(worktree.path);
	const outsideScope = changedFiles.filter((file) => !isFileInTaskScope(file, scope));
	const quality =
		changedFiles.length > 0 && outsideScope.length === 0
			? await runQualityGates(config.project.qualityGates ?? [], worktree.path)
			: null;
	let error = assessTaskEvidence({
		exitCode: agent.exitCode,
		cleanResult: streamHasCleanResult(agent.output),
		changedFiles,
		outsideScope,
		quality,
	});
	let commit: string | null = null;
	if (!error) {
		try {
			commit = await commitTaskChanges(worktree.path, taskId, changedFiles);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : String(cause);
		}
	}
	const result = {
		taskId,
		status: error ? "failed" : "completed",
		instruction,
		model: modelName,
		modelDigest: model.digest,
		scope,
		startedAt,
		completedAt: new Date().toISOString(),
		durationMs: Date.now() - Date.parse(startedAt),
		branch: worktree.branch,
		worktree: worktree.path,
		commit,
		changedFiles,
		quality,
		error,
		stderr: agent.stderr.trim() || null,
	};
	await appendTaskJournal(root, result);
	return result;
}
