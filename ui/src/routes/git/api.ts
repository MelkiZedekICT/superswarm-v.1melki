export interface GitChange {
	path: string;
	indexStatus: string;
	worktreeStatus: string;
	kind: string;
	staged: boolean;
	unstaged: boolean;
}

export interface GitSnapshot {
	root: string;
	branch: string;
	detached: boolean;
	upstream: string | null;
	ahead: number;
	behind: number;
	changes: GitChange[];
}

export interface GitCommit {
	hash: string;
	shortHash: string;
	subject: string;
	author: string;
	committedAt: string;
}

export interface GitBranch {
	name: string;
	current: boolean;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`/api/git/${path}`, init);
	const body = (await response.json()) as { success: boolean; data?: T; error?: string };
	if (!response.ok || !body.success || body.data === undefined)
		throw new Error(body.error ?? `Git request failed: ${response.status}`);
	return body.data;
}

function post<T>(path: string, body?: unknown): Promise<T> {
	return request<T>(path, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
}

export const fetchGitStatus = () => request<GitSnapshot>("status");
export const fetchGitHistory = () => request<GitCommit[]>("history");
export const fetchGitBranches = () => request<GitBranch[]>("branches");
export const fetchGitDiff = (path: string, staged: boolean) =>
	request<{ path: string; staged: boolean; diff: string; truncated: boolean }>(
		`diff?${new URLSearchParams({ path, staged: String(staged) })}`,
	);
export const stageGitFile = (path: string) => post<GitSnapshot>("stage", { path });
export const unstageGitFile = (path: string) => post<GitSnapshot>("unstage", { path });
export const commitGitFiles = (message: string) =>
	post<{ hash: string; message: string; snapshot: GitSnapshot }>("commit", { message });
export const changeGitBranch = (name: string, create: boolean) =>
	post<GitSnapshot>("branch", { name, create });
export const syncGitRemote = (operation: "fetch" | "pull" | "push") =>
	post<GitSnapshot>(operation);
