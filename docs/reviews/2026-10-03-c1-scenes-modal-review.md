# C1 scenes-modal primary independent review — 2026-10-03

PR #140, exact reviewed head `2c8211477889630cb93a3be95ff68f05a1bc9be3`; actual merged-main base `d0b576c707a4e955b9cbf089fa0c76e97835bd2a`.

Final combined outcome after round 1: **APPROVE** at `a7ac604325ce6d49adba69feb3e164f63428d136`, with SOL-01 closed and no open findings. Earlier verdicts and pending states below are historical.

I authored none of this PR. Reviewer selection follows the bounded C1 mechanics continuation decision; PM confirmed six successful CI checks at the exact head. Verdict: **APPROVE**. Open findings: **none**.

## Essential requirements derived before the implementation diff

- Governing mechanics scene@1: compiler-added player FactSpecs are byte-exact; zero is absent/not-started, 1..n is shown line, −1 ended. Content cannot author or write these facts; ordinary reads remain legal. The compiler adds the fact@1 dependency after validating authored requirements; the loader validates declared capability uses. Both validate references and ordered steps.
- Governing mechanics scene@1 and reaction@1: a matching story-point outcome starts once, after authored reactions, atomically in the triggering proposal. Starts require scene@1 but not reaction@1; existing budgets/FIFO/writer groups remain intact.
- Governing protocol ActionSet/admission and GameView: running scenes replace every ordinary contribution with only targetless, inputless continue; direct commands and invocation resolution refuse other actions before any effects or clock change. View and exits agree with admission.
- Governing mechanics continuation/event clause: each continue advances exactly one line; final continue writes −1 with fact_changed at position 1 and scene_ended at position 2. Actor comes from command. Reopen/replay preserves line without reapplying effects.
- Settled brief scope: existing hashes, artifacts, answers and trace pins remain frozen; approved generator/seed remapping preserves source/first-command representatives. Only one new scene replay transcript is authorized. No dialogue/proposal/compose/storage/UI changes or later scene features.

## Review method

The settled brief and all PM scope amendments were read before implementation. Ponytail Review and correctness review are both required. Independent focused checks and temporary mutations are recorded separately from developer-reported evidence below.


## Findings and simplicity

No blocker, should-fix or nit in the approved scope. Correctness and Ponytail Review covered the actual diff once, including schema/fixture additions, compiler hooks, shared scene helper, admission/view, reaction delivery, new cartridge/transcript, simulator inputs and documentation. Lean already. Ship.

The 25-line pure rule and 68-line shared helper have actual rule, admission, reaction and view consumers. The explicit reaction→scene coupling is required by the installed mechanics clause, limited by its ponytail trigger, and writes ordinary reserved facts through existing bounded proposal machinery. No new op, storage mechanism, generic event framework, cast-guard exemption or unrelated mechanic edit was added. Chapter and journal projection remain intact.

## Independent validation actually run

All commands used the pinned toolchain through `mise exec --` in a throwaway detached worktree at the exact reviewed head.

- Scene kernel + real SQLite reopen/receipt retry: five tests passed (`node --test kernel/ts/test/scene.test.ts mobile/authority/local-story/scene.test.ts`).
- Loader corpus: 74 tests passed (`node --test kernel/ts/test/cartridge.test.ts`). It includes all 14 new scene diagnostics; the inherited 57 corpus cases remain identical.
- Elixir source scene/compiler + contracts: 14 tests passed. After restoration, all content/compiler suites passed 123 tests, and contracts passed nine again with `mix test --force`.
- Scene and direct neighbors (chapters, journal, reactions, position), transcript replay and curated SQLite fault tests: 51 tests passed. Simulator suite: 17 tests passed, including its planted behavioral failures.
- `mix xref callers Loka.Content.Scenes` resolves only the compiler runtime caller. No Elixir runtime scene rule is claimed; ADR-074 makes it TypeScript-only.
- Independent raw-schema sweep: all 37 required entries, constants, bounds and closed-object constraints from the new scene contracts and integration fields were caught. Seventeen loosened schemas changed an invalid fixture's independently pinned answer; twenty fail the existing closed-schema subset check before validation. A baseline check of the complete invalid corpus, including subset probe definitions, passed first.
- Python reproduced the new canonical known-answer bytes/hash exactly (`d6049d81c193af520a998f2b9860079796359d7c806fd82e800fe43bd57d3a34`). Literal Python continuation/end ops independently reproduced all three new transcript delta digests; hand-specified trigger/fact outcomes and event positions/order matched.
- Protected inherited source/artifact/hash/trace files: 196 byte-identical files; all 18 prior known answers remain unchanged. All 621 inherited invalid fixtures remain identical; 31 new cases append. Current inventory is 19 source cartridges and 19 known answers.
- Reconstructed generator-11 input pool versus generator-12 pool: all 17 approved curated seed pairs preserve source and first command type. The additional 240→114 anchor preserves ashmere_dusk/perform; the passing literal anchor test verifies revision 1/clock 60. Seed 16314 and its expected-answer assertions remain unchanged.
- `git diff --check` passed. Every temporary mutation was restored; detached worktree removed after completion.

## Tests tested independently

Four realistic implementation mutants were planted one at a time and restored:

1. Remove the modal ActionSet replacement: two scene tests fail (ordinary actions remain available).
2. Replace start's zero guard with ALWAYS: ended-fact start-once test fails.
3. Disable the TypeScript reserved-write condition: recipe, reaction and dialogue corpus cases fail.
4. Disable the Elixir reserved-write membership condition: authored consequence ownership test fails (`mix test --force`).

A physical raw-schema mutation dropping SceneDefinition's required control also fails the invalid-fixture test; the additional in-memory sweep exercises all 37 changed constraints. No mutant survived. The developer's reported 32 implementation mutants are supporting reported evidence, not independent runs by this reviewer.

## Limits and nonblocking boundary observation

The PM independently verified six green CI checks at this head; I did not repeat the full check-all line, phone/Simulator UI, or the developer's 32-case implementation sweep. Headless reopening was exercised with real SQLite. The installed contract expressly carries stale fresh-id double taps and remaining scene modes/objectives to later work.

A hand-built canonical scene artifact can omit fact@1 from both requires and lock after removing authored fact-using recipes/reactions/choice sequences, and the current loader accepts it. The explicit governing addition is a compiler dependency promise (`docs/system/cartridge.md:45`), which the source compiler satisfies and independently tested source compilation confirms. Loader clauses enumerate declared uses; general implicit rule dependency closure is not specified by this slice, and the existing position boundary behaves likewise. This is a boundary observation for later dependency certification, not an invented current-scope blocker. A new explicit loader dependency contract would make this case a required refusal test.

The current scene contract preserves play-time semantics and does not implement fixed-clock hazard/menu policy or broader LegendMUD proposals. Those future interactions need a declared integration policy before installation; their absence does not contradict this approved modal subset.

## Handoff

This record and the index line were delivered to the PM in shared r78 under the explicitly authorized batched-record exception. No production code, inherited fixture, main/developer/PM worktree, branch, commit or remote was changed.


## Initial separate Sol review — awaiting round 1

The primary initial verdict above remains APPROVE at `2c8211477889630cb93a3be95ff68f05a1bc9be3`. Sol independently returned CHANGES REQUIRED with blocker SOL-01. The combined review status is **Awaiting round 1**; the developer is addressing the scene source-key boundary. No fix review or approval is implied. Contract-freeze broad re-review will start after PM verifies green checks at the fix head.

The initial Sol answer follows verbatim:

```text
Verdict: CHANGES REQUIRED
PR: 140
Head: 2c8211477889630cb93a3be95ff68f05a1bc9be3
Base: d0b576c707a4e955b9cbf089fa0c76e97835bd2a

SOL-01 | blocker | lib/loka/content/compiler.ex:137
Scene source keys bypass their 58-character limit. The shared definition pipeline validates generic Key (maximum 64), then body/4 discards errors on the inserted key, including SceneDefinition’s stricter limit. An otherwise valid scene with a 59–64-character filename compiles successfully and generates an oversized scene_<key> fact; the resulting artifact fails contract validation and cannot load. Independently reproduced in memory: 58 passes; 59 and 64 compile successfully but produce invalid artifacts; 65 is rejected. Preserve scene-specific key validation and add a source boundary regression.

Actual checks:
- Focused TS scene, cartridge-loader and schema tests passed.
- Five independent in-memory code controls caused scene tests to fail.
- 37 independent in-memory schema controls were caught.
- Elixir compiler baseline matched the independent artifact; focused reference, reserved-write and dependency probes passed.
- Independent Python artifact oracle and three continuation/end delta hashes matched.
- All seven new transcript commands, events and digests replayed exactly.
- All 18 inherited hash fixtures, existing cartridge sources/transcripts and inherited fixture cases remained unchanged.
- Seed remapping preserved sources and first command types/actions, including 240→114 dusk/ring_bell with revision1/clock60 and unchanged 16314.
- Working tree clean; diff whitespace check passed.

No additional correctness or simplicity findings.

Material limits: Six successful CI checks were PM-verified, not independently reverified. Developer-reported 32 code controls were not rerun wholesale. SQLite reopen/device tests and full checks were not run; review remained read-only, without disk mutants or authoring. Future clock/Legend proposals and the separate story-mechanics audit were outside scope.
```

## Round 1 primary broad re-review — 2026-10-03

**APPROVE** at exact fix head `a7ac604325ce6d49adba69feb3e164f63428d136`, comprising code fix `a128b1b` and future reading-time decision record `a7ac604`. PM independently verified all six checks successful at this head (CI run 37169792835; bundle run 37169792846). The initial primary verdict and verbatim initial Sol review above remain historical evidence. Open findings after this primary re-review: **none**; **SOL-01 closed**.

Contract-freeze breadth was preserved: re-read the governing scene/dependency/admission requirements and examined the whole approved scene integration, including compiler/source→engine facts, runtime starts/continuation, reserved ownership, ActionSet/view, schema boundaries, frozen content/test evidence and documentation. The substantive fix and its direct caller were reviewed in full. Compared with the initially audited head, only compiler validation, the new source boundary regression and three decision-doc files changed; all 431 files under protocol, TypeScript, cartridges and mobile remain byte-identical. Prior unchanged schema, trace-digest, seed-mapping, modal/start/reserved-write controls and simulator evidence are therefore retained rather than needlessly repeated.

SOL-01 disposition: `lib/loka/content/compiler.ex:249` discards an inserted-key error only when generic Key already rejects that key. The direct `definition/5` caller retains the generic validation and reports all remaining contract-specific body errors. This restores SceneDefinition's 58-character source limit without scene-specific compiler machinery or duplicate generic diagnostics. The new controlled-source regression demonstrates length 58 compiles a valid CartridgeArtifact and its 64-character engine fact; lengths 59/64 return exactly the independent too_long diagnostic at the scene key; length 65 retains its existing generic diagnostic path. Other definition kinds retain existing validation. Ponytail Review: lean; necessary safety validation preserved.

Actual independent round-1 checks:

- Pinned `mix test --force test/loka/content*test.exs test/loka/core/contracts_test.exs`: **133 passed**, exercising the shared compiler path and all source fixtures/contracts.
- Pinned focused TypeScript scene/loader plus real SQLite reopen/receipt-retry: **79 passed**.
- Restored old unconditional inserted-key suppression in the detached worktree: **5/6 scene source tests passed**, with the new filename boundary regression failing on the originally accepted invalid artifact. This is an actual independent red control, not developer evidence. Restored the fix and ran `mix test --force test/loka/content_scenes_test.exs`: **6 passed**.
- Diff whitespace and clean restored worktree checks passed. Temporary mutant restored; review worktree removed after handoff preparation. No shared branch or production worktree mutation.

Reading-time record audit: the recorded owner approval (“okay lets go with what you recommend, as long as world time does not stop”) is tied to the quoted recommendation to avoid punishing reading speed through intentional timed choices and protection or escape while controls are restricted. Further safe-context/interruption guidance is explicitly PM planning interpretation. The record states future integration, requires later spec/contracts amendments, and selects no specific protection, combat/death, terminated-app catch-up or persistence policy. No live clock, immunity, interruption or termination behavior is installed by this PR. The owner-rule link accurately summarizes the approved direction; the scene subset and Gate C1 remain governed by their existing plan.

Limitations unchanged: PM-verified CI, no independent full check-all/device run, and no repeat of unchanged 37-schema or simulator controls. The previously noted hand-built implicit-fact dependency boundary and stale fresh-id double tap remain nonblocking current-contract limits.

## Round 1 separate Sol review

Final separate Sol verdict: **APPROVE** at `a7ac604325ce6d49adba69feb3e164f63428d136`; **SOL-01 closed**, no new findings. The answer follows verbatim:

```text
Verdict: APPROVE
PR: #140
Head: a7ac604325ce6d49adba69feb3e164f63428d136
Base: d0b576c707a4e955b9cbf089fa0c76e97835bd2a

SOL-01: CLOSED — lib/loka/content/compiler.ex:250
The shared filter retains definition-specific key errors when generic Key validation succeeds. Scene keys 59–64 now fail precisely at .key; 65 retains the generic diagnostic. Valid artifacts and neighboring diagnostics remain unchanged.

New findings: none.

Independently run checks:
- Focused TypeScript scene, cartridge-loader and contract suites passed, including start-once, modal admission/view and continuation/end event ordering.
- Literal in-memory boundaries 57/58/59/60/64/65 passed; complete generated FactSpec and valid artifact contracts matched expectations.
- Exact new regression assertions passed through an in-memory source adapter, failed with the original filter restored, then passed after restoring the fix.
- 36 malformed scene-key/body cases preserved original diagnostics and ordering.
- 165 non-scene probes across 11 definition kinds matched original compiler results.
- All 19 real-source cartridges compiled in memory to their exact canonical/artifact/hash pins; independent Python scene oracle matched.
- Inherited sources/transcripts/hash pins, 621 invalid cases and 57 loader cases remained unchanged. Diff whitespace check passed; tree clean at the stated head.

Inherited evidence:
Runtime, schemas, fixtures and curated seeds are identical to the initial reviewed head. Prior code/schema controls, transcript replay, seed representative mapping and primary SQLite reopen evidence remain applicable; those sweeps were not repeated.

Reading-time record:
Verbatim owner direction and index/owner-rule pointers verified. Future foreground world-time continuation is preserved; detailed safe-context/interruption guidance is labeled PM interpretation and requires future specifications. No clock/protection/UI implementation or settled combat/death/termination policy is introduced.

Simplicity: Lean already. Ship. The fix addresses shared validation without new machinery.

Material limits:
Six exact-head CI successes are PM-verified evidence; full pre-push and developer red controls are reported evidence. Filesystem boundary mutations, SQLite/device work and full check-all were not run here. Review made no writes, commits, pushes or branch changes. Astra strategy advice remains outside this verdict.
```

Final combined review: **APPROVE**, with no open findings. PM independently verified all six code-head CI checks successful. The final record-bearing commit changes only this record and its index; it preserves the approved implementation and decision record unchanged.
