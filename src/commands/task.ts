import { Command } from "commander";
import { loadConfig } from "../config.ts";
import { findTaskJournalEntry, queryTaskHistory, readTaskHistory } from "../tasks/journal.ts";
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
	const taskOptions = { files: options.files, model: options.model, json: options.json };
	const result = await runVerifiedTask(process.cwd(), instruction, taskOptions);
	printTaskResult(result, options.json ?? false);
	if (result.error) process.exitCode = 1;
}

async function historyAction(options: {
	last: string;
	json?: boolean;
	status?: "completed" | "failed";
	model?: string;
}): Promise<void> {
	const limit = Number.parseInt(options.last, 10);
	const config = await loadConfig(process.cwd());
	const entries =
		options.status || options.model
			? await queryTaskHistory(config.project.root, {
					limit,
					status: options.status,
					model: options.model,
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

export function createTaskCommand(): Command {
	const command = new Command("task")
		.description("Run one verified coding task with a qualified local model")
		.argument("[instruction]", "Bounded coding task to perform")
		.option("--files <paths>", "Allowed files, comma-separated; directories end with /")
		.option("--model <name>", "Qualified installed Ollama model")
		.option("--json", "Output the task result as JSON")
		.action(taskAction);
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
		.command("history")
		.description("Show recent verified file-task attempts")
		.option("--last <count>", "Number of attempts to show", "10")
		.option("--status <status>", "Filter by completed or failed")
		.option("--model <name>", "Filter by exact local model tag")
		.option("--json", "Output history as JSON")
		.action(async (_options, actionCommand) => {
			const options = actionCommand.optsWithGlobals();
			const status = options.status as string | undefined;
			if (status && status !== "completed" && status !== "failed")
				throw new Error("--status must be completed or failed.");
			const parsedStatus = status as "completed" | "failed" | undefined;
			await historyAction({
				last: String(options.last),
				json: Boolean(options.json),
				status: parsedStatus,
				model: options.model as string | undefined,
			});
		});
	return command;
}
