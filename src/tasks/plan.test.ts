import { describe, expect, test } from "bun:test";
import { buildVerifiedTaskPlan } from "./plan.ts";

describe("verified task plan", () => {
	test("returns the exact scope, model digest, and gates before execution", () => {
		const plan = buildVerifiedTaskPlan({
			root: process.cwd(),
			instruction: "Update docs",
			files: "README.md,docs/",
			model: "qwen:7b",
			modelDigest: "sha256:abc",
			qualityGates: [{ name: "test", command: "bun test", description: "tests" }],
		});
		expect(plan.scope).toEqual(["README.md", "docs/"]);
		expect(plan.modelDigest).toBe("sha256:abc");
		expect(plan.qualityGates).toEqual([{ name: "test", command: "bun test" }]);
	});
});
