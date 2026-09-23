import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { Command } from "commander";
import { loadConfig } from "../config.ts";
import { type QualityGateOutcome, runQualityGates } from "../insights/quality-gates.ts";
import {
	assertQualifiedLocalModel,
	installedLocalModels,
} from "../runtimes/local/qualification.ts";
import { LocalRuntime } from "../runtimes/local.ts";
import { createWorktree } from "../worktree/manager.ts";

export interface TaskEvidence {
	exitCode: number;
	cleanResult: boolean;
	changedFiles: string[];
	outsideScope: string[];
	quality: QualityGateOutcome | null;
}

export function normalizeTaskScope(raw: string): string[] {
	const files = raw
		.split(",")
		.map((v) => v.trim().replaceAll("\\", "/").replace(/^\.\//, ""))
		.filter(Boolean);
	if (files.length === 0) throw new Error("--files must contain a relative path.");
	for (const file of files) {
		if (
			isAbsolute(file) ||
			file === ".." ||
			file.startsWith("../") ||
			file.includes("/../") ||
			[".git", ".overstory", ".superswarm"].some((p) => file === p || file.startsWith(`${p}/`))
		)
			throw new Error(`Unsafe task scope: ${file}`);
	}
	return [...new Set(files)];
}

export function assessTaskEvidence(value: TaskEvidence): string | null {
	if (value.exitCode !== 0 || !value.cleanResult) return "The local agent did not finish cleanly.";
	if (value.changedFiles.length === 0) return "The agent produced no file changes.";
	if (value.outsideScope.length) return `Files outside scope: ${value.outsideScope.join(", ")}`;
	if (!value.quality) return "No quality gates are configured.";
	if (value.quality.status !== "success") return "One or more quality gates failed.";
	return null;
}

async function git(cwd: string, args: string[]) {
	const child = Bun.spawn(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" });
	const [exitCode, stdout, stderr] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);
	return { exitCode, stdout, stderr };
}

async function changedFiles(cwd: string): Promise<string[]> {
	const [tracked, untracked] = await Promise.all([
		git(cwd, ["diff", "--name-only", "-z", "HEAD"]),
		git(cwd, ["ls-files", "--others", "--exclude-standard", "-z"]),
	]);
	return [
		...new Set(
			[tracked.stdout, untracked.stdout]
				.flatMap((v) => v.split("\0"))
				.filter(Boolean)
				.map((v) => v.replaceAll("\\", "/")),
		),
	]
		.filter((file) => file !== ".superswarm" && !file.startsWith(".superswarm/"))
		.sort();
}

function cleanResult(output: string): boolean {
	return output.split("\n").some((line) => {
		try {
			const e = JSON.parse(line) as { type?: string; is_error?: boolean };
			return e.type === "result" && e.is_error === false;
		} catch {
			return false;
		}
	});
}

async function journal(root: string, entry: object) {
	const path = join(root, ".overstory", "task-journal.jsonl");
	await mkdir(join(root, ".overstory"), { recursive: true });
	const old = (await Bun.file(path).exists()) ? await Bun.file(path).text() : "";
	await Bun.write(path, `${old}${JSON.stringify(entry)}\n`);
}

async function runTask(
	instruction: string,
	opts: { files: string; model?: string; json?: boolean },
) {
	const startedAt = new Date().toISOString();
	const config = await loadConfig(process.cwd());
	const root = config.project.root;
	const scope = normalizeTaskScope(opts.files);
	for (const file of scope)
		if (relative(root, resolve(root, file)).startsWith(".."))
			throw new Error(`Scope escapes project: ${file}`);
	const model = opts.model ?? config.models.builder;
	if (!model) throw new Error("Pass --model or configure a local builder model.");
	await assertQualifiedLocalModel(root, model);
	const installed = (await installedLocalModels()).find((m) => m.name === model);
	const suffix = `${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`;
	const taskId = `task-${suffix}`;
	const agentName = `builder-${suffix}`;
	const base = await git(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
	if (base.exitCode !== 0) throw new Error(base.stderr.trim());
	const baseDir = isAbsolute(config.worktrees.baseDir)
		? config.worktrees.baseDir
		: join(root, config.worktrees.baseDir);
	const worktree = await createWorktree({
		repoRoot: root,
		baseDir,
		agentName,
		baseBranch: base.stdout.trim() || "HEAD",
		taskId,
	});
	const state = join(worktree.path, ".superswarm");
	await mkdir(state, { recursive: true });
	const instructions = join(state, "task.md");
	await Bun.write(
		instructions,
		[
			`You are Superswarm builder ${agentName}. Work immediately using tools.`,
			`Change only: ${scope.join(", ")}. A path ending / includes children.`,
			"For a whole-file replacement, call the write tool with the complete final content.",
			"Never print or describe a shell command instead of calling the bash tool.",
			"Do not change .git, .overstory, or .superswarm. Do not commit; Superswarm verifies and commits.",
			"Finish only after making the requested change and checking it.",
		].join("\n"),
	);
	await Bun.write(
		join(state, "agent.json"),
		JSON.stringify({
			agentName,
			capability: "builder",
			worktreePath: worktree.path,
			qualityGates: config.project.qualityGates,
		}),
	);
	const runtime = new LocalRuntime();
	const child = Bun.spawn(
		runtime.buildDirectSpawn({
			cwd: worktree.path,
			env: {},
			model,
			instructionPath: relative(worktree.path, instructions),
		}),
		{
			cwd: worktree.path,
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
	const changed = await changedFiles(worktree.path);
	const outsideScope = changed.filter(
		(file) =>
			!scope.some(
				(allowed) => file === allowed || (allowed.endsWith("/") && file.startsWith(allowed)),
			),
	);
	const quality =
		changed.length && !outsideScope.length
			? await runQualityGates(config.project.qualityGates ?? [], worktree.path)
			: null;
	let error = assessTaskEvidence({
		exitCode,
		cleanResult: cleanResult(output),
		changedFiles: changed,
		outsideScope,
		quality,
	});
	let commit: string | null = null;
	if (!error) {
		const add = await git(worktree.path, ["add", "--", ...changed]);
		if (add.exitCode) error = add.stderr.trim();
	}
	if (!error) {
		const made = await git(worktree.path, ["commit", "-m", `Complete Superswarm task ${taskId}`]);
		if (made.exitCode) error = made.stderr.trim();
		else commit = (await git(worktree.path, ["rev-parse", "HEAD"])).stdout.trim();
	}
	const result = {
		taskId,
		status: error ? "failed" : "completed",
		instruction,
		model,
		modelDigest: installed?.digest ?? null,
		startedAt,
		completedAt: new Date().toISOString(),
		branch: worktree.branch,
		worktree: worktree.path,
		commit,
		changedFiles: changed,
		quality,
		error,
		stderr: stderr.trim() || null,
	};
	await journal(root, result);
	console.log(
		opts.json
			? JSON.stringify(result, null, 2)
			: `${error ? "Task failed" : "Task completed"}: ${taskId}\nBranch: ${worktree.branch}\nWorktree: ${worktree.path}${commit ? `\nCommit: ${commit}` : ""}`,
	);
	if (error) {
		console.error(error);
		process.exitCode = 1;
	}
}

export function createTaskCommand(): Command {
	return new Command("task")
		.description("Run one verified coding task with a qualified local model")
		.argument("<instruction>")
		.requiredOption("--files <paths>", "Allowed files, comma-separated; directories end with /")
		.option("--model <name>")
		.option("--json")
		.action(runTask);
}
