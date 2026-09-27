import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function CommitPanel({
	stagedCount,
	busy,
	onCommit,
}: {
	stagedCount: number;
	busy: boolean;
	onCommit: (message: string) => Promise<void>;
}) {
	const [message, setMessage] = useState("");
	return (
		<Card className="gap-4 py-4">
			<CardHeader className="px-5">
				<CardTitle className="text-sm">Commit changes</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-3 px-5">
				<form
					className="flex flex-col gap-3 sm:flex-row"
					onSubmit={(event) => {
						event.preventDefault();
						void onCommit(message)
							.then(() => setMessage(""))
							.catch(() => {});
					}}
				>
					<Input
						value={message}
						onChange={(event) => setMessage(event.target.value)}
						maxLength={2000}
						placeholder="Commit message"
						aria-label="Commit message"
					/>
					<Button type="submit" disabled={!stagedCount || !message.trim() || busy}>
						{busy ? "Committing…" : `Commit ${stagedCount} staged`}
					</Button>
				</form>
				<p className="text-xs text-muted-foreground">
					Only staged changes are included in the commit.
				</p>
			</CardContent>
		</Card>
	);
}
