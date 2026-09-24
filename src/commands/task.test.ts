import { describe, expect, test } from "bun:test";
import { assessTaskEvidence, normalizeTaskScope } from "../tasks/evidence.ts";

describe("verified tasks", () => {
	test("normalizes safe scope", () =>
		expect(normalizeTaskScope("./src/a.ts, docs/, src/a.ts")).toEqual(["src/a.ts", "docs/"]));
	test("rejects unsafe scope", () => {
		expect(() => normalizeTaskScope("../secret")).toThrow();
		expect(() => normalizeTaskScope(".overstory/config.yaml")).toThrow();
	});
	test("requires changes and passing gates", () => {
		expect(
			assessTaskEvidence({
				exitCode: 0,
				cleanResult: true,
				changedFiles: ["a"],
				outsideScope: [],
				quality: { status: "success", results: [], totalDurationMs: 1 },
			}),
		).toBeNull();
		expect(
			assessTaskEvidence({
				exitCode: 0,
				cleanResult: true,
				changedFiles: [],
				outsideScope: [],
				quality: null,
			}),
		).toContain("no file changes");
	});
});
