import type { TaskJournalEntry } from "./journal.ts";

export function taskRetryInput(entry: TaskJournalEntry): {
	instruction: string;
	files: string;
	model: string;
} {
	if (!entry.scope || entry.scope.length === 0)
		throw new Error(
			`Task ${entry.taskId} predates retry metadata. Run it again with an explicit --files scope.`,
		);
	return {
		instruction: entry.instruction,
		files: entry.scope.join(","),
		model: entry.model,
	};
}
