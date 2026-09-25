# Superswarm build journal

## 25 September 2026 — first operator-ready alpha

- Added durable scope, digest, duration, timeout, worktree, quality, and error
  evidence for every verified task.
- Added task inspection, outcome/model/date history filters, portable evidence
  export, preflight planning, bounded execution, evidence-based retry,
  reliability statistics, and journal integrity verification.
- Added `local doctor` for end-to-end launch readiness and `local
  qualifications` for current, stale, and unqualified Ollama model digests.
- Published a reproducible launch checklist and advanced the application to
  `0.1.0-alpha.5`.

Architecture decision: keep task records append-only and expose derived views
as streaming readers. This preserves audit evidence while keeping memory bounded
for long-lived projects.

## 24 September 2026 — operator task history

- Added `superswarm task history` so operators can review completed and failed
  local file-task attempts without opening the JSONL journal manually.
- Added `--last 1..100` and `--json` output for terminal use and automation.
- Implemented bounded reverse journal reads in 64 KB chunks. History lookup
  stops once it has enough recent records instead of loading an indefinitely
  growing journal into memory.
- Added tests for newest-first ordering, requested limits, append preservation,
  and invalid limits. Verified the CLI against the disposable acceptance journal.

## 24 September 2026 — task engine architecture cleanup

- Audited the file-task implementation with the architect-review, clean-code,
  and refactor-clean workflows. The main hotspot was `src/commands/task.ts`,
  which combined CLI presentation, policy, Git, process execution, persistence,
  and orchestration in one module.
- Reduced the command to input/output handling and moved task behavior into the
  `src/tasks/` boundary: evidence policy, Git adapter, append-only journal, and
  workflow runner. The runtime-facing behavior and CLI syntax remain unchanged.
- Replaced whole-file journal rewrites with append-only writes. Journal cost no
  longer grows with the number of completed tasks.
- Removed a duplicate Ollama model-list request by returning the already-checked
  installed model from qualification.
- Added a regression test proving that journal entries append without replacing
  earlier task evidence.

Architecture decision: keep task acceptance rules pure and independent from the
agent runtime. A future local decision engine or stronger model can replace the
runner without weakening scope, diff, quality-gate, and commit evidence.

## 23 September 2026 — evidence-gated local task execution

- Confirmed that orchestration existed but there was no simple evidence-based
  command for completing one coding task.
- Retested `qwen3.5:latest` on the target 8 GB RAM / 4 GB VRAM computer. Ollama
  loaded the model, but it produced no tool output during the bounded trial. It
  remains unsuitable as the default low-end profile.
- Added `superswarm task`: it creates an isolated Git worktree and branch, runs
  a qualified local model, enforces declared file scope, reruns quality gates,
  and commits only after objective evidence passes.
- Added `.overstory/task-journal.jsonl`. Each attempt records the exact model
  digest, instruction, worktree, branch, changed files, checks, commit,
  timestamps, and failure reason.
- Direct task mode no longer depends on an agent claiming completion through
  terminal mail. No diff, an out-of-scope edit, a failed check, or a missing
  clean result makes the task fail.

This proves bounded coding tasks when a model passes qualification. It does not
claim every natural-language software task will succeed on a 1.5B model.

### Acceptance attempts

The `qwen2.5:1.5b` model passed the exact edit-and-test prerequisite. It then
failed three disposable `superswarm task` attempts: it supplied invalid edit
arguments, described a shell command without executing it, and stopped with no
project diff. Superswarm rejected every run and recorded the evidence instead of
creating a commit. The task engine is ready; this installed model is not approved
for general coding tasks. A stronger model must pass the same workflow before the
product can claim autonomous task completion on this computer.
