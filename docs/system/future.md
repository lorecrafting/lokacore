# Future plans

Short list; each item links the plan it comes from. Current work is in the [ROADMAP](../ROADMAP.md);
published A–D mechanics are
[installed contracts](mechanics.md). The historical gate ladder is
[14](../archive/spec/14-implementation-plan.md) and [R milestones](../archive/spec/R-MILESTONES.md).

## Next

Current work: [ROADMAP](../ROADMAP.md#next).

Worldbuilding subproject (Beads loka-ikch): the [stub tree](../worldbuilding/README.md) of every world area to decide, with canon tiers and fill order.

## Authoring and certification

- Cartridge Lab [14 §R9](../archive/spec/14-implementation-plan.md#r9--cartridge-lab-v1), the synthetic
  conformance cartridge (its [14](../archive/spec/14-implementation-plan.md) section),
  Builder API [§R11](../archive/spec/14-implementation-plan.md#r11--builder-api-v1-and-script-surface-generalization);
  specs [08](../archive/spec/08-builder-api-ai-factory.md), [09](../archive/spec/09-cartridge-lab-certification.md).
- [E1 certification](e1-certification.md) is rebuilt with the real chapter; the full Lab remains future work.
- YAML source after JSON ([record](../archive/decisions/owner-decisions-r4-2026-09-25.md)); downloadable
  content after the store-policy review ([PREP-03](../archive/decisions/owner-decision-prep-03-2026-09-24.md)).

## Production Story app

- [14 §R12](../archive/spec/14-implementation-plan.md#r12--loka-app-production-story-mode): accounts and
  story progress ([23](../archive/spec/23-accounts-progress-admission.md)), typed receipt integrity
  (`result_digest`, [DIFFERENCES](DIFFERENCES.md)), save migrations, release garbage collection
  and the recovery copy ([record](../archive/decisions/owner-decision-s3b-scope-2026-09-30.md)),
  app clock source, background driver and recurring catch-up for the installed `real_elapsed`
  policy ([contract](mechanics.md#m1-a-elapsed-authority-time)),
  export and import ([10 §§31–33](../archive/spec/10-mobile-commerce-release.md)); commerce
  [§R13](../archive/spec/14-implementation-plan.md#r13--commerce-and-entitlement).
- Android evidence at the first free product gate
  ([record](../archive/decisions/owner-decision-android-descope-2026-09-30.md)).

## Online

- Deferred to the Realm by the [seams audit](../rnd/realm-seams-audit-2026-10-13.md) (record: [realm seams](../decisions/owner-decision-realm-seams-2026-10-13.md)): the admitted-actor set and `bodyOf` as a lookup; an actor-less `elapsed`; `party` scope and `audience` on creation; the GameView audience filter; the instancing record; `speech@2`; ownership transfer, inheritance and griefing rules; credit kinds `party` and contested; per-character reaction delivery; owners for the actor-relative schedule `when` leaves ([W10](mechanics.md#conditional-schedules-toolbox-row-w10)).
- [14 §R14](../archive/spec/14-implementation-plan.md#r14--beam-online-authority--realm-mode-skeleton) to
  [§R22](../archive/spec/14-implementation-plan.md#r22--persistent-text-mmorpg-expansion): the BEAM
  authority, Realm Mode, co-op instances, shards; specs [07](../archive/spec/07-offline-storypacks-to-mmo.md),
  [19](../archive/spec/19-quest-sharing-instancing-capacity.md), [11](../archive/spec/11-security-observability-operations.md).
- The ADR-074 trigger and route ([ADR-074](../archive/decisions/adr-074-ts-first-proposal.md),
  [current owner direction](../decisions/owner-decision-story-realm-shared-mechanics-2026-10-04.md)); the effect outbox
  ([03 §16](../archive/spec/03-domain-state-persistence.md)); a networked `loka play` (R14), puppeting
  and player-written descriptions ([ROADMAP](../archive/ROADMAP.md#verification-harness-adopted-2026-09-24)).
- Live operations: shipping content and mechanics to a running Realm without a restart, proposed in the [live-ops sketch](../rnd/realm-live-ops-2026-10-29.md) (not decided).
