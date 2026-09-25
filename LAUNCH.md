# Superswarm alpha launch

Superswarm 0.1.0-alpha.5 is the first operator-ready local-model release. It
keeps the Overstory console and orchestration workflow while enforcing local
Ollama inference for the supported path.

## Release acceptance

From a clean clone:

```sh
bun install --frozen-lockfile
bun run build:ui
bun run typecheck
bun run lint
bun test
npm pack --dry-run
```

In a disposable Git repository:

```sh
superswarm init --yes
superswarm local status
superswarm local qualify --model MODEL_TAG
superswarm local configure --model MODEL_TAG
superswarm local doctor
superswarm task plan "Update one bounded file" --files path/to/file
superswarm task "Update one bounded file" --files path/to/file
superswarm task history --since 2026-09-25
superswarm task stats
superswarm task verify
superswarm serve
```

`local doctor` must report every check as `PASS`. A real task must produce a
scoped commit with successful quality-gate evidence before that model is
advertised as supported. Qualification is tied to the installed model digest;
an updated model must qualify again.

## Operator recovery

- Inspect an attempt: `superswarm task show TASK_ID`.
- Retry it with the recorded instruction, model, and scope:
  `superswarm task retry TASK_ID`.
- Export evidence: `superswarm task export TASK_ID --output reports/TASK_ID.json`.
- Find failures: `superswarm task history --status failed --last 20`.
- Check journal integrity: `superswarm task verify --json`.

## Release boundary

The application, installers, console, local runtime, and evidence-gated task
workflow are release candidates. Model capability depends on the user's Ollama
model and hardware, so Superswarm refuses unqualified model digests instead of
claiming that every small model can complete coding work.
