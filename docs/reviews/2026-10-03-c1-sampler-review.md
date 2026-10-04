# C1 sampler primary independent review — PR #142

Reviewed commit: `fc5a6f110211937dd0d3c80b5b743e994f28fb5b`.
Base: `b4d91ea0ac0c02e7590fb33eaa02c5dbc96181b4`.
Reviewer: fresh Codex primary; authored none of this slice. The bounded C1 continuation
uses the [PM review selection under owner delegation](../decisions/owner-decision-touch-resumption-2026-10-03.md).

Verdict: **APPROVE**. No actionable findings or required slice-proof rows remain open.
Source review is at `fc5a6f1`; final native acceptance uses the actual integrated
Release at `9732b0ec58f81ae74b7ca4e4cf8dd736d4cd409a`. Neither PR is claimed merged.

## Requirements derived before diff review

From [C1 plan slice 11/Q2](../decisions/owner-decision-chapter-one-plan-2026-10-02.md#11-c1-sampler-the-gate-story-q2),
[adopted identity/prose](../decisions/owner-decision-sampler-batch-2026-10-03.md),
[PM band repair](../decisions/pm-decision-sampler-bands-2026-10-03.md),
[compiler/loader](../system/cartridge.md), [installed mechanics](../system/mechanics.md),
[invocation/GameView](../system/protocol.md) and [save](../system/save.md):

- Keep all 57 adopted story strings and the owner-presented batch exact. Supplement only
  manifest/text with the eleven existing band phrases and literal baseline cuts/tones,
  with top key `ready`. Preserve the other 21 sources and all prior 19 source/artifact/trace pins.
- Reuse installed mechanics for the bounded six-room errand: reciprocal doors and sight,
  reachable room-found keys/cloak, locked trunk/custody, positions, current-state journal,
  separate offer activation before pickup, carry→take_it mapping, two chapters and three-line scene.
  No new rule, command, schema, clock/combat behavior, aliases, NPC handout or story picker.
- Independently declare artifact semantics, references and engine facts/defaults/table; use
  only approved catalog values from source. Actual Elixir compilation and TypeScript loading
  agree. Runtime target IDs follow the independent frozen numeric profile.
- App opens and starts over on its sampler file while the Lantern save stays byte-identical.
  Normal invocation and real SQLite reopening/retrying line two keep scene/quest/report state.
- Generator 12→13 and the source inventory change remap inputs only: preserve inherited
  selected source, first command, full/drained profile and literal fault anchors.
- Final combined Release Simulator proves supplemented-hash load, choice/menu fit,
  authored band phrase/tone and line-two kill/relaunch. Owner phone play and measured
  touch-to-visible-feedback remain Gate C1 human rows.

## Actual diff and correctness

Reviewed all changed source, App, oracle, fixture, test, simulation-input, governing-doc
and evidence files. Runtime code changes only the App import/bundled release and shared
story-specific database constant; no kernel, storage API or protocol/schema changes.
The existing session controller continues owning open/Start over/recovery.

Independently compared the adopted draft bytes: 23 source JSON files; the other 21 are
byte-identical both to the adopted draft and `2b4c9d6`. All 57 original story values are
exact. Original catalog SHA-256 `c9625cf219728e27efb27923ed302d02cfed51df1fa099239db6ffb76285808b`
and historical batch SHA-256 `05e8865400e5a5c1cdac8669a972d87d7561fd6d1c32bb0c2543446a29967288`
match. The eleven added labels and table match the legacy UI/defaults; only the top key changes.
All 19 old fixtures and every old source/trace file remain unchanged in the actual diff.

The Python oracle declares geometry, placements, requirements, facts/resources, quest,
choice/point/scene mapping, references and band rows literally. Re-running it reproduces
the complete fixture byte-exactly; independent stdlib canonical/hash checks also confirm
`5631ddf63007b837bef1e91dfb71fcfb8d31847257210c5de1caa5b198a771b5`, 16,587 artifact bytes.
Numeric-profile ID allocation order agrees with the literal runtime targets and cloak holder.

The new tests cover distinct integration breaks: complete carried content reachability/save
walk, alternative hand-over/ending wiring, actual App release/file binding. Literal expected
IDs, journal/chapter/scene answers and saved facts do not come from the implementation.
Compiler expected bytes come from the independent answer; cross-kernel agreement supplements it.
Existing fault-test expected outcomes, revisions and clocks are untouched. No new duplicate
rule-conformance tests or source-text assertions were introduced.

## Reviewer-owned verification

Normal dependencies were installed in this isolated checkout; no shared-checkout edits,
full check_all rerun, native build or Simulator run by this reviewer.

- `python3 test/loka/cartridge_sampler_hash.py`: exit 0; fixture unchanged.
- `mise exec -- mix test test/loka/content_sampler_test.exs test/loka/cartridge_cross_kernel_test.exs`:
  exit 0, 3 tests; independent compiled bytes and actual compiler→TypeScript loader/hash/lock.
- `NODE_NO_WARNINGS=1 mise exec -- node --test mobile/authority/local-story/sampler.test.ts mobile/app/sampler.test.ts`:
  exit 0, 3 tests; six-room invocation walk, both endings, band `ready`/`normal`/exact phrase,
  real SQLite close/reopen line two, unchanged trigger retry/report count and healthy App Start over
  preserving the existing Lantern checksum. This is headless execution, not rendered native proof.
- Focused `faults.test.ts` literal-anchor/reopen checks: exit 0, 2 tests; the details waits/look
  and dusk ring_bell keep unchanged literal outcome/revision/clock answers.
- Controlled old/new simulation inventories: exit 0. The simulator algorithm is unchanged;
  remove only the sampler from its in-process input list to recreate the old pool, then restore it.
  All 17 fault representatives plus both anchor seeds and both regression seeds preserve source,
  first command and exact full/drained resource profile; required mechanic commands remain present.
  Explicit wait(1), wait(1), look and ring_bell prefixes are independently checked.
- Independently read PR #142's head and all checks through GitHub: exact `fc5a6f1`, six
  `COMPLETED/SUCCESS` checks (changes, bundle, lint, elixir, sim, typescript).
- All 23 retained author-evidence checksums verify. Author logs establish their reported runs;
  the checks above and the two red controls below are this reviewer's own executions.

## Independent red controls and restoration

1. Swapped story-point `carry`/`leave` trigger choices in a valid fixture and recomputed its
   canonical/hash with Python stdlib. Both authority sampler tests fail at opposite chapter
   answers (`take_it` remains chapter 0; `leave_it` reaches chapter 1). The loader accepts it;
   this is a gameplay-wiring failure, not malformed bytes or hash integrity.
2. Changed the actual App shared database constant to `loka-lantern.db`. App integration test
   fails because the existing Lantern pin prevents sampler opening. This detects a real save
   binding regression through execution, without source matching.

Both mutants return exit 1, were restored byte-exactly, and the complete three-test focused
sampler/App run passes again. Final tracked diff is clean. Reviewer captures were redacted
before hashing; [their checksum verification](../evidence/c1-sampler-review/SHA256SUMS.verify) passes.
Retained own results: [compiler](../evidence/c1-sampler-review/c1-sampler-primary-compiler.log),
[gameplay/App](../evidence/c1-sampler-review/c1-sampler-primary-focused.log),
[remaps](../evidence/c1-sampler-review/c1-sampler-primary-remaps.log),
[point-pair mutant](../evidence/c1-sampler-review/c1-sampler-primary-mutant-point-pair.log),
[save-binding mutant](../evidence/c1-sampler-review/c1-sampler-primary-mutant-save-binding.log),
and [restored tests](../evidence/c1-sampler-review/c1-sampler-primary-restored.log).

## Findings and simplicity

No blocker, should-fix or nit finding. Ponytail Review: **Lean already. Ship.**
The source plus existing compiler/authority/App binding is sufficient; no extra runtime layer,
dependency, abstraction, compatibility scaffolding or removed trust-boundary validation.

## Final native acceptance inspected independently

The independent touch primary executed the final production Release interaction; this
sampler primary inspected its [compact evidence](../evidence/c1-touch/README.md), metadata,
AX controls, build/terminate/relaunch results and four relevant screenshots. This reviewer
performed no native build or GUI action. All 38 native evidence manifest checksums verify.
Git byte comparisons independently confirm actual integrated `9732b0` App/source/fixture
match reviewed `fc5a6f1`, and its complete book presenter matches reviewed `595c036`.
No manual preview patch is included. PM separately verified all six integrated CI checks.

**SAMP-BAND-01: closed.** [Character screenshot](../evidence/c1-touch/content-band.png)
displays `hp 20 / 20, is in perfect health` in normal foreground from authored `band.ready`.
Both [offer](../evidence/c1-touch/offer-menu-fit.png) and
[ending](../evidence/c1-touch/ending-menu-fit.png) show their choices, Close and Done inside
the 414 × 896 logical-pixel viewport. This closes the actual new band row with the
supplemented hash; the immutable 57 story strings plus eleven reused UI labels remain
within the recorded PM scope. Warning/danger native transitions are not claimed; those
projections are controlled presenter-test evidence.

[Fresh save identity](../evidence/c1-touch/fresh-save-identity.json) pins
`5631ddf63007b837bef1e91dfb71fcfb8d31847257210c5de1caa5b198a771b5`, revision/clock/receipts 0,
and clean `loka-kernel@9732b0ec58f81ae74b7ca4e4cf8dd736d4cd409a`.
The actual Release [build status](../evidence/c1-touch/release-build-status.log) is successful.
[Scene line-two screenshot](../evidence/c1-touch/scene2.png), actual
[terminate](../evidence/c1-touch/scene-terminate.log)/[relaunch](../evidence/c1-touch/scene-relaunch.log),
and [restored controls](../evidence/c1-touch/scene2-restored-controls.log) agree with
byte-identical [before](../evidence/c1-touch/scene2-before-relaunch.json)/
[after](../evidence/c1-touch/scene2-after-relaunch.json) SQLite metadata: scene 2, revision 8,
clock 0, eight receipts, state/head digest
`48276f372fa50facde2d5f895b274bbead6b74f7aa19db1d2376a620a4f6264e`, receipt digest
`89a9969997d677d3d77f57e90941031f612e0838952e69a5cb628d76dce935a6`.
Restored prose is exactly line two, Character is disabled and Continue is the only enabled
app action; no consequence or receipt repeated. The independent touch record also verifies
scene completion followed by the queued reached chapter and normal journal updates.
Retained old-hash full-walk evidence covers unchanged rows; this fresh production proof
closes its binding/band/relaunch gaps without pretending every prior transition was repeated.

## Separate independent Sol review, verbatim

The answer below is the separate reviewer’s code verdict at the sampler head. Its final
paragraph records native proof still pending at its handoff; the inspected final production
evidence above now supplies those slice rows. Its explicit scoped App/direct-caller review
also covers the sampler App change after the prior Astra audit at `b4d91ea`, without
claiming the old audit covered a later diff.

```text
verdict: APPROVE
PR: 142
audited head: fc5a6f110211937dd0d3c80b5b743e994f28fb5b
base: b4d91ea0ac0c02e7590fb33eaa02c5dbc96181b4
Independent review; authored none.
Findings: none.

Personally run:
- Python oracle with output captured in memory reproduced the complete fixture, hash 5631ddf63007b837bef1e91dfb71fcfb8d31847257210c5de1caa5b198a771b5 and 16,587-byte artifact.
- Verified 19 prior fixture pins and existing cartridge sources unchanged; only two sampler source files supplemented; 57 adopted strings and original prose batch preserved. Evidence checksums passed.
- SQLite-memory normal-invocation walk passed six rooms, offer before acquisition, keys/container, wear/remove, positions, journal, carry→take_it chapter/scene, modal refusal, line-two authority reopen and trigger replay.
- Existing alternative-ending test passed.
- Actual App shell probe passed sampler startup/Start over binding, Lantern-row preservation and mismatched-pin refusal.
- Exact-base/current generator comparison preserved all 21 remapped representatives’ source, first-command type and full/drained profile. Literal anchors passed.

App diff scope check:
Reviewed App.tsx:14,31,38–54, imported fixture, session/openGame binding and direct Book/SaveError callers against the prior audit base. Separate sampler database and prior-pin refusal remain correct. Authority and kernel runtime modules are unchanged; no repeated gate audit.

Tests/simplicity:
Independent literal expectations and distinct content-wiring/App regressions are appropriate. Python independently declares semantics, references, defaults and bands, copying only catalog text. Ponytail Review: lean already; no justified removal.

Reported, not personally rerun:
PM’s six exact-head CI successes; developer compiler/cross-loader, file-close/reopen and fault suites, seven original plus two band red controls. No mutations, full checks or native runs performed; local Elixir build unavailable.

Remaining proof:
This verdict covers code. Prior native proof covers unchanged rows only. This SHA’s presenter still displays fallback “ready”; final integrated Release band display and native scene relaunch remain required, alongside owner phone play and touch-to-photon evidence.
```

## Carries and practical limits

- Gate C1 owner phone play and measured touch-to-visible-feedback remain human gate work,
  not an open finding or missing slice acceptance. No owner-human acceptance is claimed.
- Simulator evidence covers required slice interaction/fit/persistence. Native warning/danger
  HP transitions and raw joystick drag were not run; controlled tests cover the former, and
  PM rules the unchanged joystick outside this new C1 proof.
- Existing strict activation/acquisition, aliases, NPC handout and wider time/combat carries
  keep their declared triggers; this content introduces none of them.
- Evidence links anticipate PM publication; this record neither pushes nor claims a merge.
