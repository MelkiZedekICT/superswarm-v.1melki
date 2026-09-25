import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { loadConfig } from "../config.ts";
import {
	installedLocalModels,
	readQualifications,
	writeQualification,
} from "../runtimes/local/qualification.ts";
import { collectLocalReadiness } from "../runtimes/local/readiness.ts";
import { DEFAULT_LOCAL_MODEL, LocalRuntime } from "../runtimes/local.ts";

export function createLocalCommand(): Command {
	const command = new Command("local").description(
		"Configure and verify local-only Ollama inference",
	);
	command
		.command("doctor")
		.description("Check whether this project is ready for verified local tasks")
		.option("--json", "Output readiness checks as JSON")
		.action(async (options: { json?: boolean }) => {
			const config = await loadConfig(process.cwd());
			const checks = await collectLocalReadiness(config);
			const ready = checks.every((check) => check.status === "pass");
			if (options.json) console.log(JSON.stringify({ ready, checks }, null, 2));
			else {
				for (const check of checks)
					console.log(
						`${check.status === "pass" ? "PASS" : "FAIL"} ${check.name}: ${check.detail}`,
					);
				console.log(ready ? "Superswarm is ready for local tasks." : "Superswarm needs attention.");
			}
			if (!ready) process.exitCode = 1;
		});
	command
		.command("status")
		.description("List downloaded models without loading them")
		.action(async () => {
			const models = await installedLocalModels();
			console.log(
				JSON.stringify(
					{ endpoint: "http://127.0.0.1:11434", inferenceConcurrency: 1, models },
					null,
					2,
				),
			);
		});
	command
		.command("configure")
		.description("Assign installed models to planner, builder, and reviewer roles")
		.option("--model <name>", "Default local model", DEFAULT_LOCAL_MODEL)
		.option("--planner <name>", "Planner/coordinator model")
		.option("--reviewer <name>", "Reviewer model")
		.action(async (opts: { model: string; planner?: string; reviewer?: string }) => {
			const config = await loadConfig(process.cwd());
			const models = await installedLocalModels();
			const qualifications = await readQualifications(config.project.root);
			const selected = [opts.model, opts.planner ?? opts.model, opts.reviewer ?? opts.model];
			for (const model of selected) {
				const installed = models.find((entry) => entry.name === model);
				if (!installed) throw new Error(`Install ${model} in Ollama first.`);
				if (!/^[a-zA-Z0-9_.:-]+$/.test(model))
					throw new Error("Use a local model tag without a provider prefix.");
				const qualification = qualifications.models[model];
				if (
					qualification?.digest !== installed.digest ||
					qualification.multiTurn !== true ||
					qualification.testExecution !== true
				) {
					throw new Error(`Qualify ${model} on this machine before assigning it to an agent role.`);
				}
			}
			const overrides = join(config.project.root, ".overstory", "config.local.yaml");
			if (await Bun.file(overrides).exists())
				throw new Error(
					"config.local.yaml already exists; edit it to preserve your existing overrides.",
				);
			const roles = [
				"builder",
				"scout",
				"merger",
				"lead",
				"coordinator",
				"orchestrator",
				"reviewer",
				"monitor",
				"supervisor",
			];
			const lines = [
				"runtime:",
				"  default: local",
				"  printCommand: local",
				"agents:",
				"  maxConcurrent: 3",
				"models:",
			];
			for (const role of roles) {
				const model =
					role === "reviewer"
						? selected[2]
						: ["lead", "coordinator", "orchestrator"].includes(role)
							? selected[1]
							: selected[0];
				lines.push(`  ${role}: ${model}`);
			}
			await Bun.write(overrides, `${lines.join("\n")}\n`);
			console.log("Local roles configured. Inference requests run one at a time.");
		});
	command
		.command("test")
		.description("Run a real text inference check without coding tools")
		.option("--model <name>", "Installed model tag", DEFAULT_LOCAL_MODEL)
		.action(async (opts: { model: string }) => {
			const argv = new LocalRuntime().buildPrintCommand(
				"Reply with exactly SUPERSWARM_LOCAL_OK",
				opts.model,
			);
			const child = Bun.spawn(argv, {
				env: { ...process.env, SUPERSWARM_QUALIFICATION: "1" },
				stdin: "ignore",
				stdout: "inherit",
				stderr: "inherit",
			});
			process.exitCode = await child.exited;
		});
	command
		.command("qualify")
		.description("Test a model's scoped edit, multi-turn state, and test execution")
		.option("--model <name>", "Installed model tag", DEFAULT_LOCAL_MODEL)
		.action(async (opts: { model: string }) => {
			const config = await loadConfig(process.cwd());
			const installed = (await installedLocalModels()).find((model) => model.name === opts.model);
			if (!installed) throw new Error(`Install ${opts.model} in Ollama first.`);
			const root = await mkdtemp(join(tmpdir(), "superswarm-qualification-"));
			try {
				await mkdir(join(root, ".superswarm"));
				await Bun.write(
					join(root, "AGENTS.md"),
					"You are a builder. Follow the user exactly. Use relative file paths and coding tools.\n",
				);
				await Bun.write(join(root, "qualification.txt"), "before\n");
				await Bun.write(
					join(root, "qualification.test.ts"),
					'import { expect, test } from "bun:test";\ntest("qualified edit", async () => expect(await Bun.file("qualification.txt").text()).toBe("after\\n"));\n',
				);
				await Bun.write(
					join(root, ".superswarm", "agent.json"),
					JSON.stringify({ agentName: "qualification", capability: "builder", worktreePath: root }),
				);
				const runtime = new LocalRuntime();
				const argv = runtime.buildDirectSpawn({
					cwd: root,
					env: {},
					model: opts.model,
					instructionPath: "AGENTS.md",
				});
				const child = Bun.spawn(argv, {
					cwd: root,
					env: { ...process.env, SUPERSWARM_QUALIFICATION: "1" },
					stdin: "pipe",
					stdout: "pipe",
					stderr: "pipe",
				});
				const editTurn = JSON.stringify({
					type: "user",
					message: {
						role: "user",
						content: [
							{
								type: "text",
								text: 'Call the write tool exactly once with path "qualification.txt" and content "after\\n". Do not paraphrase the content.',
							},
						],
					},
				});
				const testTurn = JSON.stringify({
					type: "user",
					message: {
						role: "user",
						content: [
							{
								type: "text",
								text: "Now call the bash tool with command: bun test qualification.test.ts",
							},
						],
					},
				});
				child.stdin.write(`${editTurn}\n${testTurn}\n`);
				child.stdin.end();
				const [exitCode, output, errorOutput] = await Promise.all([
					child.exited,
					new Response(child.stdout).text(),
					new Response(child.stderr).text(),
				]);
				const content = await Bun.file(join(root, "qualification.txt")).text();
				const usedTool = output.includes('"type":"tool_use"');
				const usedWrite = output.includes('"name":"write"');
				const usedBash = output.includes('"name":"bash"');
				const testPassed = output.includes("1 pass") && !output.includes("1 fail");
				const passed =
					exitCode === 0 &&
					usedTool &&
					usedWrite &&
					usedBash &&
					testPassed &&
					content === "after\n";
				console.log(
					JSON.stringify(
						{
							model: opts.model,
							level: "edit-test-prerequisite",
							passed,
							exitCode,
							usedTool,
							usedWrite,
							usedBash,
							testPassed,
							exactEdit: content === "after\n",
						},
						null,
						2,
					),
				);
				if (!passed) {
					if (errorOutput.trim()) process.stderr.write(errorOutput);
					process.stderr.write("Model is not qualified for autonomous builder work.\n");
					process.exitCode = 1;
				} else {
					await writeQualification(config.project.root, installed);
				}
			} finally {
				await rm(root, { recursive: true, force: true });
			}
		});
	return command;
}
