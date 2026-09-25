import { Command } from "commander";
import { loadConfig } from "../config.ts";
import { qualifiedLocalModel } from "../runtimes/local/qualification.ts";
import { exportTaskEvidence } from "../tasks/export.ts";
import {
	findTaskJournalEntry,
	queryTaskHistory,
	readTaskHistory,
	readTaskStatistics,
} from "../tasks/journal.ts";
import { parseTaskTimeout } from "../tasks/limits.ts";
import { buildVerifiedTaskPlan } from "../tasks/plan.ts";
import { taskRetryInput } from "../tasks/retry.ts";
import { runVerifiedTask, type VerifiedTaskOptions } from "../tasks/runner.ts";

function printTaskResult(result: Awaited<ReturnType<typeof runVerifiedTask>>, json: boolean): void {
	if (json) {
		console.log(JSON.stringify(result, null, 2));
		return;
	}
	console.log(`${result.error ? "Task failed" : "Task completed"}: ${result.taskId}`);
	console.log(`Branch: ${result.branch}`);
	console.log(`Worktree: ${result.worktree}`);
	if (result.commit) console.log(`Commit: ${result.commit}`);
	if (result.error) console.error(result.error);
}

async function taskAction(
	instruction: string | undefined,
	options: Partial<VerifiedTaskOptions>,
): Promise<void> {
	if (!instruction) throw new Error("Provide a task instruction.");
	if (!options.files) throw new Error("--files is required for a task run.");
	const taskOptions = {
		files: options.files,
		model: options.model,
		json: options.json,
		timeoutMinutes: options.timeoutMinutes,
	};
	const result = await runVerifiedTask(process.cwd(), instruction, taskOptions);
	printTaskResult(result, options.json ?? false);
	if (result.error) process.exitCode = 1;
}

async function historyAction(options: {
	last: string;
	json?: boolean;
	status?: "completed" | "failed";
	model?: string;
	since?: string;
}): Promise<void> {
	const limit = Number.parseInt(options.last, 10);
	const config = await loadConfig(process.cwd());
	const entries =
		options.status || options.model || options.since
			? await queryTaskHistory(config.project.root, {
					limit,
					status: options.status,
					model: options.model,
					since: options.since,
				})
			: await readTaskHistory(config.project.root, limit);
	if (options.json) {
		console.log(JSON.stringify({ entries }, null, 2));
		return;
	}
	if (entries.length === 0) {
		console.log("No file tasks have been recorded.");
		return;
	}
	for (const entry of entries) {
		const commit = entry.commit ? ` ${entry.commit.slice(0, 8)}` : "";
		console.log(`${entry.completedAt} ${entry.status.padEnd(9)} ${entry.taskId}${commit}`);
		console.log(`  ${entry.instruction}`);
		if (entry.error) console.log(`  Error: ${entry.error}`);
	}
}

async function showAction(taskId: string, options: { json?: boolean }): Promise<void> {
	const config = await loadConfig(process.cwd());
	const entry = await findTaskJournalEntry(config.project.root, taskId);
	if (!entry) throw new Error(`Task not found: ${taskId}`);
	if (options.json) {
		console.log(JSON.stringify(entry, null, 2));
		return;
	}
	console.log(`${entry.taskId} — ${entry.status}`);
	console.log(`Instruction: ${entry.instruction}`);
	console.log(`Model: ${entry.model}${entry.modelDigest ? ` (${entry.modelDigest})` : ""}`);
	if (entry.scope) console.log(`Scope: ${entry.scope.join(", ")}`);
	console.log(`Branch: ${entry.branch}`);
	if (entry.worktree) console.log(`Worktree: ${entry.worktree}`);
	if (entry.commit) console.log(`Commit: ${entry.commit}`);
	if (entry.error) console.log(`Error: ${entry.error}`);
}

async function exportAction(taskId: string, output: string): Promise<void> {
	const config = await loadConfig(process.cwd());
	const entry = await findTaskJournalEntry(config.project.root, taskId);
	if (!entry) throw new Error(`Task not found: ${taskId}`);
	const target = await exportTaskEvidence(config.project.root, entry, output);
	console.log(`Task evidence exported to ${target}`);
}

async function retryAction(
	taskId: string,
	options: { timeoutMinutes: number; json?: boolean },
): Promise<void> {
	const config = await loadConfig(process.cwd());
	const entry = await findTaskJournalEntry(config.project.root, taskId);
	if (!entry) throw new Error(`Task not found: ${taskId}`);
	const retry = taskRetryInput(entry);
	const result = await runVerifiedTask(process.cwd(), retry.instruction, {
		files: retry.files,
		model: retry.model,
		timeoutMinutes: options.timeoutMinutes,
	});
	printTaskResult(result, options.json ?? false);
	if (result.error) process.exitCode = 1;
}

async function statsAction(options: { json?: boolean }): Promise<void> {
	const config = await loadConfig(process.cwd());
	const statistics = await readTaskStatistics(config.project.root);
	if (options.json) {
		console.log(JSON.stringify(statistics, null, 2));
		return;
	}
	console.log(`Tasks: ${statistics.total}`);
	console.log(`Completed: ${statistics.completed}`);
	console.log(`Failed: ${statistics.failed}`);
	console.log(`Success rate: ${(statistics.successRate * 100).toFixed(1)}%`);
	if (statistics.averageDurationMs !== null)
		console.log(`Average duration: ${(statistics.averageDurationMs / 1000).toFixed(1)}s`);
	for (const [model, count] of Object.entries(statistics.models))
		console.log(`Model ${model}: ${count} task${count === 1 ? "" : "s"}`);
}

async function planAction(
	instruction: string,
	options: { files: string; model?: string; json?: boolean },
): Promise<void> {
	const config = await loadConfig(process.cwd());
	const modelName = options.model ?? config.models.builder;
	if (!modelName) throw new Error("Pass --model or configure a local builder model.");
	const model = await qualifiedLocalModel(config.project.root, modelName);
	const plan = buildVerifiedTaskPlan({
		root: config.project.root,
		instruction,
		files: options.files,
		model: modelName,
		modelDigest: model.digest,
		qualityGates: config.project.qualityGates ?? [],
	});
	if (options.json) console.log(JSON.stringify(plan, null, 2));
	else {
		console.log(`Model: ${plan.model} (${plan.modelDigest})`);
		console.log(`Scope: ${plan.scope.join(", ")}`);
		console.log(`Quality gates: ${plan.qualityGates.map((gate) => gate.name).join(", ")}`);
		console.log("Ready: a worktree will be created and committed only after all checks pass.");
	}
}

export function createTaskCommand(): Command {
	const command = new Command("task")
		.description("Run one verified coding task with a qualified local model")
		.argument("[instruction]", "Bounded coding task to perform")
		.option("--files <paths>", "Allowed files, comma-separated; directories end with /")
		.option("--model <name>", "Qualified installed Ollama model")
		.option("--timeout <minutes>", "Stop an unresponsive task after 1 to 120 minutes", "30")
		.option("--json", "Output the task result as JSON")
		.action(async (instruction, options) => {
			await taskAction(instruction, {
				...options,
				timeoutMinutes: parseTaskTimeout(options.timeout as string | undefined),
			});
		});
	command
		.command("show")
		.description("Inspect one verified file-task attempt")
		.argument("<task-id>", "Task identifier from task history")
		.option("--json", "Output the task record as JSON")
		.action(async (taskId, _options, actionCommand) => {
			const options = actionCommand.optsWithGlobals();
			await showAction(String(taskId), { json: Boolean(options.json) });
		});
	command
		.command("stats")
		.description("Summarize verified task outcomes and model usage")
		.option("--json", "Output task statistics as JSON")
		.action(async (options) => {
			await statsAction({ json: Boolean(options.json) });
		});
	command
		.command("retry")
		.description("Retry a recorded task with its original model and file scope")
		.argument("<task-id>", "Task identifier from task history")
		.option("--timeout <minutes>", "Stop an unresponsive task after 1 to 120 minutes", "30")
		.option("--json", "Output the task result as JSON")
		.action(async (taskId, options) => {
			await retryAction(String(taskId), {
				timeoutMinutes: parseTaskTimeout(options.timeout as string | undefined),
				json: Boolean(options.json),
			});
		});
	command
		.command("plan")
		.description("Validate and preview a task without starting a model")
		.argument("<instruction>", "Bounded coding task to preview")
		.requiredOption("--files <paths>", "Allowed files, comma-separated; directories end with /")
		.option("--model <name>", "Qualified installed Ollama model")
		.option("--json", "Output the plan as JSON")
		.action(async (instruction, options) => {
			await planAction(String(instruction), {
				files: String(options.files),
				model: options.model as string | undefined,
				json: Boolean(options.json),
			});
		});
	command
		.command("export")
		.description("Export one task's evidence as a portable JSON report")
		.argument("<task-id>", "Task identifier from task history")
		.requiredOption("--output <path>", "Report path inside the project")
		.action(async (taskId, options) => {
			await exportAction(String(taskId), String(options.output));
		});
	command
		.command("history")
		.description("Show recent verified file-task attempts")
		.option("--last <count>", "Number of attempts to show", "10")
		.option("--status <status>", "Filter by completed or failed")
		.option("--model <name>", "Filter by exact local model tag")
		.option("--since <date>", "Show attempts completed on or after an ISO date")
		.option("--json", "Output history as JSON")
		.action(async (_options, actionCommand) => {
			const options = actionCommand.optsWithGlobals();
			const status = options.status as string | undefined;
			if (status && status !== "completed" && status !== "failed")
				throw new Error("--status must be completed or failed.");
			const parsedStatus = status as "completed" | "failed" | undefined;
			const rawSince = options.since as string | undefined;
			const since = rawSince ? new Date(rawSince) : undefined;
			if (since && Number.isNaN(since.getTime())) throw new Error("--since must be a valid date.");
			await historyAction({
				last: String(options.last),
				json: Boolean(options.json),
				status: parsedStatus,
				model: options.model as string | undefined,
				since: since?.toISOString(),
			});
		});
	return command;
}
