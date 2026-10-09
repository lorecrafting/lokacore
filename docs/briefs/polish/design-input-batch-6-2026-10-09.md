# Design input: batch 6 (chapter card, prose paragraphs, story Controls)

Sources: `docs/briefs/polish/storybook-plan-2026-10-08.md` D17, F6, G4; `docs/BOOK-UI-COMPONENTS.md#component-catalogue`
(Page, Room page, Continue button); `docs/system/book-ui.md#chapters-scenes-and-recovery`; mock
`docs/design/ui-exploration/chapter-one-playable.html:351-359` (`.chapter`); Beads loka-bhb, loka-g96.
Owner 2026-10-09: Controls yes, in batch 6.

## 1. Chapter card (G4)

**Component.** Extend `ChapterPage` (`mobile/app/book/sections.tsx:267`); no new file. It is the Page's
centred variant (`pages.tsx:210` `centred`) with no `title` prop, two blocks: the card, then the Continue button.
`ScenePage` (`sections.tsx:275`) does not share it: a scene is prose and Continue. `Body.tsx:70` passes `title` today; it adds `label` (see open question 1).

**Tokens (read from the mock `.chapter`, base size 18).** Add to `tokens.ts` (designer edit):
- `type.chapterLabel: { fontFamily: font.caps, fontSize: 13, letterSpacing: 2.6 }` (mock `small` 13px SC, `.2em`).
- `type.chapterTitle: { fontFamily: font.head, fontSize: 38, lineHeight: 40 }` (mock `b` 2.1em/1.05).
- `size.chapterRule: 80` (mock `i` width 80).
Reuse: `space.sm` (mock gap 6 and the rule's margin-top 6), `size.rule` (the rule's 1 px), `dim` (label and rule), `fg`
(title), `space.page` (the mock's 32 px side padding is not adopted: the Page margin stands), `space.block` (Page gap
before Continue). Not adopted: the mock's fleuron `span` (26 px accent, not in the owner's four parts), the italic
subtitle `em` (no live text), the 3.6 s auto-dismiss (Continue stays), the backdrop blur (an effect).

**Layout.** The card is one block, `alignItems: 'center'`, `gap: space.sm`: label (`type.chapterLabel` `dim`,
centred), title (`type.chapterTitle` `fg`, centred, wrapping, `accessibilityRole="header"`, `useTitleFocus()` as
`ScenePage` does at `sections.tsx:284`), rule (`View` `size.chapterRule` wide, `size.rule` high, `dim`,
`marginTop: space.sm`). Then `ContinueButton` not stretched (`alignSelf: 'center'`). Status locked and running head as
today (`Book.tsx:199`, book-ui.md unchanged on that).

**Accessible name** (changed after design review 2026-10-09). The card is not pressable (the mock's `button` is its
dismiss; the Book's is Continue). Label and title together are the page header: one `View accessible
accessibilityRole="header"` with `useTitleFocus()`, holding both `Text`s, no `accessibilityLabel`, so its name is its
visible text in order ("Chapter one, The Missing Child — in progress") and a screen reader arriving on the card hears
the label. Continue keeps its name "Continue": the label-in-name rule holds with nothing added.

**Stories.** `stories/ChapterPages.stories.tsx` `ChapterTitle` (generated view) stays and shows the card. Add one
hand-props story in the same file, `ChapterTitleLong` ("Long title": a title that wraps at SE width, `done: fn()`),
since the fixture's one title cannot show wrapping. Smoke/axe as every page story.

**Catalogue row (new, after Continue button; written in this PR).**

```
| Chapter card | The chapter title page's one block, centred on the paper (the Page's centred variant): a chapter label in `type.chapterLabel` `dim`, the title in `type.chapterTitle` `fg` (the page header, arriving focus), then a `dim` rule `size.chapterRule` wide and `size.rule` high; label, title and rule `space.sm` apart, the rule `space.sm` further; the mock's `.chapter` without its fleuron, subtitle and auto-dismiss. The Continue button follows as the next block, centred, not stretched. Nothing on it is pressable but Continue. | shown | `stories/ChapterPages.stories.tsx` |
```

**book-ui.md** `#chapters-scenes-and-recovery`, one word change: "A chapter title page shows its chapter label,
title, Continue and the running head only".

## 2. Prose paragraphs everywhere (loka-g96, D2)

Deferred by the owner 2026-10-09 (loka-g96 stays open). The design when it returns: one `Prose` helper in
`lines.tsx` for every authored body (`pages.tsx:134`, `Menu.tsx:83`, `skills.tsx:37`, `notices.tsx:139`,
`DreamPage.tsx:26,28`, `sections.tsx:76,117,284`), paragraphs `space.lg` apart, its own catalogue row and leaf story.
Fact for then: no text in `protocol/fixtures/missing_child_v042_hash.json` contains a newline, so only a leaf story
can show the split. `ScenePage` keeps its single `Text` for now.

## 3. Story Controls (owner: yes)

One arg, `words`, on every page story through `pageStory` (`stories/screen.tsx:54`): `pageStory(saved, shell)`
returns `args: { words: {} }` and `argTypes: { words: { control: 'object' } }`; `render` passes `args.words` to
`screenFrom(saved, shell, words)`, which builds its sayers from `(key) => words[key] ?? table[key]`
(`screen.tsx:21`). Every keyed text on the page follows: titles, descriptions, names, notice text, dialogue prompt
and choice labels, chapter title. The owner adds `"room.ferry_landing.description": "..."` in the Controls panel;
views stay generated and byte-stable (E5 untouched: `words` lives in the story, never in `views/*.json`).

So the panel starts non-empty, the stories the owner polishes words on pre-fill their keys with the table's text:
`pageStory(view, undefined, ['room.ferry_landing.title', 'room.ferry_landing.description'])` →
`args.words = Object.fromEntries(keys.map((k) => [k, table[k]]))`. Pre-fill: Room/First room (title, description),
NPC/Choice (`dialogue.elspeth.prompt`, its four choice labels), Item/Plain (name, description), Notices/Notice with
Read (description), Chapter title (`chapter.missing_child`). Others: `{}`.

Limit (say it in the story file's one comment line): already-narrated lines (`saved.log`, `saved.details`, the
combat log) are strings, not keys, so the panel cannot reword NPC history; prompt and choices it can.

## Proposed checks (developer slice)

- Raw-value lint (E3) covers the new card: no `38`, `40`, `80`, `2.6` outside `tokens.ts`. Red: inline `width: 80`.
- `words` override: a story test (`play`) on Room/First room sets `args.words` and expects the description text in
  the canvas. Red: build sayers from `table` alone.

## Owner answers (2026-10-09)

1. Chapter label: "Chapter one" from `chapter.index`, a presenter word in `words.ts` (developer code). The view has
   only `chapter.title` and `chapter.index` (`views/chapter-title.json`); the mock's "Chapter the First" is authored.
2. The fixture's chapter title "The Missing Child — in progress" (`chapter.missing_child`) stays for now
   (follow-up loka-bhk).
