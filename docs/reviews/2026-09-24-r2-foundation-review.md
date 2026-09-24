# Independent review: PR #1 "R2: fresh repository foundation"

- Reviewed commit: `acccda6` (branch `r2-foundation`, base `main` at `524227e`)
- Reviewer: Claude Fable 5.1 (fresh agent; authored none of the work)
- Date: 2026-09-24
- Governing spec: [14 §R2](../spec/14-implementation-plan.md#r2--fresh-repository-foundation),
  [02 §1](../spec/02-beam-runtime-architecture.md#1-proposed-repository-shape),
  [10 §2](../spec/10-mobile-commerce-release.md), spec README §8/§12,
  [proposed ADR-073](../decisions/adr-073-single-app.md)

## Verdict: APPROVE WITH NOTES

The spec import is faithful (every hash verified, zero non-link byte changes), ADR-073 is
coherent and fully reflected in the boundary declarations, every listed check runs green
locally and in CI, CI hygiene and privacy rules are met. The R2 gate is met as far as an
empty system can meet it, with the iOS item covered by the owner's M1 rule rather than CI.

The notes are about the lint layer: the ast-grep rules that AGENTS.md presents as the
Story/Realm and kernel-purity guarantees have holes wide enough that ordinary code will
walk through them (F1 to F5). None blocks an empty system, but F1 and F2 are small fixes
and should land before the first mobile-feature or kernel-rules PR, ideally in this one.
F6 corrects a false provenance claim in `IMPORT.md`.

All planted probe files were deleted; `git status` shows only this review.

---

## Findings

### F1 (should-fix) — Every TypeScript import rule ignores `.tsx` files

`lint/rules/mobile-*.yml` and `lint/rules/ts-kernel-pure.yml` declare `language: typescript`.
ast-grep parses `.tsx` as the separate `tsx` language, so no rule is applied to any `.tsx`
file. In a React Native app nearly every feature file is `.tsx` (the only mobile source in
this PR that is not a stub, `mobile/app/App.tsx`, is one).

Evidence (planted, then removed):

```
$ cat > mobile/features/story/Probe.tsx <<'EOF'
import { x } from '../realm';
import { k } from '../../../kernel/ts/src/index.ts';
export const P = () => <>{x}{k}</>;
EOF
$ mise exec -- ast-grep scan --error --report-style short
(no diagnostic for Probe.tsx; the same two imports in a .ts file are reported)
```

`bin/lint_red_controls.sh` plants only `.ts` files, so the red control cannot notice this.

Fix: add a `language: tsx` twin for each of the six rules (same `files`, `rule` and
`message`; ids suffixed `-tsx`), give each a `lint/tests/*-tsx-test.yml` with the same
cases, and plant one `.tsx` file per mobile rule in `bin/lint_red_controls.sh`
(`mobile/features/story/red_control.tsx` etc.). ast-grep has no multi-language rule, so
duplication is the smallest correct diff.

### F2 (should-fix) — `elixir-kernel-pure` misses most impurity, and strict `boundary` does not backstop it

`lib/loka/core.ex` declares `deps: []`, but `boundary` only checks calls into *other
boundaries and external Hex/OTP applications it knows about*; Erlang/Elixir stdlib and OTP
applications (`:erlang`, `:crypto`, `:persistent_term`, `Application`, `Registry`,
`GenServer`) pass without a warning. So the spec 02 §1 rule "core MUST NOT depend on
filesystem, network or runtime processes" rests entirely on `lint/rules/elixir-kernel-pure.yml`.
That rule is an allow-nothing list of twelve aliases and five atoms.

Evidence (planted `lib/loka/core/probe.ex`, then removed):

```elixir
def t, do: :erlang.monotonic_time()      # missed
def r, do: :crypto.strong_rand_bytes(4)  # missed (boundary: compiles clean too)
def e, do: Enum.random([1, 2])           # missed
def s, do: send(self(), :x)              # missed
def p, do: spawn(fn -> :ok end)          # missed
def d, do: Date.utc_today()              # missed
def pt, do: :persistent_term.get(:x)     # missed (boundary: compiles clean too)
def a, do: Application.get_env(:loka, :x)# missed (boundary: compiles clean too)
def ap, do: apply(File, :read!, ["x"])   # caught (alias File)
def el, do: Elixir.File.read!("x")       # missed (regex anchored at ^File)
def rf, do: make_ref()                   # missed
def rg, do: Registry.lookup(R, :k)       # missed
```

```
$ mise exec -- ast-grep scan --error --report-style short
lib/loka/core/probe.ex:10:21: error[elixir-kernel-pure] ...     (1 of 12)
$ mise exec -- mix compile --warnings-as-errors --force ; echo $?
0
```

Real risk: `:erlang.monotonic_time`, `Enum.random`, `Date.utc_today`, `self()/send/spawn`
are exactly what a rules author reaches for by habit.

Fix (same rule file, three edits, plus the twelve lines above as `invalid` cases in
`lint/tests/elixir-kernel-pure-test.yml`):

```yaml
- kind: alias
  regex: ^(Elixir\.)?(File|IO|System|Process|Port|Node|Task|Agent|GenServer|Supervisor|DynamicSupervisor|Registry|Application|Date|Time|DateTime|NaiveDateTime|Ecto|Phoenix|Logger)(\.|$)
- kind: atom
  regex: ^:(rand|random|os|file|timer|ets|erlang|crypto|persistent_term|calendar|gen_tcp|gen_udp|ssl|httpc|counters|atomics|global|mnesia|dets)$
- kind: call
  regex: ^(self|send|spawn|spawn_link|spawn_monitor|make_ref|node|monitor|receive|apply)\b
- kind: dot            # Enum.random / Enum.shuffle
  regex: ^Enum\.(random|shuffle|take_random)$
```

(`kind` names for the call and dot forms should be confirmed against
`ast-grep run --lang elixir --debug-query`; the alias and atom lines are verified against
the existing rule's node kinds.) Blocking all of `:erlang` over-blocks pure calls such as
`:erlang.binary_to_term/1`; in the kernel that is the right side to err on.

### F3 (should-fix) — `ts-kernel-pure` misses host globals; the compiler can catch most of them for free

Evidence (planted `kernel/ts/src/probe.ts`, then removed; `ast-grep scan` reported nothing):

```ts
export const a = Date();                                    // missed (only `new Date`/`Date.now`)
export const b = crypto.randomUUID();                       // missed
export const c = Math['random']();                          // missed
const D = Date; export const d = new D().getTime();         // missed (aliasing; theoretical)
export const e = () => import('node:fs');                   // missed (dynamic import)
export const f = global.setTimeout;                         // missed (`global`, property access)
export const g = fetch('x');                                // missed
export const h = Intl.DateTimeFormat().resolvedOptions().timeZone; // missed (locale = non-portable)
export const i = typeof window;                             // missed
```

Fix, cheapest lever first: `kernel/ts/tsconfig.json` already has `"types": []` but not
`"lib"`, so the default DOM lib types every browser/Node global. Adding
`"lib": ["ES2022"]` makes `tsc` reject them. Verified on a copy of the tsconfig:

```
src/probe.ts(2,18): error TS2304: Cannot find name 'crypto'.
src/probe.ts(4,18): error TS2304: Cannot find name 'global'.
src/probe.ts(5,18): error TS2304: Cannot find name 'fetch'.
src/probe.ts(7,25): error TS2304: Cannot find name 'window'.
src/probe.ts(8,18): error TS2304: Cannot find name 'setTimeout'.
src/probe.ts(9,18): error TS2584: Cannot find name 'console'.
```

Then the ast-grep rule only needs the ES-library leaks: add `pattern: Date($$$)`,
`pattern: import($$$)`, `kind: identifier, regex: ^Intl$`, and a `member_expression`
regex `^Math\s*\[` (or forbid the `Math` identifier outside `Math.(floor|abs|...)`). Add
each as an `invalid` case. Aliasing (`const D = Date`) is theoretical; skip.

### F4 (should-fix) — Story/Realm rules miss non-exported dynamic imports and false-positive on exported strings

The three mobile import rules match a `string_fragment` that is `inside` an
`import_statement` or `export_statement` with `stopBy: end`. Two consequences, both
verified with planted files:

1. Bypass. A lazy screen, the standard React Native pattern, is not an import statement:
   ```ts
   const load = () => import('../realm');          // story: not reported
   const k = () => require('../../../kernel/ts/src'); // story: not reported
   export const use = [load, k];
   ```
   (When the arrow itself is `export const ...`, the string sits inside an
   `export_statement` and is caught by accident; the existing invalid cases pass for that
   reason, not because dynamic import is handled.)
2. False positive. Any string inside any exported declaration matches:
   ```ts
   export const label = 'story/local-story';   // realm: error[mobile-realm-no-story]
   ```
   The `valid` case `const s = 'authority/local-story ...'` in each test file passes only
   because it is not exported.

Fix: anchor the string to the module-specifier position, and cover dynamic forms:

```yaml
rule:
  any:
    - kind: string_fragment
      inside: { kind: string, field: source }          # import/export ... from '<here>'
    - pattern: import($S)
    - pattern: require($S)
```

with `constraints: { S: { regex: '(^|/)(realm|remote-realm)(/|$)' } }` (per rule), and
add `export const label = '...'` as a `valid` case plus the two dynamic forms as
`invalid`. Confirm `field: source` against `--debug-query` for `export * from`.

### F5 (should-fix) — Shared packages may import features, opening a transitive Story→Realm path

`mobile-shared-no-authority` forbids `packages/**` from importing an authority (10 §2),
but nothing stops `packages/ui` from importing `features/realm`. Then
`features/story → packages/ui → features/realm` satisfies every rule while violating
14 §R2 "strict Story/Realm feature boundaries". Verified: planted
`mobile/packages/ui/probe.ts` with `export * from '../../features/realm';` scans clean.

Fix: extend the regex in `lint/rules/mobile-shared-no-authority.yml` to
`(^|/)(authority|local-story|remote-realm|features|story|realm)(/|$)` and add the case to
its test file. (Same inversion exists for `features/* → app`; low value, mention only.)

### F6 (should-fix) — `IMPORT.md` makes a false provenance claim and omits the R0 record

[IMPORT.md](../spec/IMPORT.md) line 4: "Every imported file is byte-identical between the
R0-accepted commit `f5bef28` and `997a7a8`". Six of the 43 rows do not exist at `f5bef28`:

```
ABSENT at f5bef28: docs/rewrite-v3/prep/adr-071-072-proposal.md
ABSENT at f5bef28: docs/rewrite-v3/prep/after-pr-10/owner-decision-a2-2026-09-23.md
ABSENT at f5bef28: docs/rewrite-v3/prep/after-pr-10/owner-decision-a3-2026-09-24.md
ABSENT at f5bef28: docs/rewrite-v3/prep/owner-decision-prep-03-2026-09-24.md
ABSENT at f5bef28: docs/rewrite-v3/prep/owner-decision-reviewers-2026-09-24.md
ABSENT at f5bef28: docs/rewrite-v3/prep/owner-decisions-2026-09-24.md
```

The 37 `docs/spec/` rows are byte-identical between the two commits (verified per path).
The six `docs/decisions/` rows post-date R0 by construction (proposals and owner decisions
from 2026-09-23/24), which is fine, but the sentence must say so.

Also: the phrase "R0-accepted" is defined by the legacy R0 record
`docs/rewrite-v3/prep/after-pr-10/r0-acceptance.pending.json` (`normative_files`,
`adr_state_review`, `unresolved_evidence_gates`, `architecture_index`,
`cutover_destination`). IMPORT.md does not cite it. Its `cutover_destination` asks R2 to
"preserve the invariant index" and record "its exact repository URL and import commit";
the `architecture_index` is not imported, only reachable through the reference README's
"R0/A1/A2 preparation records" link. Its `governing_companions` also names
`r1-work-package.md`, which the import left informative (defensible: R1 is complete; say
so).

Fix: (1) reword line 4 to "The 37 `docs/spec/` files are byte-identical between `f5bef28`
and `997a7a8`; the six `docs/decisions/` files were added after R0 and are imported at
`997a7a8`." (2) Add a line citing the R0 record path and hash as the source of the
normative file set, and either import it under `docs/decisions/` (it is the acceptance
record) or copy its `architecture_index` into `docs/spec/`. (3) One line on why
`r1-work-package.md` stays informative.

### F7 (note) — ADR-073 amendment strengthens 02 §1 beyond "dependency rules unchanged"; small doc residue

- 02 §1 line 70 changed from "Boundary enforcement SHOULD use separate umbrella apps plus
  compile-time boundary checks/tests" to "MUST use compile-time boundary checks (strict
  `boundary`), each rule with a planted violation that must fail". SHOULD→MUST and the
  planted-violation requirement are new normative text. Good change, but ADR-073 says only
  "the dependency rules are unchanged"; add one sentence acknowledging the enforcement
  clause was strengthened.
- 14 §R2 tasks now read "one Mix application with strict compile-checked boundaries" and,
  next line, "strict compile/dependency boundaries": the second bullet is redundant.
- 14 §R2 suggested shape says `portable/`, 02 §1 says `kernel/`; the repo follows 02. Pre-
  existing inconsistency; one word in 14 would close it. Not part of ADR-073's scope.
- Nothing else in `docs/spec` still assumes an umbrella (`grep -rni umbrella docs/spec`
  finds only the two amended lines).

What the umbrella enforced that is now lost (verified, all immaterial for this codebase):
module→area assignment by *file location*. `boundary` classifies by module name, so a file
`lib/loka/core/sneaky.ex` defining `Loka.Runtime.Sneaky` compiles clean with Runtime's
deps (the path-based ast-grep rule still scans it). Dynamic dispatch
(`apply(Module.concat([Loka, Builder]), ...)`) escapes both `boundary` and xref, as it
would have under an umbrella at runtime. Unclassified modules are not an escape:
`lib/rogue.ex` (no boundary) fails `mix compile --warnings-as-errors` (exit 1,
"Rogue is not included in any boundary").

### F8 (should-fix) — Gate R2 iOS item is met by owner rule, not by CI; record that explicitly

Gate R2 says "Empty-system CI is green on … the R1-selected iOS/Android integration path".
`mobile.yml` builds Android only; iOS was built on the owner's M1 (timings recorded in
AGENTS.md, owner-reported). AGENTS.md says "nothing paid, no EAS" and "iPhone and UI work
on the owner's M1", but no owner decision file says the gate's iOS clause is satisfied
that way. The repository is public (`gh repo view`: `"visibility":"PUBLIC"`), where
GitHub-hosted macOS runners cost nothing, so an unsigned simulator `xcodebuild` on
`workflow_dispatch`/mobile paths would violate no owner rule.

Fix, either: (a) add an `ios` job to `mobile.yml` (`pod install`, unsigned simulator build,
same bundle grep on `main.jsbundle`), or (b) add to
`docs/decisions/owner-decision-r2-2026-09-24.md` a verbatim owner line accepting the M1
build as the R2 iOS evidence, with the date and the AGENTS.md timings as the record.
(b) is the smaller diff; (a) is what the gate text literally asks for.

### F9 (note) — R2 task list: what is done, partial, missing

| Task (14 §R2) | State | Evidence |
| --- | --- | --- |
| one Mix application with strict compile-checked boundaries | done | `mix.exs`, `lib/loka/*.ex`, `lib/loka_web.ex`; red controls pass |
| strict compile/dependency boundaries | done | `boundary` strict + two xref ratchets |
| Rust workspace if accepted | n/a | R1 selected candidate C (Elixir + TS); correctly absent |
| minimal Expo app with Story/Realm and authority boundaries, shared packages | done (stubs) | `mobile/**`, rules in `lint/rules` (see F1, F4, F5) |
| formatter/lint/security configs | partial | formatter and lint present; security is `mix hex.audit` only. `npm ci --no-audit` disables npm's audit; no `.github/dependabot.yml`, no `mix_audit`/`sobelow`. Cheapest closure: one `dependabot.yml` covering `github-actions`, `npm` (two dirs) and `mix` |
| one unified CI | done | `ci.yml` + path-filtered `mobile.yml` |
| generated-schema drift check | missing, defensible | nothing is generated yet (`protocol/` does not exist); R3 introduces schemas. Add one line to 14 §R3 or a TODO in AGENTS.md so it is not forgotten |
| ADR directory | done | `docs/decisions/` |
| AGENTS/task routing docs | done | `AGENTS.md`, `CLAUDE.md`, `docs/ELIXIR-CONVENTIONS.md` |
| minimal release/dev tooling | done for empty system | `mise.toml`, `bin/*` |
| import the exact R0-accepted spec | done | hashes verified (see "Verified" below; F6 for wording) |
| physically separate normative from informative | done | `docs/spec` / `docs/decisions` / `docs/reference`; matches README §8 and §12 |

Gate items: Elixir (ci `elixir` job), TypeScript (`typescript` job), R1-selected portable
implementation (kernel/ts typecheck + `node --test`; Node, not Hermes), Android integration
path (release APK, uncached, 5 min 21 s), portability smoke (`grep -a loka-kernel` on the
Hermes bundle). The smoke proves `hermesc` compiled the kernel into the bundle, not that
it executes; appropriate for an empty kernel, but the R5 kernel needs an on-device or
emulator step that runs one `decide` call.

### F10 (note) — PR description is stale

`gh pr view 1`: "Next: Mix umbrella + `boundary` + …". The umbrella was replaced by
ADR-073 within the PR. Record-bearing PRs are merged with merge commits, so the body is
part of the record: update it to the final state and cite ADR-073 and the R2 gate
evidence before merge.

### F11 (note) — Dead weight / over-engineering

Little to cut. `bin/sync_phoenix_rules.exs` (84 lines) exists to refresh two vendored
files, one of which (`ecto.md`) describes a library that is not yet a dependency; ADR-006
is reconfirmed so keeping it is defensible. Everything else (stub `index.ts` files, single
kernel test, `.formatter.exs`, `mise.toml`) is the minimum that makes the globs and checks
have something to bite on. No speculative abstractions found.

---

## Verified and found correct

**Spec import (question 1).** Parsed all 43 rows of `IMPORT.md`; computed SHA-256 of each
legacy source at `997a7a8` (legacy clone HEAD confirmed `997a7a8c…`): 43/43 match. The 33
rows with `rewrites = 0` are byte-identical to the imported file at the import commit
`b968a8f` (and at `acccda6`, except 02 and 14, amended later by ADR-073 as IMPORT.md's
"Amendments since import" says; their diffs against legacy are exactly the ADR-073 lines
plus 14's one link rewrite). For the 10 rewritten rows, a line-by-line diff with link
targets masked shows zero non-link changes, and the count of changed link targets equals
the `rewrites` column in every case. All 19 files in the R0 record's `normative_files`
are imported to `docs/spec/`. Normative/informative split matches README §8: the six
informative documents (12, 13, 17, 18, 20, 22), `reviews/`, `INDEX-cut-candidates.md`,
`checks/`, `spec_tools/`, R1 evidence stay in the legacy repo and are linked from
`docs/reference/README.md`; companions (`pre-release-proof.md`, `release-scope.*`,
`r1-acceptance-envelope.md`, `conformance/`) and reading aids (`INDEX`, `REVIEW-GUIDE`,
`R-MILESTONES`) are imported without being promoted. Nothing informative is imported as
authority. `.gitattributes` protects `docs/spec/**` from whitespace fixes.

**ADR-073 and boundaries (question 2).** Reasoning is sound: `LokaWeb` depending on
`Loka.Builder` for the Builder API does defeat the umbrella's release-exclusion argument,
and strict `boundary` adds export control. Declarations versus 02 §1: Core `deps: []`;
Content `[Core]`; Store `[Core]`; Platform `[Core, Store]`; Runtime `[Core, Content]`
(no Store, no Builder: "production runtime MUST NOT depend on builder" holds); Builder
`[Core, Content, Runtime]`; LokaWeb `[Core, Platform, Runtime, Builder]` (no Store, no
Content). Core's forbidden Phoenix/Ecto deps: `boundary` strict catches external apps
(red control "core calls an undeclared external app" fails on `Logger`); stdlib/OTP
impurity is the ast-grep rule's job (F2).

**Checks (question 3).** Run from the repo root with `mise exec --`:
`mix deps.get` (0), `mix format --check-formatted` (0), `mix compile --warnings-as-errors`
(0), both xref ratchets (0, "No cycles found"), `mix test` (0, no tests),
`elixir bin/red_controls.exs` (5/5 ok), `ast-grep test --skip-snapshot-tests` (6 passed),
`ast-grep scan --error` (0), `bin/lint_red_controls.sh` (6/6 ok),
`elixir bin/check_docs.exs` ("45 docs, 0 broken link(s), 0 unreachable"). `kernel/ts`:
`npm ci`, `npm run typecheck`, `npm test` (1 pass). `mobile/app`: `npm ci`, `npx tsc
--noEmit` (0). Each red control fails for the reason it claims (checked the expected
strings in `bin/red_controls.exs` against real `boundary`/xref output). Anchors used by
ADR-073, IMPORT.md and AGENTS.md (`#1-proposed-repository-shape`,
`#r2--fresh-repository-foundation`, `#8-…`, `#12-…`) resolve to real headings (the checker
does not verify anchors; noted, not a finding).

**Gate and CI (questions 4, 5).** `gh pr checks 1`: android, docs, elixir, lint,
typescript all pass on run 36057164xxx at head. Action SHAs resolve to tags:
`actions/checkout` v4.4.0, `erlef/setup-beam` v1.24.1, `actions/setup-node` v7.0.0,
`actions/setup-java` v6.0.1. `ci.yml`: `pull_request` + `push: [main]` (no double run on
branches), `concurrency` with `cancel-in-progress`, `permissions: contents: read`,
`persist-credentials: false`, timeouts, `mix deps.get --check-locked`, Hex/npm versions
match `mise.toml`. `mobile.yml`: PR on `mobile/**`, `kernel/**`, itself, plus
`workflow_dispatch`; same hygiene; `-PreactNativeDevServerIp=localhost` per the R1 lesson.

**Privacy (question 6).** `git grep` over the tree for `/Users/`, `/home/`, `/private/tmp`,
worktree/scratch paths, UDID/ECID/serial/team-ID patterns: no hits other than the AGENTS.md
rule text, the conventions note that forbids `/private/tmp`, the A2 owner decision that
describes (without containing) the earlier adb-serial incident, and npm's
`serialize-error`. `app.json` carries only the public bundle id. Both `package-lock.json`
files use registry URLs only.

**Working tree.** All probe files removed; `mix compile --force` restored `_build`;
`git status --short` lists only `docs/reviews/2026-09-24-r2-foundation-review.md`.
