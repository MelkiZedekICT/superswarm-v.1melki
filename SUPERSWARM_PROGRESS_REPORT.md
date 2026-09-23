# Superswarm progress and Jev integration report

Updated: 23 September 2026  
Repository: `MelkiZedekICT/superswarm-v.1melki`  
Assessed revision before this report: `93b714d`

## Executive assessment

Superswarm is a working local-first fork of Overstory with the original console
design, a fail-closed Ollama runtime, local resource scheduling, role guards,
model qualification commands, installers, and a built dashboard. The framework
is substantially built. It is not yet a dependable autonomous coding release
because no model that fits the target 8 GB RAM / 4 GB VRAM machine has passed a
complete builder-reviewer workflow.

Two numbers best describe the project:

- **Core engineering: approximately 75% complete.** The application,
  orchestration, UI, local inference boundary, and most packaging work exist.
- **Release acceptance: 6 of 10 major gates complete.** The remaining gates are
  a qualified coding model, a full real-repository lifecycle, native Ubuntu
  validation, and publication of an installable alpha.

These are planning estimates, not test coverage percentages. The critical path
is model capability on low-end hardware, rather than missing screens or basic
orchestration code.

## Milestone ledger

| Gate | Status | Evidence |
|---|---|---|
| Import Overstory and preserve its workflows | Complete | Overstory 0.11.0 source and CLI are present. |
| Match the Overstory console design | Complete | Only the HTML title, logo, and brand constants differ from the imported UI. |
| Run inference locally without cloud fallbacks | Complete | The local adapter is fixed to loopback Ollama and rejects cloud tags, credentials, redirects, and remote overrides. |
| Schedule scarce local inference | Complete | A machine-wide lease serializes model generation while allowing Git and tool work to overlap. |
| Protect worktrees and agent roles | Complete for application guards | Writes are scoped to the real worktree; coordination data is protected; reviewers are read-only. An OS/container sandbox remains future hardening. |
| Provide setup and model qualification tools | Complete | `local status`, `test`, `qualify`, and `configure` exist, with digest-bound qualification. |
| Produce a valid npm package | Complete after this report's fix | Publishing now verifies the committed dashboard instead of rebuilding it during `prepack`. |
| Qualify a practical local coding model | Blocked | `qwen2.5:1.5b` passed a small edit fixture but failed a real builder run. The installed 9.7B candidate did not load within one minute on the target machine. |
| Pass a complete builder-reviewer-resume-cancel-merge run | Pending | This depends on a qualified model. |
| Validate Ubuntu and publish the alpha | Pending | Windows checks are strong; the Unix installer and full suite still require native Ubuntu validation. |

## What is implemented

### Product and design

- The product is branded **Superswarm** while preserving Overstory's layout,
  navigation, styles, console, run views, agent views, and coordinator views.
- The dashboard production bundle is committed and has been served against live
  health, run, agent, and coordinator endpoints.
- The upstream MIT license and Jaymin West attribution are retained.

### Local model architecture

- Ollama is the owned inference path and is restricted to
  `127.0.0.1:11434`.
- Runtime configuration fails closed when a request attempts to use a remote
  endpoint, cloud model name, credentials, or a redirect.
- Only one response stream uses the GPU at a time. Agents still keep separate
  worktrees, sessions, mailboxes, and task state.
- Local prompts are compacted for smaller context windows.
- A model must pass qualification for its exact installed digest before an agent
  can use it. Execution rechecks the qualification rather than trusting an old
  model name.

### Reliability and platform work

- Windows path conversion, file URLs, worktree handling, SQLite cleanup, and
  failed-server cleanup were corrected.
- The focused runtime, registry, worktree, mail, server, watchdog, and merge
  suites passed 203 tests with no failures.
- TypeScript checking, linting, and the production dashboard build passed.
- A broader run reached 486 passing tests before the Windows environment failed
  to provide the Unix `sh` executable needed by hook-deployer tests.

## The npm failure

The npm failure happened in `prepack`, before registry upload. `prepack` ran a
fresh Bun install and dashboard build even though `ui/dist` was already built and
tracked. On Windows, that nested build selected a different Bun installation and
hit `EPERM` while reading React packages from `ui/node_modules`.

The release hook now performs a portable Node-based content check. It verifies
the license, README, CLI entry point, dashboard HTML, JavaScript, and CSS. The
dashboard is still built deliberately with `npm run build:ui` when its source
changes; npm packaging no longer performs an unrelated dependency install.

This fixes package construction. A real publication can still require the npm
account to be logged in and may require a one-time password.

## Jev research

The product is named **Jev** (TypeSafe AI's System One model). It is not a coding
LLM and cannot replace the Ollama model that reads repositories, writes code, or
uses tools. TypeSafe states that Jev accepts shared state plus typed questions and
returns three structured answer types:

- **Choice:** select one defined option and return probabilities/confidence.
- **Score:** rate the state against an ordered rubric.
- **Noul:** return a 0–1 value for a yes/no statement.

Jev could improve an agent system at narrow decisions such as:

1. choosing the best role for a task;
2. deciding retry, stop, review, or escalate;
3. scoring whether a diff meets a rubric;
4. classifying a tool action by risk;
5. gating low-confidence results before merge.

However, the documented Jev product is accessed through
`POST https://api.typesafe.ai/v1/systemone` with a bearer API key and is priced
per input token. The official model page lists Jev 1.13 at $0.042 per million
input tokens. The official documentation reviewed for this report does not offer
a downloadable local Jev runtime or local model weights.

Direct Jev integration therefore conflicts with Superswarm's confirmed product
constraints: all inference must stay local, no external model API may be needed,
and the operating budget is zero. Sending task state or diffs to the hosted Jev
endpoint would also break the local-only network boundary already enforced in
the code.

Sources:

- https://docs.typesafe.ai/introduction/coding-agents
- https://docs.typesafe.ai/introduction
- https://docs.typesafe.ai/api
- https://docs.typesafe.ai/models
- https://docs.typesafe.ai/patterns/confidence-routing

## Recommended integration: Jev-shaped, fully local decisions

Superswarm should adopt the useful architecture without calling the hosted
service. Add a provider-neutral `DecisionEngine` with the same conceptual
primitives: `choice`, `score`, and `noul`.

```ts
interface DecisionEngine {
  evaluate(request: {
    state: unknown;
    questions: Record<string, ChoiceQuestion | ScoreQuestion | NoulQuestion>;
  }): Promise<Record<string, DecisionAnswer>>;
}
```

Implement it in this order:

1. **Deterministic backend.** Use repository state, test outcomes, changed paths,
   role permissions, timeouts, and exit codes for decisions that do not need a
   model. This is fastest and most reliable.
2. **Local Ollama backend.** Use a small installed classifier with constrained
   JSON or grammar output for judgments that need semantics. Validate every
   result against a schema and reject malformed or out-of-range answers.
3. **Confidence gate.** Accept high-confidence low-risk decisions; route weak or
   high-risk cases to the stronger local coding model or a human.
4. **Decision cache and batching.** Cache by state/question/model digest and ask
   several atomic questions against the same state to reduce repeated prompt
   processing.
5. **Calibration log.** Store the decision, confidence, later test/review result,
   latency, and model digest. Tune thresholds from observed errors.

An optional hosted Jev adapter can remain a future plugin, disabled in local-only
mode. It should only be added if the product requirements later permit paid
external inference and explicit transmission of repository-derived state.

## Efficiency impact

The local decision layer can reduce expensive coding-model turns by handling
routing and gates with rules or a much smaller model. The expected benefit is
lower queue time and fewer wasted generations, especially on a single 4 GB GPU.
It will not repair a weak coding model's inability to edit, test, commit, or send
terminal status. A qualified tool-using coding model remains the release blocker.

Measure the result with four numbers before declaring an improvement:

- coding-model calls per completed task;
- total task wall time and inference-queue time;
- false acceptance and unnecessary escalation rates;
- peak RAM/VRAM and model reload time.

## Next build sequence

1. Verify and install the npm tarball in a clean temporary project.
2. Test one stronger quantized coding model that fits the target machine, then
   run the exact real-worktree qualification workflow.
3. Implement deterministic task routing and completion gates behind the
   `DecisionEngine` interface.
4. Add the constrained local Ollama decision backend only after deterministic
   gates are measured.
5. Run builder, reviewer, resume, cancellation, and merge acceptance on Windows.
6. Repeat install, full tests, and one acceptance workflow on native Ubuntu.
7. Publish `0.1.0-alpha.1` and document its hardware/model compatibility matrix.
