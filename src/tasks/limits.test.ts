import { describe, expect, test } from "bun:test";
import { DEFAULT_TASK_TIMEOUT_MINUTES, parseTaskTimeout } from "./limits.ts";

describe("task execution limits", () => {
	test("uses a bounded default", () => {
		expect(parseTaskTimeout(undefined)).toBe(DEFAULT_TASK_TIMEOUT_MINUTES);
	});

	test("rejects invalid or excessive timeouts", () => {
		for (const value of ["0", "2.5", "121", "forever"])
			expect(() => parseTaskTimeout(value)).toThrow("1 to 120");
	});
});
