import assert from "node:assert/strict";
import test from "node:test";
import { validateReleaseMetadata } from "./release-check.mjs";

const fixture = {
	packageJson: {
		name: "@melkizedekict/superswarm",
		version: "0.1.0-alpha.6",
		repository: { url: "https://github.com/MelkiZedekICT/superswarm-v.1melki.git" },
		bin: { superswarm: "./src/index.ts" },
	},
	source: 'export const VERSION = "0.1.0-alpha.6";',
	changelog: "## [0.1.0-alpha.6] - 2026-09-26",
};

test("accepts synchronized release metadata", () => {
	assert.deepEqual(validateReleaseMetadata({ ...fixture, expectedTag: "v0.1.0-alpha.6" }), {
		valid: true,
		version: "0.1.0-alpha.6",
		errors: [],
	});
});

test("reports package, version, changelog, repository, bin, and tag errors", () => {
	const result = validateReleaseMetadata({
		packageJson: { name: "wrong", version: "next", repository: {}, bin: {} },
		source: 'export const VERSION = "other";',
		changelog: "# Changelog",
		expectedTag: "v1.0.0",
	});
	assert.equal(result.valid, false);
	assert.equal(result.errors.length, 7);
});
