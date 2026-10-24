# Review: narration log batch, engine lines for every action (loka-kgd.185, loka-x6t.129, loka-x6t.124, PR #475)

- Branch `toolbox/batch-narration-log`, reviewed head `89959b620e62a1f991969c81a1b25ab11fc95a33` (base `b27893ba0`, 23 commits).
- Governing: [docs/briefs/narration-log/README.md](../briefs/narration-log/README.md) (appended rulings), [book-ui.md Line placement](../system/book-ui.md), [interaction-patterns.md "Every line logs; some are quiet"](../design/interaction-patterns.md), [IMPORT.md 2026-10-24 amendment](../spec/IMPORT.md), AGENTS.md "Writing tests", [WORKFLOW review stance](../WORKFLOW.md).
- Reviewer: anthropic/claude-opus-5-5, independent, authored none of the work.
- Verdict: **APPROVE WITH NOTES** at `14a795f20` (first pass at `89959b620`: CHANGES REQUIRED, two blockers now fixed).

## Must be true (written before reading the diff)

1. Each accepted take, drop, give, put, move, talk, open, close, wear, remove and position action has one engine line unless an authored line exists.
2. Words come from the shared table in first or third person.
3. Every line goes to the room log (Read text excepted), combat included.
4. Quiet: own buy or sell on a shop page, own take or put on a container page; not on the page, compacted in the room log by the narrow merge rule.
5. The live region reads each quiet line in full.
6. A refusal on a detail page shows on the page and in the room log, read once.
7. A move opens the new room's log with its line.
8. Conformance fixtures change only in narration.
9. The sim silent-action pin list is gone.
10. No hash, save or schema change; old receipts replay as before.

1-4, 6-9 hold. 5 is untested (finding 2). 10 does not hold (finding 1).

## Findings

1. **Blocker** `mobile/authority/local-story/commerce-save.ts:164`. The receipt check now requires `actorLine(world, ..., 'commerce.bought'|'commerce.sold', ...)`. A save holding a buy or sell made on main carries `[{key:'shop.bought'}]` (or `shop.sold`). Probe: a scratch copy of `two_shops.test.ts` with receipt 2 narration set to the main-era `[{key:'shop.bought'}]` throws `save_corrupt` from `elapsedHost`. So every existing save with a purchase stops opening. Fix: accept the legacy key too; check key, actor and item id, not the item's current short.
   - Should-fix, same line: the short is recomputed from the reopened world through `describeEntity`. A bought item whose variant changes later (e.g. a sword notched to `short_broken`) makes its own receipt `save_corrupt`. Latent: no shipped shop sells a variant item yet. The same fix covers it.
2. **Blocker** `mobile/app/book/presenter.ts:220`. Mutant: drop `...(s.merged ?? []),` from `heard`. Result: SURVIVED against all 57 `book/*.test.ts` files. So nothing checks that a compacted quiet line ("... (2 times)") is announced. That is the x6t.124 rule "quiet is visual only; read each quiet line in full". Fix: one presenter-level test that buys twice on a shop page and asserts both lines reach the live region.
3. **Should-fix** `kernel/ts/src/mechanics/commerce/rule.ts:32`: `result.shop.bought/sold` text is now unused. Delete it together with the finding 1 fix. Old saves keep the `shop.*` keys only as legacy receipt keys.

## Open items from the developer

| Item | Verdict | Reason |
|---|---|---|
| `words.ts`: an unnamed actor reads "You" | follow-up | The player's body is never named, so a "They" fallback turns the player's own lines into "They". A fix needs a body id in GameView (a contract change). Every current key comes from the player's own command. |
| `commerce/rule.ts` Shop.bought/sold unused | fix now | Finding 3. |
| `chronicle.ts:39` prompt regex misses authored prompt keys | follow-up | Needs a kernel mark or a view field. Volume only, no wrong state. |
| `containment/rule.ts:97` item line dropped when other narration exists | accept | Matches the brief ("authored line wins"). Pinned by `theft.test.ts:106`. |
| Instance stock merge never fires; background restore or settle counts as quiet | follow-up | Diverges from the compaction rule but only affects merge counts. |
| `kernel/ts/play/main.ts` size allowance 305 | accept | Terminal client only; the header comment names the reason. |
| No 390 px screenshots | gap | Not taken in this review. The designer pass for the batch should take them. |

## Test the tests

`bin/mutate.sh`. Narrow = the book tests importing the module; survivors rerun against all `book/*.test.ts`.

| Mutant | Result |
|---|---|
| `logs.ts`: drop `\|\| last.quiet !== quiet` (merge identity) | red-narrow |
| `logs.ts`: drop `s.visits` from the merge identity | red-narrow |
| `received.ts`: combat to `combatLog` only | red-narrow |
| `received.ts`: refusal to the page only | red-narrow |
| `received.ts`: `quietOf(...)` → `undefined` | red against all book tests (survived the narrow set) |
| `presenter.ts:220`: drop `...(s.merged ?? []),` | **SURVIVED** all book tests (finding 2) |

PR body claims rerun: `chronicle.ts:37` combat-index mutant → red (`chronicle.test.ts`); `line_words.ts` `[actor ? 1 : 0]` → `[0]` → red (`combat.test.ts`). Both are backed.

Conformance fixtures: `lantern-traces.json` and `adverse-cases.json` equal `origin/main` with `narration` and `fixture_version` stripped; only narration changed.

`/code-review medium` result is reported in the PR body, with dispositions.

Hosted CI at the reviewed head: graph-diff green; ci and book-e2e were still running at review time (the PM watches).

## Fix re-check at `14a795f207076e7f670268f5118c6b6ff3dcd28a` (commits `e07c88412`, `14a795f20`)

Verdict: **APPROVE WITH NOTES**. Both blockers are closed.

- Finding 1 closed. `commerce-save.ts` `said` accepts exactly the main-era form `[{ key: shop[outcome] }]`, the same check main ran (`same(d.narration, [{ key: shop.bought|sold }])`). Otherwise it requires one line whose key is `commerce.bought|sold` and whose participants are exactly `{ actor: body }`. The old-key acceptance is no wider than main's. A buy cannot pass with the sold key, and another shop's key does not pass. `two_shops.test.ts:168` reopens an old-key receipt and a stale short; `:183` keeps the forged key and actor cases corrupt.
- Should-fix (stale short) closed: the short is no longer rebuilt.
- Finding 2 closed. `live_region.test.ts:83` buys two candles with the same short on the chandler page and checks both are heard as separate batches.
- Finding 3 closed: `shop` is dropped from the `exchange` result (`commerce/shared.ts:94`).
- Mutants (`bin/mutate.sh`, narrow, baseline green):

| Mutant | Result |
|---|---|
| `presenter.ts:220` drop `...(s.merged ?? []),` | red-narrow (`live_region.test.ts`) |
| `commerce-save.ts` remove the old-key branch | red-narrow (`two_shops.test.ts`) |
| `commerce-save.ts` ignore the participants | red-narrow |
| `commerce-save.ts` old-key branch → any one line | red-narrow |

- Nit `commerce-save.ts:132`: the new-form line's `bindings` are no longer checked. A forged item binding shows wrong text in the log. Narration is outside the hash and the item id is checked by the moves, so this is display only.
- Nit `commerce-save.ts:1`: the size allowance was raised to 308 (a second size deviation in this batch, after `main.ts` 305).
