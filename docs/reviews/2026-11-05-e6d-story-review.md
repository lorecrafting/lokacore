# Review: Editor E6d part one, Quest and Dialogue cards (PR #669, loka-wfrgk.6)

- PR: [#669](https://github.com/lorecrafting/lokacore/pull/669), branch `editor/e6d-story`
- Reviewed commit: `609736d5c4b2be6ab3b350450863b14dcb3b1a90`
- Governing: [gui-editor design §4.4, slice G5](../rnd/gui-editor-design-2026-11-04.md), [mechanic composition](../system/architecture.md#building-mechanics-by-composition), [E6b review](2026-11-05-e6b-npc-item-review.md) and [E6c review](2026-11-05-e6c-rules-review.md) (the bar: a card that writes a value the compiler refuses, or cannot express what it accepts, is not a nit; an author-error guard is a nit), [WORKFLOW review stance](../WORKFLOW.md)
- Independence: the reviewer authored none of this slice.
- CI at the reviewed head (`gh run list --commit 609736d5...`): ci success, book-e2e success, graph-diff success.
- `/code-review medium`: reported in the PR body (10 findings: 3 fixed, 1 open, 6 disputed).
- Out of scope by brief: the Scene text block and the modal scene card (part two).

## Verdict: CHANGES REQUIRED (five should-fixes; 1-3 walked, 4 by a direct `allowed()` run, 5 by the design's baseline bar)

## Must be true (written before the diff)

1. Every edit goes through `useCard` (`/change`, `/undo`, commit on blur). The cards hold no logic: the gates live in tested `kernel/ts/play` functions.
2. The add menu and the link field offer only what the compiler accepts in that place: keyword (keywords.ex:15-16), entry, expedition/patrol (expedition.ex:99-100, patrol.ex:18-19), the hidden-skill rules (skills.ex:151-161) and `then` links (dialogue_links.ex).
3. The cards can express everything §4.4 names: for the Quest card objective, deadline, **offer target**, expedition route and journal keys; for the Dialogue card prompt, choices, `then` links and gates.
4. Prose fields are text keys with `~` / Edit in Book. Agents write no words.
5. A path leaves the generic baseline only if a bespoke part really draws it, and the red controls fail when a card is unregistered.

## Checks that held

- Real Chrome walk on `toolbox_showcase`, light and dark:
  - wizard_lux `policy` equals false to true compiled ("Preview updated"), and undo restored it.
  - `joinery` then `wizard_lux` compiled with a warning.
  - A link to an unknown dialogue is refused at the field and never written.
  - Undo left the tree clean after each step.
- The `~` path: Edit in Book on an off-page prompt shows "dialogue.wizard_lux.prompt is not on this page; opened in your editor." and calls `/open` (inbook.ts:272-277). This is designed behaviour.
- `elixir bin/red_controls.exs`: all ok, including the new rows `editor gate: quest-card` and `editor gate: dialogue-card`.
- Keyword gate (`allowed.ts:34,42-43`) matches keywords.ex:15-16 (speech@1; no entry or riddle beside it). The hand mutant that drops the riddle check is red.
- Walk screenshots: `01-carpenter-add-name`, `02-then-into-quest-dialogue`, `03-policy-condition`, `04-edit-in-book`, `06-dialogue-card-dark`.
- The PR body's cites were rerun and hold: `card.ts:383`, `link.ts:7`, `allowed.ts:45-51` against expedition.ex:99-100.

## Mutants

`bin/mutate_diff.sh origin/main` at the head gave 55 rows:
- 31 red-narrow.
- 11 SURVIVED. All 11 are number literals inside comments, so they are equivalent (allowed.ts:14,15,32-34,40-43; rules.ts:17; card.ts:383).
- 13 BASELINE-RED (the panel tsx rows, because node_modules was missing at baseline). They were rerun by hand.

The PR body gives no counts; its claim is "all red but the equivalents". Hand mutants, all red-narrow:
- allowed.ts keyword without the riddle check;
- expedition without the patrol exclusion;
- link.ts `['patrol']` changed to `[]`;
- Dialogue.tsx with `if (!no)` dropped;
- Dialogue.tsx rows filter with `||` changed to `&&`;
- Quest.tsx with the words emptied;
- Dialogue.tsx words set to WORDS.

## Findings

1. **Should-fix: no hidden-skill gate on `name`/`riddle`** (`kernel/ts/play/allowed.ts:41-43`; skills.ex:157-158).
   - Walked: on `carpenter_lessons` (it teaches the hidden `joinery`), Add `name` wrote a name.
   - The compile then failed: "carpenter_lessons.json:72 `name` is not valid here. Not compiled."
   - Fix: the menu must not offer `name` or `riddle` on a dialogue whose choice steps acquire a hidden skill. `allowed(kind, menu, caps, doc, world)` has no skill definitions, so the hidden skills (from the story or the compile) must be passed in.
2. **Should-fix: a `then` into a quest, keyword or riddle dialogue is offered and accepted.** This rules the open item at `link.ts:7`. The datalist is at `Dialogue.tsx:76-80`.
   - Walked: the datalist offers `wat_letter`, `wizard_awaiting` and `wizard_awaiting_report`. Picking `wat_letter` was written.
   - The compile then failed: "carpenter_lessons.json:70 A `then` cannot lead to `wat_letter`, which has a `quest`".
   - That link can never compile, so it meets the bar. Fix: refuse those targets in `refuseLink` and drop them from the datalist.
3. **Should-fix: the Quest card cannot create an offer** (`kernel/ts/play/card.ts:383`, with `fields.tsx:21-32`). §4.4 names "offer target", and the registry gives `quests.offer` create to `cards/Quest.tsx`.
   - Walked on `carry_letter`: Add `offer` only reveals it. I then set the target to npc `bess` and the policy to `all`.
   - The write stays held: ".offer.label must have required property 'label'". `TextKey` shows the derived key but never writes it, so the offer can never be written.
   - Ruling on the `card.ts:383` dispute: the special case is fine as a shape, but the reveal is a dead end.
   - Fix: seed the revealed offer's `label` with its `proseKey`.
4. **Should-fix: the gates work one way only** (`allowed.ts:38-48`: `deadline` and `exchange` have no NEEDS row; patrol.ex:18-19 and expedition.ex:99-100 refuse them beside the mechanic).
   - Direct run at the head: `allowed('quests', ['deadline','exchange','repeatable','offer'], all, {objective:{evidence:'patrol'}, patrol:{}})` returns `["deadline","exchange","offer"]`, and the same call on an expedition quest returns `["deadline","exchange"]`. Adding `deadline` or `exchange` writes a field the compile refuses at `patrol.quest` / `expedition.quest`; `offer` only reveals (finding 3).
   - On a dialogue with `then` links, `allowed('dialogues', ['quest','riddle','keyword'], ...)` returns all three; `dialogue_links.ex:387-394` (`then_out_of`) refuses a quest or riddle on it. This was not walked.
   - Fix: reverse rows in NEEDS (no `deadline`/`exchange` beside `expedition`/`patrol`; no `quest`/`riddle` on a dialogue with a `then`).
5. **Nit: `Dialogue.tsx:77`** puts a duplicate `end` key in the datalist when a dialogue is named `end`. Author-side; the dispute holds.
6. **Nit: `Dialogue.tsx:92`** keeps a stale refusal after an outside reload. Author-side; the dispute holds.
7. **Nit: `Quest.tsx:19`** repeats the menu lines of Dialogue and Entity. The dispute holds: a shared hook would touch Entity, which is out of scope.
8. **Should-fix (as E6b finding 3): `dialogues.choices` left the baseline, but the card draws only the `then` links** (`Dialogue.tsx:62-83`; registry row `dialogues.choices`). The brief's bar is that a path leaves the baseline only if a bespoke part draws it. The rest of each choice is the generic nested form: §4.4's tree view and gate badges are missing, and the choice key is an editable rjsf key where §4.4 says "a choice label edit is refused with the reason". Reading the code, a key edit would reach the generic `diff` as a slug rename; this was not walked.
   - Fix: return `dialogues.choices` to the baseline until the tree lands, or file the tree, badges and rename refusal in Beads for part two and say so in the PR body.

Disputes `card.ts:164` (pickKind keyed by author map keys, author-side) and `Dialogue.tsx:95` (a destructure vs `removed()`, the same size) hold.
