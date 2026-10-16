# Review: PR #411 Book hostile NPC refusal line, kernel_api 1.104 (loka-y6yg.20 part B, loka-x6t.33)

- PR [#411](https://github.com/lorecrafting/lokacore/pull/411), branch `book/hostile-refusal`, exact head `5873fee352c229d956d89e844ec4c8160fd89c59`, base `origin/main`.
- Governing: [book-ui.md Hostile refusal](../system/book-ui.md) (line 285); [mechanics.md G11](../system/mechanics.md#standing-and-disposition-toolbox-rows-15-and-g11) (lines 2351-2354); [cartridge.md standing and disposition](../system/cartridge.md#standing-and-disposition-declarations); [contracts lessons](../lessons/contracts.md).
- Hosted CI at the head: `ci` and `book-e2e` success.
- Written 2026-10-16 by anthropic/claude-opus-5-5.

## Must be true (written before the diff)

1. EntityView `hostile: true` only while the G11 disposition is hostile; absent otherwise (friendly and wary alike).
2. `refusal` is `disposition.refuse`, projected only with `hostile`.
3. `refuse` is an optional TextKey admitted "as `engage`" by compiler and loader; kernel_api 1.104 floor with a loader_floors case and a red control in each kernel.
4. Hostile page: description, one Note (authored line or the `words.ts` fallback), no Talk, shelf or Ask about; services and lessons stay; foot is Leave.
5. Shelf reasons always a `reason()` word; buy `not_owned` stays "sold out".
6. G11: "A conversation already open when its speaker turns hostile runs on; the next talk is refused."
7. Hostility ending redraws the actions without the line.
8. No save or proposal change; schema mutant sweep; GameView validated in view tests.

Holds: 2, 3 (text and floor), 4, 5 (as worded), 7, 8. Open: 1 (untested), 3 (presence rule), 6 (findings below).

## Test the tests (scratch worktree, each reverted)

| Mutant | Result |
| --- | --- |
| M1 `view.ts:235` `=== 'hostile'` to `!== 'wary'` (friendly projected hostile) | **green**: all 134 kernel test files that import `gameView` or `view.ts`, plus mobile `hostile_refusal.test.ts` and `ask.test.ts` |
| M2 TS floor 1.104 to 1.103 | red, `loader_floors.test.ts` |
| M2b TS `refuse` text check dropped | red, `standing.test.ts` |
| M3 Elixir floor `[1,104]` to `[1,103]` | red, `loader_floors_test.exs` |
| M3b Elixir `entities.ex` `~w(engage)` only | red, `content_standing_test.exs` |
| M4 `Npc.tsx:98` `!enemy` dropped on ShopOptions | red, `hostile_refusal.test.ts` |
| M5 authored refusal ignored (fallback always) | red, `hostile_refusal.test.ts` |
| Schema: `hostile` enum widened to `[true,false]` | red, `validate.test.ts` |

PR-body claims rerun: "every new conditional goes red" is refuted by M1; "no content reaches that state" (Note over an open conversation) is refuted by the Bess route in finding 1.

## Findings

1. should-fix, `mobile/app/book/Npc.tsx:94`: the refusal Note draws over an open conversation. Route (toolbox_showcase, moot hall): map, Go south, map, Go south, tap Bess, Talk, "Insult the village" (standing 0 to -2). The page shows the narration, then "Bess turns to her barrel and does not look up.", then Bess's still-open conversation ("What'll it be?", her choices, Leave the conversation). G11 says that conversation runs on; the Note contradicts the speaking NPC. Restore `!talk && enemy`, with this route as its red control.
2. blocker, `kernel/ts/test/showcase_social.test.ts:73-75`: the comment claims the test catches "Nell's view is marked hostile ... at any standing but -2", but it asserts only standing 0 and -1, never friendly +1, which the test visits. M1 stays green: a friendly Nell would lose Talk and her shelf. Assert `nell(w)` gives `[undefined, undefined, []]` at +1.
3. should-fix, `mobile/app/book/Npc.tsx:165` with `mobile/app/book/words.ts:67`: an unaffordable buy now reads "(too exhausted)" (Peg's iron sword in `missing_child`: "Buy 7p (too exhausted)"); on main it read "(insufficient resource)". `hostile_refusal.test.ts:50` asserts only `!/insufficient|_/`, so it passes on the wrong word. Give a buy refused `insufficient_resource` its own money word next to the `not_owned` branch and assert the literal row; if the designer defers the wording, track it under loka-ozu and still pin the row.
4. should-fix, `kernel/ts/src/content/cartridge_standing.ts:33` and `lib/loka/content/standing.ex:42`: `engage` is refused without `hostile` (SCHEMA_VIOLATION), but `refuse` without `hostile` is accepted, so an author's refusal line that can never show compiles silently. book-ui.md says `refuse` is admitted "as `engage`". Refuse it the same way in both kernels, with a red control in each (contracts lessons, last item).
5. nit, `docs/system/mechanics.md:2354`: "Any of the three fields needs kernel_api 1.47" is stale: four fields, and `refuse` needs 1.104.
6. nit: `/code-review medium` ran at `5c36fd803`; three commits since (8da1d289, 6d8b38ce, 5873fee3). Run it in the fix round.

Judgments on the PR's open items: the Warden's fallback refusal conforms to the spec (no finding); `disposition()` also evaluating friendly is accepted; the size allowance 308 to 315 is accepted.

Verdict: **CHANGES REQUIRED** at 5873fee3.
