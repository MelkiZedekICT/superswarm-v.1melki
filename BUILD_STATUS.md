# Superswarm build status

Verified on 21 September 2026 on Windows with Bun 1.4.2, Ollama 0.34.2,
about 8 GB system RAM, and an RTX 2050 with 4 GB VRAM.

## Completed

- Built the original Overstory React console with Superswarm branding. The
  production bundle and the live `/api/health`, runs, agents, and coordinator
  endpoints were served successfully from a disposable initialized project.
- Added a local-only Ollama runtime backed by the pinned Pi coding-agent SDK.
  The runtime fixes inference to `127.0.0.1:11434`, rejects redirects, cloud
  model tags, credentials, and per-role runtime overrides.
- Added a machine-wide inference lease. Separate agents keep their own worktree,
  mailbox, and session, while only one local model response consumes the GPU at
  a time. The lease is released while agents run tools.
- Added role and path guards for local tools. Writes stay inside the real
  worktree, orchestration metadata is protected, and review roles are read-only.
- Added `superswarm local status`, `test`, `qualify`, and `configure`. A model's
  exact installed digest must pass the scoped-edit fixture before configuration,
  and the worker checks that qualification again at execution time.
- Changed `superswarm init` to create a fail-closed local configuration with
  conservative agent limits. Legacy cloud aliases no longer silently select a
  model in local mode.
- Fixed Windows path handling, file URL conversion, SQLite close behavior, and
  failed-server cleanup found while validating the upstream application.
- Added Windows and POSIX installers, locked direct runtime dependencies, and
  retained the original MIT license and attribution.

## Design fidelity

Compared `ui/` with imported upstream commit
`ff38f3f76f084abcc34f519bcaa69580f6e53cf1`. Only `ui/index.html`,
`ui/src/components/Logo.tsx`, and `ui/src/lib/brand.ts` differ, and those changes
rename the product to Superswarm. Layout, styles, navigation, and controls remain
the upstream Overstory implementation. Source comparison and a live asset/API
smoke test passed; an interactive screenshot review could not run because this
Codex host could not initialize its browser automation assets.

## Verification evidence

- Production console build: passed.
- Backend TypeScript check and Biome check: passed after the final qualification
  and compact-prompt changes.
- Focused local runtime, registry, worktree, mail, server, watchdog, and merge
  suites: 203 tests passed with 0 failures.
- Full upstream run: 486 tests across 13 files passed before the Windows sandbox
  could not resolve `sh` for the Unix hook-deployer suite. The previous SQLite
  `EBUSY` cleanup failures are fixed. Native Ubuntu remains in the release matrix.
- `qwen2.5:1.5b` passed a multi-turn exact edit-and-Bun-test prerequisite. In a
  real worktree run it read the spec but made no scoped edit, invented Maven
  checks, claimed an unmade commit, and omitted terminal mail. The runner surfaced
  the contract failure instead of accepting the claim. The model is not approved.
- The installed 9.7B `qwen3.5` candidate did not become ready within one minute
  on this hardware and was stopped. It is not qualified.

## Current release boundary

The source application is installable and its local-only boundary is implemented,
but the autonomous swarm is not a production release until at least one coding
model passes qualification and a complete builder/reviewer workflow on supported
hardware. Superswarm deliberately refuses to substitute an unqualified model.

The remaining release work is:

1. Qualify a stronger small tool-capable Ollama model on this machine. The attempted
   replacement download was blocked by the registry certificate dates.
2. Demonstrate a real agent edit, test, review, session resume, cancellation, and
   merge in a disposable repository.
3. Run the full suite and installer on native Ubuntu, then publish the alpha
   package and checksums.

See [RESEARCH_GAPS.md](RESEARCH_GAPS.md) for the architecture audit and
[INSTALL.md](INSTALL.md) for the local installation workflow.
