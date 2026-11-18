# Binding a Book line to its key

Written 2026-11-15 09:40 UTC in the Pi harness by openai-codex/gpt-5.5-codex.

A design note for `loka-wfrgk.100.8` and its siblings (`.100.6`, `.100.7`, `.100.4`). It records why the
obvious fix does not work, what the code actually allows, and the one change worth making.

## The defect

A Book line's field is looked up **by its words**. `bind` (`mobile/app/author/prose_rules.ts:14`) fills
`seen: words -> text key`, and `drawnWords` (`:19`) answers a key only when exactly one key claims the
words. When two keys draw the same words, `bind` sets that entry to `''` and **both lines lose their
field for the rest of the session**.

Two consequences the bug report understates:

- The loss is **global and permanent**, because `seen` is a module-level `Map` (`panel.tsx:31`) that is
  never cleared. One collision anywhere costs every later click on those words.
- It is **not one entry point**. `keyOf` in the in-Book editor (`mobile/app/author/inbook.ts:44`) is
  `hooks.seen.get(drawn(el)!)` — the same word lookup. Double-click-to-edit in the Book breaks with the
  panel's click, from one cause. A fix at either call site alone leaves the other broken.

## Why tagging the text does not work

I tried this first and reverted it. Extending the existing zero-width `~` marks (`tagged`,
`prose_rules.ts:33`) to every drawn line looks correct and is a 30-line diff, and its unit test passes.
It fails the suite three ways:

1. The marks land in `accessibilityLabel` (`lines.tsx:141-144`), so `Talk to Old Bram` becomes
   `Talk to‌ Old Bram‌` and the conversation tests' role-name lookups miss. Screen readers get the same
   garbage.
2. `panel.tsx` binds **unmarked** words while the DOM holds **marked** ones, so the panel's own keys
   disagree with what it drew.
3. Marking does not resolve ambiguity; it relabels it. The lookup is still by text.

The general lesson: **a rendered string cannot carry identity.** Words are the thing that collides, and
they are also the thing the user selects, copies and reads aloud.

## What the code already allows

`inbook.ts` is the precedent, not a workaround to copy. It already tags elements with dev-only
attributes — `data-loka-field`, `data-loka-todo`, `data-loka-unconfirmed`, `data-loka-selected`,
`data-loka-a11y` (`inbook.ts:90-112`, gated by `process.env.EXPO_PUBLIC_LOKA_DEV_CARTRIDGE === '1'`) —
and `inbook.test.ts` finds them by attribute. A release build strips the whole `inbook` module
(`panel.tsx:38-40`).

So the attribute mechanism exists and is proven. What is missing is only that `keyOf` consults it.

## The change

Carry the key on the element. One place.

1. **`noted`** (`book/words.ts:191`) already receives `(words, key)` for every line — engine lines too
   (`:213`) — but the key stops there: it is a side effect into `seen`, and the render never sees it.
   `rendered` (`book/logs.ts:46`) holds `line.key` and **drops it** — `DetailLine` (`:58-64`) is strings and
   plain objects with no key on any variant. So this is not "one place": it needs a key on `DetailLine`,
   set in `rendered`, and read in `LogLine` (`lines.tsx:130`), where nothing about a key is known today.
   Corrected 2026-11-15 after reading the render chain; the original text of this step claimed the key
   already reached the render, which it does not.
2. **Tag the element** in `lines.tsx`, next to the existing `name` spread, dev-only and only when the key
   is known: `data-loka-key`. This is exactly what `inbook.ts:112` does for its field, and it does not
   touch the text, so no `accessibilityLabel` changes.
3. **Read the attribute first**, in both lookup sites. `keyOf(el)` becomes
   `el.closest('[data-loka-key]')?.getAttribute('data-loka-key') ?? hooks.seen.get(drawn(el)!)`. The
   `seen` map stays as the fallback, so quality never regresses below today.
4. **`panel.tsx:217`** uses `e.target`, which is the innermost node — often a text node's parent, not the
   tagged line. It must walk up: `(e.target as HTMLElement).closest('[data-loka-key]')`, falling back to
   `clicked(seen, …)`.

That is the whole fix: one attribute written where lines render, one `closest()` at each of two lookups.

## The composed line, which is a separate problem

`lineWords` joins several keys into one sentence — `${cap(speaker)} says, ${said}` (`words.ts:216-224`),
and choice labels, shelf and people lists join a key's words into a longer line. Those lines cannot carry
**one** key because they are not one key.

Do not try to solve this with the attribute: a joined line legitimately has several. Leave it on the
`seen` fallback, which usually resolves the whole composed string for the part that is unique, and treat
`.100.7` as its own change. Attempting both at once is what makes the first attempt look small and fail
wide.

## Measurement before building

`.100.8` says 156 shared-word groups. That number decides whether this is worth the diff: if most
collisions are **cross-view** (a shelf label and a room line that never share a screen), scoping `seen`
to the current view or clearing it per render fixes most of it with no attribute at all, and is smaller
than the above.

So the first step is not code. Walk one session on the showcase, click the words that lose their field,
and count how many are simultaneously visible. If they are not, fix the scope of `seen` and stop there.

## Acceptance

- Two keys drawing identical words, both on screen: clicking each selects **its own** definition.
- Double-click either line: the in-Book editor opens **its own** source line.
- The release build carries no attribute and no `seen` lookup (the module is already dropped).
- A joined line's behavior is unchanged, and `.100.7` stays open.

## When measuring first, note this

The measurement this note asks for above (cross-view vs same-view) was run statically over the showcase's
`text.json`: **156** wordings are drawn by two or more text keys. Of those, **59** were one sampler family
(`item.egg_01..04`, never on one page) and were fixed by clearing the bindings per page (`nextPage`,
`prose_rules.ts:60`, shipped 323d3ac10, no attribute needed) — which is what this note predicted: measure
before building.

**Same-room, measured (2026-11-17): 14 wordings, every one an item variant family** — six eggs in the
larder, five candles, four ores at the forge stall, three pelts in the glade, two trout in the pond, three
turnips and three stews in the larder, and the loaf wordings. Each is one sampler family's own variety
fixture, not an authoring ambiguity: a real room does not hold six indistinguishable eggs. So the
`data-loka-key` attribute stays unbuilt, which is this note's own "do not build it speculatively" — now
with a number behind it. What the 14 do justify is a **lint**, not an attribute: two items drawing the
same words in one room is nearly always a copy-paste slip, and `mix loka.lint` can say so in one line.

Two corrections to how the live walk was described here before. It could not pass the first page because
the showcase opens a tutorial card with a "Got it" button; one click clears it. And it then walked
nothing: `pagesWalked` counted loop iterations — forty steps covered two distinct page states. Fixed in
`bin/measure_collisions.mjs`, which now reads rooms from the author API's `/story` graph, sends `go_to_room`
to the Book frame itself (`mobile/app/author/panel.tsx:245`; posting to `window.parent` reached the portal,
which drives nothing), and prints `distinctPages` with a "the walk is not moving" verdict so a standing
walk can no longer produce a share. It reports 64 distinct pages over 64 rooms. A live walk still cannot
answer the same-view question, because `nextPage(seen)` runs on every game change, so `lost` only records a
collision inside one render — which is why the 14 above are counted statically.

## What I would refuse

Rewriting the words to carry identity. It is the smallest-looking diff and the one that breaks the
accessible name, the panel's own bindings, and the user's ability to copy a line.
