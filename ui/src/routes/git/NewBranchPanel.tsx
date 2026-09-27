import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function NewBranchPanel({
	busy,
	onCreate,
}: {
	busy: boolean;
	onCreate: (name: string) => void;
}) {
	const [name, setName] = useState("");
	return (
		<Card className="gap-4 py-4">
			<CardHeader className="px-5">
				<CardTitle className="text-sm">Create branch</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-3 px-5">
				<form
					className="flex gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						if (name.trim()) {
							onCreate(name.trim());
							setName("");
						}
					}}
				>
					<Input
						value={name}
						onChange={(event) => setName(event.target.value)}
						placeholder="feature/short-description"
						aria-label="New branch name"
					/>
					<Button type="submit" variant="outline" disabled={!name.trim() || busy}>
						Create
					</Button>
				</form>
				<p className="text-xs text-muted-foreground">
					Switching branches requires a clean working tree.
				</p>
			</CardContent>
		</Card>
	);
}
