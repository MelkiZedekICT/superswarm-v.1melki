export const DEFAULT_TASK_TIMEOUT_MINUTES = 30;
export const MAX_TASK_TIMEOUT_MINUTES = 120;

export function parseTaskTimeout(raw: string | undefined): number {
	const minutes = raw === undefined ? DEFAULT_TASK_TIMEOUT_MINUTES : Number(raw);
	if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_TASK_TIMEOUT_MINUTES)
		throw new Error(
			`Task timeout must be an integer from 1 to ${MAX_TASK_TIMEOUT_MINUTES} minutes.`,
		);
	return minutes;
}
