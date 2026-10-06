# C5 final primary source review

**Verdict: CHANGES REQUIRED.** Independent reviewer authored none of the source.

- PR: [#255](https://github.com/lorecrafting/lokacore/pull/255).
- Exact source reviewed: `93f7bb25f47b62402463cfb73011cd72686b037a`; published base `9efebfd5`.
- Governing [brief](../briefs/chapter-one/chapter-one-c5-bleeding-bandage-brief-2026-10-05.md), [mechanics](../system/mechanics.md#c5-hound-bleeding-and-bandage-selected-contract), [protocol](../system/protocol.md#c5-bleed-and-bandage-composition), [cartridge](../system/cartridge.md#c5-bleed-and-bandage-declarations), [composition](../system/architecture.md#building-mechanics-by-composition), [save](../system/save.md#c5-bleed-and-bandage-recovery), and [Book](../system/book-ui.md#c5-bleeding-and-bandage-details).

## Requirements derived before the diff

Actual positive surviving hound loss must create one body/effect generation. Further eligible hound hits refresh the end without stacking or postponing its pending cadence. Current jobs damage strictly before the end; cure, expiry and every player death clear the owned occurrence. Canonically ordered same-time round/bleed work may share a group only for the exact current pair. Exact acquired/currently qualified, directly held-item treatment alone is admitted during combat; consumption, status and job changes commit together without changing HP, clock or initiative. Save replay must reconstruct accepted history, preserve mismatch/corruption refusal and never delete a save silently. Book offers and confirmed narration must reflect the same admission and receipts. The two generic composers must accept legitimate producers as well as refuse malformed transitions.

## Findings

1. **C5-FP1 — blocker — another hound's hit faults instead of refreshing.** `kernel/ts/src/mechanics/bleed/shared.ts:77` always writes the current attacker's `source_id`, but `kernel/ts/src/foundation/compose_bleed.ts:16` and `lib/loka/core/compose_bleed.ex:35` require an active refresh to retain its source. With the bundled v037 cartridge, two live hounds placed together, controlled 100% hound hits, 0% player hits and no dodge, the actual first round at 64950 applies bleeding; after its tick at 65050 the next pack opportunity at 65100 returns `fault/evaluator_error`. A direct second-hound `wound` composition returns `precondition_failed` on the bleed target. Temporarily retaining the active row's original source makes the exact pack reproduction pass. Preserve the selected provenance while allowing every eligible pack hit to refresh, and cover the real alternating-hound producer.

2. **C5-FP2 — blocker — an off-cadence refresh stalls the clock before expiry.** `kernel/ts/src/foundation/compose_bleed.ts:47` and `lib/loka/core/compose_bleed.ex:22` reject `next_tick_at > ends_at`, although `kernel/ts/src/mechanics/bleed/job.ts:86` advances cadence and schedules `min(next_tick_at, ends_at)` specifically to deliver the final expiry. Reproduction uses real commands: wound at 64950, Flee, wait to 64975, return and re-engage, settle tick 65050 and hound hit 65125, then Flee again. The refreshed end is 65425; ticks at 65150 and 65250 succeed, but tick 65350 proposes cadence 65450 and expiry job 65425 and faults `precondition_failed`. Elapsed cannot reach lawful expiry. Permit the pending expiry representation in both portable composers without weakening exact job/generation checks; test an arbitrary re-engagement phase and its cold reopen.

3. **C5-FP3 — blocker — a noncombat player death leaves bleeding active after return.** `kernel/ts/src/mechanics/bleed/shared.ts:11` is called by combat cleanup, while `kernel/ts/src/mechanics/death/sequence.ts:173` clears water/escort/patrol state without clearing this bleed. The actual water expiry caller has no other cleanup. Controlled v037 input with authored water duration 50: wound at 64950, Flee, enter a declared water bottom through the water occurrence helper, then deliver drowning at 65000. The delivery is accepted and returns HP10 at Chapel, but the original bleed remains active with its pending job. This violates the explicit all-player-death cleanup clause. The published duration6000 normally outlasts duration300 bleeding; the failure is in supported authored-duration composition, not a claim that the stock route currently triggers it. Clear C5 in the shared player-death path, accounting for already completed/cancelled bleed jobs so its own fatal tick remains valid.

4. **C5-FP4 — blocker — fatal bleed has no typed bleeding cause.** `kernel/ts/src/mechanics/bleed/job.ts:27` calls `deathSequence` with source hound and null credit but no cause; `kernel/ts/src/mechanics/death/sequence.ts:23` supports only the drowning cause. An actual HP1 bleed delivery emits `entity_died` with original hound `killer_id` and null `credited_character_id`, but no `cause`. The selected protocol requires a typed bleeding cause and original-producer evidence. Preserve the existing no-credit behavior, add the narrow typed cause through the existing event/death contract, and assert it on the actual tick producer. Do not fabricate a melee attack event.

## Verification and limits

- Unchanged C5 kernel, portable composition and real SQLite authority tests: **15/15 pass**. This includes the six tick/cure COMMIT outcomes, input/elapsed fencing, cold reopen and replay. Existing focused tests miss the pack-source switch and off-cadence refresh failures above.
- Tested the tests in the detached throwaway checkout: removing `row.generation === generation` from exact bandage matching made the existing stale-generation refusal fail (`accepted` instead of `rejected`). Restored the source afterwards.
- The four targeted behavioral controls above fail on this exact source. The pack-source control passes with the temporary provenance correction; that correction was restored and is not committed. The drowning control uses the real expiry producer and an explicit controlled content duration. All temporary tests were removed before committing this record.
- Tracked schema sweep rerun: **56 mutations, 56 killed, no survivors**. Read the separately tracked discriminator compile control and portable literal cases. The sweep result is not evidence for the behavioral cases missing above.
- v035/v036 frozen hash fixtures are byte-identical to the published base. v037 canonical bytes and SHA256 independently recomputed with Python agree with `d995ec92f0e7dcfd45d495504cd008176c04a3fa6c822e4a194b0b127be7fc65`. The successor script takes published v036 plus the reviewed provisional C5 artifact; it does not regenerate the expected answer through the current compiler.
- Reviewed the integration/helper split changes with the current composers, producer/job paths, keyed/raw admission, status projection, terminal custody and generic receipt replay. The confirmed receipt path and explicit mismatch refusal remain. Hosted checks and browser results are the PM's exact-head evidence; this review did not rerun a browser or use an owner save or native runtime.

Ponytail Review: no additional framework or dependency is needed. Existing resource/death/job/receipt owners remain the right boundaries; fix these cases there. No separate over-engineering finding. The verdict remains CHANGES REQUIRED until C5-FP1 through C5-FP4 are closed.

## Independent save/protocol second opinion

The following answer is retained verbatim for source `93f7bb25`. SO1/SO2 overlap FP1/FP2; SO3 and SO4 add portable binding findings to the open fix list.

```text
CHANGES REQUIRED
Head: 93f7bb25f47b62402463cfb73011cd72686b037a
Base: 9efebfd563841977e712323dc35ff649af6747fa
All locations below refer to that head.

C5-SO1 | blocker | kernel/ts/src/mechanics/bleed/shared.ts:77
A second pack hound’s positive hit replaces source_id, but both composers require the active source to remain unchanged. Reproduced against v037: wound at 64950, tick at 65050, next round at 65100 faults evaluator_error instead of refreshing. Preserve the retained source when refreshing.

C5-SO2 | blocker | kernel/ts/src/foundation/compose_bleed.ts:47; lib/loka/core/compose_bleed.ex:23
Off-cadence refresh cannot reach expiry. Example: application at T0, refresh at T150, end T450. The T400 tick advances next_tick_at to T500 and schedules expiry at T450, but both composers reject next_tick_at > ends_at. Reproduced precondition_failed; elapsed cannot advance through that tick. Permit the retained future cadence needed by an expiry delivery.

C5-SO3 | blocker | lib/loka/core/compose_encounter.ex:236
Portable composers disagree on mixed bleed/sight scheduling. A schema-valid job.schedule containing a complete bleed binding plus sight returns precondition_failed in TypeScript, but Elixir accepts it and drops sight. Reproduced directly in both runtimes. Reject the competing binding in Elixir and add a shared refusal fixture.

C5-SO4 | should-fix | protocol/delta.schema.json:868
The four-way discriminator does not reject partial bindings. Validation accepts bleed_body_id without bleed_generation, and encounter_id with an orphan bleed_generation. The latter can cancel an encounter job while ignoring the stray bleed field. Require complete binding fields and exclude partial competing bindings; the current sweep misses these cases.

Checks/limits: 13 focused TypeScript tests passed; an in-memory cadence-guard mutant failed the expected fixture. The passing suite misses the reproduced scenarios above. Frozen v035/v036/combat fixtures are unchanged; v037 loads with the stated hash. Reviewed receipt replay, transaction fencing and six SQLite fault cases; did not rerun SQLite, full CI or mobile/native work. Browser retry remains a risk observation, not defect evidence. No files or comments changed.
```
## Scoped fix round 1 — CHANGES REQUIRED

**Exact fix head:** `c04a5c0fd962c8e6fd9e79c5a99c472c1c33c940`, including spec-first commit `670c0fa6`. Reviewed only the six open findings, the fix diff and affected callers. **FP1, FP3, FP4, SO3 and SO4 are closed. FP2 remains open.** SO1 overlaps closed FP1; SO2 overlaps remaining FP2.

- **FP1 closed:** active refresh retains the original source. The actual alternating pack opportunity now succeeds and preserves its pending job/cadence. Replacing retained source with current attacker again makes the focused second-hound test fail.
- **FP3 closed:** shared player return clears C5 before restoring the body; cleanup avoids cancelling an already completed/cancelled occurrence. The real short-water expiry test returns HP10 with inactive bleed and a cancelled job, and the later old tick leaves HP10. Removing shared cleanup makes that test fail. Combat and bleed deaths still pass.
- **FP4 closed:** fatal bleed supplies `cause: "bleeding"`; the existing death/event contract admits it, preserves original hound provenance and null credit, and produces no fake melee event. Removing that cause makes the actual fatal-tick assertion fail.
- **SO3 closed:** Elixir explicitly rejects `sight` in a bleed schedule. The shared literal mixed-binding case fails if that rejection is removed; restored focused Elixir tests pass.
- **SO4 closed:** standard `dependentRequired` is implemented in both validators and the schema compiler; the cancellation body/generation pair requires both fields, while the existing discriminator excludes competing complete bindings. Generated cancellation types preserve that relationship. Removing TypeScript dependent-required enforcement makes the partial-binding test fail. The new checks keep valid encounter/sight/water cancellation forms.

### FP2 remaining direct-consumer failure

**Blocker — `kernel/ts/src/foundation/compose_bleed.ts:19` and `lib/loka/core/compose_bleed.ex:52`.** Removing `next_tick_at <= ends_at` fixes ordinary off-cadence expiry, including real SQLite reopen. But the completed-job branch still requires strictly advancing `next_tick_at`, rejecting the explicitly selected no-damage reschedule when a round refreshes an expiry before the future cadence.

Independent real-command reproduction on the corrected source, using the existing controlled C5 fixture (seed `[1,2,3,4]`, hound hit100%, player hit0%, no dodge):

1. Attack at64800; first hound wound at64950. Flee; elapsed to64975; Move back along the reciprocal exit; Attack again.
2. Settle tick65050 and round65125, which refreshes end65425. Flee; settle65150 and65250; elapsed to65275.
3. Move back and Attack at65275, making the next round due65425. Choose a command ID whose resulting round JobId sorts before the bleed JobId (the independent control checked IDs20 through39 until that canonical order was present).
4. Settle tick65350: active bleed has `next_tick_at=65450`, `ends_at=65425`, with its expiry job due65425. Both current jobs are confirmed due65425.
5. Elapsed65425 runs the round first: its positive hit extends end65725. The following expiry delivery correctly requests a fresh job at65450 without HP loss and preserves `next_tick_at=65450`. Composition returns `fault/precondition_failed` on the bleed target because the completed-job cadence predicate requires `65450 > 65450`.

Temporarily allowing equality in that predicate makes this exact real-command control pass with end65725 and cadence65450; the temporary edit was restored. The fix must distinguish a legitimate delivery before the next tick from an actual tick, preserving cadence advancement when damage is due and exact occurrence validation. Cover this round-first former-expiry path in both portable semantics and the real consumer, with reopen as appropriate. This is the affected direct consumer required by the existing C5 equal-time clause, not a reopened unrelated area.

Verification on unchanged fix head: **19/19 focused TypeScript/kernel/real-SQLite tests; 12/12 Elixir bleed/contracts tests; schema sweep59/59**. Individually reverting FP1, ordinary FP2, FP3, FP4, SO3 and SO4 made their focused tests fail; Elixir used `mix test --force`. The independent remaining-FP2 control fails on the exact fix head. All mutations and temporary tests were restored; only this record/index are committed. No browser, native runtime or owner save was used in this re-review.

Ponytail Review: the fixes reuse the existing provenance, death, delta and schema owners. No separate complexity finding. Keep the remaining fix within the current cadence check and its real job consumer.
