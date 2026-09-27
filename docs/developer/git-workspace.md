# Git workspace

Superswarm's **Git** page gives the local operator console a focused view of the
repository that was selected when `superswarm serve` started. Open it from the
top navigation or the `Ctrl+K` / `Cmd+K` command palette.

The page shows the current branch, upstream, ahead/behind counts, staged and
unstaged files, path-scoped diffs, and recent commits. It supports staging and
unstaging individual changed files, committing only staged files, creating or
switching local branches, fetching remote updates, pushing the current branch,
and fast-forward-only pulls.

Branch switching stops when there are uncommitted changes, preserving them on
the current branch. Pull asks for confirmation and refuses merge commits. Push
uses the branch's configured upstream; the page won't set tracking or create a
remote branch implicitly. Git commands run as argument arrays in the selected
project root; file actions accept only repository-relative paths.

The implementation lives in `src/commands/serve/git/` and
`ui/src/routes/git/`. The Git API is local to `superswarm serve`; it does not
add a hosted Git service or modify Git remotes and credentials.
