# Design review: the Book's spirit state, PR #604 (loka-kgd.205)

- PR [#604](https://github.com/lorecrafting/lokacore/pull/604) `death/spirit-state` at `badc44a8d383605db5e711d1f7f74a1bcb783340`.
- Governing: [book-ui.md Spirit state](../system/book-ui.md) (after Falling), [spirit-state rulings](../design/spirit-state-rulings.md), [catalogue](../BOOK-UI-COMPONENTS.md).
- Reviewer: Book UI designer, independent design review of the UI part; authored none of the diff. Mechanics, save and protocol go to the normal `reviewer`.
- Not reopened (PM-accepted): the clock starts at Let go; the lint allowlist gains spirit, heard and bus; a death outside a fight is out of scope.
- CI at this head (`gh run list --commit`): ci, book-e2e and graph-diff success.
- `/code-review medium` is reported in the PR body (developer's); not rerun here.
- Seen live: `pages-room--spirit-state` and `book-actioncard--waiting` in light, dusk and dark, from this worktree's Storybook.

## Must be true (written before the diff)

1. The spirit layer is the highest in the held chooser; no fatal hold, vignette or glow shows with it.
2. The wash is pale on light/dawn and deep on dusk/dark, at `opacity.spirit` 0.6, and every text role keeps 4.5:1 on it in every palette, including mid cross-fade.
3. It arrives set with the page turn in every mode; still; inside the page column; opaque cards solid; Storm draws no light.
4. Only the title, plain paragraphs, the log and the one rise card show; status row, running head, minimap, joystick, say field and Contents are not drawn.
5. Before zero the card is the unavailable form with the status icon's ring draining (steps under reduced motion); a press gives warning, no sentence, nothing sent.
6. At zero the card becomes available with no extra announcement; the Book never rises itself.
7. Revival lines dry at k × `seconds` / (n − 1); held lines log in order at the rise; each line is read once.
8. Rise: selection haptic; the layer fades over `motion.palette` (a plain `motion.fade` under reduced motion; Flashes off the same); controls return at once; focus to the room title.
9. The bed is muffled on landing and opens over `motion.bed` at the rise; no new cue.
10. An encounter, chapter or scene ends the state at once, solid; a reopen shows the World page solid.

## Checks that held

- (1) `heldLayer.ts` chooser puts `spirit` first.
- (2) `tokens.ts` spirit day/night and `opacity.spirit` match the rulings; `heldLayer.test.ts` holds 4.5:1 at peak per palette. Live, light and dark both read cleanly; the card stays solid.
- (3) `UnderInk.tsx:90` sets the layer with the turn; no breathing; `Leaf.tsx` Storm is not exposed in spirit.
- (4) `Body.tsx` hides running head, Here, links and title press; `Book.tsx:265` drops the Bottom. The story asserts Rise is the only button and is aria-disabled.
- (5) `Unavailable.tsx` wait form: warning haptic, no sentence; `Ring` drains over `drainMs` and steps under reduced motion.
- (7) `spirit.ts` pacing matches the formula; `letGo` holds the receipt's lines and they log at the rise.
- (8) Rise focuses `title.last`; no page turn.
- (9) `useCueSounds.ts` passes `spirit` to the bed's muffle and reopens it at the rise; no new sound id.
- (10) `haunt` wakes on combat, scene and chapter-index change; nothing stored, so a reopen is solid.

## Findings

1. **should-fix** `mobile/app/book/UnderInk.tsx:94`: the rise fade is `withTiming(0, { duration: motion.palette.duration })` with the default `ReduceMotion.System`, so under reduced motion the blue cuts out in one frame instead of the ruled plain fade. Player-visible: a reduced-motion player sees the whole page snap from blue to paper at the press, the one place the spec asks for a gentle change. Fix: under reduced motion `motion.fade` with `reduceMotion: ReduceMotion.Never` (as `Blow.tsx:21`). I corrected the component's doc comment to the rule (`UnderInk.tsx:123`); the code must follow.
2. **should-fix** `mobile/app/book/heldLayer.ts:17`: `spiritInk` decides polarity by exact `bg` hex. The palette cross-fades dusk to dark over `motion.palette`, and `UnderInk` passes the per-frame mixed `bg` (`palette.ts:47`), which matches neither, so the wash flips to pale `spirit.day` under light ink. Player-visible: a death wait across the dusk/dark hour boundary flashes a pale blue page for about 1.5 s with light text on it, below 4.5:1. Fix: use `dark(palette)` from `palette.ts:61`, as the blow wash does (the rulings' "as the blow wash splits by polarity").
3. **should-fix** `mobile/app/book/Body.tsx:249`: at zero `ready` moves focus to the new card whenever the wait ran, wherever focus was. Player-visible: a screen-reader or keyboard player reading the log has focus pulled to "Rise, button" at zero, an extra announcement that can cut off the last revival line the rulings say marks readiness. Fix: refocus only if the waiting card held focus (or keep one pressable across both states). Spec text written (below).
4. **question** `mobile/app/book/Unavailable.tsx:91`: react-native-web drops `accessibilityValue` on a button, so the web build has no seconds-left value. Accept as a native-only value, or carry it in `aria-valuenow` on web?
5. **question** `mobile/app/book/Book.tsx:265`: in spirit, a fault or catching-up draws the Bottom, joystick and status included, against "the Book's only control". Intended as the fault escape hatch?

## Spec text written

- `docs/system/book-ui.md` Spirit state, The rise card: "Focus on the card stays on it; focus anywhere else does not move, so zero makes no announcement of its own (the last revival line marks it)."
- `mobile/app/book/UnderInk.tsx` doc comment: the rise fade is `motion.fade` under reduced motion, still a fade; Flashes off the same.

## Proposed check

- `heldLayer.test.ts`: blend dusk to dark (and light to dawn) at the midpoint through the palette curve, and assert every text role on `spiritInk` holds 4.5:1. It should fail at this head and would catch any later hex-equality polarity test.

## Verdict

CHANGES REQUIRED: findings 1 to 3 are small and local; the rest of the state matches the rulings.
