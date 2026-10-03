# Review: chapter-one stage plan (Gate C1) record, ROADMAP stage, decisions index

- PR: #127, branch `c1-plan`
- Commit reviewed: `c777923`
- Sources: the reviewed draft `chapter-one-plan-draft.md` (base `16f2536`), codex Astra
  (R01-R11) and Sol (two re-checks) answers, the owner decisions 2026-10-02 as relayed in the
  brief (paraphrased), PM rulings §6
- Stance: short (docs-only, no mutation testing). `bin/check_docs.exs` at `c777923`: exit 0,
  262 docs, 0 broken, 0 unreachable

**Verdict: CHANGES REQUIRED** (four should-fix, no blocker; nits and one question)

## What must be true (written before reading the diff)

1. The record carries every reviewed fix of the draft: Astra R01, R03-R11, Sol R04a/R04b/R06,
   Sol2 R04a (persisted `objectives_complete`, terminal fallbacks); spec-first, scope trigger,
   hashes rule, whole invocation path, split-before-growth for each capped file.
2. The breakable-key descope removes everything that existed only for it: the snapped-key row,
   the rooted sink, its `fresh.ts`/numeric-profile/03 §23 amendments, force in protocol lists,
   key consumption in the gate audit, the force touch row; the carry stays with a trigger.
3. The parts codex never saw (c1-chapters, c1-scenes-modal, sight in c1-doors, the App.tsx
   switch, the descope) are consistent with the installed mechanics and checkable from the text.
4. Repo claims hold (`movement.ts` sight, DIFFERENCES rows, story points, 06 §33-§37, 00a §9).
5. Every LATER carry of the old ROADMAP row is still findable with a trigger; triage 31/31;
   counts add up (48 + 12 = 60; ten Opus, two Sonnet).
6. One fact in one place: ROADMAP links the record and does not restate it; check_docs green.

## Checks

1. Met. Record :81-85 (caps), :99-104 (allocation order, contract-freeze depth), :108-120 (spec
   first, hashes, invocation path plus event and refusal protocol files), :196-201 (custody split
   from loader reachability, closed unlocked chest valid), :219-231 (journal selection incl.
   persisted `objectives_complete` and both terminal fallbacks), :278 (menu fit). Only loss:
   N-3.
2. Met. Delta-ops table has no sink row; :101 allocates slot holders only; c1-locks :189-201 has
   no force, sink, `fresh.ts`, check@1 or luck row; gate audit :309-311 drops key consumption;
   c1-touch drops force; item 1 LATER with trigger (:49, ROADMAP row); R02 marked moot (:341).
3. Partly: F-1, F-2, F-3, Q-1.
4. Met. `movement.ts:30` scan, `:82` sight follows `passage` not `fare` (so both ExitView
   branches, `gameview.schema.json:190`); DIFFERENCES 3 and 10 as cited; story points only on a
   quest-resolving dialogue choice (`cartridge.md:53-55`, `mechanics.md` dialogue@1);
   `bell_rung` is narrate ×3, await_ack, end, modal (00a:478); 06 §34 lists the three steps,
   §37 is scene control; `App.tsx:14`, `:31`; `session.ts:24`, `:27`; file sizes at the stated
   caps; `docs/spec/release-scope.json` exists.
5. Partly: F-4. All other carries (1, 5, 6, 7, 10, 11, 12, 14, 15, 16, 20, 22, 28, 31) are in
   the ROADMAP row with a trigger; triage rows 31; slice arithmetic and model split correct.
6. Met with N-2.

## Findings

**F-1 should-fix: "given by a dialogue choice" has no installed vocabulary.** Record :16-18
(Q2), :269-270 (c1-sampler: "No protocol change", "locks only installed capabilities"). The only
dialogue transfer is `hand_over`, the bound item from the actor's body to the bound NPC
(`protocol/dialogue.schema.json:187`, `kernel/ts/src/dialogue.ts:71` `not_owned` unless the
actor holds it); a reaction can only `fact.assign` (`protocol/reaction.schema.json:52`).
Scenario: the Sonnet sampler developer has Tobin give the watch-cell key on a choice; there is no
way to express it, so it either edits `dialogue.schema.json` and both kernels in a slice that
declares no protocol change, or stops. Fix (owner/PM choice, not mine): (a) the sampler places
every key and wearable in rooms (the owner's "or" allows it), with NPC-to-player giving carried
with a trigger; or (b) name a slice that owns the dialogue give at contract depth.

**F-2 should-fix: the chapter rule is under-defined.** Record :96, :236-242, :327-330.
(a) `outcome?` is optional but its absence has no meaning: is a chapter with a story point and
no outcome reached on any outcome or never? (b) "its quest resolved with that outcome" compares
a story-point outcome key with the quest instance's outcome, which is the choice id
(mechanics.md quest@1 resolution). The Lantern's keys coincide (`carry` → choice `carry`), so a
direct key comparison passes every Lantern-shaped test and fails for an outcome `good_end`
triggered by choice `carry`. Fix: state the mapping (outcome → its trigger dialogue and choice →
that dialogue's quest resolved with that choice), define or forbid the missing `outcome`, and add
an acceptance case whose outcome key differs from its choice id.

**F-3 should-fix: what one `continue` advances is undefined.** Record :97, :248-249, :261-263
against c1-touch :292-293. 00a:478 `bell_rung` has three narrates and one await_ack. If a beat is
the group up to an await_ack, the presenter pages lines locally, a kill on line 2 reopens on line
1, and the kernel's "same beat after reopen" check still passes. If a beat is one step, narrate
is no longer immediate (06 §33 "deterministic immediate beats"). Fix: one sentence defining a
beat, and the c1-touch kill row asserting which line is shown, not only the beat.

**F-4 should-fix: items 13 and 30 have no trigger, yet the gate demands one.** Record :314 lists
13 and 30 among "carries ... with triggers". ROADMAP row (`docs/ROADMAP.md:24`) narration@1 has
no trigger (the record's "with scene@1", :78, is not carried over); item 30 gives a reason in
the record (:79, 00a §8) and no trigger in either place. Scenario: the Gate C1 checklist reviewer
fails the carry item. Fix: e.g. "with scene@1 (next stage)" and "the first NPC with two
dialogues".

**Q-1 question: scene start inside `rules/dialogue.ts`.** Record :255, :258-259. Dialogue@1 code
setting a scene@1 fact names another mechanic (emergence principle 1). 06 §38 lists further hooks
(activation, objective completion, failure); each would need another special case on the
dialogue side. 00a's own shape is a story point outcome consequence (`scene.start`), i.e.
content names the scene. Not blocking; the c1-scenes-modal brief should carry the composes-with
statement saying where the trigger lives and why.

**N-1 nit: record :326 "the touch UI has no Look button" is false.** The room title is the Look
button (`docs/design/room-view/README.md:9`, `mobile/app/book/pages.tsx:71`). The ruling holds on
its "one place" reason; drop the false premise. The decisions index line "sight lines in Look"
(`docs/decisions/README.md:95`) reads fine either way.

**N-2 nit: the new `## C1 slices` table restates the record.** `docs/ROADMAP.md:29-47`; main's
ROADMAP has no earlier per-stage table. The c1-sampler and c1-touch cells repeat Q2 and will
drift when F-1 lands. Shorter cells (slice name plus one noun phrase) or the record link only.

**N-3 nit: the hashes rule lost its fixture list.** Record :113-116 vs draft :89-90
(`protocol/fixtures/cartridge_lantern_hash.json`, compiled fixtures, `lantern-traces.json`
pins). c1-sampler re-points `App.tsx:14`; naming the files keeps the rule checkable.

**N-4 nit: no slice owns the DIFFERENCES row 10 edit.** Record :315-316 asks the gate to find row
10 narrowed, but neither c1-doors (:160-176) nor c1-touch (:288, which deletes row 3) lists it.
Add it to c1-doors' docs.
