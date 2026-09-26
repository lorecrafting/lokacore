# Decisions after R0

Accepted ADRs live in [document 16](../spec/16-decision-register.md); ADR-070 to ADR-074
entered it on 2026-09-24 and ADR-075 on 2026-09-25, and their files here hold the full
text. This directory also holds the owner's decisions retained verbatim.

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
