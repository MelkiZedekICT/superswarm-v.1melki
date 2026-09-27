import { FileDiff } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { LoadingCard } from "@/components/ui/loading-card";

export function DiffPanel({
	path,
	diff,
	loading,
	error,
	truncated,
}: {
	path: string | null;
	diff: string | undefined;
	loading: boolean;
	error: string | null;
	truncated: boolean;
}) {
	if (!path)
		return (
			<EmptyState
				icon={FileDiff}
				title="Select a changed file"
				description="Choose a file to inspect its staged or working changes."
				className="min-h-64"
			/>
		);
	if (loading) return <LoadingCard label="Loading diff" />;
	if (error)
		return (
			<div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
				{error}
			</div>
		);
	return (
		<div>
			<div className="mb-3 flex items-center justify-between gap-3">
				<h2 className="min-w-0 truncate font-mono text-sm" title={path}>
					{path}
				</h2>
				{truncated && (
					<span className="shrink-0 text-xs text-muted-foreground">Preview shortened</span>
				)}
			</div>
			<pre className="max-h-[34rem] overflow-auto rounded-lg border border-border bg-muted/40 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
				{diff || "No diff for this version of the file."}
			</pre>
		</div>
	);
}
