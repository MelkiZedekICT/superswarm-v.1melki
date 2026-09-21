#!/usr/bin/env sh
set -eu

for tool in git bun ollama; do
  command -v "$tool" >/dev/null 2>&1 || { echo "Missing required command: $tool" >&2; exit 1; }
done

repo=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$repo"
bun install --frozen-lockfile
(
  cd ui
  bun install --frozen-lockfile
  bun run build
)
bun link
printf '%s\n' 'Superswarm installed. Run: superswarm --help'
printf '%s\n' 'Then initialize a Git project with: superswarm init --yes'
