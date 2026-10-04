# Primitive composition audit — merged architecture and all queued mechanics

**Status:** private read-only design audit; no implementation approval, runtime reproduction, tests, builds, dependency changes, native work or save operations. Main evidence is merged `6d9712ef2b0ea12be537e4ef4c826a6d04e155af` (after PR155). M2's changing developer source was not treated as merged code. Private M2/M3/M5 formal briefs and the later-story source-only plan are planned contracts. PR136 reconciliation inspected at `549d707a65d7c66a61439201dc9ddd35e50d2cc3` is pending at this audit's evidence pin, not installed authority. Advice can inform a brief; it is not an independent implementation review.

## Conclusion

Yes: **create a missing primitive when a real mechanic needs it**. A demand for reuse is not a ban on new semantics, nor permission to weaken the intended mechanic until it fits existing code. The right decomposition preserves the required behavior and gives the new invariant one owner. It does not require a separate package, interface or generic framework for each verb or mathematical operation.

The merged system has a credible composition base: pure rules, typed commands/events, an ordered delta algebra, explicit writer groups, scoped facts, conserved containment, deterministic RNG/identity, shared admission helpers, and one changed-row receipt transaction. Equipment already demonstrates valuable composition: worn state is containment through capacity-one holders, so ordinary custody/conservation queries still work. This is not a blank-slate architecture rewrite.

The installed expression layer is intentionally small. Recipes can assign facts/adjust resources/emit custom events; reactions write facts and recognize only fact changes/room entries; dialogue has explicit quest/handover hooks; scene start has a named reaction hook. These documented subsets are not evidence that full 21/06 composition exists. The next consumers need real additions in resource settlement, durable creation, event consequences, perception/traversal, status/modifiers, behavior intents and narrative occurrence/credit. Build them at their consumers, then reuse them.

Two concrete current correctness defects were confirmed statically: exit availability bypasses the composed ActionSet (PC-01), and ordinary fact defaults are not semantically revalidated at artifact load (PC-11). Recurring jobs expose a current unbounded-history scalability debt (PC-02). Neither is a reason to halt M2's already appropriate rate-settlement work. No new fundamental contradiction in the adopted M2/M3 direction was established by this audit.

## Scope and evidence

The companion `coverage-matrix.md` contains **112 rows**: all 37 registered feature-map capabilities (22 installed subsets, 15 not yet), M1–M23, all 29 C2/C3 mechanic candidates (C2-M14A/B separate), ten content compositions, five CC continuity/product rows, and eight foundation/host responsibility rows. `matrix-data.json` is the same evidence in structured form. Each row states inputs, typed writers, invariant/order/trust obligations, reused/missing primitive, content boundary and status/source.

Inspected: actual AGENTS/WORKFLOW; active architecture/mechanics/protocol/cartridge/save/owner rules and differences; generated features/contracts/residency; pinned TS mechanics/runtime/foundation and relevant content/view/action code; archived21 in full; archived06 quest, event credit, dialogue, consequence and scene contracts; owner composability/emergence record; first-encounter literals; the four private formal brief bundles; pending Legend reconciliation and later-story candidate/source tables. AST outlines preceded substantial TS reads; AST JSON import/pattern inspection was used for structural searches. The 91 inspected mechanics import statements had no direct other `rule.ts` import; that narrow syntactic observation is not a proof of semantic independence. No Elixir xref/build was run in the read-only lane; portable-twin requirements are grounded in their existing contracts and inspected files.

The original September25 owner decision requires the brief/PR to state shared reads/writes, existing mechanics affected without extra code and named mechanic/content exceptions (`docs/archive/decisions/owner-decision-emergence-2026-09-25.md:54`). Active owner rules link it at `docs/system/owner-rules.md:79`; WORKFLOW's concrete brief list (`docs/WORKFLOW.md:61`) does not make the full decomposition record explicit. The minimal amendment below closes that navigation/brief gap without another checklist framework.

## Layers that must stay distinct

| Layer | Existing examples | What a new consumer may add | What does not belong here |
|---|---|---|---|
| Portable semantic foundation | canonical/hash, checked numbers/RNG/IdSource, typed delta target/overlay/precondition algebra, shared invariant checks | generic rate-row arithmetic; guarded creation/initial-placement or job-cancel contract when actually needed | rat names, player posture meaning, chapter routes, account/UI behavior |
| Reusable world primitive | scoped facts, resource queries/adjustment, custody, barrier transition, policy, jobs/continuations | typed effective resource specs, life/custody queries, damage/status/knowledge/relations/quantity/ownership as consumed | arbitrary component setters, storage transactions, one special handler per NPC |
| Concrete RPG mechanic | Move, Rest, equipment, attack round, bandage, swimming, stealing | pure sequence that reads shared state and asks its owning primitives for typed consequences | calling another mechanic's player verb or fabricating a user invocation |
| Authored composition | Bram ferry, five rat credits, child endings, corpse templates, King phases, tavern services, dream | policies/definitions/reactions/objectives/scenes with content IDs and values | host callbacks, unrestricted script authority or hidden mutation |
| Host/product/presentation | trusted elapsed, SQLite receipts/fencing, GameSession, Book, accounts/entitlements/continuity admission | confirmed transaction/load support and structured view/input for actual new state | gameplay rules based on rendering, raw UI World writes or offline-to-Realm wealth import |

The foundation's existing quest/barrier operations are part of the frozen portable delta contract even though they carry domain-shaped legal transitions; “foundation” is not a proposal to remove those contracts. Story capabilities remain TypeScript first under Candidate C. A new capability does **not** automatically need an Elixir rule twin; a change to shared composition arithmetic/ops/invariants does need both existing foundation implementations, independent literals and the established differential. See `docs/system/architecture.md:87`, `docs/contracts.gen.md:50` and `docs/residency.gen.json`.

## Findings with concrete consequences

### PC-01 — actual static correctness defect: movement advertisement ignores ActionSet composition

**Evidence:** `kernel/ts/src/view/view.ts:138` and `:166` calculate exit availability from scene, passage, standing and fare. `commands/actions.ts:156` composes room subtract/intersect/replace; `:190`/`:202` reject Move when no eligible offered action matches. `content/cartridge_recipes.ts:59`/`:64` explicitly permits a room contribution naming registered `move`. `docs/system/protocol.md:248` and `view/invariants_view.ts:73` require an available exit not to be refused with `unsupported_capability`/`invalid_state`.

**Scenario:** an otherwise valid open connected room authors `actions: [{op: 'subtract', actions: ['move']}]`. Standing actor has enough MV. The view says its exit is available, while direct Move has no matching ActionSet entry and is refused. An overriding movement policy offers another composition path to disagreement. This was proved by tracing source and accepted loader rules, not by running the case.

**Small fix:** use the existing authoritative movement admission predicate in exit projection, sharing exact action identity/alias handling and refusal precedence with execution. Do not make projection execute commands or draw RNG. One controlled valid-cartridge regression plus a mutation that bypasses composed admission should cover the new break after checking the old focused suite. Consumer urgency: before M10, hidden routes, restricted movement or mount policies rely on these gates. M2 is independent.

### PC-02 — actual scalability debt: completed-job history is retained and rescanned on ordinary actions

**Evidence:** `mechanics/schedule/rule.ts:38` completes the old row and schedules a new unique row; `foundation/compose.ts:167`/`:174` preserve terminal jobs. `foundation/compose.ts:114`/`:116` enumerates the entire jobs section for every composition, even a non-job delta; `runtime/apply.ts:18`/`:25` clones each written section; proposal prefix `runtime/proposal.ts:166` and final `:63` compose again. The pending-job budget does not bound completed history.

**Scenario:** a saved world repeatedly advances through daily schedules. Even with one pending job, completed rows keep growing, and later ordinary Take/Rest costs include scans of all old jobs. Combat rounds add history much faster. This is an actual source-level dependence on lifetime history; no phone latency or measured threshold is claimed.

**Small response:** before live recurring combat / long-run acceptance, select bounded terminal-job retention/compaction semantics preserving occurrence identity, stale callback refusal and saved receipts. A legal typed removal/compaction operation or a demonstrated bounded job representation is allowed if needed. Preserve save compatibility and shared delta invariants. Do not add a cache without an ownership/update contract, nor delete history merely because it looks old. First seek removal of needless non-job scans using sufficient maintained/bounded observations. The wider read-only scan debt in `quest/lifecycle.ts:91`, `reaction.ts:33`, containment capacity and `compose.ts:249`/`:294` is documented; new consumers must pre-charge traversal, and any index should be justified by actual scale rather than this audit adding a graph framework.

### PC-03 — future primitive gap, already correctly identified: resource settlement and effective specs

**Evidence:** merged `mechanics/resource.ts:25`/`:49` select a global pool spec; `foundation/compose.ts:87` uses the legacy hourly arithmetic. The private M2 brief:17–35 and rate-boundary note:16–20 specify generic `{value,at,rate,remainder}` settlement and a final RPG agreement check. M5-A brief:27–35 specifies an immutable exact entity-resource override map and required birth rows.

**Scenario:** Rest followed by Stand must not credit prior standing time at the rest rate. A rat with max6 must not accept7 merely because player maxHP10. Shrine wake must not write position without settling/rebinding opted pool rates. M2's narrow final guard belongs after final speculative apply and before accepted/storage, not in every prefix apply (prefix state can be intentionally transitional), and load/reconcile repeats the guard. Shared foundation validates generic arithmetic; RPG interprets position. **No active-M2 stop trigger found.** Extract/reuse the narrow settlement constructor when M5 wake/return actually consumes it; do not add a modifier framework now.

### PC-04 — future prerequisite: durable identity, custody and life are real new primitives

**Evidence:** `runtime/decision.ts:47`/`:128` keeps mutable State separate from definition-derived World maps; `runtime/apply.ts:9` and `runtime/proposal.ts:166` currently return/reuse static maps. `mechanics/lookups.ts:33`/`:41` has actor-body reach but no corpse ownership. `mechanics/containment/rule.ts:28` admits any reachable item. `commands/target.ts:37`, `movement/rule.ts:88` and view iterate installed identities without NPC life semantics. M5-B brief:17–22/34–42 owns the proposed fix.

**Scenario:** a memory-only corpse disappears on reopen; only final hydration leaves an immediate reaction unable to see it; a plain corpse item can be picked up wholesale or looted by the wrong owner; HP0 NPC still appears/takes gifts if life is filtered only in Attack. A same-definition second corpse must not replace the first in one-ID-per-definition authored maps.

**Required decomposition:** generic created identity + proved same-writer initial placement; pinned-template hydration in prefix/final/load; reusable explicit-NPC life and actor-aware custody predicate used by every actual reader/admission path; death's single fatal writer sequence owns roots, closure and return. Do not create a generic spawner, ownership service, decay system or ghost framework merely to build one corpse. Do not apply voluntary carry limits to forced death/return; ordinary recovery Take uses the selected M3 policy.

### PC-05 — future combat blocker: scheduled composition needs terminalization and direct event ownership

**Evidence:** `runtime/proposal.ts:253` dispatches every job through schedule, and `:267` admits schedule's output. `runtime/decision.ts:179` contains direct `schedule→movement`, not transitive composition. `proposal.ts:131` documents stale-entry refusal; `docs/system/DIFFERENCES.md:10` carries it. Private M5-B/M6 integration audit:27–39 proposes the consuming amendment.

**Scenario:** player flees or dies before a future round; without a terminal job and generation re-read, retained debt can keep encountering obsolete due work, a stale job can abort the whole advance, or revived player can receive an old opportunity. Declaring combat→death alone does not let a schedule-owned result emit death events.

**Required:** one typed encounter/bound round context, a minimal cancel/terminalization op if existing complete cannot handle a future job, re-read/skip stale due entries, and the actual direct schedule/combat/death (and movement only if emitted) event permissions. Credit comes from validated participants because `run_job` is actor-free. One concrete second job-kind branch is enough; neither a generic registry nor transitive COMPOSES is justified. Final writer conflicts still apply across lazily composed prefixes; final rejection must discard every prefix/RNG/event.

### PC-06 — high-priority future gap: reuse one selected consequence vocabulary, including finite rat credit

**Evidence:** `mechanics/reaction.ts:26` recognizes two event types; `:58` writes only facts. `action_recipe/rule.ts:49` has its own selected sequence; `dialogue/rule.ts:103`/`:138` calls quest lifecycle and `:153` constructs handover. `runtime/proposal.ts:191` specializes acquisition credit. Archived21:731 and archived06:385 require typed consequence contracts. Pending reconciliation record:44 selects five attributed player credit facts for S1; active queue M22-A precedes M20-A (`docs/NEXT-MECHANICS.md:43`/`:45`).

**Scenario:** implementing S1 by switching on `lantern_cellar`, five rat IDs and five fact names inside combat satisfies one quest while blocking reuse and violating the owner's no-content-in-mechanics boundary. Alternatively moving all quest/reaction work after commit breaks atomic kill-credit/reward behavior. Creating a new fact writer per dialogue/scene/combat/reaction introduces subtly different scope/expected-value rules and same-target conflicts.

**Required:** advance the smallest M22-A subset for the first actual death→authored fact credit consumer if needed. Content declares the exact victim/room/credit mapping; engine validates the death event and participant attribution, resolves the declared scope and produces a registered fact consequence. Later M20/M21 reuse that typed construction/delivery. A small closed union and explicit dispatch is enough. Do not expose raw DeltaOp/free-form field writes as content. Do not weaken writer conflicts to last-writer-wins: a damage/death/return sequence sharing a target belongs to one declared writer; independent reactions attempting competing writes must be rejected or an explicit reducer/composition policy must be adopted.

### PC-07 — future shared query gap: perception, traversal and voluntary acquisition admission

**Evidence:** merged `lookups.ts:33` is custody, `policy.ts:47` uses target presence, `movement/rule.ts:62` is passage and `view/view.ts:138` separately assembles exits. Darkness/far perception is expressly absent (`docs/system/DIFFERENCES.md:15`). M3 brief:23–49 already selects a small shared carry query and a truthful unavailable Take. These predicates answer different questions; do not collapse ownership, reachability, visibility and legality into one ambiguous helper.

**Scenario:** hiding a dark rat only in the view leaves raw-ID Attack legal; a Buy transfer bypasses Take-only load while future policy expects a ceiling; an NPC escort teleports through a locked/tidal path because it reuses scheduled placement rather than legal traversal; mount and rider move under different policies. Custody must count locked nested/worn mass even though it is not currently reachable.

**Required:** at M9/M10/M16 and later stealth/witness/mount consumers, build small named pure queries for the shared concepts and compose them in the existing action/view paths. Charge inspected candidates before traversal, share the bounded context across the view, and preserve explicit refusal precedence. M3's one lazy pre-metered custody adjacency build is a bounded table observation, not permission for recursive whole-world scans per item or a persistent mutable index. New indexes are future measured work. No universal eligibility engine.

### PC-08 — future status/skill/attribute contract, not a demand for a full RPG framework

**Evidence:** merged `policy.ts:60` reads immutable starts; equipment transfers only (`equipment/rule.ts:24`). M7/M8 and C2-M04/05/07/08/09 have concrete consumers for learned-vs-qualified competence, source-bound modifiers, duration/stacking, typed material damage and curses.

**Scenario:** moving a ring between slots applies PER twice; removing it leaves a cached bonus; identifying a cursed crown unexpectedly turns its real effect on; a bleeding status recreates its tick schedule after every transfer; learning a word is mistaken for present casting qualification. A future rate modifier must settle the old interval before changing effective rate.

**Required:** one selected effective-value query/typed status lifecycle when first consumed, with source identity, stacking/expiry and checked order. Reuse resources, M2 settlement, jobs and knowledge. Freeze only the actual skill/check/defense/material order against independent literals, preserving M4's untrained RNG profile. Do not preload levels/XP/learn-by-use, classes, all modifier categories or Legend formulas.

### PC-09 — future narrative trigger: source-independent terminal occurrences and continuations

**Evidence:** `dialogue/rule.ts:177` emits story points only from dialogue-choice triggers; `view/view.ts:174` derives chapter from a dialogue quest outcome. Active mechanics:253–255 explicitly says revisit when another producer appears. Scene facts (`scene/shared.ts:27`) represent one one-shot sequence; active mechanics:279 excludes richer scene features. Pending policy:47/50 requires acknowledged dawn end, not quest resolution, to export.

**Scenario:** reusing the current derived chapter path for scene-end completion either advances before acknowledgement or cannot represent the source at all. A repeatable event/scene cannot use the same one-shot scene fact without erasing occurrence identity. A replaced/dead speaker cannot silently bind by name on reopen. Finale Q2/Q3 reactions writing the same child profile can conflict; unbounded scene queuing is not an automatic fix.

**Required:** add durable source-independent completion/occurrence semantics at M21-C/M22-C/CC-M01; reuse the host's atomic pending report storage and receipts. Add only required role/wait/overlay/checkpoint state for M21-A/B. Objective reducers consume typed events with explicit causal/actor credit; facts carry broad story truth. Select one authored writer/profile rule per target and acknowledge bell before eligible dawn. Dreams remain content over a scoped overlay, not a new world authority or deep-copy of the world.

### PC-10 — boundary/process clarity, low-cost adoption

**Evidence:** active architecture:81 accurately documents named couplings; engine rule lint prevents importing another rule but does not prove semantic independence. `runtime/decision.ts:192` constrains commands/events while DeltaOp remains the common union; `proposal.ts:285` checks event ownership, not a universal writer capability permission system. Compiler/loader validate reserved authored facts and closed vocabulary (`docs/system/cartridge.md:114`).

**Implication:** neither folder names, an import ban, generated feature presence, nor successful source grep proves decomposition or final RPG invariants. Conversely, naming a supported shared query is not a bug when the spec explicitly requires it. Keep trusted code ownership explicit and use narrow final/load guards only where the new invariant needs them. The proposed architecture section/brief record should make this reviewable; a generic source-text checker or mandatory primitive registry would be theater.

### PC-11 — actual static trust-boundary defect: fact default validation differs between compiler and loader

**Evidence:** `protocol/fact.schema.json:27`/`:52` leaves enum-membership and dynamic integer bounds to semantic validation. `lib/loka/content/compiler.ex:220` rejects invalid defaults with `FACT_DEFAULT_INVALID`. TS `content/cartridge_refs.ts:158` validates policy/assignment values and special reserved facts, but does not validate ordinary FactSpec defaults; `content/cartridge.ts:267` checks scopes only. `runtime/fresh.ts:59` copies the default into the runtime default map. `mechanics/fact.ts:86` checks stored assignments, so a fresh invalid default is not covered by that invariant.

**Scenario:** an otherwise legal artifact with recomputed canonical content hash declares an ordinary enum fact with `values: ['missing']` and `default: 'rescued'` (or integer bounds0..1/default2). The schema accepts the field types, the compiler would reject equivalent source, but the loader path has no corresponding cross-field rejection. Unwritten reads now return a value outside the supposed shared typed vocabulary. This is a static code-path conclusion, not an executed malicious artifact or runtime test. Compiler-produced valid sampler content is not shown to be affected; the defect is independent validation at the artifact trust boundary.

**Small fix:** validate every ordinary default with the existing typed-value predicate in the loader's semantic/reference stage and the established default diagnostic. Add only the missing loader controlled cases after checking existing focused tests; mutate away the semantic check and observe failure. Compiler/loader parity needs a new case, not a second generic schema validator or check that only finds the source text. If the registered `facts_typed` claim is extended to defaults, independently verify it without computing its oracle through the loader implementation.

## Named mechanic dependencies and duplication disposition

| Actual dependency | Disposition |
|---|---|
| movement→position `standing`, resource fare and barrier lookup | Required by active mechanics:28–31; shared read-only vocabulary. Future traversal consumers reuse it; not an illicit call to Stand/Open/Pay player verbs. |
| dialogue→quest lifecycle `acceptRefused/activation/resolution` (`dialogue/rule.ts:57`, `:147`) | Explicit current subset/COMPOSES exception, required by active dialogue contract. A future general consequence seam should replace expanding special cases, not erase valid current activation. |
| dialogue handover vs containment Give | Both construct the same typed transfer/event but have different bound-role/presence/capacity gameplay admission. Consolidate typed construction when actual third consumer arrives; do not route dialogue through Give or assume identical refusal semantics. |
| recipe cost admission vs execution and resource helper | Same resource algebra is the desired seam. M5 effective spec change must trace all global spec lookups (`resource.ts:26,49,76`) and admission callers, not patch damage alone. |
| proposal→quest earned/reaction/schedule | Composition-root coupling already declared (`architecture.md:81`); update when actual new event/job kind arrives. Do not manufacture dynamic plugin registration. |
| reaction→scene `starts` (`reaction.ts:36`) | Explicit one-consumer shortcut with an existing graduation comment. Generalize to selected typed deliveries at M22's second consumer; no present correctness defect solely for this name. |
| scene→dialogue `ALWAYS` (`scene/shared.ts:14`) | Incidental constant ownership, not a needed dialogue semantic dependency. Opportunistically move/reuse the trivial policy constant when touching these helpers; no standalone refactor PR. |
| foundation→quest/barrier legal states | Existing frozen portable operation contracts; keep both twins coherent. It is not permission to put chapter progression or named rat behavior in compose. |
| view→mechanics helpers | Correct query reuse where exact predicates match; PC-01 shows where hand-assembled projection drifts. Fix the actual mismatch, not all folder dependencies. |
| any capability→chapter IDs | No direct chapter-specific installed violation established by this inspection. Future S1/King/ferry/shrine labels must remain authored data; map needed roles/templates explicitly. |

## Prioritized implementation/refactor queue

| Priority / item | First concrete consumer; dependency | Minimal lift / boundary | Acceptance break to prove when implemented |
|---|---|---|---|
| P0 consumer gate: safe lethal sequence | M5-B immediately consumed by M6 after M2/M5-A | large, split foundation identity/custody from live encounter only if immediately consumed; independent proposal review | lost/orphan corpse after reopen; old-round action after revival; unsafe return route; wrong owner loot |
| P1 trust boundary: PC-11 fact defaults | Existing compiled artifact loader; before broader fact-driven composition | small semantic parity check using existing typed validator/diagnostic | correctly hashed enum or bounded-int default outside its declared domain is rejected at load |
| P1 correctness: PC-01 exit admission | Existing valid room contributions; before M10/restricted traversal | small isolated shared admission/view correction | subtract Move while open/standing/affordable must not advertise usable exit; alias/policy seam where actually supported |
| P1 planned: resource settlement/effective specs | M2 then M5-A and death wake/restore | medium already briefed; shared portable arithmetic and narrow RPG final/load guard | retroactive rate, fraction loss, authored-but-wrong rate, rat exceeding its own maximum |
| P1 planned: encounter/job terminalization and event ownership | M6 first recurring combat | medium–large, within actual encounter slice; no scheduler framework | stale/cancelled round does nothing; due sibling still proceeds; schedule-owned death event admitted only through declared direct composition |
| P1 scaling decision: job lifetime cost | M1 recurrence already exists; M6 increases rate; before long-run claims | first bounded read-only design decision, then smallest demonstrated repair; no speculative cache | controlled retained-history case catches scans/copies growing with obsolete jobs; persistence/identity semantics still exact |
| P1 planned: minimal shared consequences | M6 finite rat credit / M22-A / M20-A | medium; bring narrow event→authored fact mapping forward | valid death sets exactly its declared credited fact; wrong victim/room/participant no credit; no combat chapter switch |
| P2 planned: custody/load/life sharing | M3 then M5 and actual Buy/swim consumers | medium within briefs; no persistent weight index | nested/worn once, forced overload escape, raw-ID fixed-corpse refusal and consistent corpse/NPC projection |
| P2 planned: perception/traversal | M9/M10/M16, then C2 discovery and C3 stealth/mount | medium per actual predicate family | hidden target direct invocation; escort illegal edge; rider/mount partial move |
| P2 planned: skills/status/effective stats | M6-B/M7/M8, later ring/material/curse | medium per selected writer; new primitive explicitly allowed | missing qualification, double modifier, stale expiry, wrong damage/draw order |
| P2 planned: narrative reducers and occurrences | M20/M21/M22; finale→CC-M01 | medium–large split by operator/scene family | preactivation credit, same reward twice, wrong branch, export before acknowledgement, silent role rebinding |
| P3 real later consumers | commerce→immediate service→escrow/quantity/ownership/knowledge/witness | candidate rows name dependencies and bounded increments | conservation, once-only completion/claim, scope/observer access; no duplicated low-level transaction tests |
| P3 continuity/product | CC-M01/02/03 and account/install tracks | own explicit host contracts | malformed partial import, duplicated imported item, prior save damage, entitlement logic leaking into portable rules |

Priority P0 means a condition that must hold before exposing the named future lethal consumer, not an instruction to stop today's nonlethal source work. All new work requires a concrete brief/spec amendment and its normal independent review. This report is not implementation GO.

## Catalog-only candidates inspected, with no current consumer inferred

Archived21 is a vocabulary/catalog, not a hidden requirement to implement everything. Its remaining families were considered while mapping all active/future candidates:

| Catalog family | Current disposition and reuse direction |
|---|---|
| Stance, dual wield, ranged/adjacent attacks, full injury/ancestry/progression | Need an actual selected fight/item/character writer beyond current queue; reuse effective stats, check/damage order, targeting and status. No class/level framework inferred. |
| Collection/bestiary | A projection/history consumer, with explicit retained record if required; never make collection legality authority. No present row authorizes it. |
| Hunt, drives, rich ecology/weather/seasons and supply-chain simulation | Bounded perception/memory/resource queries→legal behavior intents; add only for selected NPC/environment play. No every-entity tick or economy simulator prerequisite. |
| Player ghost walk, corpse resurrection service, ironman | Not implied by chapter-two NPC ghost mystery. Current shrine death stays its own selected policy; future ghost ActionSet/lifecycle would need explicit recovery/custody contract. One shared difficulty remains current direction. |
| Barter, NPC-to-NPC trade, banking/debt/obligations | S7 item handoff is not barter; existing proposed atomic payment/custody can be extended with actual conservation/credit semantics when selected. No debt system by implication. |
| Mail, runtime boards, player books, language/speech/social poses | Runtime author provenance, durable delivery, audience and typed communication events would be new consumers over readables/jobs/narration. A static M12 notice does not require mail or editing. |
| Recognition/disguise, richer knowledge/tracks/rumor propagation | Reuse observer knowledge/perception with explicit retained evidence/derived expiry. C3 wanted can be the selected simpler witnessed jurisdiction contract; disguise is not a prerequisite. Q1 tracks currently need a discovery producer, not a general decaying trail subsystem. |
| Party/guild/institutions, property/leases and territory/governance | Actual C3 cottage owns the narrow property/custody distinction; later Realm membership/access/concurrency require their own typed relations and authority contracts. Affiliation story flags do not imply a guild/class subsystem. |
| Spatial InstancePlan, multi-participant ritual, shared scarce service | M21 dream overlay needs no deep-copy/private dungeon; first real spatial instance must define closure/import/export without cloning unique entities. Party ritual/Realm scarce jobs wait for actual participants/concurrency; C3 forge owns only its chosen local escrow/capacity subset. |
| Builder templates/LokaScript/semantic editor operations | Compile-time flattening can reuse authored patterns when authoring pain is demonstrated. A real semantic gap first gets a typed primitive; arbitrary script/set-field authority is not a substitute. No scripting or Builder framework is approved here. |

## Minimal public adoption and review discipline

Prefer **one canonical section in `docs/system/architecture.md`**, linked by the system index, AGENTS and WORKFLOW brief/review instructions. The companion `normative-amendment-proposal.md` gives exact text. Do not publish this full private audit as a second normative catalog; public plans retain their candidate tables and link the canonical guide. Existing specs still own operation/invariant details.

For each changed mechanic, record: actual consumer; shared reads; typed writes/consequences and owning writer group; primitives reused; smallest new primitive with invariant if existing vocabulary is insufficient; existing mechanics that compose automatically; named mechanic/content exceptions and governing clause; budget/ordering/persistence/projection implications. This is one short brief paragraph/table, not a new bureaucracy.

Use existing rule purity/import boundaries, closed schemas, lock/ref validation, target/precondition/writer conflict checks and GameView admission invariant. Extend a deterministic check only for a concrete new enforceable property. A source-text rule banning the word “quest”, tests of registry size, universal test matrices and synthetic fake mechanics do not prove composition.

Focused automated proof runs the real consuming path on controlled input; independent literal answers and red controls cover distinct plausible regressions. Try mutations against existing focused tests first. Reuse generic receipt/storage fault tests unless the new payload exposes a distinct lost-row or partial-adoption break. Simulator automation is first; batch playable previews, retain later manual/device gate, owner installed-save preservation, deferred blur and no paid services. No proof was executed in this audit.

## Ponytail and correctness self-review of this advice

- Reuse: architecture section plus existing brief/review loop, not a new guide hierarchy and architecture linter.
- Reuse: facts/resources/containment/jobs/receipts; create only missing invariants for actual consumers.
- Cut: generic effect/timer/plugin/query/scene/spawn/ownership frameworks, full RPG schema, universal modifiers, all-catalog implementation and one PR solely to move `ALWAYS`.
- Keep: trust-boundary validation, narrow RPG final/load guards, conserved custody, independent foundation twins/oracles, attribution and real transaction failure behavior.
- Correctness pass: classify PC-01/PC-11 as static actual bugs; PC-02 as current source-level scaling debt without invented measurements; other entries as explicit future gaps/consumer gates or documented bounded exceptions. Pending policy and private drafts are not installed behavior.

Net production lines proposed by this audit: unknown; no code diff exists, so no invented deletion score. The report deliberately authorizes neither an implementation nor a guard-pass claim.

## Independent inspection contributions and limits

The separate kernel code auditor supplied `kernel-code-auditor.md` at the same pinned base, including complete installed mechanics/runtime/action/view reads and Elixir compose/invariant inspection. The lead independently confirmed PC-01 through the loader/admission/projection paths. The separate content/host auditor supplied `host-content-code-auditor.md` and inspected compiler/loader and host/session/presentation boundaries: changed-row atomic receipt save and adopt-after-confirmation (`mobile/authority/local-story/store.ts:245`, `save.ts:49`), dynamic identity absence at the planned M5 seam, and the ordinary FactSpec default asymmetry. The lead independently confirmed PC-11 against schema/compiler/loader/fresh/invariant sources. These are inspection contributions, not independent code approvals or executed test evidence.

Additional host observation retained as a low-priority follow-up, outside the primitive changes proposed here: `ClockDriver.advance` in `mobile/authority/local-story/elapsed.ts:126` throws on a top-level commitElapsed fault before its later decision-fault branch; `session.ts:189`/`:210` may report generic error instead of the typed elapsed fault. Proposal rollback and retained debt are not shown broken. Recheck the precise shared status contract and controlled path before calling it a user-visible bug; no runtime execution or fix is claimed.
