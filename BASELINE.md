# SuperSwarm baseline

This repository starts from the complete, unmodified Overstory application by
Jaymin West. The original MIT license and attribution are retained in LICENSE.

- Upstream: https://github.com/jayminwest/overstory
- Imported commit: `ff38f3f76f084abcc34f519bcaa69580f6e53cf1`
- Upstream package version: `0.11.0`
- Project repository: https://github.com/MelkiZedekICT/superswarm-v.1melki

## Current status

The upstream source and Git history have been imported. Application code,
interface, runtime adapters, and model defaults have not been customized.
Build and test verification are still pending. This is a source baseline, not
a verified release. No local models have been installed or connected.

The next step is to build and validate the existing application on Ubuntu,
then integrate two or three local models. The eventual product must run
inference locally without paid model APIs. Upstream cloud defaults are still
present and must be replaced before claiming local-only operation.

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
