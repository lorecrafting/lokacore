# Book item detail order review — 2026-10-05

PR: #178. Source reviewed: `102a0602b7cffdc23546e5da9e7bb6c3a6a48e01`.
Base: `3e33fc5286a841239d30e7a030faaf5275725692`.
Fresh independent reviewer; authored none of the source change.

## Requirements derived before reading the diff

From [Book UI detail-page order](../system/book-ui.md#detail-page-order),
[item details and Take/Drop](../system/book-ui.md#item-details-and-takedrop), and the
[owner decision](../decisions/owner-decision-detail-page-order-2026-10-05.md):

- Detail identity, authored description and projected item state precede chronological
  history; offered options follow history inside the same scrolling content.
- Empty history adds neither heading nor placeholder. NPC/combat order remains consistent;
  World retains its room-page order.
- Retained same-room item actions use existing item history and projected actions/contents.
  Confirmed Take/Drop still return to World with their existing narration; Leave is local.

## Verdict: APPROVE

No findings or open items. `Menu.tsx` forwards the item ID and existing history;
`ThingPage` renders that history after description/state and before actions in its
existing `Sheet` ScrollView. Empty histories render nothing. The existing presenter
preserves confirmed Take/Drop routing and retains the original pending context.
NPC/combat ordering already follows the required log-before-options pattern.

## Verification

- Independently confirmed all six source-head CI checks passed.
- `mise exec -- node --test book/item_detail.test.ts book/polish.test.ts`
  from `mobile/app`: 14/14 passed, including real-session Wear/Remove chronological
  rendering, empty history, container results, confirmed Take/Drop and pending retry.
- In a detached throwaway worktree, reverted Item to `press={p.press}`: 2/14 failed
  (missing Wear history and missing container detail consequence).
- Independently moved the item history below actions and Leave: the existing
  `polish.test.ts` suite stayed green (13/13), while the new item ordering test failed
  (0/1), demonstrating its distinct behavioral coverage and literal expected ordering.
- Restored both mutations exactly; the focused suites passed again (14/14), and
  `git diff --exit-code -- mobile/app/book` confirmed no source changes remained.
- Expected answers are literal rendered text; no frozen conformance fixtures changed.
  Native hosts are test leaves: these checks prove component order and real-session
  routing, not native layout or scrolling. No Simulator interaction was performed.

Ponytail Review: lean already; existing history and components suffice, with no new
runtime abstraction or dependency. No simplification requested.
