# Aimed targets batch (loka-x6t.109, pick lists, Douse), 2026-10-23

Owner (live polish session 2026-10-23, quoted): "Ok lets do the engine aimed spells thing."; targeting: "one of the
options is inventory usable inventory items so you click that option and it opens a list and you pick an item and then
the item detail closes with an echo the log that you have used the item on target"; "Okay lets work on the new
targetting systmw and also codify that in the book ui doc". Rule in force (designer spec, polish session batch): an
action aimed at a thing draws on that thing's page, never on World; Cast in the say field is for untargeted words only;
the "Pick list" component (`docs/BOOK-UI-COMPONENTS.md`) and "Pick a second thing" (`docs/system/book-ui.md`).
Drafted by Fable (contract change: command, recipe schema, GameView), PM edits. Read the [brief kit](../brief-kit.md)
for every slice. Handoff threshold: 220k (WORKFLOW token hygiene).

Beads: slice 1 loka-x6t.109.1, slice 2 .2, slice 3 .3, slice 4 .4, slice 5 .5.

Run order on batch branch `toolbox/batch-aimed-spells`: slice 1 (Douse, S) -> slice 2 (engine, M) -> slice 3
(showcase content, S). Slices 1 and 3 both regenerate `protocol/fixtures/toolbox_showcase_hash.json`, so they are
sequential. Slices 4 and 5 (Book) run only after the polish session batch (with the designer's pick-list spec) merges;
5 also after 3; 4 and 5 never in flight together. Slice 2's schema and kernel_api change needs a `docs/reviews` record
at merge.

## Facts the briefs rest on

- Cast today: engine verb `cast` is `[{kind:'none'}, ['word']]` (`kernel/ts/src/commands/verbs.ts:27`), offered only
  in a cartridge with a spell (`commands/actions.ts:104`), kept in a fight (`:186`). Admission: `castAdmission`
  (`mechanics/action_recipe/shared.ts:98-111`) finds the spell by word (`spellOf`, `:82`) and reads its policy with no
  target; the rule (`action_recipe/rule.ts:76,119,134`) makes the caster's body the subject; effects
  (`action_recipe/spell.ts:57-90`) land on the step's named `npc`/`item`, else the caster. Command schema
  `cast {type, actor_id, word}`, `additionalProperties:false` (`protocol/command.schema.json:647-658`).
  `invocation.ts:57-80` `TARGETS` has no `cast` entry; `named` fills `{action: key}` for a recipe (`:112-117`).
- Spell target schema: `{kind:'spell', word, learned}` (`protocol/action.schema.json:610-628`); `damage` requires
  `npc` (`:789-805`); `light.ignite` requires `item`. Loaders: `kernel/ts/src/content/cartridge_recipes.ts:76-86,136-165`,
  `lib/loka/content/spells.ex:24-35`. Floors: `cartridge_variants.ts` / `variants.ex` top at 1.118;
  `kernel/ts/src/runtime/world.ts:108` `kernel_api: '1.118'`; `protocol/fixtures/loader_floors.json`.
- Elixir has no runtime command admission: "both kernels" here means both loaders plus `elixir bin/contracts.exs`;
  story rules stay TypeScript-only (AGENTS.md).
- GameView offer-per-target precedents: use pairs on the tool's entry with `target_ids [target, tool]`
  (`view/use.ts:12-50`, `view/action_lists.ts:114,121`); give pairs `target_ids [item, recipient]`
  (`view/item_pairs.ts:52`); generic entity-scoped offers via `listed(entityOffered...)` (`action_lists.ts:111`,
  `advertise()` `:180-199`, which emits `command` only for light verbs, harvest, expedition). `accepts`
  (`commands/action_input.ts:41-61`) binds a payload to a set entry. Invariant `gameview_agrees_with_admission`
  (`view/invariants_view.ts:118-160`).
- `spell_words` (`view/spells.ts:19-37`) lists learned spells for the say field; the Book draws chips from it
  (`mobile/app/book/buttons.ts:146`) and the Character page's refused Spells section (`skills.tsx:157`).
- Book cards: `heldButtons` (`buttons.ts:196-230`) makes one card per available action on every projected thing; an
  aimed offer `{action_key:'flamma', command:'cast', target_ids:[wight]}` on the wight's entry would draw today as
  "Flamma the wight" with no Book code.
- The item pick list is Book-only: every pair it lists is already in the GameView (use pairs, give pairs; after slice 2
  aimed spells on the target entry).
- Aimed skills audit: every showcase skill recipe targets a room detail (a fixture with no page), so none moves.
- Showcase spells: `flamma` policy `npc_present wight`, `damage {npc: wight, kind: fire, amount: 8}`; `lux` cost ma 2
  ash 1, `light.ignite {item: lantern}` then `{item: attic_lantern}`; `ward` self status. Wight hp 8, fire resistance
  50 (`docs/showcase/magic-district.md`). The walkthrough casts flamma by chip
  (`mobile/app/walkthrough/toolbox_showcase.walk.ts:217,221`), as does `mobile/app/book/cast_death.test.ts:42-43`.
- Engine test sampler: `cartridges/spell_effects_sampler` (flamma at a wight hp 8, fire 50 -> 4 after one bolt; lux
  ignites `orb`). Edit it in-test, never on disk.
- Douse: `cartridges/toolbox_showcase/text.json:33` `"actions.quench": "Quench"`. `band.quenched` is the THIRST band
  (`resources.json:72`), not a fire band: leave it ("quenched" thirst is correct). `use_sampler`'s "Quench a cart" is
  that sampler's own text: untouched.

## Slice 1: loka-x6t.109.1, douse wording (S, content)

Goal. `cartridges/toolbox_showcase/text.json` `actions.quench` "Quench" -> "Douse". Keep `narration.quench`,
`item.smithy_bucket.description` and `band.quenched`. Regenerate `protocol/fixtures/toolbox_showcase_hash.json`
(`bin/regen_hash_fixture.sh`, then replace the old sha in the showcase transcripts and live `.sql` files, then
`npm run stories:views`, as the room words batch did). `docs/showcase/magic-district.md:118,157` "Quench the bier" ->
"Douse the bier". Fix any walkthrough or story that taps "Quench" in the showcase.

Acceptance: both kernels compile the showcase with no new diagnostic; `kernel/ts/test/transcripts.test.ts` replays; the
fixture's sha256 equals `mix loka.compile`'s. No new test (a label is a deliberate decision; the hash fixture is the pin).

## Slice 2: loka-x6t.109.2, aimed spells engine (M)

Lane: engine. Read `docs/lessons/contracts.md`, `docs/lessons/mechanics.md`. At the M ceiling: no content, no Book, no
refactors.

Goal. A spell may declare `aimed {scopes}`; such a spell is cast at one entity (`cast {word, target_id}`), is offered on
each admitted target's GameView entry (`command: 'cast'`, `target_ids: [target]`), never in `spell_words`, and its
effect steps that name no `npc`/`item` act on the target. kernel_api 1.118 -> 1.119.

Contract surfaces:
- `protocol/action.schema.json` spell target: optional `aimed: {scopes: [room_occupants|room_contents|inventory]+,
  additionalProperties:false}`. `damage.npc` and `light.ignite.item` become optional in the schema; the loaders require
  them on an unaimed spell.
- `protocol/command.schema.json` `cast`: optional `target_id` (EntityId). `protocol/gameview.schema.json`: descriptions
  only. `kernel/ts/src/contracts.gen.ts` via `elixir bin/contracts.exs`.
- Loaders, both kernels (`cartridge_recipes.ts spells()`, `spells.ex`): `aimed` needs kernel_api >= 1.119
  (KERNEL_API_RANGE_INVALID); a `damage` without `npc` or `light.ignite` without `item` on an unaimed spell is
  SCHEMA_VIOLATION at that step's `.npc` / `.item`. Floors top 1.119 in both ladders; one `loader_floors.json` case on
  `cartridges/spell_effects_sampler` by edits (add `aimed {scopes:[room_occupants]}` to `recipes/flamma.json`).
- `commands/actions.ts`: an aimed spell the actor has learned joins the ActionSet as an Offered `{key: recipe.key,
  label, target: {kind:'entity', scopes: aimed.scopes}, input: [], priority, policy, command: 'cast', recipe}`;
  `perform` keeps ignoring spells. `action_input.ts accepts`/`boundAction`: a `cast` with `target_id` binds to the
  aimed spell's key, one without to the engine verb.
- `castAdmission`: unknown/unlearned word -> `invalid_state` first (never tells which words are spells); then
  `target_id` on an unaimed spell, none on an aimed one, or a target outside `aimed.scopes` -> `invalid_target`;
  `hiddenTarget` makes an unseen target `not_present`; the policy is read with `{target: target_id}`.
- `rule.ts`: an aimed spell's subject is `p.target_id`; `spell.ts effect()`: `status.apply`, `damage` without `npc` and
  `light.ignite` without `item` act on the subject. `fightBack` unchanged.
- `view/spells.ts spellWords` skips aimed spells. Offers: prefer the generic `listed(entityOffered)` path; `advertise()`
  emits `command: 'cast'` for it; a target the policy or scope refuses is not listed; cooldown/costs list it unavailable
  with that code. Write `aimedActions()` only if the generic path cannot carry it; say which.
- `invocation.ts`: `TARGETS.cast = ['target_id']`; `named` for a spell recipe is `{word: recipe.target.word}`
  (see loka-kgd.158).
- `invariants_view.ts advertised()`: a `cast` with `target_id` matches the target entity's entries with
  `command === 'cast'`.
- Spec: `docs/system/mechanics.md` rows 29a and 29b, `docs/system/cartridge.md` "Spell declarations",
  `docs/system/protocol.md` (invocation table, `spell_words`).

Acceptance (`kernel/ts/test/aimed_spells.test.ts` or `spells.test.ts`; sampler edited in-test: flamma aimed
`room_occupants`, `damage {kind:'fire', amount: 8}` without `npc`; `gameView` validated against the schema):
1. In the crypt with the wight: the wight's EntityView `actions` has `{action_key:'flamma', command:'cast',
   target:{kind:'entity',scopes:['room_occupants']}, input:[], target_ids:[<wight>], available:true}`; `spell_words`
   has no `flamma`.
2. `cast {word:'flamma', target_id: wight}` accepted; wight hp 8 -> 4; `action_completed.subject_id` is the wight.
3. `cast {word:'flamma'}` -> `invalid_target`; `cast {word:'lux', target_id: orb}` (unaimed) -> `invalid_target`;
   flamma at a floor item -> `invalid_target`.
4. `cast {word:'zzz', target_id: wight}` -> `invalid_state`, not `invalid_target`.
5. `perform {action:'flamma', target_id: wight}` -> `not_found`.
6. `resolve` of `{action_key:'flamma', actor_id, target_ids:[wight], input:{}}` is
   `{type:'cast', actor_id, word:'flamma', target_id: wight}`.
7. Lux edited aimed `inventory`, `light.ignite` without `item`, policy `has_tag {subject:'target', tag}`: cast at the
   tagged held orb lights it; at a held untagged item -> `invalid_state` and not listed on that item's entry.
8. Ward edited aimed `room_occupants`, `status.apply` without `npc`, cast at the wight: the status is the wight's,
   none on the caster.
9. Loader, both kernels, red controls: unaimed `damage` without `npc` -> SCHEMA_VIOLATION at `...sequence[0].npc`;
   `aimed.scopes: ['inspectable_details']` -> SCHEMA_VIOLATION; `aimed` on a `use` recipe -> SCHEMA_VIOLATION. Floor
   case 1.119/1.118 -> KERNEL_API_RANGE_INVALID in compiler and loader.
10. In a fight, a second aimed cast is still admitted.
11. Schema mutant sweep on `aimed`, `cast.target_id`, the optional `npc`/`item`; mutants on the `invalid_target`
    branches, the `spell_words` skip, the invariant branch.

Spec text, mechanics.md 29a (replacing the "read with no target" sentence): "A spell may be aimed (`target.aimed
{scopes}`, kernel_api 1.119, loka-x6t.109): it is cast as `cast {word, target_id}` at one entity in those scopes of the
caster's room or body (`invalid_target` otherwise, after the word's own `invalid_state`), its policy is read with that
target, and it is offered on each admitted target's GameView entry as `{action_key: <recipe key>, command: 'cast',
target_ids: [target]}`, never in `spell_words`; an unaimed spell keeps the untargeted cast and refuses a `target_id`. The
invocation fills `word` from the recipe and `target_id` from `target_ids`." 29b: "On an aimed spell, `status.apply` and
`damage` without `npc` and `light.ignite` without `item` act on the target; an unaimed spell requires `npc`/`item` on
`damage` and `light.ignite` (SCHEMA_VIOLATION) and applies a bare `status.apply` to the caster."

Stop and ask if `accepts`/`boundAction` cannot bind a `cast` with `target_id` without a new field on Offered; if the
generic advertise path lists the aimed offer with the wrong `target` spec; or if a tag cannot be put on the sampler's orb.

## Slice 3: loka-x6t.109.3, showcase aimed spells (S, content)

After slices 1 and 2. Read `docs/SHOWCASE.md`.

Goal. `flamma` gets `aimed {scopes:['room_occupants']}` and drops `npc` from its damage step (policy kept); `lux` gets
`aimed {scopes:['inventory']}`, one `light.ignite` without `item`, and policy `has_tag {subject:'target', tag:'lamp'}`
with tag `lamp` on `lantern` and `attic_lantern`; `ward` unchanged. `at_least` 1.119; hash fixture regen (as slice 1).
Update `kernel/ts/test/showcase_magic.test.ts`, `docs/showcase/magic-district.md` steps 2, 3, 7, and re-point the Book
consumers that cast by chip (`toolbox_showcase.walk.ts:217,221`, `cast_death.test.ts:42-43`) to the generic card
("Flamma the wight"). Hand back the spell/offer table.

Acceptance (`showcase_magic.test.ts`): (1) the held lantern's entry lists `lux` unavailable `insufficient_resource` at
ash 0, available after `gather_ash`; cast at the lantern -> ma 3, ash 0, lantern lit; `cast {word:'lux'}` ->
`invalid_target`; the bucket lists no `lux`. (2) flamma at the wight -> 4, fight opens, bier burning; second bolt -> 0,
`entity_died.killer_id` the body, experience 40; third cast -> `invalid_state`; the hedge-wizard in the loft lists no
`flamma`. (3) `spell_words` after the grimoire holds no flamma or lux. (4) Showcase compiles in both kernels; transcripts
replay.

Stop and ask before touching the attic wight (flamma never worked there; an owner content call), or if the generic card
does not appear on the wight's page (then slice 5 must merge before the e2e lane goes green: report, don't fake it).

## Slice 4: loka-x6t.109.4, pick lists for use and give (M, Book)

After the polish session batch (designer's spec) merges. Read `docs/BOOK-UI-COMPONENTS.md` agent rules and its "Pick
list" entry, `docs/system/book-ui.md` "Pick a second thing", `docs/lessons/mobile.md`. Where this brief and the
designer's text differ on look, wording or focus order, the designer's text wins; on what is sent or where the result
goes, stop and ask.

Goal. Build the Pick list and its consumers per the spec: "Use an item…" on a target's page (use pairs whose
`target_ids[0]` is this entity, by tool), "Use on…" on a held tool's page (that entry's pairs, by target), "Give an
item…" on a person's page and "Give to…" on a held item's page (give pairs). They replace the per-pair cards (including
the both-pages cards added in the polish session). A pick sends the offer's intent unchanged (`action_key`, its
`target_ids` in GameView order, `input {}`), returns to World as Give does (`received.ts:99`), and the result is the
receipt's narration (or the spec's default line) in the World log. An unavailable pair is a `label: reason` row, not
pressable. Escape and device Back close the list and focus returns to the option.

Acceptance (Book tests on `compiled('cartridges/use_sampler')` as `use_on.test.ts:12`; literals from its text.json):
1. The burning cart's page shows "Use an item…"; it lists the bucket (not the oilcan, whose pair is refused); the pick
   sends `{action_key:'quench', target_ids:[cart, bucket]}`; the page is World; the cart no longer burns; the log's last
   line is the quench narration.
2. The winch's page lists the oilcan only.
3. The torch's page shows no "Use an item…".
4. The bucket's page shows "Use on…" listing the cart and no per-pair card.
5. Give (farmer and apple fixture): the farmer's page "Give an item…" lists the apple; pick -> World; log **You give an
   apple to the farmer.** once.
6. An unavailable pair (cooldown or cost set in-test) appears as `label: reason`, not pressable.
7. Escape closes the list and focus returns to the option.
8. Screenshot, 390 px, the list open on the cart's page.

## Slice 5: loka-x6t.109.5, "Cast a spell…" (S, Book)

After slices 3 and 4. Goal: the Pick list's fifth consumer: on an entity's page, "Cast a spell…" lists that entry's
offers with `command: 'cast'` (label = the spell's label); a pick sends `{action_key: <recipe key>, target_ids:[target]}`
(the engine fills `word`). The generic "Flamma the wight" card goes. Assert the say field and the Character Spells
section show no aimed spell. Re-point `cast_death.test.ts` and the walkthrough to the list.

Acceptance (showcase): on the wight's page "Cast a spell…" lists Flamma; pick -> the fight opens, the log shows
`narration.flamma`; no `flamma` chip; after the kill the option is gone. The held lantern's page lists Lux; at ash 0 it
reads `Lux: need 1 ash`. Spec text (book-ui.md Word bar, with the designer's approval): "An aimed spell (cartridge
`aimed`, loka-x6t.109) is never a chip or a Spells-section line: the GameView offers it on each admitted target's entry
(`command: cast`, `target_ids: [target]`) and the Book lists it in that page's Cast a spell… pick list."

## Owner additions (2026-10-23, after the draft)

Owner (quoted): "1. Yes please" (a reverse "Cast on…" list from the Character page's Spells block) "Okay in combat yes
give each foe line a cast a spell option, and also a perform a skill otpion." So slice 5 also covers:
- Character page, Spells block: each aimed spell the GameView offers anywhere in reach gets "Cast on…", a Pick list of
  its admitted targets (the target entries carrying that spell's `command: 'cast'` offer); pick -> World, result in the
  log.
- Combat page: each foe line gets "Cast a spell…" (that foe's cast offers). The designer writes the combat placement and
  the Character reverse list into book-ui.md / BOOK-UI-COMPONENTS.md before slice 5 (after #459 merges; single writer).
- "Perform a skill…" on foe lines needs skills aimed at an NPC: a separate engine row (Beads child of loka-x6t.109,
  "Aimed skills"), briefed after slice 2 shows the aimed-spell shape. Not in this batch.
Later (Beads P3, not this batch): a bottom-bar icon opening the spell and skill lists; a configurable hotbar.

## Risks

- Slice 2 is at the M ceiling; if the generic advertise path cannot carry the offer, the PM splits view + invariant
  into its own run.
- Between slices 3 and 5 the aimed spells draw as generic cards; if that card does not appear, order 5 before merging.
- A refused aimed spell with no target present shows nowhere. Accepted.
- The hash fixture is regenerated twice (slices 1 and 3); sequential on one branch.
