import { isAbsolute } from "node:path";
import type { QualityGateOutcome } from "../insights/quality-gates.ts";

const PROTECTED_PATHS = [".git", ".overstory", ".superswarm"];

export interface TaskEvidence {
	exitCode: number;
	cleanResult: boolean;
	changedFiles: string[];
	outsideScope: string[];
	quality: QualityGateOutcome | null;
}

export function normalizeTaskScope(raw: string): string[] {
	const paths = raw
		.split(",")
		.map((value) => value.trim().replaceAll("\\", "/").replace(/^\.\//, ""))
		.filter(Boolean);
	if (paths.length === 0) throw new Error("--files must contain a relative path.");
	for (const path of paths) {
		const escapes = path === ".." || path.startsWith("../") || path.includes("/../");
		const protectedPath = PROTECTED_PATHS.some(
			(item) => path === item || path.startsWith(`${item}/`),
		);
		if (isAbsolute(path) || escapes || protectedPath) throw new Error(`Unsafe task scope: ${path}`);
	}
	return [...new Set(paths)];
}

export function isFileInTaskScope(file: string, scope: readonly string[]): boolean {
	return scope.some(
		(allowed) => file === allowed || (allowed.endsWith("/") && file.startsWith(allowed)),
	);
}

export function streamHasCleanResult(output: string): boolean {
	return output.split("\n").some((line) => {
		try {
			const event = JSON.parse(line) as { type?: string; is_error?: boolean };
			return event.type === "result" && event.is_error === false;
		} catch {
			return false;
		}
	});
}

export function assessTaskEvidence(evidence: TaskEvidence): string | null {
	if (evidence.exitCode !== 0 || !evidence.cleanResult)
		return "The local agent did not finish cleanly.";
	if (evidence.changedFiles.length === 0) return "The agent produced no file changes.";
	if (evidence.outsideScope.length > 0)
		return `Files outside scope: ${evidence.outsideScope.join(", ")}`;
	if (!evidence.quality) return "No quality gates are configured.";
	if (evidence.quality.status !== "success") return "One or more quality gates failed.";
	return null;
}
