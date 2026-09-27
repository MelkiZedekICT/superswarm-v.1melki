import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/lib/toast";
import {
	changeGitBranch,
	commitGitFiles,
	fetchGitBranches,
	fetchGitDiff,
	fetchGitHistory,
	fetchGitStatus,
	stageGitFile,
	syncGitRemote,
	type GitSnapshot,
	unstageGitFile,
} from "./api";
import { ChangeList } from "./ChangeList";
import { BranchAndRemoteControls } from "./BranchAndRemoteControls";
import { CommitPanel } from "./CommitPanel";
import { DiffPanel } from "./DiffPanel";
import { HistoryPanel } from "./HistoryPanel";
import { NewBranchPanel } from "./NewBranchPanel";

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : "Git action failed.";
}

export function GitPage() {
	const queryClient = useQueryClient();
	const [selectedPath, setSelectedPath] = useState<string | null>(null);
	const [selectedStaged, setSelectedStaged] = useState(false);
	const statusQuery = useQuery({
		queryKey: ["git", "status"],
		queryFn: fetchGitStatus,
		refetchInterval: 5000,
	});
	const historyQuery = useQuery({
		queryKey: ["git", "history"],
		queryFn: fetchGitHistory,
		refetchInterval: 30000,
	});
	const branchesQuery = useQuery({
		queryKey: ["git", "branches"],
		queryFn: fetchGitBranches,
		refetchInterval: 30000,
	});
	const diffQuery = useQuery({
		queryKey: ["git", "diff", selectedPath, selectedStaged],
		queryFn: () => fetchGitDiff(selectedPath ?? "", selectedStaged),
		enabled: selectedPath !== null,
	});
	const refresh = () => queryClient.invalidateQueries({ queryKey: ["git"] });
	const onError = (error: Error) => toast.error(error.message);
	const onSnapshot = (snapshot: GitSnapshot, label: string) => {
		queryClient.setQueryData(["git", "status"], snapshot);
		void refresh();
		toast.success(label);
	};
	const stageMutation = useMutation({
		mutationFn: stageGitFile,
		onSuccess: (data) => onSnapshot(data, "File staged"),
		onError,
	});
	const unstageMutation = useMutation({
		mutationFn: unstageGitFile,
		onSuccess: (data) => onSnapshot(data, "File unstaged"),
		onError,
	});
	const commitMutation = useMutation({
		mutationFn: commitGitFiles,
		onSuccess: (result) => {
			onSnapshot(result.snapshot, `Committed ${result.hash.slice(0, 8)}`);
		},
		onError,
	});
	const branchMutation = useMutation({
		mutationFn: (input: { name: string; create: boolean }) =>
			changeGitBranch(input.name, input.create),
		onSuccess: (data) => onSnapshot(data, `Switched to ${data.branch}`),
		onError,
	});
	const syncMutation = useMutation({
		mutationFn: syncGitRemote,
		onSuccess: (data, operation) => onSnapshot(data, `Git ${operation} completed`),
		onError,
	});
	const snapshot = statusQuery.data;
	const stagedCount = snapshot?.changes.filter((change) => change.staged).length ?? 0;
	const busy =
		stageMutation.isPending ||
		unstageMutation.isPending ||
		commitMutation.isPending ||
		branchMutation.isPending ||
		syncMutation.isPending;

	useEffect(() => {
		if (selectedPath === null && snapshot?.changes[0]) setSelectedPath(snapshot.changes[0].path);
		if (
			selectedPath &&
			snapshot &&
			!snapshot.changes.some((change) => change.path === selectedPath)
		)
			setSelectedPath(snapshot.changes[0]?.path ?? null);
	}, [selectedPath, snapshot]);

	function selectFile(path: string, staged: boolean) {
		setSelectedPath(path);
		setSelectedStaged(staged);
	}

	return (
		<div className="mx-auto flex max-w-7xl flex-col gap-5 p-6">
			<header className="flex flex-wrap items-center justify-between gap-4">
				<div className="min-w-0">
					<h1 className="text-xl font-semibold tracking-tight">Git</h1>
					{snapshot && (
						<p
							className="mt-1 truncate font-mono text-xs text-muted-foreground"
							title={snapshot.root}
						>
							{snapshot.root}
						</p>
					)}
				</div>
				<BranchAndRemoteControls
					snapshot={snapshot}
					branches={branchesQuery.data ?? []}
					branchBusy={branchMutation.isPending}
					syncBusy={syncMutation.isPending}
					onBranch={(name) => branchMutation.mutate({ name, create: false })}
					onSync={(operation) => syncMutation.mutate(operation)}
					onRefresh={() => void refresh()}
				/>
			</header>

			{statusQuery.isError && (
				<div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
					{errorMessage(statusQuery.error)}
				</div>
			)}
			{snapshot && (
				<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
					<span>
						{snapshot.changes.length} changed file{snapshot.changes.length === 1 ? "" : "s"}
					</span>
					{snapshot.upstream ? (
						<>
							<span>Tracking {snapshot.upstream}</span>
							<span>{snapshot.ahead} ahead</span>
							<span>{snapshot.behind} behind</span>
						</>
					) : (
						<span>No upstream configured</span>
					)}
				</div>
			)}

			<div className="grid gap-5 xl:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.6fr)]">
				<Card className="gap-3 py-3">
					<CardHeader className="px-4 py-2">
						<CardTitle className="text-sm">Changes</CardTitle>
					</CardHeader>
					<CardContent className="px-3">
						<ChangeList
							changes={snapshot?.changes ?? []}
							selectedPath={selectedPath}
							busy={busy}
							onSelect={selectFile}
							onStage={(path) => stageMutation.mutate(path)}
							onUnstage={(path) => unstageMutation.mutate(path)}
						/>
					</CardContent>
				</Card>
				<Card className="min-w-0 gap-4 py-4">
					<CardHeader className="px-5">
						<CardTitle className="text-sm">Review diff</CardTitle>
					</CardHeader>
					<CardContent className="min-w-0 px-5">
						{selectedPath && (
							<div className="mb-3 flex gap-2">
								<Button
									size="sm"
									variant={!selectedStaged ? "secondary" : "ghost"}
									onClick={() => setSelectedStaged(false)}
								>
									Working tree
								</Button>
								<Button
									size="sm"
									variant={selectedStaged ? "secondary" : "ghost"}
									onClick={() => setSelectedStaged(true)}
								>
									Staged
								</Button>
							</div>
						)}
						<DiffPanel
							path={selectedPath}
							diff={diffQuery.data?.diff}
							loading={diffQuery.isLoading}
							error={diffQuery.error ? errorMessage(diffQuery.error) : null}
							truncated={diffQuery.data?.truncated ?? false}
						/>
					</CardContent>
				</Card>
			</div>

			<div className="grid gap-5 xl:grid-cols-2">
				<CommitPanel
					stagedCount={stagedCount}
					busy={commitMutation.isPending}
					onCommit={async (commitMessage) => {
						await commitMutation.mutateAsync(commitMessage);
					}}
				/>
				<NewBranchPanel
					busy={branchMutation.isPending}
					onCreate={(name) => branchMutation.mutate({ name, create: true })}
				/>
			</div>

			{historyQuery.isError && (
				<div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
					{errorMessage(historyQuery.error)}
				</div>
			)}
			<HistoryPanel commits={historyQuery.data ?? []} />
		</div>
	);
}
