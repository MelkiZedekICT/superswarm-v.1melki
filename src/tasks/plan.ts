import { relative, resolve } from "node:path";
import type { QualityGate } from "../types.ts";
import { normalizeTaskScope } from "./evidence.ts";

export interface VerifiedTaskPlan {
	instruction: string;
	model: string;
	modelDigest: string;
	scope: string[];
	qualityGates: Array<{ name: string; command: string }>;
	willCreateWorktree: true;
	willCommitOnSuccess: true;
}

export function buildVerifiedTaskPlan(options: {
	root: string;
	instruction: string;
	files: string;
	model: string;
	modelDigest: string;
	qualityGates: QualityGate[];
}): VerifiedTaskPlan {
	const scope = normalizeTaskScope(options.files);
	for (const file of scope)
		if (relative(options.root, resolve(options.root, file)).startsWith(".."))
			throw new Error(`Scope escapes project: ${file}`);
	return {
		instruction: options.instruction,
		model: options.model,
		modelDigest: options.modelDigest,
		scope,
		qualityGates: options.qualityGates.map(({ name, command }) => ({ name, command })),
		willCreateWorktree: true,
		willCommitOnSuccess: true,
	};
}
