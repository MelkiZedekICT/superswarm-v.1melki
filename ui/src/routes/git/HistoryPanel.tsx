import { GitCommitHorizontal, History } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import type { GitCommit } from "./api";

export function HistoryPanel({ commits }: { commits: GitCommit[] }) {
	return (
		<section className="rounded-xl border border-border bg-card">
			<header className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold">
				<History className="size-4 text-muted-foreground" />
				Recent commits
			</header>
			{commits.length === 0 ? (
				<EmptyState
					icon={GitCommitHorizontal}
					title="No commits yet"
					description="Create the repository's first commit from the command line."
					className="m-4"
				/>
			) : (
				<ul className="divide-y divide-border">
					{commits.slice(0, 12).map((commit) => (
						<li key={commit.hash} className="flex items-start gap-3 px-4 py-3">
							<GitCommitHorizontal className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm" title={commit.subject}>
									{commit.subject}
								</p>
								<p className="mt-1 text-xs text-muted-foreground">
									{commit.author} · {new Date(commit.committedAt).toLocaleString()}
								</p>
							</div>
							<code className="text-xs text-muted-foreground">{commit.shortHash}</code>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
