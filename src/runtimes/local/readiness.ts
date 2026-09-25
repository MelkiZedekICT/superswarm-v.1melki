import { runGit } from "../../tasks/git.ts";
import type { OverstoryConfig } from "../../types.ts";
import {
	type InstalledLocalModel,
	installedLocalModels,
	type QualificationRegistry,
	readQualifications,
} from "./qualification.ts";

export interface ReadinessCheck {
	name: string;
	status: "pass" | "fail";
	detail: string;
}

export function evaluateLocalReadiness(
	config: OverstoryConfig,
	models: InstalledLocalModel[],
	registry: QualificationRegistry,
	gitReady: boolean,
): ReadinessCheck[] {
	const runtime = config.runtime?.default ?? "claude";
	const builder = config.models.builder;
	const installed = models.find((model) => model.name === builder);
	const qualification = builder ? registry.models[builder] : undefined;
	const qualified = Boolean(
		installed &&
			qualification?.digest === installed.digest &&
			qualification.multiTurn &&
			qualification.testExecution,
	);
	return [
		{
			name: "git",
			status: gitReady ? "pass" : "fail",
			detail: gitReady ? "Git repository is available." : "Git repository is unavailable.",
		},
		{
			name: "runtime",
			status: runtime === "local" ? "pass" : "fail",
			detail: `Configured runtime: ${runtime}`,
		},
		{
			name: "ollama",
			status: models.length > 0 ? "pass" : "fail",
			detail: `${models.length} local model${models.length === 1 ? "" : "s"} available.`,
		},
		{
			name: "builder",
			status: installed ? "pass" : "fail",
			detail: builder ? `Builder model: ${builder}` : "No builder model configured.",
		},
		{
			name: "qualification",
			status: qualified ? "pass" : "fail",
			detail: qualified
				? `Qualified digest: ${installed?.digest}`
				: "Builder model has not passed qualification at its installed digest.",
		},
		{
			name: "quality-gates",
			status: (config.project.qualityGates?.length ?? 0) > 0 ? "pass" : "fail",
			detail: `${config.project.qualityGates?.length ?? 0} quality gates configured.`,
		},
	];
}

export async function collectLocalReadiness(config: OverstoryConfig): Promise<ReadinessCheck[]> {
	const [models, registry, git] = await Promise.all([
		installedLocalModels(),
		readQualifications(config.project.root),
		runGit(config.project.root, ["rev-parse", "--is-inside-work-tree"]),
	]);
	return evaluateLocalReadiness(config, models, registry, git.exitCode === 0);
}
