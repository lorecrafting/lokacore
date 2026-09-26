# Independent reviews

Each record is written by a fresh agent that authored none of the reviewed work (AGENTS.md).
One line per record: PR, commit reviewed, verdict, and the final round's commit and verdict
when there were fixes. Findings, dispositions and cross-vendor (Astra) reviews are in the records
(PR #1: dispositions in the PR).

## R0/R1

Reviews before R2 live in the [legacy repository](https://github.com/lorecrafting/lokacore-v2-legacy) (commit `997a7a8`, `docs/rewrite-v3/reviews/`).

## R2: foundation, delivery process, plan

- [R2 foundation](2026-09-24-r2-foundation-review.md): PR #1 at `acccda6`, APPROVE WITH NOTES.
- [Delivery workflow](2026-09-24-workflow-review.md): PR #2 at `7b2e7ab`, APPROVE WITH NOTES.
- [Docs budget](2026-09-24-docs-budget-review.md): PR #3 at `910b6a6`, APPROVE WITH NOTES.
- [Roadmap](2026-09-24-roadmap-review.md): PR #5 at `3638143`, APPROVE WITH NOTES.

## R3: contract slices and gate

- [R3 PR 1 portable ABI](2026-09-24-r3-pr1-portable-abi-review.md): PR #4 at `99b9b37`, APPROVE WITH NOTES; fixes `e258bff`, APPROVE WITH NOTES.
- [R3 PR 2 contracts](2026-09-24-r3-pr2-contracts-review.md): PR #9 at `324015c`, APPROVE WITH NOTES; final `bb4a7fb`, APPROVE.
- [R3 PR 4a capabilities](2026-09-24-r3-pr4a-capabilities-review.md): PR #12 at `0995551`, APPROVE WITH NOTES.
- [R3 PR 6a envelopes](2026-09-24-r3-pr6a-envelopes-review.md): PR #11 at `018ccbf`, CHANGES REQUIRED; fixes `b966814`, APPROVE.
- [R3 PR 3 commands](2026-09-24-r3-pr3-commands-review.md): PR #13 at `cfc6a14`, CHANGES REQUIRED; final `c2284ed`, APPROVE.
- [R3 PR 4b facts, relations, GameView, accounts](2026-09-24-r3-pr4b-facts-review.md): PR #14 at `bccc582`, APPROVE WITH NOTES; fixes `1f96346`, APPROVE.
- [R3 PR 5 composition](2026-09-24-r3-pr5-composition-review.md): PR #15 at `9131dbe`, APPROVE WITH NOTES; fixes `2812a71`, APPROVE.
- [R3 gate](2026-09-24-r3-gate-review.md): PR #16 at `5ee2aa7`, APPROVE WITH NOTES; fixes `94b15fb`, APPROVE; **Gate R3: PASS WITH NOTED GAPS**.

## R3: tooling and design

- [Local hooks](2026-09-24-local-hooks-review.md): PR #7 at `0673d90`, APPROVE WITH NOTES.
- [Lessons split](2026-09-24-lessons-split-review.md): PR #8 at `9bbd478`, APPROVE WITH NOTES; fixes `9ab9094`, APPROVE.
- [Size limits](2026-09-24-size-limits-review.md): PR #6 at `6c02aee`, CHANGES REQUIRED; final `24c72ea`, APPROVE WITH NOTES.
- [Prettier](2026-09-24-prettier-review.md): PR #10 at `7d8d7c8`, APPROVE WITH NOTES; fixes `7e05205`, APPROVE.
- [Room view prototype](2026-09-24-room-view-prototype-review.md): PR #17 at `ba5e572`, APPROVE WITH NOTES; fixes `9cc66f6`, APPROVE.

## Post-R3

- [ADR-074 TypeScript-first proposal](2026-09-24-adr-074-ts-first-review.md): PR #18 at `0f7c4f6`, CHANGES REQUIRED; fixes `1545b82`, APPROVE.
- [Maintenance cleanup](2026-09-24-maint-cleanup-review.md): PR #20 at `d387b93`, APPROVE WITH NOTES; fix `54688e7`, APPROVE.
- [Maintenance: ADR-074 amendments](2026-09-24-maint-adr074-amendments-review.md): PR #19 at `e7b1625`, CHANGES REQUIRED; fixes `7b5f5b0`, APPROVE.
- [Pre-R4 sweep: TypeScript + mobile](2026-09-25-sweep-ts-review.md): PR #21 at `08be6f5`, APPROVE.
- [Pre-R4 sweep: Elixir + scripts](2026-09-25-sweep-elixir-review.md): PR #23 at `c1e8b18`, APPROVE WITH NOTES.
- [Pre-R4 sweep: docs, protocol, CI](2026-09-25-sweep-docs-review.md): PR #22 at `8cd606c`, APPROVE WITH NOTES.
- [Type-check the TypeScript tests](2026-09-25-ts-test-types-review.md): PR #24 at `f3d83b7`, APPROVE WITH NOTES.
- [R4 S1: compiled-cartridge and diagnostic contracts](2026-09-25-r4-s1-review.md): PR #25 at `7015b00`, CHANGES REQUIRED; fixes `695473b`, APPROVE; Astra relay + `870d822`, APPROVE WITH NOTES.
- [R4 S2: Elixir cartridge compiler (R4 minimal)](2026-09-25-r4-s2-review.md): PR #27 at `cd27dea`, CHANGES REQUIRED; fixes `6c1360c` (head `b87388f`), APPROVE.
- [Observability design slice plan, Astra scope](2026-09-25-docs-observability-plan-review.md): PR #28 at `ac8d833`, APPROVE WITH NOTES; fixes `0af7b91`, APPROVE.
- [R4 S3: TypeScript cartridge loader](2026-09-25-r4-s3-review.md): PR #26 at `0bb540b`, APPROVE WITH NOTES; fixes, merge of main and test 4 at `d5a1102`, APPROVE WITH NOTES.
- [Observability design: ADR-075 and observation contracts](2026-09-25-observability-design-review.md): PR #29 at `fd0ab9f`, APPROVE WITH NOTES; Astra relay; fixes `59b55e2` (head `e2847af`), APPROVE WITH NOTES; final `dc44543`, APPROVE.
- [CI: native mobile builds only on native inputs](2026-09-25-ci-mobile-split-review.md): PR #30 at `2f34de8`, APPROVE WITH NOTES.
- [ADR-075 accepted; first dev-evidence entries](2026-09-25-adr-075-accept-review.md): PR #33 at `544b263`, APPROVE WITH NOTES; fixes `7311cf3`, APPROVE.

## R5

- [R5 S1: rooms and exits, first world, look/move, `loka play`, rule lint lockdown](2026-09-25-r5-s1-review.md): PR #34 at `b76025e`, APPROVE WITH NOTES (Fable); Astra relay; fixes `740349c`, APPROVE WITH NOTES; final `86d65ac`, APPROVE.
- [R5 S2: inspectable details, target resolution, `target.unresolved`, feature map](2026-09-25-r5-s2-review.md): PR #35 at `37d70a0`, APPROVE WITH NOTES (Fable).
- [Puppeting owner decision, contract lesson, #35 ledger](2026-09-25-puppeting-docs-review.md): PR #36 at `8eb47f7`, APPROVE WITH NOTES; fixes `a4824d2`, APPROVE.
- [R5 S2b: short references in cartridge source](2026-09-25-r5-s2b-review.md): PR #37 at `7c18373`, CHANGES REQUIRED (one blocker, a missing quest_state test); fixes `8aef59f`, APPROVE.
- [Review-lever owner decision, R5 re-estimate, #36/#37 ledger](2026-09-25-review-lever-docs-review.md): PR #38 at `ee90fa1`, APPROVE WITH NOTES (one nit on the estimate basis); fixes `4085939`, APPROVE.
- [Emergence owner decision; composes-with check](2026-09-25-emergence-docs-review.md): PR #39 at `48cac4d`, APPROVE WITH NOTES (one should-fix: reviewer step 7 drops the spec-required exception); fixes `6d8507f`, APPROVE.
- [R5 S3: typed facts, conditions, state-dependent descriptions](2026-09-25-r5-s3-review.md): PR #40 at `5bcf81a`, APPROVE WITH NOTES (Fable; one should-fix: `expand/2` crashes on a detail keyed `exits`); fixes `7bbdbec`, APPROVE.
- [S4 owner answers, touch-link ruling, #38-#40 ledger](2026-09-25-pm-docs-s4-answers-review.md): PR #41 at `943c44a`, APPROVE WITH NOTES (three should-fix: `fact_changed` timing, touch links against the Text/GameView contracts, the link compile rule against existing content); fixes `bbf5c74`, APPROVE.
- [R5 S4: take/drop/give, containment checks, item text, touch links, `fact_changed`, fact typing](2026-09-25-r5-s4-review.md): PR #42 at `7938da9`, APPROVE WITH NOTES (two should-fix: `fact_changed` position, `has_item` semantics in the contract); fixes `5741788`, APPROVE.
- [All reviews on Opus owner decision, #41/#42 ledger](2026-09-25-opus-reviews-docs-review.md): PR #43 at `50c8e78`, APPROVE WITH NOTES (one nit: WORKFLOW's role table and Astra sentence still read as if Fable reviews run).
- [R5 S5: ActionSet algebra, simple ActionRecipe execution, `perform`, `custom_event`](2026-09-25-r5-s5-review.md): PR #44 at `4689eb1`, APPROVE WITH NOTES (two should-fix: a recipe may share an engine verb's key and the loader checks no key clash; `action_completed` vs the frozen `action_recipe@1` event stream), plus Astra REQUEST CHANGES (A1 blocker: admission ignores the target/input contract); fixes `80d082a`, APPROVE (one nit: an untested scope kind check).
- [#43/#44 ledger; Astra takes the Fable slots while Fable is suspended](2026-09-25-pm-docs-s5-ledger-review.md): PR #45 at `d978057`, APPROVE WITH NOTES (one nit: the Astra sentence still says "beside the Fable review").
- [R5 S6a: logical clock unit, `wait`, recipe `duration`, `time_of_day`, luck check and check@1 events](2026-09-25-r5-s6a-review.md): PR #46 at `6309127`, APPROVE WITH NOTES (four should-fix: a schema-valid `wait` makes timed performs throw `integer_overflow` out of `step`; duplicate inline check keys; `action_completed` on a failed attempt without an outcome; `time_of_day` vs 06 §21 `time_window`), plus Astra REQUEST CHANGES (A1 blocker: loader fact-value parity); fixes `bbf7e01`, APPROVE (one nit: a stale op name in the dusk fixture description).
- [HP/MA/MV owner decision, S6a/S6b split, worktree location, #45 ledger](2026-09-25-pm-docs-hp-ma-mv-review.md): PR #47 at `ba2a538`, APPROVE WITH NOTES (two should-fix: 00's amendment omits the accepted 0 MV refusal and existing-cartridge preservation; room-view README still lists the MV cost as open); fixes `2c560d1`, APPROVE; DikuMUD figures `4ddec9d`, APPROVE WITH NOTES (one should-fix: 00 regeneration row still says doubled resting against the Diku position bonuses); fixes `7e48f6b`, APPROVE.
