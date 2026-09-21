# Overstory gaps Superswarm must close

Updated: 21 September 2026. This is a source audit of imported Overstory 0.11.0,
not a claim about unreleased upstream work. The audit searched runtime adapters,
configuration, orchestration, watchdog, security design notes, installation, and
tests for explicit stubs and for assumptions that fail on an 8 GB RAM / 4 GB VRAM
local-model machine.

## The central gap

Overstory schedules **agent processes**. A local-first product must also schedule
the scarce **inference resource**. `agents.maxConcurrent`, spawn staggering, depth,
and run limits cap sessions, but they do not prevent several agents from asking a
single GPU-backed model server to generate at once. Small machines then thrash,
time out, or silently fall back to CPU.

Superswarm adds a machine-wide inference lease. Agents retain separate worktrees,
mailboxes, and conversations, while model response streams run one at a time. The
lease is released before tool execution, so another agent can think while the first
runs tests. This is the main architectural difference from simply pointing an
existing adapter at Ollama.

## Gaps found

| Priority | Gap in the imported system | Evidence | Superswarm response |
|---|---|---|---|
| P0 | No fail-closed local-only mode | Default runtime/provider and helper calls are cloud-oriented. Runtime overrides can route individual roles elsewhere. | A `local` runtime rejects remote overrides, cloud model tags, non-loopback inference URLs, and HTTP redirects. Merge/watchdog helper calls inherit the same runtime. |
| P0 | No GPU/model admission control | Concurrency limits count sessions rather than inference requests. | Serialize Ollama response streams with a machine-wide lease, while allowing tools and Git work to overlap. |
| P0 | Adapter labels overstate practical readiness | Nine adapters are marked experimental; OpenCode contains explicit unverified flags and stubbed readiness/transcript methods. Pi is also experimental. | Ship one owned local path using the Pi SDK as a library, pin its version, and test the behavior Superswarm depends on. Do not market registry presence as support. |
| P0 | Guard hooks are not an OS sandbox | `docs/headless-hooks-design.md` says instruction/hook enforcement remains weaker than an OS sandbox. Local tools can execute trusted repository scripts. | Enforce role-based write and worktree path checks, block remote inference, and state that shell execution trusts the opened project. Container/OS sandboxing remains release work. |
| P1 | Prompts assume frontier-model instruction following | Agent definitions are long, procedural, and depend on terminal mail signals. There is no local-model capability test before assigning a role. | Compile a compact local overlay and add staged qualification: exact edit plus test as a prerequisite, then a real worktree, commit, terminal mail, resume, and review before release approval. |
| P1 | No hardware-aware model profile | Config has no RAM/VRAM discovery, model footprint, context-window measurement, or loaded-model policy. | Provide small/balanced profiles, discover installed Ollama models, default to sequential inference, and record measured results rather than guessing from parameter count. |
| P1 | Context policy is cloud-centric | Imported prompt/context and compaction behavior were designed around much larger context windows. | Give local agents an 8K bounded context initially, compact task overlays, and measure prompt size before dispatch. Long-term memory stays in mail/spec/Git rather than the model context. |
| P1 | Completion can be self-reported | Terminal mail is necessary for lifecycle transitions, but a weak model can report success without a correct change. | Treat tests, file scope, diff inspection, and reviewer output as evidence; terminal mail alone must never equal acceptance. |
| P1 | Deployment is a source-oriented CLI workflow | Upstream expects several external CLIs and runtime tools to be installed independently. | Pin the local agent SDK plus tracker/prompt dependencies, make `superswarm init` local-first, and add an installer/package smoke test. |
| P1 | Windows parity was incomplete | Native separator handling, file URL conversion, and SQLite statement lifetime caused failures in this build. | Fixed those paths and explicit database close behavior; keep Windows and Ubuntu in the release matrix. |
| P2 | No local-model regression benchmark | Upstream tests validate orchestration with mocks but cannot detect model drift or a model losing tool-call reliability. | Add an opt-in qualification fixture that runs only against already-installed models and stores model/digest, latency, tool success, and memory observations. |
| P2 | Cost reporting is monetary/token-centric | Local inference costs are dominated by latency, RAM/VRAM pressure, and energy, not API price. | Add local metrics: queue wait, generation time, tokens/second where available, timeout, and loaded model. |

## Model roles for this machine

The detected machine has about 8 GB system RAM and a 4 GB RTX 2050. Superswarm
must not load two large models concurrently. “Two or three local models” means two
or three selectable role profiles, loaded on demand, with only one active inference
stream. A model is not approved because it downloads successfully.

Minimum qualification for each candidate:

1. Produce a valid structured tool call five times without malformed arguments.
2. Read a fixture, make one scoped edit, run its test, and describe the diff.
3. Respect a read-only reviewer role and refuse an out-of-worktree edit.
4. Resume a second turn without losing task state.
5. Finish within the configured five-minute turn timeout on this hardware.

The already-installed `qwen2.5:1.5b` completed real local text inference and the
multi-turn prerequisite fixture: an exact scoped write followed by a passing Bun
test. It then failed a real builder run. Before compacting the prompt it asked for
instructions already present; afterward it read the spec but only claimed it had
edited, tested, and committed. The worktree remained unchanged, it invented Maven
commands in a Bun project, and it never sent terminal mail. Superswarm marked the
worker failed. This demonstrates why a small tool fixture cannot be treated as
role qualification. The installed 9.7B candidate did not become ready within one
minute on this machine and was stopped. No model is approved for autonomous work.

## Definition of deployable

Superswarm is deployable when a clean install can initialize a repository, verify
Ollama and a qualified model, launch the unchanged Overstory-style console, execute
a real builder/reviewer workflow, preserve all inference locally, pass the platform
test matrix, and uninstall without touching user projects or models. Source builds
and a successful text completion are checkpoints, not that finish line.
