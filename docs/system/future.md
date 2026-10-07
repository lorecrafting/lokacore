# Future plans

Short list; each item links the plan it comes from. Chapter 1's unfinished E1–E3 gates
and deferred carries are in the [ROADMAP](../ROADMAP.md); published A–D mechanics are
[installed contracts](mechanics.md). The historical gate ladder is
[14](../archive/spec/14-implementation-plan.md) and [R milestones](../archive/spec/R-MILESTONES.md).

## Next

- **Chapter 1 acceptance**: E1–E3 remain open in the [roadmap](../ROADMAP.md);
  installed A–D source and its [current identity](cartridge.md#current-bundled-chapter)
  do not establish completion of those gates.
- **M mechanics planning**: [official M1–M23 queue](../NEXT-MECHANICS.md) and
  [adopted policies](../decisions/pm-decision-mechanics-continuation-plan-2026-10-03.md),
  under delegated PM authority; implemented portions are described in [mechanics](mechanics.md).
- **Playtest and tune** ([record](../archive/decisions/owner-decision-playtest-2026-09-25.md)).

## Chapter one and the proof cartridge

- The release uses [one shared difficulty](../decisions/owner-decision-single-difficulty-2026-10-03.md);
  the older ladder's selectable difficulty and separate death-mode rules are superseded.
- The installed time model follows the [fixed-time restriction](../decisions/owner-decision-fixed-time-2026-10-03.md):
  clock progression is authority-driven elapsed time; gameplay actions offer no time skip.
- Mechanical planning now follows the [LegendMUD baseline](../decisions/owner-decision-legendmud-baseline-2026-10-03.md),
  with its [sourced system reference](../reference/legendmud-system.md). The
  [current PM reconciliation](../decisions/pm-decision-legend-mechanics-reconciliation-2026-10-04.md)
  selects bounded consumers, recovery-route gates and chapter handoff/finale ordering. The
  [provisional Story-mechanics proposal](../design/provisional-story-mechanics.md) retains dated,
  unadopted alternatives; it does not override the current M1/M2/M3/M4/M5 choices. Each consuming
  implementation amends active clauses and contracts first.
- Capabilities registered but not installed, with the slice that first needs them:
  [feature map](../features.gen.md), [release scope](../spec/release-scope.md); chapter-one
  endings follow the [active content decision](../decisions/owner-decision-chapter-one-content-2026-10-02.md).
- Mechanics: [00 §4](../archive/spec/00-first-cartridge-design.md#4-feature-list) (movement, time,
  character, items, combat, economy, NPCs, quests, social, touch UI) and
  [00 §11](../archive/spec/00-first-cartridge-design.md#11-release-ladder-three-chapters-one-world) (the
  three-chapter ladder); the primitive catalog [21](../archive/spec/21-composable-world-primitives.md),
  §27 candidates and §28 graduated mechanics; quests, dialogue and scenes
  [06](../archive/spec/06-quests-dialogue-actions-scripting.md); the content
  [00a](../archive/spec/00a-chapter-one-content.md).
- Gates: [14 §R7](../archive/spec/14-implementation-plan.md#r7--quest-dialogue-and-scenes),
  [§R8](../archive/spec/14-implementation-plan.md#r8--living-world-capability-pack),
  [§R10](../archive/spec/14-implementation-plan.md#r10--first-real-offline-cartridge);
  acceptance scenarios [15](../archive/spec/15-acceptance-scenarios.md).
- Touch UI: [room view](../design/room-view/README.md) GameView needs; the chosen direction.

- **Later chapter mechanics**: [provisional Barrow King / King's Road quest-consumer queues](../LATER-MECHANICS.md); lookahead after Missing Child, not installed contracts; five conflicts have [selected future policies](../decisions/pm-decision-later-story-reconciliation-2026-10-04.md).

## Authoring and certification

- Cartridge Lab [14 §R9](../archive/spec/14-implementation-plan.md#r9--cartridge-lab-v1), the synthetic
  conformance cartridge [§R9C](../archive/spec/14-implementation-plan.md#r9c--synthetic-v3-conformance-cartridge),
  Builder API [§R11](../archive/spec/14-implementation-plan.md#r11--builder-api-v1-and-script-surface-generalization);
  specs [08](../archive/spec/08-builder-api-ai-factory.md), [09](../archive/spec/09-cartridge-lab-certification.md).
- YAML source after JSON ([record](../archive/decisions/owner-decisions-r4-2026-09-25.md)); downloadable
  content after the store-policy review ([PREP-03](../archive/decisions/owner-decision-prep-03-2026-09-24.md)).

## Production Story app

- [14 §R12](../archive/spec/14-implementation-plan.md#r12--loka-app-production-story-mode): accounts and
  story progress ([23](../archive/spec/23-accounts-progress-admission.md)), typed receipt integrity
  (`result_digest`, [DIFFERENCES](DIFFERENCES.md)), save migrations, release garbage collection
  and the recovery copy ([record](../archive/decisions/owner-decision-s3b-scope-2026-09-30.md)),
  export and import ([10 §§31–33](../archive/spec/10-mobile-commerce-release.md)); commerce
  [§R13](../archive/spec/14-implementation-plan.md#r13--commerce-and-entitlement).
- Android evidence at the first free product gate
  ([record](../archive/decisions/owner-decision-android-descope-2026-09-30.md)).

## Online

- [14 §R14](../archive/spec/14-implementation-plan.md#r14--beam-online-authority--realm-mode-skeleton) to
  [§R22](../archive/spec/14-implementation-plan.md#r22--persistent-text-mmorpg-expansion): the BEAM
  authority, Realm Mode, co-op instances, shards; specs [07](../archive/spec/07-offline-storypacks-to-mmo.md),
  [19](../archive/spec/19-quest-sharing-instancing-capacity.md), [11](../archive/spec/11-security-observability-operations.md).
- The ADR-074 trigger and route ([ADR-074](../archive/decisions/adr-074-ts-first-proposal.md),
  [current owner direction](../decisions/owner-decision-story-realm-shared-mechanics-2026-10-04.md)); the effect outbox
  ([03 §16](../archive/spec/03-domain-state-persistence.md)); a networked `loka play` (R14), puppeting
  and player-written descriptions ([ROADMAP](../archive/ROADMAP.md#verification-harness-adopted-2026-09-24)).
