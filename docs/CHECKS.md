# Checks

The active checks run in CI and locally through `bin/check_all.sh` (what pre-push runs).
Mobile checks are paused by the [owner decision](decisions/owner-decision-web-first-mobile-pause-2026-10-05.md);
their rules and red controls remain available for resumption. Moved out of [AGENTS.md](../AGENTS.md),
which every agent loads every session.

- `boundary` (strict, every boundary): the dependency directions in
  [architecture.md](system/architecture.md#elixir-boundaries-compile-checked) are a compile error. Declared in each boundary's top module (`lib/loka/*.ex`, `lib/loka_web.ex`).
- `mix xref graph --format cycles --fail-above 0` and
  `mix xref graph --label compile-connected --fail-above 0`: zero cycles, zero
  compile-connected edges. When a compile edge is justified, replace the zero with a
  reviewed allowed list.
- `ast-grep test` and `ast-grep scan --error` (`sgconfig.yml`, `lint/`): active CI checks the Elixir kernel
  (`lib/loka/core`) and the TypeScript kernel (`kernel/ts/src`) rules and paths. The deferred mobile rules say that, in `mobile/`,
  shared packages never import an authority, Story and Realm never import each other, and
  only `authority/local-story` imports the kernel ([mobile import rules](system/architecture.md#mobile-import-rules)) and
  `packages/game-view/session.ts` imports only the generated contracts, as types
  (`mobile-session-contracts-only`); the authority holds no display text, that is a string with
  two words or a final full stop outside an `Error`, a module specifier or SQL
  (`mobile-authority-no-display-text`, tests exempt); the renderer (`app/book/`,
  `SaveError.tsx`, tests exempt) imports only `react`, `react-native` without `Alert`, its own
  files and `packages/game-view`, and calls no `require()` or `import()` (`mobile-renderer-imports`, so react-native-web can mount it;
  [owner wish](decisions/owner-decision-presenter-split-2026-10-02.md)); rule
  modules live only in `kernel/ts/src/mechanics/<capability>/rule.ts`, are registered in `runtime/world.ts` only as
  `<module>.decide`, never mutate, cast or name `Object`/`JSON`/`Function`-like escapes, and
  import only kernel modules; the typed `Rule` contract (`kernel/ts/test/rule_ownership.ts`)
  and `step`'s event-ownership check keep each to its capability's commands and events. The foundation
  imports only its own modules and generated contracts (`ts-foundation-imports`). Every
  rule has valid and invalid cases in `lint/tests/`; `bin/lint_red_controls.sh --core-only` plants
  kernel violations and requires each active rule to report them. The full mode remains for later mobile work.
- TypeScript: Prettier (`.prettierrc.json`, scope in `.prettierignore`, `npm ci` at the
  root) formats on edit and is checked in pre-commit and CI (run from the repo root;
  `.prettierignore` only applies there). CI and `bin/check_all.sh` currently select
  non-mobile files; `mobile/` formatting is deferred. The mobile app's
  `npx tsc --noEmit` and `npm test` are also deferred. Active TypeScript verification is
  `npm run typecheck && npm test` in `kernel/ts` (Node's built-in test runner).
  `bin/check_all.sh` sets `TEST_REPORTER=dot` (the `npm test` scripts default to `spec`): one dot per
  passing test, failures printed in full.
- Size: source files at most 300 lines, test files 500, each function clause (and `fn`/arrow)
  40, in every tracked Elixir, TypeScript and `.mjs` file (`*.gen.*` exempt); current
  TypeScript CI and local checks select non-mobile files, with mobile files deferred:
  `elixir bin/check_size.exs`, `node bin/check_ts_size.mjs` (CI red control
  `bin/ts_size_red_controls.sh --core-only`). Escape hatch: a `size: allow N, reason` comment in lines
  1-5 (file) or right above a function after line 5, at most 1.5x; the reviewer must agree
  a split would be worse. Source files: a file at its limit (300 lines, or its existing
  `size: allow`) splits instead of growing; no new `size: allow` is added to a source file and
  an existing one is never raised. Test files keep the escape hatch.
- `mix credo --strict`: cyclomatic complexity 9, nesting 2, ABC size 30, arity 6; nothing else.
  Any `credo:disable` comment gives its reason on the same line; the reviewer checks it.
- `elixir bin/contracts.exs --check`: `kernel/ts/src/contracts.gen.ts`, the
  [capability/schema docs](contracts.gen.md) and the capability/residency matrix
  (`docs/residency.gen.json`) match `protocol/` (run without `--check` to regenerate); an
  Elixir host adapter on a `portable_capability` without a differential fails (ADR-074).
- `elixir bin/features.exs --check`: the [feature map](features.gen.md) matches the
  capability registry and `docs/features.json`; an implemented capability (a rule module) with
  a missing cell fails.
- `elixir bin/red_controls.exs`: refuses occupied plant paths and creates files exclusively;
  `test/loka/red_controls_test.exs` checks preserved local bytes. It plants a boundary violation, a cycle, a compile edge, an
  oversized AGENTS.md, size-limit cases, one violation per Credo check, a stale and an
  out-of-subset schema, an Elixir adapter without a differential, a stale feature map, an
  implemented capability without its map cells, and a PartyId passed where a CharacterId is
  matched (nominal ids, `Loka.Core.Contracts`), and requires each check to fail.
- `elixir bin/check_docs.exs`: relative links resolve; every Markdown file is reachable
  by links from README.md, AGENTS.md or CLAUDE.md; AGENTS.md stays
  within its word budget (it is loaded by every agent, every session); each `path:line` code
  pointer in the live docs (AGENTS.md, docs/system, ROADMAP, CHECKS, WORKFLOW, lessons,
  world-parameters) names exactly one tracked file and a line inside it
  (`bin/docs_red_controls.sh` plants a missing file, a line past the end and an ambiguous name).
- `bin/docs_only.sh <base> <after>` prints `skip` when every file changed in the range is `*.md` (not
  `*.gen.md`, which the elixir drift checks cover), else `run` (also for a missing or non-ancestor
  `<base>` or an empty diff). The `changes` job of `ci.yml` passes (`bin/ci_base.sh`) the newest ancestor of a pull request
  head whose `elixir`, `typescript` and `sim` jobs all passed (GitHub API; none found or an API error
  means `run`) and skips those three jobs on `skip`; pushes to main never skip. `lint` (with the docs
  link check) always runs. Planted cases, in a throwaway repo: `bin/docs_only_red_controls.sh` (a
  `.json` under `docs/`, a `.gen.md`, a code file renamed to `.md`, a mixed range, no `<base>`, a
  non-ancestor `<base>` and an empty diff must say `run`; and a fake `gh` that fails on the run list or the job list must leave `ci_base.sh` with no base).
- CI (`.github/workflows/`): `ci.yml` on pull requests and pushes to main, superseded runs
  cancelled; `mobile.yml` and `mobile-bundle.yml` are disabled in GitHub and retain only
  manual triggers in source for eventual resumption. The simulator (`kernel/ts/test/sim.ts`) runs its
  regression seeds everywhere and 10,000 fresh sequences only when `CI` is set (GitHub Actions
  sets it, in its own `sim` job via `npm run test:sim`; the `typescript` job runs `test:nosim`; locally, `npm test`, `bin/check_all.sh` and pre-push run 500), by
  [owner decision](decisions/owner-decision-test-audit-2026-10-02.md)
  (r1-acceptance-envelope.md §3); its Hermes replay sample (seeds 1-19) ran on the iPhone 11 in
  [R6P P6b](evidence/2026-10-02-r6p-iphone11/README.md) (ADR-074).
