# Review: mechanics batch M13 head (cross-row interactions)

- Branch `toolbox/batch-m13`, exact head `56f6bea9f6e2a5fa2c52d0d158ab63b63d1be33d`, base `main` `e753bd69` (diff `e753bd69...56f6bea9`). No PR yet (batch model). Rows: 16, FD2, FD3, 33, FD5, FD7 kernel half, W15 + FD9, loader floors cases; each row record is in this directory and is not reopened here.
- Governing: [row 16](../system/mechanics.md#sneak-and-hide-toolbox-row-16), [rows 33 and 34](../system/mechanics.md#theft-fence-and-witnessed-offense-toolbox-rows-33-and-34), [FD5](../system/mechanics.md#witness-ledger-and-reaction-moves-toolbox-row-fd5-loka-kgd22), [FD7](../system/mechanics.md#ask-about-a-topic-toolbox-row-fd7), [W15 + FD9](../system/mechanics.md#recognition-and-earned-titles-toolbox-rows-w15-and-fd9), [reaction@1 table](../system/mechanics.md#reaction1-kerneltssrcmechanicsreactionts), [realm seams brief checklist](../decisions/owner-decision-realm-seams-2026-10-13.md#brief-checklist), [WORKFLOW review stance](../WORKFLOW.md), [reviewer stance](../../.claude/agents/reviewer.md).
- Verdict: **APPROVE WITH NOTES** (finding 1 is a one-line spec amendment; nothing blocks).
- Written 2026-10-15 by anthropic/claude-fable-5-1.

## Must be true (written before the diff)

1. One bystander rule: the theft notice (row 33) and the FD5 `witness` filter both read `witnesses()`; a thief concealed from a bystander (no `pierced_by`, or attribute not above level) is unseen by it; a piercing bystander sees; the subject is never its own witness; the victim sees like any bystander and notices only by attribute vs level.
2. Entry engagement cures concealment, so a theft after being spotted is seen by every bystander.
3. Witness identity is by NPC instance; W15 names, `knows_name` and FD9 titles never enter the witness rule or the notice.
4. `npc.move` moves the NPC only; its holdings travel with it through `containers`; no witness read beyond the known pre-command world (loka-kgd.154).
5. Attribution: `asked` subject is the asked NPC delivered to the asker; the theft notice's subject is the thief's body (`doer`); `item_acquired` subject is the holder; no `world.character` read in mechanics or in the view for a named actor.
6. GameView: `actor_name`, `known_npcs`, NPC holdings and `ask` are computed for the viewing actor; nothing is listed that admission refuses (hostile ask unavailable with a reason; a take of an NPC holding goes through the same `theftRefused`).
7. Floors 1.91 to 1.97 are refused by both kernels on the fixture cases; `longwait_property` still compiles every sampler and holds.
8. The W15 seam-1 two-actor test (37a963ea) exists and goes red when the view reads `world.character`.

All eight hold (evidence below). Item 1 holds to the letter of both sections and exposes the gap in finding 1.

## Evidence

- Code: `kernel/ts/src/mechanics/senses.ts:167-170` (`witnesses`), `containment/theft.ts:63-75` (seers, notice `subject_id: body`), `reaction.ts:87-91` (filter, `npc !== body`) and `:205-235` (`SUBJECT`: `asked: entity_id`, `item_acquired: holder_id`, `custom_event: doer`), `disposition.ts:50-57` (engage cures concealment), `containment/react.ts:73-101` (`moveNpc` guards: living, engaged, following escort, `moves`), `view/knowledge.ts:14,65`, `view/action_lists.ts:223-225`, `speech/ask.ts:37-57`. `protocol/reaction.schema.json` carries `witness` on exactly the seven event branches, so a `witness` on the theft notice (`custom_event`) is refused at the schema; both loaders floor `witness` at 1.95 (`cartridge_reactions.ts:98`, `lib/loka/content/reactions.ex:105`).
- Green at head: `kernel/ts/test/identity.test.ts`, `loader_floors.test.ts`, `longwait_property.test.ts` (exit 0); `mix test --force test/loka/loader_floors_test.exs` (2/2).
- Red control, item 8 (view seam 1), each reverted, tree clean:

| Mutant | Result |
|---|---|
| `view/knowledge.ts:14` `displayedName(world, world.character, …)` | killed: "the den earns a title; a hood hides it" (`identity.test.ts:138`, OTHER's `actor_name`) |
| `view/knowledge.ts:65` `describeEntity(world, world.character, …)` | killed: "the stranger is unnamed until it gives its name" (`identity.test.ts:123`, OTHER's `known_npcs`) |

- Cross-row mutants, each run against the test files importing the module, each reverted, tree clean:

| Mutant | Result |
|---|---|
| `senses.ts:169` drop `!concealed(...)` | killed: `theft.test.ts` 6 (hidden thief) and `witness.test.ts` (hidden taker vs baker) |
| `reaction.ts:90` drop `npc !== body` | killed: `witness.test.ts` "the baker is never his own witness" |
| `theft.ts:67` `every` → `some` | killed: `theft.test.ts` 4 and 6 |
| `react.ts:92` drop `engaged` guard | killed: `reactions_sampler.test.ts` (crow mid-fight stays) |

- Constructed probes on the compiled theft sampler at 1.95 (probe file deleted, not committed):
  1. Hidden thief lifts the ring beside the guard with `witness: guard` on `item_acquired`: guard alertness 3 gives `theft.seen` and the reaction fires; alertness 0 gives `theft.unseen` and it does not. Filter and notice agree.
  2. Lone merchant, purse, `witness: merchant` on `item_acquired` (stealth 0 vs alertness 0): narration `theft.unseen`, no notice, yet the reaction fires (`wanted` true). See finding 1.

## Findings

1. **Should-fix (spec gap, one line).** `docs/system/mechanics.md:3162` (row 33 Known limits) and `:3177` (FD5 witness filter). A `witness` naming the victim on `item_acquired` holds whenever the victim sees the thief; it ignores row 33's attribute-vs-level notice check, so content such as "the merchant shouts when robbed" fires in the same decision whose line says `theft.unseen` (probe 2). Both sections hold to their letter (seeing is not noticing; the notice has no victim slot), but neither says so. Minimum fix: one Known-limits line in row 33 or FD5 stating that the victim as `witness` sees but need not have noticed, and that "the victim noticed" is reachable only through the notice (which also fires when a bystander alone saw). Whether the filter should instead apply the notice check for the item's previous holder is a designer call; not required for this batch.

## Open items (not findings)

- No PR body yet: the `/code-review medium` result and the `catches / every` claims are to be reported when the batch PR opens (row records already carry this).
- `reaction@1` table has no `asked` row; FD7's text at `mechanics.md:3235` declares the subject, and `SUBJECT` matches it.
- Question, dialogue is not a batch row: `npc.move` of an NPC in an open dialogue leaves the pending choice to `apart` (`dialogue/selection.ts:127-128`), which reads the containers, so the choice is refused rather than continued across rooms; not run.
- Known and not re-reported: loka-kgd.154, loka-kgd.155, loka-kgd.156, loka-ynfo, loka-3wwm; "ask offered with no known topic" belongs to the FD7 Book half (loka-s05w).

Verdict: APPROVE WITH NOTES.
