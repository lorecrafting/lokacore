# Decisions after R0

Accepted ADRs live in [document 16](../spec/16-decision-register.md); ADR-070 to ADR-074
entered it on 2026-09-24 and ADR-075 on 2026-09-25, and their files here hold the full
text. This directory also holds the owner's decisions retained verbatim, or marked paraphrased.

## R0/R1

- [ADR-071 and ADR-072](adr-071-072-proposal.md): candidate C selected; persistence
  shape. ADR-070 (Pixel 3a substitution): its text is in the legacy A2 plan linked from
  [the A2 owner decision](owner-decision-a2-2026-09-23.md).
- Owner decisions: [A2](owner-decision-a2-2026-09-23.md), [quick A3](owner-decision-a3-2026-09-24.md),
  [PREP-03](owner-decision-prep-03-2026-09-24.md).

## R2

- [ADR-073](adr-073-single-app.md): one Mix application with strict boundaries,
  not an umbrella.
- Owner decisions: [R2](owner-decision-r2-2026-09-24.md), [reviewers](owner-decision-reviewers-2026-09-24.md),
  [other 2026-09-24 quotes](owner-decisions-2026-09-24.md).

## R3

- Owner decisions: [R3 plan and verification harness](owner-decision-roadmap-2026-09-24.md),
  [R3](owner-decisions-r3-2026-09-24.md), [R3 lanes, CommandId, auto-merge](owner-decisions-r3-lanes-2026-09-24.md),
  [R3 PR 4a manifest forms and limits](owner-decisions-r3-pr4a-2026-09-24.md),
  [Gate R3 residency and Elixir types](owner-decisions-r3-gate-2026-09-24.md),
  [R3 open questions: target order, dotted fact names, ADR-072](owner-decisions-r3-open-questions-2026-09-24.md).

## Post-R3

- [ADR-074](adr-074-ts-first-proposal.md): TypeScript-only story rules until a server first
  consumes them ([accepted by the owner](owner-decision-adr-074-2026-09-24.md)).
- Owner decisions: [R5 setup: rule lint lockdown, `loka play` CLI, feature map](owner-decision-r5-setup-2026-09-25.md).
- Owner decision: [failed lookups visible to the Lab (`target.unresolved`)](owner-decision-lab-failed-lookups-2026-09-25.md).
- [Type-check the TypeScript tests](owner-decision-ts-test-types-2026-09-25.md): owner
  approval to add `@types/node` and type-check `kernel/ts/test/` before R4.

## R4

- Owner decisions: [R4 minimal: JSON source, 4 MiB artifact cap, hello fixture's frozen subset](owner-decisions-r4-2026-09-25.md).
- [Observability design slice before R5; Astra scope delegated to the PM](owner-decisions-observability-astra-2026-09-25.md).
- [Native mobile builds only when native inputs change; fast Hermes bundle check otherwise](owner-decision-ci-mobile-builds-2026-09-25.md).

## Observability design

- [ADR-075](adr-075-observability-proposal.md): one observation record format, four stores
  joined by ids, a registered event-name list, the game-trace entry
  ([accepted by the owner](owner-decision-adr-075-2026-09-25.md)).
- Owner decisions: [ADR-075 kernel version and dev-evidence ledger](owner-decisions-adr-075-2026-09-25.md).

## R5

- Owner decisions: [R5 slice plan; MUD-style `loka play`, networked terminal later (R14)](owner-decisions-r5-plan-2026-09-25.md).
- Owner decision: [puppeting later; rules read the actor from the command](owner-decision-puppeting-2026-09-25.md).
- Owner decision: [short references in cartridge source (S2b)](owner-decision-short-refs-2026-09-25.md).
- Owner decision: [review lever: Opus by default, Fable/Astra for foundational freezes](owner-decision-review-lever-2026-09-25.md).
- Owner decision: [composability and emergence principles; composes-with check](owner-decision-emergence-2026-09-25.md).
- Owner decisions: [S4 item text (four tiers), brief mode in S7, player text online; inline touch links; host-synthesized `fact_changed`](owner-decisions-r5-s4-2026-09-25.md).
- Owner decision: [all reviews on Opus while Fable is near its limit](owner-decision-opus-reviews-2026-09-25.md).
- Owner decision: [default HP, MA and MV pools, 1 MV per move, regeneration (S6b)](owner-decision-hp-ma-mv-2026-09-25.md).
- Owner decision: [a playtest-and-tune stage after R6P: numbers, UI, changed and new mechanics](owner-decision-playtest-2026-09-25.md).
- Owner decision: [defer `knock` and map discovery/`where` from R5 to chapter one](owner-decision-r5-deferred-mechanics-2026-09-28.md).
- Owner decisions: [codex runs cross-vendor reviews; Fable back for rare, very complex work](owner-decisions-review-flow-2026-09-30.md).
- Owner decision: [developers default to Sonnet, Opus for kernel and contract slices](owner-decision-sonnet-developers-2026-09-30.md).
- Owner decision: [autonomous PM with an escalation ladder](owner-decision-autonomy-2026-09-30.md).
- Owner decision: [R6 slice plan approved](owner-decision-r6-plan-2026-09-30.md).
- Owner decision: [one phone (iPhone 11) until release; Android evidence deferred to the first free product gate](owner-decision-android-descope-2026-09-30.md).
- Owner decision: [P1 merges on its Node proof; the iPhone 11 Hermes run is batched before S3](owner-decision-p1-hermes-batching-2026-09-30.md).
- Owner decision: [a parallel phone smoke screen before R6P (wiring proof for the UI slice)](owner-decision-r6-smoke-2026-09-30.md).
- Owner decision: [one save per story, no bookmarks; a new game replaces it after confirmation](owner-decision-one-save-2026-09-30.md).
- Owner decision: [S4 scope: job drain waits for the first real job (Bram's schedule); `real_elapsed` and OFF-08/09/13 carried](owner-decision-s4-scope-2026-09-30.md).
- Owner decision: [Gate R6 "finish": a fixed tap script to a declared end state, the save equal to a headless run; a real story is R6P's gate](owner-decision-gate-r6-finish-2026-09-30.md).
- Owner decision: [Gate R6 carries to R6P: device mid-commit kill evidence, the `evaluation.budget_exceeded` producer, the Hermes `kernel.decision_latency` producer](owner-decision-gate-r6-carries-2026-09-30.md).
- Owner decision: [S3b scope: bundled releases reopen saves on their pin, typed refusals; GC, migration staging and downloads carried](owner-decision-s3b-scope-2026-09-30.md).
- Owner decision: [SM2 scope: the book-style UI over the smoke controller in three slices, real GameView data only, fonts and a simple page turn](owner-decision-sm2-scope-2026-10-01.md).
- Owner decision: [Early R7/R8 plan: slices Q, S, R, N, D in order, R5 deferrals moved to R7/R8 for chapter one, GameView slice G for resources only](owner-decision-early-r7r8-plan-2026-10-01.md).
- Owner decision: [narrow slice N: recipe narration pins its participants' EntityIds at commit; PM rulings on the committed and authored shapes](owner-decision-narrow-n-2026-10-01.md).
- Owner decision: [split slice D into D1 (dialogue) and D2 (the story point carry); scene@1 narrowed out, the durable choice is dialogue@1's continuation row](owner-decision-split-d-2026-10-01.md).
- Owner decision: [agent-device (Callstack, open source) on the iOS Simulator in UI-slice reviews from slice G; fix the iOS 27 simulator crash first](owner-decision-agent-device-2026-10-01.md).
- Owner decision: [the story-sense "milestone" becomes "story point"; the 23 §3 event is `story_point_reached`](owner-decision-story-point-2026-10-01.md).
- Owner decision: [condition bands for resources, after LegendMUD's condition scale (tribute); one table in 04 §15, computed by the kernel](owner-decision-condition-bands-2026-10-01.md).
- Owner decision: [review rules: codex Astra only on gate reviews and `proposal.ts` changes, Sol otherwise and on fix re-checks; Fable as codex stand-in; Opus drafts briefs; the PM's persistent worktree](owner-decision-review-rules-2026-10-01.md).
- Owner decision: [R6P plan: six slices and the gate; `selector_cardinality` to chapter one; Opus developers on every R6P slice; the owner tests for now](owner-decision-r6p-plan-2026-10-01.md).
- Owner decision: [engine output is structured; each presenter owns its layout and wording; a presenter-split slice after Gate R6P](owner-decision-presenter-split-2026-10-02.md).
- PM decision, auto-approved under owner overnight authority: [Lantern proof content: a locked west gate, dialogue change as Bram's talk ending, 23:00 as a claim limit, talk policy quest-active](pm-decision-lantern-proof-content-2026-10-01.md).
- Owner leaning, not a decision: [Realm separation, a middle path on ADR-074 §5 route (a): shared foundation, separate rules, new keys for online behaviour](owner-leaning-realm-separation-2026-10-01.md).
