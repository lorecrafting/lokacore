# Loka v3 Specification Review Record

**Scope:** `docs/rewrite-v3/` plus the v3 reconciliation of `docs/product/CARTRIDGE-ROADMAP.md`  
**Review state:** self-review and adversarial architecture review performed before opening the stacked specification PR.

This file records important challenges raised against the draft and the resulting corrections. It is evidence about the specification process, not a substitute for the normative contracts.

## 1. Rewrite versus port ambiguity

**Finding:** Early inventory wording used “porting disposition,” which could instruct an implementation agent to migrate Lokacore module-by-module.

**Risk:** legacy APIs, compatibility layers, process topology, and architectural debt survive into the supposedly clean system.

**Resolution:** corrected throughout.

The specification now requires:

- a clean-sheet v3 implementation;
- no old modules/APIs/shims/process topology carried forward merely for speed;
- Lokacore used only as requirements/evidence/reference material;
- optional future one-way content translation into v3-native schemas.

## 2. Offline requirement contradicted original server-authoritative roadmap

**Finding:** The first roadmap assumed even single-player cartridges ran on the Phoenix server.

**Risk:** no true offline play; single-player product tied to cloud uptime; later attempt to add offline mode would require a second rules implementation.

**Resolution:** architecture changed to two authority hosts over shared portable semantics:

- offline: local serialized authority + SQLite;
- online: BEAM/OTP authority + PostgreSQL.

The product roadmap was rewritten to match.

## 3. Shared kernel could undermine the BEAM-native goal

**Finding:** Moving too much into a portable Rust kernel could accidentally turn Elixir into a thin web wrapper.

**Risk:** lose OTP supervision/process/message-passing advantages and increase FFI complexity.

**Resolution:** kernel boundary is deliberately narrow.

Portable kernel owns deterministic mechanics required by both offline and online play. BEAM owns online:

- sessions;
- WorldInstance/ZoneShard authority;
- supervision;
- networking;
- scheduling coordination;
- persistence transactions;
- outbox workers;
- backpressure;
- observability;
- future distributed topology.

ADR-033 records this constraint.

## 4. Rust/mobile bridge maturity was overstated

**Finding:** Rustler is mature on BEAM, but current Rust→React Native tooling varies in maturity; one prominent generator currently warns against production use.

**Risk:** lock the rebuild to fragile mobile tooling before testing Expo/EAS release ergonomics.

**Resolution:**

- Rust is provisional;
- mobile binding strategy is provisional;
- R1 is a disposable feasibility spike;
- compare at least stable C ABI/platform wrappers and TurboModule/JSI approaches;
- do not make a third-party generator an architectural dependency without evidence.

Fallback remains dual Elixir/TypeScript implementations with mandatory golden conformance, if the shared-kernel approach fails the spike.

## 5. “Same seed” was not a complete determinism contract

**Finding:** Cross-host replay can still diverge through map iteration, ID generation, sorting, floating-point boundaries, or host entropy.

**Risk:** offline and online versions of the same cartridge subtly behave differently.

**Resolution:** normative determinism now covers:

- canonical collection ordering;
- canonical serialization;
- fixed/versioned RNG;
- deterministic ID source;
- stable tie-breaks;
- integer/fixed-point rule-critical arithmetic where host floating point could alter outcomes.

Acceptance scenarios DET-06 onward test these boundaries.

## 6. Native kernel state could become a hidden second authority

**Finding:** A long-lived mutable native state handle could advance before PostgreSQL/SQLite commit.

**Risk:** database and in-memory game state disagree after commit failure or crash.

**Resolution:** the spec defines a proposal/commit protocol:

```text
decide against committed state
  → StateDelta/events/effects
  → host transaction commits
  → only then apply committed delta in memory
```

If post-commit in-memory application fails, reload from durable committed state.

R1 must benchmark several state-crossing strategies instead of assuming a hidden mutable NIF resource.

## 7. Cartridge expansion/composition was underspecified

**Finding:** Campaign chapters and future MMO mounts could otherwise start reaching into each other's internal keys.

**Risk:** global namespace coupling and cartridges that cannot evolve independently.

**Resolution:** added explicit cartridge ports/extension points:

- exported entries/exits;
- continuity exports/imports;
- typed extension points;
- campaign/deployment mount bindings.

Unexported internals remain private.

## 8. Single-player sequel continuity could become accidental MMO state

**Finding:** “Reuse cartridges later” did not specify which state is allowed to survive between offline chapters.

**Risk:** arbitrary internal state coupling or later temptation to import offline gold/items into the MMO.

**Resolution:** introduced explicit continuity classes:

- cartridge-local state;
- campaign-character state;
- campaign-memory state;
- optional account memory;
- online realm/MMO state.

Offline campaign economy/power never becomes authoritative realm state.

## 9. App Store treatment of downloadable scripts was too optimistic

**Finding:** Calling downloaded rules “bytecode” does not make them automatically compatible with current Apple downloadable-code rules.

**Risk:** architecture works technically but creates avoidable review risk.

**Resolution:**

- downloadable LokaScript IR must be bounded/typed and limited to capabilities already shipped in the app;
- no downloaded native/JS modules per cartridge;
- dedicated App Review position spike before first submission;
- if necessary, restrict the representation further into a declarative rule graph.

The product requirement for downloadable offline storypacks remains; the representation is a release gate.

## 10. General Builder API was scheduled before proving a real game

**Finding:** The original implementation graph built the generalized Builder API before the first real cartridge.

**Risk:** repeat the historical pattern of building a world-building platform before discovering what a shippable story actually needs.

**Resolution:** reordered milestones:

- R9 Cartridge Lab;
- R10 first real offline cartridge, substantially handcrafted;
- R11 generalized Builder API derived from observed authoring pain;
- R16 factory automation later.

## 11. Event terminology was overloaded in Lokacore

**Finding:** Lokacore has structured `Loka.Engine.Event` plus tuple events returned to transports.

**Risk:** the clean rebuild accidentally recreates one generic “event” bucket.

**Resolution:** v3 separates:

- Command;
- DomainEvent;
- Effect;
- ClientMessage.

Each has its own schema and responsibility.

## 12. Definition and runtime entity were conflated historically

**Finding:** Lokacore stores prototypes and runtime instances through the same broad entity abstraction/table/API.

**Risk:** cartridge namespaces/version pinning and runtime mutation become difficult to reason about.

**Resolution:** immutable DefinitionRef and mutable RuntimeEntity are separate concepts with separate lifecycles.

## 13. One-process-per-entity was not justified by the new product

**Finding:** Lokacore's EntityServer model creates many cross-authority operations.

**Risk:** item transfers, quest updates, and multi-entity actions need coordination across many actors and durable writes.

**Resolution:** processes represent concurrency ownership domains:

- private/party WorldInstance;
- later shared ZoneShard;
- Session;
- schedulers/workers.

Entities are data unless they genuinely require independent concurrent ownership.

## 14. Temporal features could create timer/tick explosions

**Finding:** MUD worlds invite schedules, plants, cooldowns, shops, weather, respawns, and ambient events.

**Risk:** one timer/tick process per object creates unnecessary load and hard-to-replay behavior.

**Resolution:** four temporal strategies:

- derived/on-demand state;
- durable scheduled jobs;
- ephemeral cadence;
- world/shard simulation scheduling.

This incorporates a particularly useful lesson from Evennia's OnDemandHandler.

## 15. Private story → MMORPG reuse needed more than a single “shared” switch

**Finding:** many intimate narratives are not semantically valid when all players share one copy of every NPC/quest.

**Risk:** forced shared-state conversion ruins the story or creates quest races.

**Resolution:** three reuse modes:

1. adventure portal to private/party instance;
2. geographically embedded private/party instance;
3. selected shared-area promotion with a separately certified deployment overlay.

Shared promotion is optional.

## 16. Mobile/server protocol drift must not recur

**Finding:** current RN client/server disagree on join parameters, event names, and view-model shapes.

**Risk:** two independently maintained contracts drift again.

**Resolution:** one language-neutral machine-readable online protocol source generates/checks Elixir and TypeScript contracts and fixtures.

Portable kernel commands have their own host-neutral conformance schema.

## 17. CI and documentation authority

**Finding:** Lokacore has overlapping CI and stale architecture/builder docs.

**Risk:** implementation agents trust conflicting historical sources.

**Resolution:**

- one coherent CI in v3;
- schema/registry generated or checked documentation;
- accepted spec + decision register govern architecture;
- historical Lokacore docs stay reference-only.

## 18. Review conclusion

No finding currently requires abandoning the clean-rebuild strategy.

The highest-risk unresolved decision is the **shared portable kernel technology/binding strategy**. It remains intentionally provisional and is the first implementation evidence gate (R1).

The second important release risk is **App Store treatment of downloaded rule content**; the architecture has been constrained to minimize that risk, but current review policy must be tested/reverified before commercial submission.

The specification should not be considered implementation-final until this PR itself receives external/adversarial review and any resulting corrections.


## 19. Self-review corrections after PR opening

A fresh PR self-review found:

- stale pre-v3 manifest fields still present in the roadmap;
- no explicit portable GameView/projection contract for offline versus online;
- deterministic gameplay IDs required but underspecified;
- R10 mobile smoke wording depended on the later polished R12 shell;
- overly broad “portable bytecode” wording.

Corrections:

- roadmap manifest aligned to v3 kernel/capability profiles;
- host-neutral GameView projection added so React Native does not reimplement game visibility/action rules;
- deterministic gameplay IDs now come from an explicit deterministic IdSource;
- R10 uses a developer mobile harness, R12 owns polished product-shell acceptance;
- downloadable rules are described as bounded portable rule IR.

## 20. Adversarial review after self-review

The next pass assumed long-lived commercial offline saves, automatic app updates, real command retries, signing-key rotation, and later MMO concurrency.

Findings and corrections:

1. **Old saves versus app auto-update** — added explicit kernel/rule-IR/content-schema compatibility matrix, local migrations/rollback, and acceptance scenarios.
2. **Command receipts could not actually replay a response** — receipt now stores committed revision plus response payload/reference, not only a digest.
3. **Commerce/account logic had no domain home** — introduced `loka_platform`; `loka_web` remains adapter-only.
4. **Artifact signing had no key-rotation contract** — added signing key IDs/trust-set rotation/revocation semantics.
5. **General scripting was too front-loaded** — R7 now builds only the interpreter core/minimal bindings needed to prove containment and the first cartridge; R11 generalizes from observed authoring needs.
6. **Portable projection could drift** — corrected during self-review and now covered as a host-neutral GameView.
7. **Cartridge/app compatibility is now part of certification**, not a support afterthought.

No adversarial finding currently requires abandoning the clean-sheet/offline-first architecture. The shared-kernel decision remains the primary R1 evidence gate.


## 21. Product-boundary interruption: separate Stories and Online clients

During adversarial review, the product boundary was challenged again: offline single-player and persistent multiplayer have sufficiently different trust, release, UX, and state requirements that one client risks becoming condition-heavy.

Decision:

- **Loka Stories** is a separate offline-first cartridge/campaign app;
- **Loka Online** is a separate online-only multiplayer/MUD app;
- both live in one monorepo and share UI/GameView/schema packages where valuable;
- the Online client does not become a local simulation authority;
- the Stories client does not carry realm/social/shard responsibilities.

The Builder API now has explicit `story`, `realm`, and `promote` targets.

This reduces architecture coupling at the cost of two app-store/release tracks and a deliberate cross-client entitlement/account policy. The latter is intentionally not assumed to be automatic.


## 22. Review round two: revisit the two-client decision

After PR #4 merged, the client split was challenged again from a maintenance/product perspective.

### Finding

Two separate store apps preserved authority separation, but duplicated:

- store listings/review tracks;
- release/version management;
- navigation/onboarding;
- design/accessibility shell;
- account/catalog/purchase/restore UX;
- analytics/support surface;
- installed-user migration path when Realm launches.

The authority problem did not actually require two binaries.

### Revised decision

Use **one Loka app with two strict gameplay session modes**:

- `LocalStorySession` — local kernel + SQLite;
- `RemoteRealmSession` — Phoenix/BEAM.

The common renderer consumes host-neutral GameViews. Exactly one session authority is active at a time. Realm never accepts local simulation as authority.

The mobile codebase keeps separate Story and Realm feature/authority modules so “one app” does not become pervasive `if online?` conditionals.

### Why this is simpler

- one store presence and installed user base;
- one design/accessibility/localization system;
- one cartridge/account/catalog experience;
- Realm can arrive later as an app update;
- no cross-app entitlement problem;
- Story cartridges can open online adventures/Realm portals without deep-linking to another product.

### New cost

Online development cadence can force more frequent app updates, so offline save/kernel/rule-IR backward compatibility becomes even more important. The existing compatibility contract already treats this as a release invariant.

### Builder decision retained

`story`, `realm`, and `promote` remain distinct Builder targets because they represent authority/trust/certification semantics, not clients.

## 23. Review round two: master-plan clarity

The packet has grown large enough that an implementation model could confuse research/history with requirements.

Correction: the packet index now explicitly labels:

- normative architecture;
- normative sequencing/acceptance gates;
- informative/reference evidence.

A disagreement between normative documents is itself a spec defect and blocks implementation until reconciled; there is no implicit “pick the newest paragraph” rule.

Certification is now explicitly target-driven:

- Story workspaces select portable/offline/save-compatibility gates;
- Realm workspaces select online/concurrency/security/load gates;
- Promote workspaces retain the immutable Story artifact and add explicit multiplayer adaptation plus Realm certification.
