import assert from "node:assert/strict";
import test from "node:test";
import { npmVersionStatus } from "./npm-version-status.mjs";

test("finds an exact published version", async () => {
	const result = await npmVersionStatus("@scope/pkg", "1.2.3", async () =>
		Response.json({ versions: { "1.2.3": {} } }),
	);
	assert.equal(result.published, true);
});

test("reports a missing version without treating it as an error", async () => {
	const result = await npmVersionStatus("@scope/pkg", "1.2.4", async () =>
		Response.json({ versions: { "1.2.3": {} } }),
	);
	assert.equal(result.published, false);
});

test("reports an unpublished package from registry 404", async () => {
	const result = await npmVersionStatus(
		"@scope/pkg",
		"1.0.0",
		async () => new Response(null, { status: 404 }),
	);
	assert.equal(result.published, false);
});

test("fails closed on registry outages", async () => {
	await assert.rejects(
		() =>
			npmVersionStatus(
				"@scope/pkg",
				"1.0.0",
				async () => new Response(null, { status: 503, statusText: "Unavailable" }),
			),
		/503 Unavailable/,
	);
});
