import { describe, expect, test } from "bun:test";
import { localQualificationStatuses } from "./qualification.ts";

describe("local qualification status", () => {
	test("distinguishes qualified, stale, and unqualified model digests", () => {
		const statuses = localQualificationStatuses(
			[
				{ name: "ready", digest: "one", size: 1 },
				{ name: "changed", digest: "new", size: 1 },
				{ name: "unknown", digest: "three", size: 1 },
			],
			{
				version: 2,
				models: {
					ready: {
						digest: "one",
						qualifiedAt: "2026-09-25T00:00:00Z",
						scopedEdit: true,
						multiTurn: true,
						testExecution: true,
					},
					changed: {
						digest: "old",
						qualifiedAt: "2026-09-24T00:00:00Z",
						scopedEdit: true,
						multiTurn: true,
						testExecution: true,
					},
				},
			},
		);
		expect(statuses.map((entry) => entry.status)).toEqual(["qualified", "stale", "unqualified"]);
	});
});
