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

## Fix round 1: re-check at `eff67180125697fe5d9a36edea3b8ee3fbebd68a`

Scope: fixes 2effc01ca and eff671801 only, the code they touch and their direct callers (`buyReason`: `Npc.tsx:165` only).

| # | Disposition | Proof |
| --- | --- | --- |
| 1 | Nell at 0 and +1 asserted not hostile (`showcase_social.test.ts:89-96`) | round-0 M1 (`!== 'wary'`) now red in `showcase_social.test.ts` |
| 2 | `!talk && enemy` restored (`Npc.tsx:94`); Bess insult mid-talk pinned (`hostile_refusal.test.ts:53-67`) | mutant drops `!talk`: red in `hostile_refusal.test.ts` |
| 3 | PM ruling "can't afford" (`words.ts` `buyReason`); full Peg row asserted | mutant drops the `insufficient_resource` entry: red |
| 4 | `refuse` without `hostile` is SCHEMA_VIOLATION in both kernels | TS clause dropped: red in `standing.test.ts`; Elixir clause dropped: red in `content_standing_test.exs` (exit 2) |
| 5 | `mechanics.md` floor and Book bullets, `cartridge.md` refuse rule | read: four fields, 1.104, `hostile` required |
| 6 | `/code-review` | not rerun on the fix commits; carried as a nit |

Baseline at the head: `standing`, `showcase_social`, `hostile_refusal`, `ask` and `content_standing_test` green. The Elixir `(spawn_template || ...) or (...)` is safe: `spawn_template` is `const: true` in `entity.schema.json`, so `or` never sees a non-boolean.

Open items, judged:

- nit: a sell the shop cannot pay still reads "(too exhausted)" (`Npc.tsx:166`, `words.ts:67`). No shipped content reaches it, so it is accepted as a known limit. loka-ozu does not record it yet; add the sell row there with the other designer wording.
- nit: `docs/system/book-ui.md:296-298` names only "sold out", not the PM's "can't afford" ruling. A later polish pass could map the buy row back to plain `reason()` and stay within the spec.
- Hosted CI at eff67180 was still in progress at this check.

Verdict: **APPROVE WITH NOTES** at eff67180.

## Second opinion at eff671801 (fix round 1)

- Exact head `eff67180125697fe5d9a36edea3b8ee3fbebd68a`; hosted `ci` and `book-e2e` success. Written 2026-10-16 by anthropic/claude-opus-5-5, an independent second reviewer; the must-be-true list was formed before reading the first record and matches items 1-8 above, plus: Realm seam 1 (view reads the viewer actor), per-player standing scope, hash fixture consistent, no save change.
- First-record dispositions verified: 1 `mobile/app/book/Npc.tsx:94` `!talk && enemy` and the Bess route in `hostile_refusal.test.ts`; 2 Nell asserted at 0, +1, -1 and -2 (M1 below red); 3 `mobile/app/book/words.ts:77` "can't afford", full Peg row asserted; 4 `refuse` without `hostile` is SCHEMA_VIOLATION in `cartridge_standing.ts:33-38` and `standing.ex:42`; 5 `mechanics.md:2354`; 6 `/code-review medium` rerun at 2effc01ca, and eff671801 changes only two doc lines.
- Agree (both kernels): UNRESOLVED_REFERENCE on the refuse text, 1.104 floor, refuse-needs-hostile; `loader_floors.json` 1.104 case is unshadowed (at 1.103 only `refuse` fails; the 1.58/1.57 case strips nell and bess refuse); `toolbox_showcase_hash.json` sha256 of `canonical` recomputed in Python matches; no save or proposal file changed.
- Focused runs green: kernel/ts sleep, theft, status_readers, ask, standing, showcase_social, loader_floors, validate; mobile hostile_refusal, ask; mix content_standing, loader_floors, content_showcase.

| Mutant (reverted) | Result |
| --- | --- |
| `view.ts:235` `=== 'hostile'` to `!== 'wary'` | red: `✖ social 2-3: help makes Nell friendly (bread 2); ...` (PR claim confirmed) |
| `standing.ex:68` `[1, 104]` to `[1, 103]` | red: `loader_floors_test.exs` each fixture floor |
| `standing.ex:42` refuse-needs-hostile to `false` | red: `content_standing_test.exs` rows 15 and G11 |
| `hostile` `enum [true]` to `type boolean` (`contracts.gen.ts` and `gameview.schema.json`) | red in both kernels: `invalid fixtures fail with exactly the listed errors` (PR claim confirmed) |
| `view.ts:237` unauthored hostile NPC projects `refusal: e.short` | red only in mobile `ask.test.ts` (guard fallback); acceptable |

### Findings

1. should-fix, `protocol/gameview.schema.json:494`: `refusal` is valid without `hostile`, but its description says "present with hostile". Both validators already support `dependentRequired` (`kernel/ts/src/foundation/validate.ts:142`, `lib/loka/core/contracts/schema.ex:141`; house use `action.schema.json:1091`). Failure: a refactor that moves `refusal` out of the hostile spread at `view.ts:237` projects it for a wary NPC that no test pins; GameView validation stays green and `Npc.tsx:76` drops it silently. Tightening after 1.104 ships is a contract change, so do it now: `"dependentRequired": {"refusal": ["hostile"]}` on EntityView and one `invalid.json` case.

Open: finding 1, to fix in this round before merge ([WORKFLOW step 7](../WORKFLOW.md): nothing open). Method note: a JSON-only schema mutant stays green in TS, which validates against `contracts.gen.ts`; mutate both.

Verdict: **APPROVE WITH NOTES** at eff671801.
