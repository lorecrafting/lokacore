# AGENTS.md — Loka v3

Instructions for every coding agent and LLM. `CLAUDE.md` points here; no separate policy.

Loka v3: offline-first story/MUD engine, Elixir/OTP server and TypeScript kernel on
Hermes/React Native (Expo). R2 foundation; R1 history/spec/evidence: [archive](https://github.com/lorecrafting/lokacore-v2-legacy),
commit `997a7a8` (`docs/rewrite-v3/`, `r1-spike/`).

## Specification (source of truth)

- [docs/system/](docs/system/README.md), [Book UI](docs/system/book-ui.md),
  [protocol/](protocol/README.md) and conformance fixtures define the system.
  Amend `docs/system` before code, in one PR citing the governing section or archived plan.
  If they disagree, stop and ask ([known differences](docs/system/DIFFERENCES.md)).
- [Owner rules in force](docs/system/owner-rules.md): a new decision adds its record to
  [docs/decisions/](docs/decisions/README.md) and a line there.
- [docs/archive/](docs/archive/README.md): cited spec packet, in-force older decisions.
  Closed work keeps only lessons and permalinks ([move forward](docs/decisions/owner-decision-move-forward-2026-10-07.md)).

## Architecture decisions already made (do not reopen silently)

- **Pre-production:** no backward API/release/save compatibility or older adapters. Replace obsolete
  fixture and doc pins with independent current answers. Keep current-behavior checks, save integrity,
  explicit pin refusal and no silent save deletion
  ([owner decision](docs/decisions/owner-decision-forward-development-2026-10-05.md)).

- **Candidate C (R1), TypeScript first:** the portable semantic foundation (canonical
  encoding and hash, numbers, RNG, IdSource, delta algebra, invariant registry) is built in
  Elixir and TypeScript, held to the reviewed fixtures and randomized differential testing.
  Story rules (`portable_capability`) are TypeScript-only until a server first consumes
  them; an Elixir host adapter on one needs a declared differential (`bin/contracts.exs`).
  [ADR-071](docs/archive/decisions/adr-071-072-proposal.md),
  [ADR-074](docs/archive/decisions/adr-074-ts-first-proposal.md).
- **Persistence shape (ADR-072):** the world lives in memory; rules are pure
  (`decide(state, command) → proposal`) and never write memory or storage; the host
  commits only the changed rows plus the receipt in one transaction, then adopts the
  proposal into memory, then replies. Kernels use structural sharing. No periodic or
  rest-point snapshots; a full checkpoint exists only for export/backup.
- **Databases (ADR-006, reconfirmed 2026-09-24):** PostgreSQL online, SQLite offline on
  the phone. Server code uses Ecto with Ecto-managed migrations.
- **Mechanics vs numbers ([owner decision](docs/decisions/owner-decision-world-parameters-2026-10-02.md)):**
  the engine owns mechanics; cartridges own numbers and world settings (costs, durations,
  rates, odds, maximums, default stats, calendar lengths, thresholds). Never add a world value
  as an engine or presenter literal; [World parameters](docs/world-parameters.md) lists the
  ones still to move. Safety budgets and protocol constants stay in the engine.
- **Distribution (PREP-03):** the first release bundles its chapter in the app;
  downloadable story content waits for a pre-launch store-policy review.

## Hard-won lessons

Keep lessons in area files; link here only when relevant to all work.
- Before touching `mobile/` or running on a phone, read [mobile lessons](docs/lessons/mobile.md).
- For engine mechanics, read [mechanics lessons](docs/lessons/mechanics.md).
- Before touching SQLite or persistence, read [storage lessons](docs/lessons/storage.md).
- Before capturing or committing evidence, read [evidence lessons](docs/lessons/evidence.md).
- Before touching `protocol/`, its fixtures or canonical encoding, read [contract lessons](docs/lessons/contracts.md).
- For CI, hooks, skip rules or randomized tests, read [check lessons](docs/lessons/checks.md).

**All work**
- Read documents once per agent; [exceptions](docs/decisions/owner-decision-read-once-docs-2026-10-05.md).
- Never print or commit adb serials, iPhone UDID/ECID/serial/device name, team ID,
  certificate or provisioning identifiers, home/scratch/worktree paths or
  app-container UUIDs. Every capture script has a `redact()` covering them.
- Nothing invented; unknowns stay null.
- zsh does not word-split `$VAR`: wrap repeated commands in `function name { ...; }`.

**Performance**
- Whole-state copying kills phones. On a Pixel 3a (Hermes), copying a 190 KB state per
  step took 216 ms; structural sharing took under 1 ms. Never deep-clone or re-encode
  the whole state per action. BEAM maps share structure; plain JS objects do not.
- Per-action SQLite commits are cheap when they write only changed rows (about 190 bytes,
  6 to 11 ms p99 on the Pixel 3a; 1 to 3 ms on an M1 even for whole-state writes).
  The disk is not the bottleneck; work per action is.
- A full canonical checkpoint of a 730 KB state still took about 490 ms on the Pixel 3a
  (not split into write/read/parse/encode). Keep it off the player-action path and
  measure it split.
- Declare any performance variant before tuning it, and keep failing results.

## Conventions

- Elixir: [docs/ELIXIR-CONVENTIONS.md](docs/ELIXIR-CONVENTIONS.md), built on Phoenix's
  vendored usage rules (`docs/conventions/phoenix/`, refreshed by
  `elixir bin/sync_phoenix_rules.exs`). Upstream rules win unless that page overrides them.
- Phoenix is used only at the edges: Realm transport, sessions, PubSub and the admin and
  builder web apps (spec documents 01 and 07). Domain, runtime, content and store code never
  depend on it.

## Simplicity (every change, every agent)

Write the least code that correctly does the job. Before writing, stop at the first rung
that holds: does it need to exist at all; is it already in this repo; does the standard
library or platform do it; does an installed dependency do it; can it be one line. No
abstraction with one implementation, no config nobody sets, no scaffolding for later.
Never simplify away validation at trust boundaries, data-loss handling, security or
anything the spec requires. Mark a deliberate shortcut with a `ponytail:` comment naming
its limit. Before asking for review, audit the diff for over-engineering (Claude Code:
`/ponytail-review`; other agents: the same questions by hand) and include the result in
the PR. Pass this section into subagent prompts. [Mechanic composition](docs/system/architecture.md#building-mechanics-by-composition).

## Writing tests (every change, every agent)

A test exists to catch a specific break. Adapted from
[obra/superpowers `writing-good-tests.md`](https://github.com/obra/superpowers/blob/main/skills/test-driven-development/writing-good-tests.md) (MIT).
- **Name the break.** Before the body, name the realistic bug that makes it fail. If the
  only thing that fails it is a deliberate decision (a constant, a message's wording, a
  registry's size), it is a change detector: test the behavior that depends on it instead.
- **Expected values never come from the code under test.** Use current conformance
  fixtures, hand-checked literals, or table rows with literal answers. Never compute the
  answer with the implementation, its helpers, or the other kernel (where both kernels
  implement it, they are compared to the fixtures, then to each other, never only to each other).
- **Behavior, not text.** Run scripts and checks on controlled input and assert output or
  exit status; do not grep source.
- **Test our contract, not the library.** No tests for trivial structs, getters or
  forwarding; no tests of Elixir, Node or `boundary` mechanics. A test never checks logic it
  defines itself.
- **Real over mocks.** Mock only what is slow or external (the network, a device); storage
  faults are real (see [storage lessons](docs/lessons/storage.md));
  never assert on the mock itself. Production modules carry no test-only functions.
  Inject storage faults by operation (a table read, the n-th COMMIT), never by SQL text.
- **Nothing extra.** No fixture, helper or validation the test does not need; no test
  written for coverage alone.
- **One test per break per layer.** Apply a new test's mutant to the old suite first;
  if a focused test in the same layer (one kernel's unit files, one authority file)
  fails, add nothing. Broad runs (simulator, transcripts, traces) do not count: they do not
  name it.
- **Mutation check before handoff.** For each realistic mutation (wrong constant or
  branch, missing state change, empty return, missing validation of empty/zero/malformed
  input) at least one test fails; actually break the code once and watch it fail.
  A test passing with its header's break is wrong: fix or delete it.
  Mix compares mtimes to the second, so run Elixir mutants with `mix test --force`.

## Searching code (use precise tools first)

- Elixir structure (callers, dependencies, cycles): `mix xref callers <Module>`,
  `mix xref graph --format cycles`. The compiler resolves aliases, so these are exact.
- Syntax patterns in Elixir or TypeScript: `ast-grep --lang elixir -p '<pattern>' --json`
  (`--lang typescript` for TS). `ast-grep outline` does not parse Elixir.
- Plain text search only for strings, docs and config.

## Checks

Checks: [current gates](docs/CHECKS.md), focused [provisional lane](docs/decisions/owner-decision-local-provisional-integration-2026-10-05.md).
[Post-E3 tiering](docs/decisions/owner-decision-tiered-ci-after-chapter-one-2026-10-06.md) awaits reviewed implementation.

## Working rules

- Follow [the delivery workflow](docs/WORKFLOW.md) for slice reviews and the
  [Beads Rust](docs/WORKFLOW.md#beads-rust) for PM task status.
- Update [Book UI](docs/system/book-ui.md) per mechanic; fix UI defects now ([workflow](docs/WORKFLOW.md#book-interaction-delivery)).
- Toolchain: pinned in `mise.toml`; run `mise exec -- <cmd>`.
- After cloning, run `git config core.hooksPath .githooks`; `--no-verify` only with the owner's OK; fix the cause instead.
- Merge record-bearing PRs with merge commits, never squash.
- Reviews are independent ([records](docs/reviews/README.md)): a fresh agent that authored
  none of the work ([owner ruling](docs/system/owner-rules.md#process));
  who reviews what: [the workflow](docs/WORKFLOW.md).
- Each fact lives in one place; other docs link to it rather than restate it.
- Follow [token hygiene](docs/WORKFLOW.md#token-hygiene); skip rereading unchanged documents.
- Expected failing readiness probes need no fix.
- The owner wants nothing paid (no EAS); headless work runs on GitHub Actions, iPhone
  and UI work on the owner's M1.
