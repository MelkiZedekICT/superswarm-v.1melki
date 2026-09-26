import { access, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_PACKAGE = "@melkizedekict/superswarm";
const EXPECTED_REPOSITORY = "https://github.com/MelkiZedekICT/superswarm-v.1melki.git";
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function validateReleaseMetadata({ packageJson, source, changelog, expectedTag }) {
	const errors = [];
	if (packageJson.name !== EXPECTED_PACKAGE)
		errors.push(`Package name must be ${EXPECTED_PACKAGE}.`);
	if (!VERSION_PATTERN.test(packageJson.version ?? ""))
		errors.push(`Invalid package version: ${packageJson.version ?? "missing"}.`);
	const sourceVersion = source.match(/export const VERSION = "([^"]+)"/)?.[1];
	if (sourceVersion !== packageJson.version)
		errors.push(
			`Version mismatch: package.json=${packageJson.version} src/index.ts=${sourceVersion}.`,
		);
	if (packageJson.repository?.url !== EXPECTED_REPOSITORY)
		errors.push(`Repository must be ${EXPECTED_REPOSITORY}.`);
	if (!packageJson.bin?.superswarm) errors.push("The superswarm executable is missing.");
	if (!changelog.includes(`## [${packageJson.version}]`))
		errors.push(`CHANGELOG.md has no ${packageJson.version} release section.`);
	if (expectedTag && expectedTag !== `v${packageJson.version}`)
		errors.push(`Tag mismatch: expected v${packageJson.version}, received ${expectedTag}.`);
	return { valid: errors.length === 0, version: packageJson.version, errors };
}

export async function checkRelease(root, expectedTag) {
	const [packageText, source, changelog] = await Promise.all([
		readFile(join(root, "package.json"), "utf8"),
		readFile(join(root, "src", "index.ts"), "utf8"),
		readFile(join(root, "CHANGELOG.md"), "utf8"),
	]);
	for (const required of [
		join(root, "LICENSE"),
		join(root, "README.md"),
		join(root, "ui", "dist", "index.html"),
	])
		await access(required);
	return validateReleaseMetadata({
		packageJson: JSON.parse(packageText),
		source,
		changelog,
		expectedTag,
	});
}

async function main() {
	const root = join(dirname(fileURLToPath(import.meta.url)), "..");
	const tagIndex = process.argv.indexOf("--tag");
	const expectedTag = tagIndex >= 0 ? process.argv[tagIndex + 1] : undefined;
	const result = await checkRelease(root, expectedTag);
	if (!result.valid) {
		for (const error of result.errors) console.error(`- ${error}`);
		process.exitCode = 1;
		return;
	}
	console.log(`Superswarm ${result.version} is ready to publish.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await main();
