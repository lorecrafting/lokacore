# Checks

CI runs all of them; each has a planted case that must fail. Run everything locally with `bin/check_all.sh` (what pre-push runs). Moved out of [AGENTS.md](../AGENTS.md), which every agent loads every session.

- `boundary` (strict, every boundary): dependency directions from spec document 02 §1 are a
  compile error. Declared in each boundary's top module (`lib/loka/*.ex`, `lib/loka_web.ex`).
- `mix xref graph --format cycles --fail-above 0` and
  `mix xref graph --label compile-connected --fail-above 0`: zero cycles, zero
  compile-connected edges. When a compile edge is justified, replace the zero with a
  reviewed allowed list.
- `ast-grep test` and `ast-grep scan --error` (`sgconfig.yml`, `lint/`): the Elixir kernel
  (`lib/loka/core`) and the TypeScript kernel (`kernel/ts/src`) stay pure; in `mobile/`,
  shared packages never import an authority, Story and Realm never import each other, and
  only `authority/local-story` imports the kernel (spec documents 10 §2, 14 §R2); rule
  modules live only in `kernel/ts/src/rules/`, are registered in `world.ts` only as
  `<module>.decide`, never mutate, cast or name `Object`/`JSON`/`Function`-like escapes, and
  import only kernel modules; the typed `Rule` contract (`kernel/ts/test/rule_ownership.ts`)
  and `step`'s event-ownership check keep each to its capability's commands and events. Every
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
  [capability/schema docs](contracts.gen.md) and the capability/residency matrix
  (`docs/residency.gen.json`) match `protocol/` (run without `--check` to regenerate); an
  Elixir host adapter on a `portable_capability` without a differential fails (ADR-074).
- `elixir bin/features.exs --check`: the [feature map](features.gen.md) matches the
  capability registry and `docs/features.json`; an implemented capability (a rule module) with
  a missing cell fails.
- `elixir bin/red_controls.exs`: plants a boundary violation, a cycle, a compile edge, an
  oversized AGENTS.md, size-limit cases, one violation per Credo check, a stale and an
  out-of-subset schema, an Elixir adapter without a differential, a stale feature map, an
  implemented capability without its map cells, and a PartyId passed where a CharacterId is
  matched (nominal ids, `Loka.Core.Contracts`), and requires each check to fail.
- `elixir bin/check_docs.exs`: relative links resolve; every Markdown file is reachable
  by links from README.md, AGENTS.md or CLAUDE.md; AGENTS.md stays
  within its word budget (it is loaded by every agent, every session).
- CI (`.github/workflows/`): `ci.yml` on pull requests and pushes to main, superseded runs
  cancelled; `mobile.yml` builds the native apps on pull requests that change native
  inputs, pushes to main and manual runs; `mobile-bundle.yml` compiles the Hermes bundle
  on pull requests that touch `mobile/` or `kernel/`. The simulator (`kernel/ts/test/sim.ts`) runs its
  regression seeds and 10,000 fresh sequences in `npm test` on every fast CI run
  (r1-acceptance-envelope.md §3); the Hermes replay sample comes at R6P (ADR-074).
