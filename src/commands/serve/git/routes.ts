import { apiError, apiJson } from "../../../json.ts";
import { registerApiHandler } from "../../serve.ts";
import { getGitSnapshot } from "./repository.ts";

/** Register the project-scoped Git API separately from the agent REST routes. */
export function registerGitApi(projectRoot: string): void {
	registerApiHandler(async (req) => {
		const { pathname } = new URL(req.url);
		if (req.method === "GET" && pathname === "/api/git/status") {
			try {
				return apiJson(await getGitSnapshot(projectRoot));
			} catch (error) {
				return apiError(error instanceof Error ? error.message : "Could not read Git status.", 400);
			}
		}
		return null;
	});
}
