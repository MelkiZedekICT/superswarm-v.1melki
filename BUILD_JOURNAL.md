# Superswarm build journal

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
