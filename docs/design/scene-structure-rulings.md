# Scene structure in the Scene text card: design rulings (loka-wfrgk.100.5)

The owner decided on 2026-11-06 that a scene's structure is edited in the GUI ([owner decision](../decisions/owner-decision-scene-structure-gui-2026-11-06.md)). That covers lines and pages, speaker lines and choice labels, in `.scene` dialogues and `.cut` cutscenes. The decision reverses ruling 11 of the [GUI editor design](../rnd/gui-editor-design-2026-11-04.md#8-owner-rulings-needed), and it narrows ruling 9 ("rename a key is out of v1") for one kind of key only, a choice key.

- Ruling 12 still holds: a scene is edited as text, and an edit never reflows the owner's lines.
- The grammar is in `lib/loka/content/scene_files.ex:3-33` and `cut_files.ex`; this doc does not restate it.
- Chrome comes from the [editor chrome rulings](editor-chrome-rulings.md): type, colour, item buttons, refusals and focus (§1, §3, §5, §7).
- Nothing in this doc enters the Book.
- No player-facing words are written here. A new line's words are `~`, and the owner writes them.

## 1. What the card offers

| Ruling | Why | Test |
|---|---|---|
| **`.scene` add.** The line's row menu (below) offers four kinds, placed after the line. A **choice** is `- ~` at the line's choice depth, after the line's whole block. A **speaker line** is `<role>: ~`, with the role picked from the scene's `npc:`/`with:`. A **words line** is `* ~`. A **sub-line** is `then:`, `needs:`, `once`, `once: sitting`, `asked`, `gives:`, `sets:` or `quest:`; its value comes from the line's `Value` picker, and only the ones the block lacks are offered. The indent copies the line's own | The grammar's line kinds, nothing new; `~` is the placeholder the toolbar already counts | Add each kind after line 3 of a fixture: every other byte is unchanged, and the result compiles or shows the one diagnostic the grammar predicts |
| **`.scene` remove.** Remove a line. On a choice, Remove takes the choice and its whole block, sub-lines and any nested set. Key lines (`npc:`, the first `when:`) have no Remove | A choice without its block would orphan the block onto the choice above it | Remove a choice with three sub-lines: four lines go, and no other byte changes |
| **`.scene` move.** Move up and Move down move a choice with its whole block past its sibling choice, or a sub-line within its own block. A move that would cross a nesting depth or a block's edge is refused. The indentation goes with the line | The owner's order is the order the Book draws (`order` is the compiler's own, `scene_merge.ex` `order_refused`) | Move choice 2 above choice 1: the two blocks swap byte for byte; Move up on a first sibling is disabled |
| **`.scene` choice label.** A choice label row is a words field, like a `* ` line. Committing it rewrites the `- ` line, and the carry (§2) is shown before it is sent | Ruling 11 is reversed; the key is still the slug of the words (`scene_lines.ex:80-85`) | Type new words: the row shows `key: old → new` in `chrome.type.code` before Enter |
| **`.cut` pages.** Each paragraph is one page, a `narrate` step (`cut_files.ex:21-29`). The page offers Add page after (`~`), Remove, Move up, Move down, Split at this line (two or more lines) and Join with next. The closing `---` is drawn and has no buttons. Removing the only page is refused | A page is the cut's only unit; the end mark is fixed (`cut_files.ex:70-79`) | Move page 3 above page 2, then undo: the bytes are equal to the original |

## 2. Renaming a choice carries its referrers

The new key is `SceneLines.key/1` of the new words. A `~` label's key is `todo__<n>`, which depends on the line number (`scene_lines.ex:84-85`). The compiler's referrers to a choice key, and what the rename does with each:

| Referrer | Where the compiler reads it | On rename |
|---|---|---|
| Twin `dialogues/<k>.json` `choices.<c>` | merged over the scene (`scene_merge.ex:13-20`) | **carried**: the entry is moved to the new key. A stale entry left behind merges into a choice with no `label`, which is a schema refusal, so this is gated two ways |
| Twin `riddle.choice_id` | `defs.schema.json` `source.DialogueDefinition.riddle` | **carried** |
| Story point `<k>/<outcome>` | from the choice's own `story_point` (`dialogues.ex:209-228`); trigger `{dialogue, choice}` (`resolve.ex:210-212`) | moves with the choice, so nothing is rewritten. A chapter's `outcome` names the story point's outcome, not the key (`dialogues.ex:84-93`) |
| Quest `journal.outcomes.<c>`, when the dialogue carries `quest` | the outcome is the choice key (`kernel/ts/src/mechanics/dialogue/rule.ts:198`); its text is at `quests.ex:138` | **carried**: the key is renamed in `quests/<q>.json`. The compiler does not check this key against choices, so the card is its only guard. A test pins it |
| The same quest and key in another dialogue | `dialogues.ex:128-130` | **refused**: the outcome is shared |
| Reaction `on: {event: choice_resolved, choice: <c>}` | not scoped to a dialogue and not validated (`reactions.ex:136`) | **refused**, with the referrers listed (ruling 9's form). Rewriting it could not be gated two ways |
| Nested set `<k>_<c>` (the choice opens a deeper `- `) | `scene_files.ex` nested set, linked by `then` | **refused** in v1. Its twin, its `then:` and outline bindings, and its own children would all have to follow |
| Derived facts `name(k, c)` for `once` and `asked` | `dialogue_once.ex:26-32`, `dialogue_asked.ex:26-31` | renamed implicitly. A `needs:`/`when:` or any JSON read of the old name is **refused** with its referrers. Saves keep the old name (Known limits) |
| Text keys `dialogue.<k>.choices.<c>.label` | regenerated from the scene (`prose.ex`) | nothing to rewrite |
| Transcripts `cartridges/*/transcripts/*.jsonl` `choice_id` | not the compiler's | not carried; transcript replay shows the break (Known limits) |

| Ruling | Why | Test |
|---|---|---|
| **Every op checks keys.** Each structural op computes every choice key before and after. A changed key that is not the one being renamed (a `~` choice below an insert, remove or move) is refused when it has any referrer from the table above, with the words "give choice N its words first". A changed key without referrers goes through | Without this, S2 would quietly orphan `choices.todo__N` | A fixture with a twin entry on `todo__7`: inserting at line 3 is refused at the card and at the route |

## 3. The write route

| Ruling | Why | Test |
|---|---|---|
| **`/edit` stays line-exact.** It still refuses a key line. Its choice-label refusal (`kernel/ts/play/prose.ts:25`) stays, and the answer names the card: a label goes through `/restructure`, because it carries keys | `/edit` writes one line of one file; a label can write three files | `/edit` on a `- ` line answers 400 and the files are unchanged |
| **`POST /restructure {file, was, op, carry}`.** It is a new route in `kernel/ts/play/write.ts` beside `/set`; `/change` stays JSON-only. `op` is one of `{add: {after, kind, value?}}`, `{remove: n}`, `{move: n, by: -1\|1}`, `{label: n, words}`, `{split: n}` or `{join: n}`. The route recomputes the changes from disk with the compile's keys, the way `/set` does. Then it compares them with `carry`, the `[{file, was}]` the card showed: any file that differs, or a stale `was`, is a 409 with the current bytes. It writes every file through `done()` (`write.ts:75-79`) as **one journal entry**, so one Undo reverts the scene, its twin and the quest together | One pure function, `kernel/ts/play/scene_structure.ts`, serves both the card's preview and the route, which makes the pre-check two-way (as `refusePick` is for `/set`) | A rename that touches three files is one `/undo` id; a stale twin gives 409 and no file is written |
| **The compile is the gate after the write.** No route compiles before it writes. The card pre-checks, the route re-checks and writes, the watcher compiles and pushes diagnostics, and the card shows them on the row with one Undo. A refusal the compiler would also make is refused before the write | The present gate for every write route; a pre-write compile would cost seconds per click | Plant an op the card misses on purpose: the diagnostic reaches the row, and Undo restores the bytes |
| **Drafts first.** An op waits for any pending `/edit` from the card's words fields and sends the sha that `/edit` answers. A row's words field is keyed by its text key, which after a move belongs to other words, so the list remounts after every op | An unsent draft must never land on a moved line | Type in line 4, then Move up line 5 without blurring: line 4's words are saved and the op still applies |

## 4. Refusals, gated two ways

Each refusal is checked in `scene_structure.ts` and returned by the route, so the card shows it before sending. Where the compiler makes the same refusal, a test plants the case and asserts both answers.

| Refusal | Compiler twin |
|---|---|
| A duplicate or empty choice key after the op | scene line refusal (`scene_files.ex:270-275`) |
| A `.cut` with no page, or `---` not last | `cut_end` (`cut_files.ex:70-79`) |
| A scene-grammar line added to a `.cut` (the card does not offer it) | `cut_scene_line` warning (`cut_files.ex:48-52`) |
| A stale twin `choices.<c>` | schema `DialogueChoice.required: label` |
| A move across a depth or a block's edge; Remove on a key line | none: the card and the route only |
| A rename of a choice that has a nested set, a reaction referrer, a shared quest outcome, or a read of its derived fact; a shifted `~` key that has referrers | none (§2): the card and the route only, each pinned by a route test |
| A `.cut` whose twin carries `steps` | none: the twin owns the pages (`scene_merge.ex` deep merge replaces lists) |

## 5. The interaction model

| Ruling | Why | Test |
|---|---|---|
| **Row actions.** Each `<li>` in `Lines` ends in a row of item buttons that appears on row hover or focus-within and is always in the DOM (chrome §7): Add (`plus`, a menu of the kinds in §1), Move up (`arrow-up`), Move down (`arrow-down`) and Remove (`trash-2`). They are 24 px ghost buttons with 16 px lucide icons, `strokeWidth` 1.5 and `absoluteStrokeWidth`. A button that cannot act is `disabled` with its reason in the tooltip, not hidden. A `.cut` page row adds Split (`split`) and Join (`merge`) | One item-button idiom across the editor; a disabled button teaches more than a missing one | At a 28 px row height the buttons do not wrap at a card width of 320 |
| **Names.** The aria-label pattern is `<verb> line N` (`Add after line 4`, `Move up line 4`, `Remove line 4`), `<verb> page N` for a cut (`Split page 2 at line 3`), and `choice N words` for a label field. The Add menu's items are the grammar's own words: `choice`, `speaker line`, `words line` and the sub-line verbs. Numbers count from 1 | Chrome words only where the editor needs them; keys are shown verbatim | Each button's accessible name is unique within the card |
| **Keyboard.** Tab reaches a row's field, then its buttons, in reading order. With focus in a row, Alt-Up and Alt-Down move it, Alt-Enter opens Add, and Alt-Backspace removes, with the same refusals. Esc closes the Add menu and the carry preview and returns focus to the row. After an op, focus stays on the moved or added row, and an added row focuses its `~` field | Every key has a button; nothing uses Alt plus arrows in the left column, whose arrows belong to the map and the graph | Keyboard only: add a choice after line 2, type its words, Alt-Up it, Undo |
| **Carry preview.** Before a label is sent, one `surface` box under the field lists `key: old → new` and then each file it will write, one `chrome.type.code` line per file. Enter or the `Rename` button sends, and Esc cancels. A refusal replaces the box with the field refusal: a 1 px `refusal` border, `circle-alert`, and the message and referrers under the field | The owner sees the files and the keys before three files change | A label with a twin and a quest lists two files plus the scene; a reaction referrer shows the refusal and no Rename button |
| **Answers.** The route's refusal shows boxed at the top of the card, as `/set`'s does now (`Scene.tsx:52`). Undo in the header reverts the last op's single journal entry | One refusal and undo surface per card | A 409 reloads and shows `Changed outside: reloaded.` |

Tokens: `chrome` in [`tokens.ts`](../../mobile/app/book/tokens.ts) only. The `~` chip uses `warning`, focus is the 2 px `accent` ring, and no new token is added.

## 6. Slices

| Slice | Scope | Acceptance |
|---|---|---|
| **S1: route and `.cut` pages** | `scene_structure.ts` with the `.cut` ops; `POST /restructure` with `carry`, 409, and one journal entry; page buttons on a `.cut` card | Every other byte is kept for every op (the `/set` test's form, `scene_card.test.ts:75`); an empty cut and a `---` move are refused at the card and as `cut_end`; one Undo restores; the route is listed in the design's §5.1 table |
| **S2: `.scene` lines** | add, remove and move on `.scene`; the key check in §2; drafts first; the keyboard | A moved choice keeps its block and its indentation byte for byte; a cross-depth move is refused; an insert above a `~` choice with a twin entry is refused at the card and at the route; a planted duplicate key is refused at the card and by the compile; the keyboard-only pass in §5 |
| **S3: choice label rename** | the label field, the carry preview, the carry for the twin, `riddle.choice_id` and quest outcomes, and §2's refusals; `/edit`'s answer names the card | One rename writes the scene, twin and quest in one entry; a stale twin entry is planted to prove the schema twin; a test for each of the four refusals (nested set, reaction, shared outcome, fact read); undo is byte-equal |

## Proposed checks

- **S1.** A route test runs each op over every fixture `.scene` and `.cut` and asserts that the diff touches only the op's lines (ruling 12, mechanically).
- **S3.** A property test: for every choice in the samplers, rename it and then rename it back, and the tree is byte-equal.

## Known limits

- Dev saves and recorded transcripts keep old choice keys and old `once`/`asked` fact names. Transcript replay shows the break; no save migration is planned.
- `choice_resolved` reactions are not validated by the compiler, so §2 refuses rather than rewrites them. A compiler check would let S3 carry them instead.
