# Superswarm baseline

This repository starts from the complete, unmodified Overstory application by
Jaymin West. The original MIT license and attribution are retained in LICENSE.

- Upstream: https://github.com/jayminwest/overstory
- Imported commit: `ff38f3f76f084abcc34f519bcaa69580f6e53cf1`
- Upstream package version: `0.11.0`
- Project repository: https://github.com/MelkiZedekICT/superswarm-v.1melki

## Current status

The upstream source and Git history have been imported. The application is
branded Superswarm with an additional `superswarm` command alias. A local Ollama
runtime, fail-closed routing, model qualification, and sequential inference
scheduling are now implemented. The interface build, TypeScript check, lint,
focused local/runtime tests, and a live console/API smoke test pass on Windows. See
[BUILD_STATUS.md](BUILD_STATUS.md) for evidence and [PROJECT.md](PROJECT.md) for
the agreed scope. This remains an alpha: the 1.5B model passed the edit-and-test
prerequisite but failed a real worktree task, so no installed model is approved
for autonomous builder work.

The next step is to qualify two or three suitably small local models and validate
the installer and full workflow on native Ubuntu. Imported cloud adapters remain
in source for compatibility, while a project initialized by Superswarm defaults
to local routing and rejects remote role/helper overrides.

## Continue on Ubuntu

Install Git and Bun using their official instructions, then clone this project:

```sh
git clone https://github.com/MelkiZedekICT/superswarm-v.1melki.git
cd superswarm-v.1melki
bun install --frozen-lockfile
bun run build:ui
bun run typecheck
bun run lint
bun test
bun src/index.ts --help
```

Consult README.md for the original application workflow and prerequisites.
Interactive runtime workflows may need tmux and the relevant runtime CLI.
Do not start cloud-backed agents as part of baseline validation.

The previous Windows environment had no working Ubuntu WSL disk; switching
to the machine's native Ubuntu installation avoids that specific blocker.
Ubuntu 26 compatibility has not yet been tested.
