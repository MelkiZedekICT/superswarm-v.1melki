import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function npmVersionStatus(packageName, version, fetcher = fetch) {
	const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
	const response = await fetcher(url, {
		headers: { Accept: "application/vnd.npm.install-v1+json" },
		signal: AbortSignal.timeout(10_000),
	});
	if (response.status === 404) return { packageName, version, published: false };
	if (!response.ok)
		throw new Error(`npm registry returned ${response.status} ${response.statusText}.`);
	const metadata = await response.json();
	return {
		packageName,
		version,
		published: Object.hasOwn(metadata.versions ?? {}, version),
	};
}

function readArgument(name) {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
	const packageName = readArgument("--package");
	const version = readArgument("--version");
	if (!packageName || !version) throw new Error("Pass --package and --version.");
	const result = await npmVersionStatus(packageName, version);
	if (process.env.GITHUB_OUTPUT)
		await appendFile(
			process.env.GITHUB_OUTPUT,
			`published=${result.published}\npackage=${result.packageName}\nversion=${result.version}\n`,
		);
	console.log(JSON.stringify(result));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]))
	await main().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
