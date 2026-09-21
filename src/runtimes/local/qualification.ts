import { dirname, join } from "node:path";
import { resolveProjectRoot } from "../../config.ts";

export interface InstalledLocalModel {
	name: string;
	size: number;
	digest: string;
}

export interface QualificationRegistry {
	version: 2;
	models: Record<
		string,
		{
			digest: string;
			qualifiedAt: string;
			scopedEdit: true;
			multiTurn: true;
			testExecution: true;
		}
	>;
}

export async function installedLocalModels(): Promise<InstalledLocalModel[]> {
	const response = await fetch("http://127.0.0.1:11434/api/tags", {
		redirect: "error",
		signal: AbortSignal.timeout(5000),
	});
	if (!response.ok) throw new Error("Ollama is not ready. Start Ollama and try again.");
	const body = (await response.json()) as { models?: InstalledLocalModel[] };
	return (body.models ?? []).filter((model) => !model.name.includes("cloud"));
}

export async function readQualifications(projectRoot: string): Promise<QualificationRegistry> {
	const file = Bun.file(join(projectRoot, ".overstory", "local-models.json"));
	if (!(await file.exists())) return { version: 2, models: {} };
	return file.json();
}

export async function writeQualification(
	projectRoot: string,
	model: InstalledLocalModel,
): Promise<void> {
	const registry = await readQualifications(projectRoot);
	registry.version = 2;
	registry.models[model.name] = {
		digest: model.digest,
		qualifiedAt: new Date().toISOString(),
		scopedEdit: true,
		multiTurn: true,
		testExecution: true,
	};
	await Bun.write(
		join(projectRoot, ".overstory", "local-models.json"),
		`${JSON.stringify(registry, null, "\t")}\n`,
	);
}

export async function assertQualifiedLocalModel(
	projectRoot: string,
	modelName: string,
): Promise<void> {
	const [models, registry] = await Promise.all([
		installedLocalModels(),
		readQualifications(projectRoot),
	]);
	const installed = models.find((model) => model.name === modelName);
	if (!installed)
		throw new Error(`Local model unavailable: ${modelName}. Install it in Ollama first.`);
	const qualification = registry.models[modelName];
	if (
		qualification?.digest !== installed.digest ||
		qualification.multiTurn !== true ||
		qualification.testExecution !== true
	) {
		throw new Error(
			`Model ${modelName} is not qualified for this project and machine. Run superswarm local qualify --model ${modelName}.`,
		);
	}
}

/** Resolve the main project even when the worker starts inside an agent worktree. */
export async function localProjectRoot(cwd: string): Promise<string> {
	try {
		return await resolveProjectRoot(cwd);
	} catch {
		throw new Error(
			`Cannot locate .overstory from ${dirname(cwd)}. Initialize the project before running local agents.`,
		);
	}
}
