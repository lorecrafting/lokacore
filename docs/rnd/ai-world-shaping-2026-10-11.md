# AI dungeon master / live world morphing: R&D study (loka-e97d)

Read-only study, branch main @ c2b089dc, 2026-10-11. Facts cite file:line or doc section. Proposals and opinions are marked **(proposal)** or **(opinion)**.

Short answer: the engine is a closed, deterministic, data-driven kernel with a validated content pipeline. That is the right foundation for an AI author or DM. What is missing is any way to change content after a world starts: a cartridge is one immutable release, pinned by hash into every save. The R&D question is therefore not "can the AI run the rules" (it must not) but "what is the smallest validated, receipted content delta the kernel can accept mid-save".

## 1. Foundation audit

### What already supports an AI author or DM (facts)

| Mechanism | Where | Why it matters for an AI |
|---|---|---|
| Declarative content: rooms, items, NPCs, facts, policies, recipes, quests, dialogues, reactions, scenes, story points are JSON; "No arbitrary script runs" | docs/BUILDERS-GUIDE.md "Authoring paths and examples"; docs/system/cartridge.md "Source layout" | An LLM emits JSON, not code. The content grammar is closed. |
| Compile-time validation with structured diagnostics: `mix loka.compile` runs all stages, unique sorted diagnostics, exit 1 on error | docs/system/cartridge.md "Compiler" (`lib/loka/content.ex:38`, `:73`); checks list ibid. (UNRESOLVED_REFERENCE, CONTAINMENT_CYCLE, BARRIER_UNREACHABLE_KEY, OUTCOME_MISMATCH, RESERVED_FACT...) | A generate/compile/repair loop already has its error channel. The compiler is the guardrail. |
| Loader re-validates the artifact in the kernel with the same checks as the compiler, plus installed-capability checks | docs/system/cartridge.md "Artifact and loader" (`kernel/ts/src/content/cartridge.ts:48`, `content/cartridge_installed.ts:24`); 45 `cartridge_*.ts` validators in `kernel/ts/src/content/` | Validation does not depend on trusting the producer. |
| Content hash: artifact is canonical `{cartridge, content_hash}`; `CONTENT_HASH_MISMATCH` on load; cross-kernel identical bytes | cartridge.md "Compiler" (`content.ex:53`), "Artifact and loader"; `test/loka/cartridge_cross_kernel_test.exs:169` | Every content version is content-addressed. |
| Pure kernel: no I/O, clock, randomness, locale | docs/system/architecture.md "TypeScript kernel" (`kernel/ts/src/index.ts:1`, `lint/rules/ts-kernel-pure.yml`) | The AI cannot be called from inside a rule even by accident. |
| Seeded RNG in state; a new lineage draws a seed once; `state.rng` advances per authority draw and is committed in the head | `kernel/ts/src/runtime/fresh.ts:31`, `:78`; `mobile/authority/local-story/authority.ts:148-155`; save.md "Commit, fence, reconcile" | Replay never needs a random source. |
| Admission: ActionSet composition, policy gating, capability ownership, `unowned_event` fault, `rejection_consumes_nothing` invariant | docs/system/protocol.md "The decision loop" steps 4-7; "ActionSet and admission"; `runtime/invariants.ts:116` | Any input, from a player or an AI, is refused unless offered and legal. |
| Budgets: eleven limits, one aggregate counter across admission, rule and proposal; exhaustion is a fault | protocol.md "Budgets" (`contracts.gen.ts:366`, `foundation/compose.ts:119`) | AI-authored content cannot make a decision run unbounded. |
| Effects are data, two registered types, `allowed_origins`; "effects (always empty today)" | `protocol/effect_registry.json`; protocol.md "The decision loop" | No side channel exists for content to reach the outside world. |
| Receipts and replay: receipt stores invocation id, intent digest, Command, DecisionResult; known id replays `saved` without deciding again; altered intent is `conflict` | save.md "Receipts" (`store.ts:36`, `invocation.ts:50`) | A recorded result is authoritative; replay never re-runs the producer. |
| Trusted non-player input precedent: `stepElapsed` accepts a typed `elapsed` command only from the authority, with its own CommandId derivation | `kernel/ts/src/runtime/world.ts:162-175`; save.md "M1-A trusted elapsed receipts" | Template for a trusted "DM" command kind. |
| Reactions: data-driven consequences on any registered event, deterministic order | mechanics.md "reaction@1" (`mechanics/reaction.ts`) | The main lever a DM would pull: event -> authored consequence. |
| Statuses on player, NPCs and things; permanent statuses; modifiers | mechanics.md "Status effects over time", "Statuses on NPCs and things", "Permanent statuses" | Morphable state already has a typed home. |
| Live instance creation from templates: population plans and corpse templates create and replace NPC instances at runtime | glossary.md "Spawn"; mechanics.md "C3 bounded living hounds"; `runtime/created.ts`, `invariants_creation.ts` | Proves runtime entity birth with fresh IDs is already admitted and invariant-checked. |
| Narration variety and derived weather pick by hash of ids, never the authority RNG; every line is authored | mechanics.md "Narration variety" (W7), "Derived sky" (row 31); MECHANICS-TOOLBOX.md "Traps" 4, 5 | Shows the house pattern for variation without touching determinism. |
| `kernel_api` versioning with `requires.kernel_api.at_least`, capability lock, `INSTALLED` declaration | cartridge.md "Installed capabilities" (`runtime/world.ts:106`, API 1.57) | Content and engine versions are already negotiated. |
| Deterministic simulator: seed -> cartridge, world, 1-64 commands, invariants per step, shrinking; `--cartridge` any artifact | `kernel/ts/test/sim.ts:1-12`; BUILDERS-GUIDE.md "Preview an edit" | Cheap fuzzing of AI-produced content. |
| Prior design: archived spec 08 "Builder API and AI Factory": typed Builder API, MCP adapter, "closed semantics, open composition", factory/runtime separation | docs/archive/spec/08-builder-api-ai-factory.md §1, §20, §24 | The owner's question was already framed once; the archived answer still fits the installed engine. |

### What is missing or works against it (facts)

| Gap | Where | Consequence |
|---|---|---|
| A cartridge is immutable after compile; `World.cartridge` is a readonly definition set shared by every step | BUILDERS-GUIDE.md "The pieces"; `kernel/ts/src/runtime/decision.ts:122-124` | No runtime content patching at all. |
| The save pins one exact release hash; a mismatch is refused, never migrated | save.md "Opening a story" (refusals table, pre-production policy); `authority.ts:179` | Changing content means a new game today. |
| No authoring API; `Loka.Builder` is an empty boundary | architecture.md "Elixir boundaries"; BUILDERS-GUIDE.md "Builder app direction" | The only AI entry point is files on disk plus `mix loka.compile`. |
| No general live spawner: "arbitrary live builder spawning remains future work" | glossary.md "Spawn"; BUILDERS-GUIDE.md "What the current builder can express" | Only authored population plans create entities. |
| Receipts do not carry `result_digest`; an altered stored response still replays as `saved` | DIFFERENCES.md row 1 | A recorded AI output in a receipt is not yet integrity-checked. |
| All player-facing prose is catalogued text keys; "No procedural prose" is a standing trap | cartridge.md "Text"; MECHANICS-TOOLBOX.md "Traps" 4 | AI narration has no slot in the committed narration model. |
| The compiler is Elixir and the loader is TypeScript; the phone has no compiler | architecture.md "Layout" | Between-session or runtime deltas on device need the TS loader path only. |
| Entity and room IDs are minted at world creation from one allocator; 211 initial IDs for Chapter 1 | cartridge.md "Current bundled chapter"; `fresh.ts:31-34` | Added definitions need an ID allocation rule that does not collide with the save. |

## 2. Design space: integration modes

Ordered from least to most invasive. Sizes are rough **(opinion)**.

| Mode | What it needs | Reuses | Risks | Size |
|---|---|---|---|---|
| (a) Offline AI authoring: the model writes cartridge source, `mix loka.compile` and the simulator gate it | A prompt/skill with the source layout and diagnostic codes; a generate-compile-repair loop; a sim run per candidate | Compiler, loader, `sim.ts --cartridge`, showcase as few-shot corpus | Content is valid but dull or unreachable; only the compiler's static checks hold (reachability is "authoring potential, not proof", cartridge.md "Compiler") | Small: no engine change. Days. |
| (b) Between-session revisions: AI emits cartridge vN+1; the save migrates to it | A save migration rule (today refused); stable definition keys so rows still resolve; a compatibility check (deleted room a body stands in, renamed quest) | Content hash, pin, loader | Receipt history re-decides differently on new content (save.md: already a `save_corrupt` case pre-production) | Medium: new migration contract in save + loader. Weeks. |
| (c) Live DM through ordinary commands: the AI acts as an NPC or as a trusted authority input (like `elapsed`) that fires existing reactions, statuses, facts, spawns from authored templates | A trusted `dm` command kind with its own CommandId derivation; an allowlist of payload ops (fact.assign within FactSpec, status.apply, template spawn, narration key); receipts as now | `stepElapsed` pattern, reaction@1, status rows, population templates, admission | Scope creep: a "DM op" that writes arbitrary rows bypasses rules. Must go through the same propose/adopt path and budgets | Medium: one new command type plus validators. Weeks. |
| (d) Runtime content patches: validated, hashed delta layer adding rooms, NPCs, items, dialogues, quests to a running save | Patch contract (add-only first); loader-side patch validation against base plus prior patches; ID allocation for new definitions; patch hash chained into the pin; `World.cartridge` becomes base + patches | All 45 `cartridge_*.ts` validators, content hash, IdSource, receipts | The hardest determinism question: a patch is content, not a command, so where does it sit in the receipt log? See §4 | Large: touches loader, World, save pin, simulator. Months. |
| (e) AI narration only: deterministic state, AI prose rendered on top | A render-side hook keyed by committed narration keys and bindings; narration cached by `(command_id, key)` and stored outside the save or as an annotation | Receipt's committed narration keys, W7's `command_id:key` seed idea | Prose contradicts state; cost per line; the Book's text model is catalog-only | Small to medium; zero kernel change if cached outside the save. |

Modes compose: (e) plus (c) is a plausible "DM v1". (d) is the real "builder morphs the world" ask.

## 3. Guardrail proposal (first cut)

**(proposal)** Three rings. The ring is decided by one question: who can be blamed when it is wrong.

### Ring 0: deterministic, AI-forbidden

| Must stay fixed | Evidence it is already a boundary |
|---|---|
| Rule code: every `mechanics/*/rule.ts`, admission, propose/adopt, compose | Kernel purity (architecture.md); typed `Rule<C>` contract (`runtime/decision.ts:192`) |
| RNG state, seeds, draw order | `state.rng` in head; trap 5 |
| ID minting | one allocator per decision (`decision.ts:244`); `fresh.ts` |
| Budgets, invariants, event ownership | protocol.md "Budgets", "Invariants"; `unowned_event` |
| Save integrity: head, receipts, pin, fence/reconcile | save.md "Commit, fence, reconcile" |
| Numeric profile, resource math, levelling, combat resolution, death and return | frozen `loka-numeric-v1`; resource@1; owner levelling decision |
| Economy invariants: prices as authored data, no money creation outside registered ops | commerce mechanics; world-parameters.md |
| Engine FactSpecs reserved to their rule (`position`, `scene_<k>`) | `RESERVED_FACT` in compiler and loader |

The AI never writes a state row directly. It only produces content or commands that the kernel then decides.

### Ring 1: AI may morph, under validation

| Morphable | Guard that exists | Guard still needed |
|---|---|---|
| New rooms, exits, details, items, NPC blueprints | compiler/loader reference, containment, reachability, barrier checks | Add-only patch rule; no edit of a definition a save row references |
| Facts of the cartridge's own FactSpecs, within bounds | `FACT_TYPE_MISMATCH`, `precondition_failed` on out-of-spec assign | Allowlist of fact keys a DM op may touch (e.g. not quest-gating facts; trap 8) |
| Dialogues, choices, quests, story points, scenes | `OUTCOME_MISMATCH`, `DUPLICATE_DEFINITION`, text-key checks | Quest additions never retire an active quest row |
| Reactions, statuses, schedules, population plans | reaction@1 ordering; status declarations; trap 10 floors | A patch cannot change an existing reaction's `when`/`apply` |
| Instance spawns from templates | population/corpse creation path and invariants | DM op reuses the template path; no ad-hoc entity shape |
| Prices, dispositions, standing | authored data; trap 8 "lines, prices and dispositions, not gates" | Bounds per field |

### Ring 2: AI may generate freely

Prose shown to the player: descriptions, narration lines, NPC speech, away recaps, journal flavour. Guard: it is presentation. It is keyed to a committed narration key and bindings, cached by `command_id:key`, never read by any policy, never saved as state. Trap 9 (moderation before another player sees it) applies in the Realm.

### Where the line is uncertain

- **Quest objectives and deadlines.** Content (ring 1) but they gate progress (trap 8 says gates stay on quest facts). Experiment: let the AI add a side quest only; never touch a quest the chapter list names.
- **Room removal and exit changes.** A body may stand there; a save row may point there. Experiment: add-only patches first; measure how often a DM actually wants deletion.
- **Narration that implies state** ("the guard takes your coin"). Experiment: constrain the prose model to the committed events and bindings of the receipt, and run a contradiction check in the sim.
- **AI-authored policies.** Policies are closed trees evaluated under budgets, so they are ring 1 by construction. But a policy that always fails makes content unreachable. Experiment: require the simulator to reach every added room and fire every added reaction at least once.

## 4. Determinism and replay with a nondeterministic AI

**(proposal)** The rule is one line: the model is called only *outside* the decision loop, and whatever it produced enters the loop as an input that is recorded before it is decided. Replay reads the record and never calls the model.

| AI output | Enters the kernel as | Recorded where | Replay reads | Existing mechanism reused |
|---|---|---|---|---|
| A whole cartridge (mode a, b) | the artifact, by content hash | the save pin (`authority.ts:179`) | the pinned artifact | pin refusal on mismatch (save.md "Opening a story") |
| A DM command (mode c) | a typed trusted Command with a derived CommandId | a receipt with intent digest and DecisionResult (`store.ts:36`) | the stored DecisionResult, `replay: true` | `stepElapsed` + receipts (`world.ts:162`, save.md "Receipts") |
| A content patch (mode d) | a hashed add-only delta applied at a stated revision | a new receipt kind or a new `patches` save table; the pin becomes base hash + ordered patch hashes | base + patches in order, then receipts as now | content hash, canonical encoding, the loader's validators |
| Prose (mode e) | nothing; it is presentation | a cache keyed `(command_id, text key)`, outside state; optionally the trace | the cache, or re-generate (prose is not state) | W7 `command_id:key` hashing idea; the trace table (save.md "The game trace") |

Three consequences:

1. **RNG stays untouched.** The AI never draws from `state.rng`. If a DM op needs "randomness" it uses the W7/row-31 pattern: a hash of stable ids. Trap 5 already forbids the alternative.
2. **Patches must be ordered in the receipt log.** A patch applied between receipt n and n+1 changes what n+1 can decide. So a patch needs a position: simplest is "a patch is a receipt" with a `content_patch` DecisionResult whose `delta` is the definition delta. Then replay is one sequence and `rejection_consumes_nothing` still holds.
3. **Receipt integrity must be closed before any AI input is trusted on replay.** DIFFERENCES.md row 1: a receipt whose stored response was altered still replays as `saved`. This matters little when the recorded producer is the kernel, and a lot when it is a model. `result_digest` is already carried to R12 (future.md "Production Story app").

The prose cache deserves one more line: because committed narration binds `participants` to EntityIds at commit (cartridge.md "Text", `action_recipe/rule.ts:89`), a prose model can be given exactly the entities and events of one receipt and nothing else. That is the natural contradiction guard.

## 5. Staged R&D plan

Each experiment is cheap, uses what exists and settles one question. Order matters: 1 and 2 need no engine change.

| # | Experiment | Question it settles | Success looks like | Reuses |
|---|---|---|---|---|
| 1 | **Generate a district.** Give a model the showcase source layout, `docs/system/cartridge.md` compiler checks and one built district as few-shot; ask for a new 4-room district with one quest, one reaction, one NPC. Loop on `mix loka.compile` diagnostics up to N rounds. | Is the compiler a sufficient guardrail for ring 1 content? What do models get wrong (references, text keys, reachability)? | Compiles in <= 3 repair rounds; `sim.ts --cartridge` on 50 seeds holds every invariant; a human can walk the loop in `loka play`. Record the diagnostic histogram. | `cartridges/toolbox_showcase`, `mix loka.compile`, `sim.ts`, BUILDERS-GUIDE.md |
| 2 | **Narration overlay.** Replay a showcase transcript in `loka play`; for each accepted receipt hand the model only its narration keys, bindings and events; render prose; diff against the catalog line for state contradictions (did it name an entity not in bindings, an event not in the receipt). | Can ring 2 prose be constrained by receipts alone? What context is enough? | < 5% lines mention an entity or outcome outside the receipt; the overlay is reproducible from the cache without the model. | receipts, `kernel/ts/play`, transcripts under `cartridges/*/transcripts` |
| 3 | **Trusted DM command.** Add one typed command `dm_fact` (an authority-only `fact.assign` of an allowlisted cartridge fact, derived CommandId like `elapsed`) behind an opt-in capability; route through step/propose/adopt and receipts; fire it from a dev-panel button. | Does the existing admission/proposal path carry a non-player trusted input without a bypass? Do reactions and budgets apply unchanged? | Reactions fire, invariants hold, replay returns `saved, replay: true` without re-running; sim fuzz including `dm_fact` finds no new fault class; red control: a non-allowlisted fact is refused. | `stepElapsed`, reaction@1, receipts, `?dev=1` panel |
| 4 | **Add-only patch at the loader.** Define `CartridgePatch` as a second artifact adding definitions only; make `loadCartridge` accept base + patches and run the existing `cartridge_*.ts` validators over the union; allocate new IDs from the lineage allocator at the patch's revision; pin = base hash + patch hashes. No compiler change: hand-write the patch JSON for experiment 1's district. | Can `World.cartridge` become layered without touching rules? Where do new IDs come from safely? Does the simulator still shrink? | A save opened on base, patched after revision n, continues; invariants hold; reopen replays identically; a patch that references a missing base key is refused with an existing diagnostic code. | all `content/cartridge_*.ts`, `fresh.ts` ID minting, pin refusal |
| 5 | **Patch as receipt.** Record the patch of experiment 4 as a receipt kind so replay is one log; add `result_digest` to receipts (closes DIFFERENCES row 1). | Is "patch = receipt" enough for replay, or does it need its own table? Is receipt integrity cheap? | Full replay of (receipts + patch) reproduces the state hash; an altered receipt response is refused. | save.md receipts, canonical hash |

Stop rule **(opinion)**: if experiment 1 needs more than ~5 repair rounds per district, the guardrail problem is the model's grasp of the grammar, not the engine, and the next investment is a smaller authoring vocabulary (spec 08 §24 "intent-first composition"), not runtime patching.

## 6. Verdict

**(opinion)** Yes: the foundation is stable enough to start R&D now. Everything a safe AI author needs on the content side exists: a closed JSON grammar, a strict compiler with the same checks in the loader, content hashes, a pure seeded kernel, admission and budgets, and receipts that replay without re-deciding. The single biggest gap is that content is frozen at load and pinned by one hash into the save, so there is no mid-save content delta: no patch contract, no layered `World.cartridge`, no ID allocation for added definitions, and no receipt integrity (`result_digest`) to make a recorded AI input trustworthy on replay. Experiments 1-3 cost no engine change and will show whether the compiler alone is a sufficient guardrail before anyone builds the patch layer.



# Addendum: a living, breathing world driven by AI (owner scope 2026-10-11)

## A1. World-model layer

The owner's scenario needs the AI to reason over regional state and then write a world delta. Below, what exists as engine data today versus what is new. Statuses are from `docs/MECHANICS-TOOLBOX.md` "Ranked toolbox" on main @ c2b089dc.

| Layer | Exists today (facts) | New for the scenario |
|---|---|---|
| Prices, supply, demand | Prices are authored per item and shop, exact integers; a skill discount is a typed numerator/denominator with overflow refusal (cartridge.md "B3 shop", `:685`; "D12 practical skill", `:1400`); `mechanics/commerce/`. Finite stock per shop (B5 stock, cartridge.md `:742`). | No regional price index, no supply/demand model. A "price dial" would be a per-shop multiplier declaration the AI sets; demand would be derived from stock rows, not simulated. |
| Ecology: populations | Bounded, RNG-free population plans with births, wander, replacement and loot roles (mechanics.md "C3 bounded living hounds"; `mechanics/population/settle.ts`). | Floors a quest needs (W12, todo); predator/prey (W12 `prey` slot, todo); random encounters with a per-plan RNG option (row 9, todo). |
| Ecology: resources, regrowth | Tool-gated harvest with depletion (row 19, done #375, `cartridges/harvest_sampler`); regrowth not built, needs item creation (Beads `loka-kgd.85`). Decay (row 41) todo, designed as a status with expiry plus a W1 reaction. | Regrowth as a job; a regional "yield" dial. |
| Weather, climate | Derived sky: weather is a per-day draw from an authored weight table hashed on `(world context, day)`, never stored (mechanics.md "Derived sky", row 31 done #358). Season and tide are cycles. | Climate change = replacing the authored weight table or cycle cuts. Because weather is derived from `World.context` and the clock, swapping the table mid-save changes past days too; a dated table (valid from day N) would be new. |
| Factions, reputation | Standing and disposition declarations (cartridge.md `:1600`), per-NPC trust as W2 pair facts, gifts via reactions (row 15 done #363); rumour by co-presence (W3). | Faction-level facts the AI may shift (bounded int facts already fit); no faction entity. |
| World events | Phased world event trigger and spawn (37a) and aftermath (37b) are todo; their design is a schedule-driven reaction with a `population.spawn` apply step and a `fact_changed` aftermath reaction. Statuses on NPCs and things with tick/expiry events (G3, done #359). | 37a is the natural "boss kill opens an area" hook: a `quest_resolved` or `entity_died` reaction (both registered triggers, mechanics.md "reaction@1") that assigns a world fact. |
| Player-facing observables | GameView, codex, away recap (W4), notice board | A region summary the AI reads: nothing exists; it would be a projection over facts, stock rows, population rows and the calendar. |

**(opinion)** The AI does not need a simulation it reasons *inside*. It needs a read-only region summary (facts, stock, population counts, calendar, standing) and a small set of typed dials to write. Everything regional today is either authored data or a derived function of the clock, which is exactly what makes it dial-able.

## A2. Modifying existing areas mid-save

What a live save references (facts): the body's room and every entity's holder (`World.entities`, `decision.ts:122`); quest rows with `DefinitionRef` and scope (save.md "Opening a story"); pending choices and continuations bound to a dialogue and choice id (save.md "Receipts", riddle recovery); status rows on holders; population rows per plan; visited rooms with counts (W7); discovered places (D10). Every one of those names a DefinitionRefString `<id>@<version>:<kind>/<key>` (cartridge.md "Artifact and loader", `content/cartridge.ts:110`).

What already protects them: the loader refuses any artifact whose references do not resolve (`cartridge_refs.ts:167`); a save whose receipt history re-decides differently opens `save_corrupt` (save.md "Opening a story"); recovery per feature validates its rows against the cartridge and refuses on mismatch (the ~40 "recovery" sections of save.md). None of this is a migration: today the answer to "the cartridge changed" is a refusal and Start over.

**(proposal)** Rules for a mid-save delta to an existing area, cheapest first:

| Rule | Why |
|---|---|
| Add-only for definitions: new rooms, exits, items, NPCs, dialogues, quests, reactions. | Nothing in the save can dangle. Matches the earlier §2 mode (d). |
| Tombstone, never delete: a room, NPC or item definition gets `retired: true`. The loader keeps it resolvable; the engine stops offering it (no exits lead in, the NPC's schedule sends it to a holding room, the quest cannot be offered). | A body standing in a retired room still has a room; a held item of a retired blueprint is still an item. Reuses the "terminal consumed holder" idea of row 41. |
| Versioned definitions: a changed room or dialogue is a new key (`market@2`) plus a tombstone on the old. A quest in progress keeps its old dialogue; new accepts get the new one. | DefinitionRefString already carries `@version` at the cartridge level; a per-definition version is the new part. |
| Exits may be added and may be closed by a barrier, never removed. | Barrier state is already live data with `barrier_changed` events. |
| Facts: a delta may add FactSpecs and may assign existing cartridge facts within their spec; it may not narrow a FactSpec's range below a stored value. | `precondition_failed` on out-of-spec assign (protocol.md step 7) covers the write; the spec change needs a loader check. |
| Dialogue that references old facts keeps working because facts are never removed; the AI's new text keys are additive. | Text catalog is append-only by construction (cartridge.md "Text"). |
| Prices, stock, weight tables, population caps, schedule rooms: replaceable in place, as dials (A3). | They are data read at decision time, not referenced by save rows. |

Migration proper (rewriting save rows) is not proposed; refusal stays the answer for anything outside these rules.

## A3. Guardrail rings revisited: dials versus rules

**(proposal)** The owner is right that prices, weather weights and spawn rates are knobs. A dial is a declared, bounded, rate-limited field the AI may set; a rule is code. The split, with first-guess ranges (ranges are opinion, to be tuned by experiment A5-2):

| Dial | Range | Max change per AI run | Where it lives today |
|---|---|---|---|
| Shop price multiplier per shop or per item tag | 0.5x to 2.0x of authored base | 15% per run | new per-shop field; base prices unchanged (`commerce/`) |
| Shop stock top-up | 0 to authored capacity | +50% of capacity | B5 stock rows |
| Weather weight table per region, dated from day N | weights 0 to 10 per phase, at least one wet and one dry > 0 | one phase weight at a time | row 31 table |
| Population cap and birth interval per plan | cap 0 to 2x authored; never below the plan's floor (W12) | +-25% | C3 plan declarations |
| Harvest yield / regrowth interval | 0.5x to 2x | +-25% | row 19 depletion; regrowth new |
| Faction standing and disposition facts | the FactSpec's bounds | +-1 tier | row 15 facts |
| Schedule room for an NPC hour | any room not retired | one slot per run | W10 schedules |
| Spawn a bundle from an authored template at a room | authored templates only | one bundle per run per plan | `population.spawn` (37a) |
| World-event fact assign (region opened, raid phase) | the fact's enum | one step along the enum | reaction@1 `fact.assign` |

Never touched by the AI (unchanged from ring 0): rule code, RNG, ID minting, budgets, invariants, receipts and pin, numeric profile, combat and levelling math, quest completion logic, the chapter list, reserved facts, base prices and resource bounds as authored.

**Simulation before commit (proposal, reuses existing tools).** A proposed world delta is accepted only if:

1. It validates as content: loader stages over base + delta (`content/cartridge_*.ts`), plus the new dial-range and tombstone checks.
2. The simulator runs on the patched world from the live save's state for N seeds x M commands and every registered invariant holds (`sim.ts`, `runtime/invariants.ts:34`). The sim already accepts any artifact (`--cartridge`) and already shrinks failures.
3. Economy and balance probes pass: scripted walks that buy the cheapest and dearest goods, harvest to depletion, and fight the strongest spawned bundle, with assertions such as "coin earnable per game hour stays within [a, b]" and "no quest-needed population reaches 0" (W12 floor). These probes are new but are ordinary `sim.ts`-style tests over a fixture.
4. The delta's hash is recorded (A4) before any player command runs on it.

Refusal is cheap and leaves the world unchanged, exactly as a rejected decision does (`rejection_consumes_nothing`, `runtime/invariants.ts:116`).

## A4. Trigger and cadence

**(proposal)** The AI never runs inside a decision. It runs between decisions, at a boundary the kernel marks.

| Context | Trigger | Who applies the delta | Fits today |
|---|---|---|---|
| Single-player save | A world-event fact changes (boss `entity_died` or `quest_resolved` reaction assigns `region_x: opened`, 37a style). The authority sees the committed event and queues an AI run. The delta is applied as a receipted trusted command at the next revision, before the next player command. Meanwhile the world is playable on the old content; the opened area shows a "sealed" barrier until the delta lands. | the local authority (`mobile/authority/local-story`), same place `elapsed` is delivered (`world.ts:162`) | the event and reaction hooks exist; the trusted command and patch loader are new (§5 experiments 3 and 4) |
| Single-player, slow world change | Between sessions, on reopen: an AI run bounded by the elapsed time since the last session, turning dials only (no new areas). | the authority on `openStory` (`authority.ts:76`) | reuses the M1-A trusted-elapsed receipt pattern |
| Online Realm (not built; architecture.md "Status") | A server tick (e.g. once per game day) or a world-event boundary; one AI run per shard; the delta is a shard-wide receipted command, applied in the ordinary command order so every client replays identically. | the BEAM authority (archived R14+) | nothing built; the content model is identical, which is the point of the shared-kernel decision (owner-decision-story-realm-shared-mechanics-2026-10-04) |

Rate limits: at most one world delta per world event and one dial run per game day; a delta that fails A3 is retried at most once with the refusal diagnostics fed back to the model, then dropped. Seeded random events ("the AI may seed random events") are 37a schedules the AI authors with the row-9 per-plan RNG option, so the randomness is the kernel's seeded RNG, not the model's.

## A5. Revised staged plan

Cheapest proof first; each step is a real cartridge or test, not a design.

| # | Experiment | Settles | Success | Reuses |
|---|---|---|---|---|
| 1 | **Hand-authored "boss opens area"** in `toolbox_showcase`: an `entity_died` reaction assigns `region_fen: opened`; the new area's entry exit has a barrier whose policy reads that fact; the area is authored by hand. | Does the event -> fact -> gate -> area chain work with zero new engine code? | A sim seed kills the boar and walks into the new rooms; a seed that does not kill it is refused at the gate. | reaction@1, barrier policy, showcase combat district |
| 2 | **Dial probes.** On the showcase, hand-edit the dials (prices x1.5, weather weights, population cap) and run economy/ecology probes as `sim.ts`-style tests; find the ranges where invariants and the probes break. | What ranges and rates are safe? Which dials need a floor? | A table of safe ranges per dial, with the failing case for each bound. | `sim.ts --cartridge`, B5 stock, row 31, C3 |
| 3 | **AI authors the opened area offline** (= earlier experiment 1): the model writes the fen district as source, compile-repair loop, sim gate. | Can the model produce the area to the grammar? | Compiles in <= 3 rounds; sim holds; a human walks it. | `mix loka.compile`, sim |
| 4 | **Trusted `world_delta` command + add-only patch loader** (= earlier experiments 3 and 4 merged): the authority applies a hashed delta (new area from step 3 plus dial changes within step 2's ranges) as a receipted command at revision n on a live save; tombstones for a retired room. | Can a live save take the AI's delta and still replay? | Reopen replays to the same state hash; a dial outside range and a delete of a referenced room are refused with diagnostics; a body in a retired room keeps playing. | receipts, `stepElapsed`, loader validators, `fresh.ts` ID minting |
| 5 | **Closed loop on one event.** Boss kill -> authority queues the model with the region summary and the dial schema -> model returns area + dials -> A3 gate (validate, sim, probes) -> apply as in step 4 -> player enters. Narration overlay (earlier experiment 2) optional. | Is the end-to-end latency and refusal rate acceptable? | One run lands in under a minute of wall time locally; <= 1 retry; no invariant failure across 200 seeds after the delta. | everything above |

## A6. Updated verdict

**(opinion)** The content side of a living world is closer than it looks: the regional state the AI would reason over is already authored data or a derived function of the clock (prices, stock, weather table, population plans, standing facts), and the event hooks that would trigger an AI run (reactions on `entity_died` and `quest_resolved`) exist; experiments 1-3 need no engine change. The distance is on the write side. The largest new gap beyond the earlier one (no mid-save content delta) is that no definition can be versioned or retired in place: `World.cartridge` is one immutable release with no tombstones, no per-definition version and no dial fields, so "modify an existing area" has nowhere to land, and the economy/ecology probes that would make simulation-before-commit meaningful do not exist yet. Building those two things, tombstones plus dials and the probe suite, is the R&D core; the AI integration itself reuses the trusted-command and receipt pattern already in the engine.
