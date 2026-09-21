# Superswarm: project direction and build notes

Updated: 21 September 2026.

## What we are building

Superswarm is a local coding-agent application based on the complete Overstory
codebase by Jaymin West. Preserve Overstory's interface, commands, roles, Git
worktrees, agent messaging, monitoring, and merge workflow. Make small product
differences later, after the baseline works.

Repository: https://github.com/MelkiZedekICT/superswarm-v.1melki

### Requirements confirmed with the owner

- Name: **Superswarm**.
- Build the existing Overstory application first; do not substitute a new chat UI.
- Next, integrate two or three local models to do the work.
- All eventual inference must run on the user's own machine, with no paid model
  API, mandatory cloud account, rented GPU, or remote fallback.
- This is an installable application, not a publicly hosted website. Overstory's
  optional localhost browser console remains part of the application.
- Budget: zero additional cash spend. Existing hardware and internet are assumed.
- Aim for a 72-hour alpha; never label incomplete verification as a finished release.
- The owner has some TypeScript/Python, Git, and Docker familiarity and wants to
  learn while building, especially the runtime, scheduling, and permissions logic.
- Lower-end machines matter. Choose supported model profiles by measurement;
  default to sequential inference if memory requires it.
- The machine is dual-boot Windows/Ubuntu. Native Ubuntu was proposed for full
  workflow validation. This Codex task is currently attached to the Windows folder.

The earlier suggestion of a public web app with rented GPU hosting was explicitly
rejected. Do not revive that architecture without a new instruction from the owner.

## Research findings and decisions

1. Upstream Overstory is archived, but its full source and history are available.
   We imported commit `ff38f3f76f084abcc34f519bcaa69580f6e53cf1`, version 0.11.0.
   Keep the original MIT license and attribution.
2. Bun runs the backend TypeScript directly; the React operator console has a
   separate build. Validate both instead of assuming a successful clone is a build.
3. The current adapters are not equally complete. The imported Pi adapter is
   experimental, and OpenCode contains stubs. Validate the chosen runtime before
   promising parity. A runtime listed in the registry is not a tested integration.
4. The imported defaults selected cloud-backed runtimes/models. Superswarm's init
   path now selects the local runtime and rejects cloud role overrides. Imported
   adapters remain available only to older Overstory configurations.
5. Local-only routing must cover coordinators, workers, reviewers, merge helpers,
   and recovery calls. Adding local builder models alone is insufficient.
6. Agent roles can share one loaded model with separate state. Two or three model
   choices do not require loading them simultaneously. Actual RAM/VRAM and task
   measurements must determine model size and concurrency.
7. A localhost model endpoint is not a paid cloud API. If absolutely no HTTP model
   server is wanted, an embedded llama.cpp adapter is an alternative requiring
   more integration work. This distinction remains to be confirmed at model setup.
8. Git worktrees isolate edits, not arbitrary shell execution. Preserve permissions,
   cancellation, review, and honest error reporting as first-class behavior.

Sources consulted/rechecked on 19 September 2026:

- [Overstory upstream and maintenance status](https://github.com/jayminwest/overstory)
- [Bun installation and Windows support](https://bun.sh/docs/installation)
- [Upstream runtime adapter guide](https://github.com/jayminwest/overstory/blob/main/docs/runtime-adapters.md)
- [Pi local model configuration](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/models.md)
- [Ollama concurrency and local-only configuration](https://docs.ollama.com/faq)

The first two sources were refreshed for this build session. The remaining sources
were inspected during the preceding research session. The original detailed report
is in the parent workspace's research folder; this file is the portable project note.

The repository-focused gap audit is in [RESEARCH_GAPS.md](RESEARCH_GAPS.md). Its
main finding is that local-first orchestration needs inference-resource scheduling,
model qualification, and fail-closed routing in addition to a local provider URL.

## Build sequence

### Stage 1 — complete upstream application baseline

- Install locked backend and interface dependencies.
- Build the existing console and run CLI smoke checks.
- Run type checking, lint, and upstream tests; record platform-specific failures.
- Initialize a disposable target project and verify actual backend state through
  status/mail/API checks without model calls.
- Start and inspect the real local console, retaining the upstream layout.
- Keep repeatable startup/verification instructions and commit the results.

### Stage 2 — local inference

- Measure actual hardware and select two or three appropriate model candidates.
- Prove one tool-using agent: read a file, edit, run a test, and produce a diff.
- Route every role and helper call locally; fail closed on missing local settings.
- Test sequential planner/builder/reviewer handoffs and cancellation.
- Prove a prepared fixture works without external network access.

### Stage 3 — alpha release

- Verify clean installation on the supported OS.
- Publish exact versions, model profiles, measured limits, and known issues.
- Release a downloadable application with attribution and setup instructions.
- Make small visual/product differences only after the functional baseline.

## Current evidence

- Full upstream source/history imported and pushed to the owner's repository.
- Superswarm branding and command alias pushed in commit `d0c694d`.
- Bun 1.4.2 is available locally in the Windows workspace tools folder.
- The previously registered Ubuntu WSL installation could not start because its
  virtual disk was missing. This does not establish a problem with native Ubuntu.
- Ollama 0.34.2 and three installed models were discovered locally. The small
  `qwen2.5:1.5b` model passed an exact edit-and-test prerequisite but failed a real
  worktree task: it made no scoped changes, invented Maven checks, and omitted
  terminal mail. The 9.7B candidate did not load within one minute. Neither is
  approved for an autonomous role.
- Local routing, serialized inference, tool guards, qualification, installers,
  and the live console/API smoke test are implemented. Detailed evidence and the
  remaining release boundary are recorded in BUILD_STATUS.md.

## Manual coding and learning priorities

Own and understand runtime configuration, tool-call/result continuity, queue
ownership, path/command permissions, cancellation, and merge/recovery decisions.
Read the relevant upstream module, reproduce its behavior in a disposable fixture,
then make one small change with a focused regression check. Use assistance for
boilerplate and explanations; do not ship critical code that cannot be explained.

## Definition of done

Stage 1 is complete only when builds and necessary checks are demonstrated and
remaining platform limits are stated. The product is complete only after real
local model execution, handoffs, reviewable changes, and installation are verified.
Source imported, branded, committed, or pushed is not synonymous with working.
