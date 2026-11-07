# Scene structure in the Scene text card: design rulings (loka-wfrgk.100.5)

The owner decided on 2026-11-06 that a scene's structure is edited in the GUI ([owner decision](../decisions/owner-decision-scene-structure-gui-2026-11-06.md)). That covers lines and pages, speaker lines and choice labels, in `.scene` dialogues and `.cut` cutscenes. The decision reverses ruling 11 of the [GUI editor design](../rnd/gui-editor-design-2026-11-04.md#8-owner-rulings-needed). Ruling 9 ("rename a key is out of v1") stands: on 2026-11-07 the owner chose to separate a choice's key from its words instead of renaming keys (§2).

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
| **`.scene` choice label.** A choice label row is a words field, like a `* ` line. Committing it rewrites the words of the `- ` line and never its key (§2) | Ruling 11 is reversed; the key stays fixed, so nothing that names the choice changes | Type new words on a slug-keyed choice: the line becomes `- <new words> #<old slug>` and every other file is byte-equal |
| **`.cut` pages.** Each paragraph is one page, a `narrate` step (`cut_files.ex:21-29`). The page offers Add page after (`~`), Remove, Move up, Move down, Split at this line (two or more lines) and Join with next. The closing `---` is drawn and has no buttons. Removing the only page is refused | A page is the cut's only unit; the end mark is fixed (`cut_files.ex:70-79`) | Move page 3 above page 2, then undo: the bytes are equal to the original |

## 2. A choice's key is fixed; its words are free

Owner 2026-11-07 (paraphrased): separate a choice's key from its words instead of building rename. Today a choice's key is the slug of its words (`scene_lines.ex:80-85`), so new words would mean a new key, and every referrer (the twin's `choices.<c>`, `riddle.choice_id`, quest `journal.outcomes.<c>`, `choice_resolved` reactions, the derived `once`/`asked` facts, saves) would break.

| Ruling | Why | Test |
|---|---|---|
| **An explicit key.** A `- ` line may end with ` #<key>` (`<key>` matching the Key pattern). The compiler then keys the choice by `<key>` and the label's words are the line without that suffix; without a suffix the key is the slug, as today, so every existing scene compiles unchanged. The suffix never reaches the player (it is not part of the label text) | One small grammar rule in `scene_lines.ex` `choice_key`; keys are structure, words are the owner's | A fixture `- Carry it #carry` compiles to choice `carry` with label words `Carry it`; the same file without the suffix keys `carry_it`; a duplicate explicit key is the existing duplicate-key refusal |
| **The card pins the key before the first word changes.** Committing new words on a slug-keyed choice writes `- <new words> #<old slug>` in the same line edit, so the key is unchanged; on an explicitly keyed choice it rewrites only the words | No referrer moves, so there is nothing to carry and nothing to refuse | Reword every choice in the samplers: the compiled artifact's choice keys and every non-scene file are byte-equal |
| **New choices get a key at once.** The card's Add choice writes `- ~ #choice_<n>` (the next free `choice_<n>` in the dialogue), so a choice the card makes never depends on its line number or words | A `todo__<n>` key moves when lines move (§2 key check); an explicit key does not | Add a choice after line 3, then insert a line above it: its key stays `choice_<n>` |
| **Hand-written `- ~` choices.** Writing words into one by the card pins `#choice_<n>` when the choice has no referrer yet, else its current `#todo__<n>` | A placeholder key with referrers must not move | A `- ~` with a twin entry keeps `todo__<n>` after its words are written |

| Ruling | Why | Test |
|---|---|---|
| **Every op checks keys.** Each structural op computes every choice key before and after. A changed key (an unpinned `- ~` choice below an insert, remove or move) is refused when it has any referrer from the table above, with the words "give choice N its words first". A changed key without referrers goes through | Without this, S2 would quietly orphan `choices.todo__N` | A fixture with a twin entry on `todo__7`: inserting at line 3 is refused at the card and at the route |

## 3. The write route

| Ruling | Why | Test |
|---|---|---|
| **`/edit` stays line-exact.** It still refuses a key line. Its choice-label refusal (`kernel/ts/play/prose.ts:25`) stays, and the answer names the card: a label goes through `/restructure`, because it carries keys | `/edit` writes one line of one file; a label can write three files | `/edit` on a `- ` line answers 400 and the files are unchanged |
| **`POST /restructure {file, was, op, carry}`.** It is a new route in `kernel/ts/play/write.ts` beside `/set`; `/change` stays JSON-only. `op` is one of `{add: {after, kind, value?}}`, `{remove: n}`, `{move: n, by: -1\|1}`, `{split: n}` or `{join: n}`. The route recomputes the changes from disk with the compile's keys, the way `/set` does. Then it compares them with `carry`, the `[{file, was}]` the card showed: any file that differs, or a stale `was`, is a 409 with the current bytes. It writes every file through `done()` (`write.ts:75-79`) as **one journal entry**, so one Undo reverts the whole op | One pure function, `kernel/ts/play/scene_structure.ts`, serves both the card's preview and the route, which makes the pre-check two-way (as `refusePick` is for `/set`) | An op is one `/undo` id; a stale `was` gives 409 and no file is written |
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
| A shifted unpinned `~` key that has referrers | none: the card and the route only, pinned by a route test |
| A `.cut` whose twin carries `steps` | none: the twin owns the pages (`scene_merge.ex` deep merge replaces lists) |

## 5. The interaction model

| Ruling | Why | Test |
|---|---|---|
| **Row actions.** Each `<li>` in `Lines` ends in a row of item buttons that appears on row hover or focus-within and is always in the DOM (chrome §7): Add (`plus`, a menu of the kinds in §1), Move up (`arrow-up`), Move down (`arrow-down`) and Remove (`trash-2`). They are [chrome §7](editor-chrome-rulings.md#7-inspector-card-fields-2026-11-05-loka-wfrgk23) item buttons with [§6](editor-chrome-rulings.md#6-iconography) icons. A button that cannot act is `disabled` with its reason in the tooltip, not hidden. A `.cut` page row adds Split (`split`) and Join (`merge`) | One item-button idiom across the editor; a disabled button teaches more than a missing one | At a 28 px row height the buttons do not wrap at a card width of 320 |
| **Names.** The aria-label pattern is `<verb> line N` (`Add after line 4`, `Move up line 4`, `Remove line 4`), `<verb> page N` for a cut (`Split page 2 at line 3`), and `choice N words` for a label field. The Add menu's items are the grammar's own words: `choice`, `speaker line`, `words line` and the sub-line verbs. Numbers count from 1 | Chrome words only where the editor needs them; keys are shown verbatim | Each button's accessible name is unique within the card |
| **Keyboard.** Tab reaches a row's field, then its buttons, in reading order. With focus on a row's line number or one of its buttons, never inside an input or words field, Alt-Up and Alt-Down move the row and Alt-Enter opens Add, with the same refusals. Remove has no key: it destroys, and its button is enough. Inside a field Alt and the arrows or Backspace keep their platform text meaning Esc closes the Add menu and returns focus to the row. After an op, focus stays on the moved or added row, and an added row focuses its `~` field | Every key has a button; on macOS, Option plus an arrow or Backspace edits text; the left column's arrows belong to the map and the graph | Keyboard only: add a choice after line 2, type its words, Tab to its Move up, Alt-Up, Undo. Option-Backspace in a words field deletes one word and the line count is unchanged |
| **Answers.** The route's refusal shows boxed at the top of the card, as `/set`'s does now (`Scene.tsx:52`). Undo in the header reverts the last op's single journal entry | One refusal and undo surface per card | A 409 reloads and shows `Changed outside: reloaded.` |

Tokens: `chrome` in [`tokens.ts`](../../mobile/app/book/tokens.ts) only. The `~` chip uses `warning`, focus is the 2 px `accent` ring, and no new token is added.

## 6. Slices

| Slice | Scope | Acceptance |
|---|---|---|
| **S1: route and `.cut` pages** | `scene_structure.ts` with the `.cut` ops; `POST /restructure` with `carry`, 409, and one journal entry; page buttons on a `.cut` card | Every other byte is kept for every op (the `/set` test's form, `scene_card.test.ts:75`); an empty cut and a `---` move are refused at the card and as `cut_end`; one Undo restores (the card keeps the `restructure` answer's id, as `Scene.tsx:41` keeps `set`'s); the route is listed in the design's §5.1 table |
| **S2: `.scene` lines** | add, remove and move on `.scene`; the key check in §2; drafts first; the keyboard | A moved choice keeps its block and its indentation byte for byte; a cross-depth move is refused; an insert above a `~` choice with a twin entry is refused at the card and at the route; a planted duplicate key is refused at the card and by the compile; the keyboard-only pass in §5 |
| **S3: explicit choice keys and the label field** | the ` #<key>` grammar rule in `scene_lines.ex` and its TS mirror if any; the label words field that pins the key (§2); Add choice writes `#choice_<n>` | The §2 tests; every sampler compiles byte-equal before and after; rewording a choice changes only its own line; a contract or schema change, if the grammar needs one, gets the Fable review |

## Proposed checks

- **S1.** A route test runs each op over every fixture `.scene` and `.cut` and asserts that the diff touches only the op's lines (ruling 12, mechanically).
- **S3.** A property test: reword every choice in the samplers through the card; every compiled choice key and every non-scene file is unchanged.

## Known limits

- Rewording through a text editor (not the card) still changes a slug key; the card is the safe path. Old dev saves past such a change may not replay (owner accepted 2026-11-07).
- `choice_resolved` reactions are not validated by the compiler (`reactions.ex:136`); with fixed keys they no longer need to be.
