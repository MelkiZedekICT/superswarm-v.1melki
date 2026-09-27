import { ArrowDownToLine, ArrowUpFromLine, GitBranch, RefreshCw, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { GitBranch as GitBranchInfo, GitSnapshot } from "./api";

export function BranchAndRemoteControls({
	snapshot,
	branches,
	branchBusy,
	syncBusy,
	onBranch,
	onSync,
	onRefresh,
}: {
	snapshot: GitSnapshot | undefined;
	branches: GitBranchInfo[];
	branchBusy: boolean;
	syncBusy: boolean;
	onBranch: (name: string) => void;
	onSync: (operation: "fetch" | "pull" | "push") => void;
	onRefresh: () => void;
}) {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<div className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
				<GitBranch className="size-4 text-muted-foreground" />
				<select
					className="max-w-48 bg-transparent outline-none"
					value={snapshot?.detached ? "" : (snapshot?.branch ?? "")}
					disabled={!snapshot || branchBusy}
					onChange={(event) => {
						if (event.target.value) onBranch(event.target.value);
					}}
					aria-label="Current Git branch"
				>
					<option value="" disabled>
						{snapshot?.branch ?? "Loading branch"}
					</option>
					{branches.map((branch) => (
						<option key={branch.name} value={branch.name}>
							{branch.name}
						</option>
					))}
				</select>
			</div>
			<Button
				size="sm"
				variant="outline"
				onClick={() => onSync("fetch")}
				disabled={syncBusy}
				title="Fetch remote updates"
			>
				<RefreshCw />
				Fetch
			</Button>
			<Button
				size="sm"
				variant="outline"
				onClick={() => {
					if (
						window.confirm(
							"Pull changes using fast-forward only? Local changes will not be overwritten.",
						)
					)
						onSync("pull");
				}}
				disabled={syncBusy || !snapshot?.upstream}
				title="Fast-forward from upstream"
			>
				<ArrowDownToLine />
				Pull
			</Button>
			<Button
				size="sm"
				variant="outline"
				onClick={() => onSync("push")}
				disabled={syncBusy || !snapshot?.upstream || !snapshot.ahead}
				title="Push commits to upstream"
			>
				<ArrowUpFromLine />
				Push
			</Button>
			<Button size="icon" variant="ghost" onClick={onRefresh} aria-label="Refresh Git status">
				<RotateCw />
			</Button>
		</div>
	);
}
