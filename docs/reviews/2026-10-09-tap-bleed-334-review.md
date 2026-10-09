# Review: Tap bleed, entity lines keep the page rhythm (PR #334)

- PR #334, branch `polish/tap-bleed`, head `d3cf4a07`. Beads loka-n5l. Pure UI polish, correctness pass.
- Governing: [design input n5l](../briefs/polish/design-input-n5l-2026-10-09.md); [BOOK-UI-COMPONENTS.md](../BOOK-UI-COMPONENTS.md) line 15 (pressables), 81-83 (`space.md` as bleed), 115 (Entity line).
- Verdict: **CHANGES REQUIRED** (one test gap, R1).

## Must be true

1. A `type.body` Tap shows 28 px. Touching lines sit 28 apart, and a run sits `space.block` from a paragraph.
2. The hit area is never cut: `minHeight: size.touch` stays the floor. The later sibling wins an overlap, and no target drops under 24 px.
3. No consumer (EntityLine, VerbLine, room title, Position, water Surface) moves its text or loses its target.
4. Only `Tap` bleeds. The lint rule and the play fail on a planted break.

## Proof

- (1) and (4): mutant M1 (bleed removed) fails `Run` with `expected 44 to be 28`. M2 (`-space.sm`) fails with `expected 32 to be 28`. Baseline: `EntityLine.stories.tsx` 8/8 pass. A planted `marginVertical: -space.sm` at `lines.tsx:40` raises `error[mobile-book-bleed-only-tap]`, and the clean scan exits 0. `ast-grep test`: 16 pass. Both PR claims rerun and hold.
- (2): mutant M3 drops `minHeight: size.touch`. These all stay green:
  - the EntityLine, Page, RoomPage, StatusLine, VerbLine and PageFoot stories (28/28);
  - `polish*.test.ts` and `catalogue.test.ts` (26/26).
- (3): every consumer's text position is unchanged, because the padding equals the negative margin. Each consumer's effective target is in R2.

## Findings

1. **blocker**, `mobile/app/stories/EntityLine.stories.tsx:63-84`: nothing fails if `minHeight` is dropped (M3 above).
   - A body line reaches 44 from padding alone (28 + 16), so the `Run` play cannot see the floor.
   - Position (`Status.tsx:122`, `type.small` 19) relies on the floor. Without it, its target is 35 px and the suite stays green.
   - The design input's proposed check said the play "breaks if ... the minHeight dropped".
   - Fix: assert one Position button's height (or a 19 px child in a Tap) is `size.touch`.
2. **should-fix**, `docs/briefs/polish/design-input-n5l-2026-10-09.md:64-65` and `docs/BOOK-UI-COMPONENTS.md:15`: the claim "44 px wherever a Tap has non-Tap neighbours" is false. The catalogue's "hit area is at least `size.touch`" also overclaims. RN-web Views are `position: relative`, so any later sibling covers the bleed:
   - water Surface (`Body.tsx:46`): PageBody covers the bottom 8 px, leaving 36;
   - each Worn item (`sections.tsx:148`): the next slot's View covers it, leaving 36;
   - room title (`pages.tsx:263`): the ScrollView covers it. That leaves 40 by layout arithmetic. The PR body says both "4 px covered" of 48 and "≥40".

   All of these stay ≥24 (WCAG 2.5.8). Fix: make the rule text say what the code delivers.

## Open items judged

- (1) Hit areas covered by a later sibling: covered by R2. Not a layout break.
- (2) Worn mis-tap: not a finding. The bottom of a slot label opens the item in that same slot. The item's own bottom bleed is covered by the next slot, so a tap never reaches the item above.
- (3) Note height: nit. Design input lines 25 and 37 say 19 (`type.small`). `palette.ts:10` sets `note` to `type.body`, so the note line is 28 and the play's 72 is right. The catalogue gives no number.
- (4) axe `label-content-name-mismatch`: reproduced. Given a note and no `rest`, the DOM text is `A brass lanternIt is unlit.` (no space), and the label is `A brass lantern It is unlit., open`.
  - It is pre-existing and latent: the only caller that passes `note` (`pages.tsx:193`) always passes `rest`.
  - The `Run` fixture matches production, so it hides nothing that is live.
  - Follow-up Beads issue for the PM. Not a finding against #334.
- (5) Verb lines `space.block` apart: out of scope. The PM logs it.
- `/code-review medium` is reported in the PR body.

## Fix round 1 (head `72a3a38a`, commits `10b58b65`, `72a3a38a`)

- Verdict: **APPROVE**.
- R1 fixed: `StatusLine.stories.tsx:80-87` adds a `Position` play. It asserts that a `type.small` position button is `size.touch` tall.
  - Baseline: the StatusLine and EntityLine stories pass 17/17.
  - Red control, rerun here: with `minHeight` removed from `Tap`, the play fails with `expected 35 to be 44`.
- R2 fixed: `BOOK-UI-COMPONENTS.md:15` now says "box is at least `size.touch`". It gives the guaranteed targets as shown box plus uncovered bleed: 28 in a run, 36 for Surface, Worn and Position, 40 for the room title, 44 where the paper around it is free. These match my layout arithmetic. The brief's lines 64-68 agree.
- Nit (3) fixed: the brief now says the note is 28 (`type.body`), with a footprint of 56 and a hit box of 72. This matches `palette.ts:10` and the `Run` play.
- Verb-line bullet: the brief says the verb lines touch. Confirmed: `pages.tsx:148` wraps them in one `View`, so they sit 28 apart, and no follow-up is needed.
- Open: the axe follow-up (open item 4) is for the PM to file.
