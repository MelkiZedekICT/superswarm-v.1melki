import { Check, FileCode2, FilePlus2, FileQuestion, FileX2, Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { GitChange } from "./api";

interface ChangeListProps {
	changes: GitChange[];
	selectedPath: string | null;
	busy: boolean;
	onSelect: (path: string, staged: boolean) => void;
	onStage: (path: string) => void;
	onUnstage: (path: string) => void;
}

function ChangeIcon({ change }: { change: GitChange }) {
	const Icon =
		change.kind === "untracked"
			? FileQuestion
			: change.kind === "added"
				? FilePlus2
				: change.kind === "deleted"
					? FileX2
					: FileCode2;
	return <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />;
}

function ChangeGroup({
	title,
	changes,
	staged,
	selectedPath,
	busy,
	onSelect,
	onStage,
	onUnstage,
}: Omit<ChangeListProps, "changes"> & { title: string; changes: GitChange[]; staged: boolean }) {
	return (
		<section>
			<div className="flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				<span>{title}</span>
				<span>{changes.length}</span>
			</div>
			{changes.length === 0 ? (
				<p className="px-3 py-2 text-xs text-muted-foreground">No files</p>
			) : (
				changes.map((change) => (
					<div
						key={`${title}:${change.path}`}
						className={`group flex items-center gap-2 rounded-md px-2 py-1.5 ${selectedPath === change.path ? "bg-accent/70" : "hover:bg-accent/40"}`}
					>
						<button
							className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
							onClick={() => onSelect(change.path, staged)}
							title={change.path}
						>
							<ChangeIcon change={change} />
							<span className="truncate">{change.path}</span>
							<span className="ml-auto font-mono text-xs text-muted-foreground">
								{change.indexStatus}
								{change.worktreeStatus}
							</span>
						</button>
						{staged ? (
							<Button
								size="icon"
								variant="ghost"
								className="size-7 opacity-0 group-hover:opacity-100 focus:opacity-100"
								disabled={busy}
								onClick={() => onUnstage(change.path)}
								aria-label={`Unstage ${change.path}`}
								title="Unstage"
							>
								<Minus />
							</Button>
						) : (
							<Button
								size="icon"
								variant="ghost"
								className="size-7 opacity-0 group-hover:opacity-100 focus:opacity-100"
								disabled={busy}
								onClick={() => onStage(change.path)}
								aria-label={`Stage ${change.path}`}
								title="Stage"
							>
								<Plus />
							</Button>
						)}
					</div>
				))
			)}
		</section>
	);
}

export function ChangeList(props: ChangeListProps) {
	const staged = props.changes.filter((change) => change.staged);
	const unstaged = props.changes.filter((change) => change.unstaged);
	return (
		<div className="flex flex-col gap-3">
			<ChangeGroup {...props} title="Staged" changes={staged} staged />
			<ChangeGroup {...props} title="Changes" changes={unstaged} staged={false} />
			{props.changes.length === 0 && (
				<div className="flex items-center gap-2 px-3 text-xs text-muted-foreground">
					<Check className="size-4" />
					Working tree clean
				</div>
			)}
		</div>
	);
}
