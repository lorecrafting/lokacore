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

## Hard-won lessons

New lessons go in the file for their area; a lesson enters AGENTS.md only if it applies to all work.
- Before touching `mobile/` or running on a phone, read [mobile lessons](docs/lessons/mobile.md).
- Before touching SQLite or persistence, read [storage lessons](docs/lessons/storage.md).
- Before capturing or committing evidence, read [evidence lessons](docs/lessons/evidence.md).
- Before touching `protocol/`, its fixtures or canonical encoding, read [contract lessons](docs/lessons/contracts.md).

**All work**
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
  faults are real (see [storage lessons](docs/lessons/storage.md));
  never assert on the mock itself. Production modules carry no test-only functions.
- **Nothing extra.** No fixture, helper or validation the test does not need; no test
  written for coverage alone.
- **Mutation check before handoff.** For each realistic mutation (wrong constant or
  branch, missing state change, empty return, missing validation of empty/zero/malformed
  input) at least one test fails; actually break the code once and watch it fail.
  Mix compares mtimes to the second, so run Elixir mutants with `mix test --force`.

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
- TypeScript: Prettier (`.prettierrc.json`, scope in `.prettierignore`, `npm ci` at the
  root) formats on edit and is checked in pre-commit and CI (run from the repo root;
  `.prettierignore` only applies there);
  `npx tsc --noEmit` in `mobile/app` (covers all of `mobile/`) and
  `npm run typecheck && npm test` in `kernel/ts` (Node's built-in test runner).
- Size: source files at most 300 lines, test files 500, each function clause (and `fn`/arrow)
  40, in every tracked Elixir, TypeScript and `.mjs` file (`*.gen.*` exempt):
  `elixir bin/check_size.exs`, `node bin/check_ts_size.mjs` (red control
  `bin/ts_size_red_controls.sh`). Escape hatch: a `size: allow N, reason` comment in lines
  1-5 (file) or right above a function after line 5, at most 1.5x; the reviewer must agree
  a split would be worse.
- `mix credo --strict`: cyclomatic complexity 9, nesting 2, ABC size 30, arity 6; nothing else.
  Any `credo:disable` comment gives its reason on the same line; the reviewer checks it.
- `elixir bin/contracts.exs --check`: `kernel/ts/src/contracts.gen.ts`, the
  [capability/schema docs](docs/contracts.gen.md) and the capability/residency matrix
  (`docs/residency.gen.json`) match `protocol/` (run without `--check` to regenerate).
- `elixir bin/red_controls.exs`: plants a boundary violation, a cycle, a compile edge, an
  oversized AGENTS.md, size-limit cases, one violation per Credo check, a stale and an
  out-of-subset schema, and a PartyId passed where a CharacterId is matched (nominal ids,
  `Loka.Core.Contracts`), and requires each check to fail.
- `elixir bin/check_docs.exs`: links resolve; every doc is reachable; AGENTS.md stays
  within its word budget (it is loaded by every agent, every session).
- CI: pull requests and pushes to main, superseded runs cancelled. Planned: native mobile
  builds only when mobile code changes or on manual trigger; the differential runs
  at least 10,000 fresh sequences on every fast CI run (r1-acceptance-envelope.md).

Run everything locally: `bin/check_all.sh` (what pre-push runs).

## Working rules

- Every slice follows [the delivery workflow](docs/WORKFLOW.md): PM plans and briefs, a
  developer builds and self-reviews, a fresh reviewer reviews, the same developer fixes.
- Toolchain: pinned in `mise.toml`; run `mise exec -- <cmd>`.
- After cloning, run `git config core.hooksPath .githooks`; `--no-verify` only with the owner's OK; fix the cause instead.
- Merge record-bearing PRs with merge commits, never squash.
- Reviews are independent ([records](docs/reviews/README.md)): a fresh agent that authored none of the work (owner ruling:
  fresh Fable, Opus or other-vendor agents such as Codex qualify, [ruling](docs/decisions/owner-decision-reviewers-2026-09-24.md); prefer Fable for design-judgment reviews, as defined in [the workflow](docs/WORKFLOW.md)).
- Each fact lives in one place; other docs link to it rather than restate it.
- Every Markdown file must be reachable by links from README.md, AGENTS.md or CLAUDE.md,
  and every relative link must resolve: `elixir bin/check_docs.exs`.
- Readiness probes that exit 1 by design are expected; don't "fix" them.
- The owner wants nothing paid (no EAS); headless work runs on GitHub Actions, iPhone
  and UI work on the owner's M1.
