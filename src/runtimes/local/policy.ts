import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import type { ExtensionFactory } from "@earendil-works/pi-coding-agent";
import { DANGEROUS_BASH_PATTERNS } from "../../agents/guard-rules.ts";
import type { HooksDef } from "../types.ts";

export type LocalPolicyDecision = { block: true; reason: string } | undefined;

/** Resolve the existing ancestor too, so symlinks cannot escape the worktree. */
export function withinWorktree(root: string, candidate: string): boolean {
	const target = resolve(root, candidate);
	let ancestor = target;
	while (!existsSync(ancestor) && dirname(ancestor) !== ancestor) ancestor = dirname(ancestor);
	const realTarget = resolve(realpathSync(ancestor), relative(ancestor, target));
	const rel = relative(realpathSync(root), realTarget);
	return rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

export function evaluateLocalToolCall(
	hooks: HooksDef,
	toolName: string,
	input: Record<string, unknown>,
): LocalPolicyDecision {
	const mayWrite = ["builder", "merger"].includes(hooks.capability);
	if (["write", "edit"].includes(toolName)) {
		if (!mayWrite) return { block: true, reason: "This agent role cannot edit project files." };
		if (typeof input.path !== "string" || !withinWorktree(hooks.worktreePath, input.path)) {
			return { block: true, reason: "File edits must stay within the assigned worktree." };
		}
		const rel = relative(hooks.worktreePath, resolve(hooks.worktreePath, input.path));
		if (rel.split(sep).some((part) => [".git", ".superswarm", ".overstory"].includes(part))) {
			return { block: true, reason: "Agent tools cannot rewrite orchestration metadata." };
		}
	}
	if (toolName === "bash" && !mayWrite && typeof input.command === "string") {
		const command = input.command;
		const coordination = /^(ov|superswarm) (mail|sling|status|stop|spec|group|run|merge|log)\b/;
		const single = !/[;&|`\n\r<>]|\$\(/.test(command);
		if (
			!(single && coordination.test(command)) &&
			DANGEROUS_BASH_PATTERNS.some((pattern) => new RegExp(pattern).test(command))
		) {
			return { block: true, reason: "This role cannot run file-modifying shell commands." };
		}
	}
	return undefined;
}

/** Role and file boundaries. Shell tools execute trusted project code; this is not an OS sandbox. */
export function localPolicy(hooks: HooksDef): ExtensionFactory {
	return (pi) => {
		pi.on("tool_call", async (event) =>
			evaluateLocalToolCall(hooks, event.toolName, event.input as Record<string, unknown>),
		);
	};
}
