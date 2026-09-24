# AGENTS.md — Loka v3

Instructions for every coding agent and LLM working here (Codex, Claude Code, others).
`CLAUDE.md` only points to this file; it is not separate policy.

Loka v3 is an offline-first story/MUD engine: an Elixir/OTP server and a TypeScript
kernel running on Hermes in a React Native (Expo) phone app. This repository starts at
R2 (fresh repository foundation). The history, the R1 spike and all R1 evidence live
in the archived repository
[lorecrafting/lokacore-v2-legacy](https://github.com/lorecrafting/lokacore-v2-legacy)
at commit `997a7a8` (spec under `docs/rewrite-v3/`, spike under `r1-spike/`).

## Specification (source of truth)

- [docs/spec/](docs/spec/README.md): the R0-accepted specification, imported at the R2
  cutover ([import record](docs/spec/IMPORT.md)). Its README §8 says which documents are
  normative. Two normative documents disagreeing is a defect: stop and ask.
- [docs/decisions/](docs/decisions/README.md): proposed ADRs and verbatim owner decisions
  since R0. [docs/reference/](docs/reference/README.md): informative material, linked in
  the legacy repository, never authority.
- Amend the spec here first, get it reviewed, then change code (spec README §11). Cite
  the governing spec section in every PR.

## Architecture decisions already made (do not reopen silently)

- **Candidate C (R1):** rules are implemented twice, in Elixir (server) and TypeScript
  (phone), held to the same reviewed fixtures and to randomized differential testing.
  [Proposed ADR-071](docs/decisions/adr-071-072-proposal.md).
- **Persistence shape (proposed ADR-072):** the world lives in memory; rules are pure
  (`decide(state, command) → proposal`) and never write memory or storage; the host
  commits only the changed rows plus the receipt in one transaction, then adopts the
  proposal into memory, then replies. Kernels use structural sharing. No periodic or
  rest-point snapshots; a full checkpoint exists only for export/backup.
- **Databases (ADR-006, reconfirmed 2026-09-24):** PostgreSQL online, SQLite offline on
  the phone. Server code uses Ecto with Ecto-managed migrations.
- **Distribution (PREP-03):** the first release bundles its chapter in the app;
  downloadable story content waits for a pre-launch store-policy review.

## Hard-won lessons from R1 (read before touching these areas)

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

**expo-sqlite and React Native**
- expo-sqlite 57.0.3 on Android: opening the same database file twice gives both JS
  handles one native database, and garbage collection of either closes it. Symptom:
  `NativeDatabase.execSync` rejected, `NullPointerException`. Open each database once
  per process.
- expo-sqlite's transaction helpers (`withTransactionSync`,
  `withExclusiveTransactionAsync`) issue COMMIT themselves. To own the COMMIT point
  (fault injection, unknown-commit handling) run `BEGIN IMMEDIATE` / `COMMIT` /
  `ROLLBACK` yourself with `execSync` on one connection.
- The React Native Gradle plugin (`configureDevServerLocation`) writes the build
  machine's IPv4 address into every variant's `resources.arsc`, release included. Pass
  `-PreactNativeDevServerIp=localhost`. APKs then differ only in AGP's encrypted
  dependency-info signing block; the JS bundle, Hermes bytecode and source map are
  byte-identical across builds.
- Record the AGP version with the root `./gradlew buildEnvironment`, not
  `:app:buildEnvironment` (AGP sits on the root buildscript classpath).

**Mobile builds (measured 2026-09-24, minimal Expo 57 app, arm64 release)**
- M1 Air: Android clean 78 s with warm download caches (first ever, with NDK download,
  346 s); JS change with a warm Gradle daemon 9 s. iOS `pod install` 23 s, clean
  `xcodebuild` 50 s, JS change 9 s. GitHub CI Android, uncached: Gradle 349 s, job 6 min 15 s.
  Iterate on the M1; CI builds are clean-build proof, not the edit loop.
- `pod install` writes React Native codegen into `ios/build/generated`. Never
  `rm -rf ios/build` or use it as `-derivedDataPath`; rerun `pod install` if it is gone.
- zsh does not word-split `$VAR`: wrap repeated commands in `function name { ...; }`.

**Physical-device runs**
- The owner can connect only one phone at a time. Batch all work per phone; ask for a
  swap only when needed.
- A locked screen stops the app's JS. Check the lock state before a run; keep the app in
  the foreground; treat a lock or backgrounding as an invalid run.
- Every wait on a device needs a timeout (for example 120 s per launch, a 10 minute
  progress watchdog). An unbounded `until grep …` loop hung for minutes once.
- The Android logcat ring buffer keeps lines from earlier runs; a stale progress marker
  once looked like a finished run. Match on the current process id or a run id.
- iOS: `xcode-select` may point at the Command Line Tools; set
  `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` (no sudo). Signing uses the
  owner's free personal team (automatic signing); nothing paid, no EAS.
- iOS symbolication with `atos`: look up the return address minus 1, or it names the
  wrong function.

**Evidence and privacy**
- Never print or commit adb serials, iPhone UDID/ECID/serial/device name, team ID,
  certificate or provisioning identifiers, home/scratch/worktree paths or
  app-container UUIDs. Every capture script has a `redact()` covering them.
- Retained raw tool output is hashed (`SHA256SUMS` with its verify output beside it,
  not self-listed). Mark evidence folders `-whitespace` in `.gitattributes` so git never
  "fixes" hashed bytes.
- Keep owner-reported, inspected, catalogue and inferred facts separate and labeled.
  Nothing invented; unknowns stay null. Owner decisions are retained verbatim in a file.
- Declare any performance variant before tuning it, and keep failing results.

**SQLite fault testing**
- `PRAGMA max_page_count` clamped to the current page count, then a write that must grow
  the file, gives a real deterministic `SQLITE_FULL`.
- An "unknown COMMIT" test that discards the result of a COMMIT that succeeded never
  exercises the not-committed branch; inject a genuinely failed COMMIT too.

**Canonical encoding (R3)**
- Elixir maps with 32 keys or fewer iterate in sorted key order, so a key-order test with
  fewer keys passes even when the encoder never sorts. Use more than 32 keys.

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
the PR. Pass this section into subagent prompts.

## Writing tests (every change, every agent)

A test exists to catch a specific break. Adapted from
[obra/superpowers `writing-good-tests.md`](https://github.com/obra/superpowers/blob/main/skills/test-driven-development/writing-good-tests.md) (MIT).
- **Name the break.** Before the body, name the realistic bug that makes it fail. If the
  only thing that fails it is a deliberate decision (a constant, a message's wording, a
  registry's size), it is a change detector: test the behavior that depends on it instead.
- **Expected values never come from the code under test.** Use the frozen conformance
  fixtures, hand-checked literals, or table rows with literal answers. Never compute the
  answer with the implementation, its helpers, or the other kernel (Elixir and TypeScript
  are compared to the fixtures, then to each other, never only to each other).
- **Behavior, not text.** Run scripts and checks on controlled input and assert output or
  exit status; do not grep source.
- **Test our contract, not the library.** No tests for trivial structs, getters or
  forwarding; no tests of Elixir, Node or `boundary` mechanics.
- **Real over mocks.** Mock only what is slow or external (the network, a device); storage
  faults are real (see SQLite fault testing);
  never assert on the mock itself. Production modules carry no test-only functions.
- **Nothing extra.** No fixture, helper or validation the test does not need; no test
  written for coverage alone.
- **Mutation check before handoff.** For each realistic mutation (wrong constant or
  branch, missing state change, empty return, missing validation of empty/zero/malformed
  input) at least one test fails; actually break the code once and watch it fail.

## Searching code (use precise tools first)

- Elixir structure (callers, dependencies, cycles): `mix xref callers <Module>`,
  `mix xref graph --format cycles`. The compiler resolves aliases, so these are exact.
- Syntax patterns in Elixir or TypeScript: `ast-grep --lang elixir -p '<pattern>' --json`
  (`--lang typescript` for TS). `ast-grep outline` does not parse Elixir; use the Elixir
  outline script once it exists.
- Plain text search only for strings, docs and config.

## Checks (CI runs all of them; each has a planted case that must fail)

- `boundary` (strict, every boundary): dependency directions from spec document 02 §1 are a
  compile error. Declared in each boundary's top module (`lib/loka/*.ex`, `lib/loka_web.ex`).
- `mix xref graph --format cycles --fail-above 0` and
  `mix xref graph --label compile-connected --fail-above 0`: zero cycles, zero
  compile-connected edges. When a compile edge is justified, replace the zero with a
  reviewed allowed list.
- `ast-grep test` and `ast-grep scan --error` (`sgconfig.yml`, `lint/`): the Elixir kernel
  (`lib/loka/core`) and the TypeScript kernel (`kernel/ts/src`) stay pure; in `mobile/`,
  shared packages never import an authority, Story and Realm never import each other, and
  only `authority/local-story` imports the kernel (spec documents 10 §2, 14 §R2). Every
  rule has valid and invalid cases in `lint/tests/`; `bin/lint_red_controls.sh` plants a
  violation at each rule's real path and requires the scan to report it.
- TypeScript: `npx tsc --noEmit` in `mobile/app` (covers all of `mobile/`) and
  `npm run typecheck && npm test` in `kernel/ts` (Node's built-in test runner).
- `elixir bin/red_controls.exs`: plants a boundary violation, a cycle, a compile edge and
  an oversized AGENTS.md, and requires each check to fail.
- `elixir bin/check_docs.exs`: links resolve; every doc is reachable; AGENTS.md stays
  within its word budget (it is loaded by every agent, every session).
- CI: pull requests and pushes to main, superseded runs cancelled. Planned: native mobile
  builds only when mobile code changes or on manual trigger; the full 10,000-sequence
  differential runs nightly.

Run everything locally:
`mix format --check-formatted && mix compile --warnings-as-errors && mix xref graph --format cycles --fail-above 0 && mix xref graph --label compile-connected --fail-above 0 && mix test && elixir bin/red_controls.exs && ast-grep test --skip-snapshot-tests && ast-grep scan --error && bin/lint_red_controls.sh && elixir bin/check_docs.exs`
(prefix each with `mise exec --`, or activate mise).

## Working rules

- Every slice follows [the delivery workflow](docs/WORKFLOW.md): PM plans and briefs, a
  developer builds and self-reviews, a fresh reviewer reviews, the same developer fixes.
- Toolchain: pinned in `mise.toml`; run `mise exec -- <cmd>`.
- Merge record-bearing PRs with merge commits, never squash.
- Reviews are independent ([records](docs/reviews/README.md)): a fresh agent that authored none of the work (owner ruling:
  fresh Fable, Opus or other-vendor agents such as Codex qualify, [ruling](docs/decisions/owner-decision-reviewers-2026-09-24.md); prefer Fable for design-judgment reviews, as defined in [the workflow](docs/WORKFLOW.md)).
- Each fact lives in one place; other docs link to it rather than restate it.
- Every Markdown file must be reachable by links from README.md, AGENTS.md or CLAUDE.md,
  and every relative link must resolve: `elixir bin/check_docs.exs`.
- Readiness probes that exit 1 by design are expected; don't "fix" them.
- The owner wants nothing paid (no EAS); headless work runs on GitHub Actions, iPhone
  and UI work on the owner's M1.
