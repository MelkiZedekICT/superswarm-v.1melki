import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquireTurnLock } from "../../agents/turn-lock.ts";

export function assertLocalUrl(input: string): URL {
	const url = new URL(input);
	if (url.origin !== "http://127.0.0.1:11434" || url.username || url.password) {
		throw new Error("Remote inference is disabled. Superswarm uses Ollama at 127.0.0.1:11434.");
	}
	return url;
}

/** Hold the GPU lease through response consumption, releasing before any tool runs. */
export function localFetch(original: typeof fetch): typeof fetch {
	return Object.assign(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
		const rawUrl = input instanceof Request ? input.url : String(input);
		if (process.env.SUPERSWARM_DEBUG === "1") {
			process.stderr.write(`[local-fetch] ${rawUrl} init=${Object.keys(init ?? {}).join(",")}\n`);
		}
		const url = assertLocalUrl(rawUrl);
		if (url.pathname !== "/v1/chat/completions")
			return original(input, { ...init, redirect: "error" });
		const lockDir = join(tmpdir(), "superswarm-local-inference");
		await mkdir(lockDir, { recursive: true });
		const lock = await acquireTurnLock({
			agentName: "local-inference",
			overstoryDir: lockDir,
			timeoutMs: 600000,
		});
		try {
			init?.signal?.throwIfAborted();
			const response = await original(input, { ...init, redirect: "error" });
			if (process.env.SUPERSWARM_DEBUG === "1") {
				process.stderr.write(`[local-fetch] ${response.status} ${response.statusText}\n`);
			}
			if (!response.body) {
				lock.release();
				return response;
			}
			const reader = response.body.getReader();
			return new Response(
				new ReadableStream<Uint8Array>({
					async pull(controller) {
						try {
							const { done, value } = await reader.read();
							if (done) {
								lock.release();
								controller.close();
							} else controller.enqueue(value);
						} catch (error) {
							lock.release();
							controller.error(error);
						}
					},
					async cancel(reason) {
						try {
							await reader.cancel(reason);
						} finally {
							lock.release();
						}
					},
				}),
				{ status: response.status, statusText: response.statusText, headers: response.headers },
			);
		} catch (error) {
			if (process.env.SUPERSWARM_DEBUG === "1") {
				process.stderr.write(
					`[local-fetch] failed: ${error instanceof Error ? error.stack : String(error)}\n`,
				);
			}
			lock.release();
			throw error;
		}
	}, original);
}
