import { describe, expect, test } from "bun:test";
import { DEFAULT_CONFIG } from "../../config.ts";
import { evaluateLocalReadiness } from "./readiness.ts";

describe("local launch readiness", () => {
	test("passes only when the configured digest is qualified", () => {
		const config = structuredClone(DEFAULT_CONFIG);
		config.runtime = { ...config.runtime, default: "local" };
		config.models.builder = "qwen:7b";
		const checks = evaluateLocalReadiness(
			config,
			[{ name: "qwen:7b", digest: "sha256:abc", size: 1 }],
			{
				version: 2,
				models: {
					"qwen:7b": {
						digest: "sha256:abc",
						qualifiedAt: "2026-09-25T00:00:00Z",
						scopedEdit: true,
						multiTurn: true,
						testExecution: true,
					},
				},
			},
			true,
		);
		expect(checks.every((check) => check.status === "pass")).toBe(true);
	});

	test("fails qualification when the installed model digest changes", () => {
		const config = structuredClone(DEFAULT_CONFIG);
		config.runtime = { ...config.runtime, default: "local" };
		config.models.builder = "qwen:7b";
		const checks = evaluateLocalReadiness(
			config,
			[{ name: "qwen:7b", digest: "new", size: 1 }],
			{
				version: 2,
				models: {
					"qwen:7b": {
						digest: "old",
						qualifiedAt: "2026-09-25T00:00:00Z",
						scopedEdit: true,
						multiTurn: true,
						testExecution: true,
					},
				},
			},
			true,
		);
		expect(checks.find((check) => check.name === "qualification")?.status).toBe("fail");
	});
});
