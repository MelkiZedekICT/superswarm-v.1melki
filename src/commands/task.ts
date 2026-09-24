import { Command } from "commander";
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

async function taskAction(instruction: string, options: VerifiedTaskOptions): Promise<void> {
	const result = await runVerifiedTask(process.cwd(), instruction, options);
	printTaskResult(result, options.json ?? false);
	if (result.error) process.exitCode = 1;
}

export function createTaskCommand(): Command {
	return new Command("task")
		.description("Run one verified coding task with a qualified local model")
		.argument("<instruction>", "Bounded coding task to perform")
		.requiredOption("--files <paths>", "Allowed files, comma-separated; directories end with /")
		.option("--model <name>", "Qualified installed Ollama model")
		.option("--json", "Output the task result as JSON")
		.action(taskAction);
}
