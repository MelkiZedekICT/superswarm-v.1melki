import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const requiredFiles = [
	"LICENSE",
	"README.md",
	"src/index.ts",
	"src/tasks/runner.ts",
	"src/runtimes/local.ts",
	"ui/dist/index.html",
];

const missing = [];
for (const relativePath of requiredFiles) {
	try {
		const info = await stat(join(root, relativePath));
		if (!info.isFile() || info.size === 0) missing.push(relativePath);
	} catch {
		missing.push(relativePath);
	}
}

let assets = [];
try {
	assets = await readdir(join(root, "ui/dist"), { recursive: true });
} catch {
	missing.push("ui/dist");
}

if (!assets.some((name) => name.endsWith(".js"))) {
	missing.push("ui/dist/**/*.js");
}
if (!assets.some((name) => name.endsWith(".css"))) {
	missing.push("ui/dist/**/*.css");
}

const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
if (packageJson.name !== "@melkizedekict/superswarm") missing.push("package.json#name");
if (packageJson.bin?.superswarm !== "./src/index.ts") missing.push("package.json#bin.superswarm");
if (packageJson.repository?.url !== "https://github.com/MelkiZedekICT/superswarm-v.1melki.git")
	missing.push("package.json#repository.url");

if (missing.length > 0) {
	console.error("Superswarm package is incomplete. Build the UI before publishing.");
	for (const path of missing) console.error(`- ${path}`);
	process.exit(1);
}

console.log("Superswarm package contents verified.");
