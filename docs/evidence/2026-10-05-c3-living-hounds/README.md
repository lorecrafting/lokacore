# C3 living hounds — provisional source evidence

Source: `dbb20b78` on the isolated C3 branch, integrating published B8 source. Independent source review and publication remain pending. The active chapter is `0.0.26` / kernel API `1.24`; its independently verified SHA-256 is `79191ce8a2653728c4ee1a4ad5cd31eacd38120bd420c8be413c9d0b92afc440`. The genesis fixture pins 124 IDs.

## Checks

| Command | Result |
| --- | --- |
| `mise exec -- bin/check_all.sh` | Exit 0; `check-all.log` (351 Elixir tests, contract/schema/docs/architecture, kernel TypeScript, size and formatting). |
| `mise exec -- node --test --experimental-strip-types kernel/ts/test/hounds.test.ts` | Exit 0, 7/7. |
| `mise exec -- mix test test/loka/content_missing_child_test.exs --force` | Exit 0, 6/6. |
| `mise exec -- node --test --experimental-strip-types mobile/app/book/hounds.test.ts` | Exit 0, 2/2 after the Book test was moved behind local Story/GameView. |
| `mise exec -- node --test --experimental-strip-types mobile/authority/local-story/hounds.test.ts` | Exit 0, 2/2 with real SQLite. |
| `mise exec -- node --test --experimental-strip-types kernel/ts/test/commerce.test.ts mobile/app/book/shop.test.ts` | Exit 0, 5/5 after hiding generic Buy/Sell entity offers. |
| `mise exec -- ast-grep scan --error mobile/app/book/hounds.test.ts` | Exit 0; the commit hook also passed architecture, formatting and docs checks. |

The real SQLite tests cover one lost COMMIT acknowledgement on a wandering job with replay and cold reopen, and an actual move → Attack → elapsed fatal → pelt Take sequence followed by cold reopen. The latter retains one corpse and the same pelt in player custody.

## Red controls observed

| Planted break | Focused failure |
| --- | --- |
| Remove TypeScript loader's `wander_interval <= replacement_delay` guard | Exit 1; slower-wander loader test failed. |
| Remove Elixir compiler's same period guard | Exit 2; slower-wander compiler test failed (5/6). |
| Omit fatal population slot transition | Exit 1; deliberate-attack/replacement test failed (6/7). |
| Reject spawned pelts from ordinary item custody | Exit 1; Book corpse Contents/Take test failed (1/2). |

Every planted source edit was restored immediately after its red run.

## Browser walk

On an isolated localhost web preview, a fresh chapter showed four separate, same-named hounds in Hound Run and adjacent Map sight. I opened one hound, used its Attack action, observed creature-neutral combat narration and automatic closure, opened its real corpse and nested pelt, then used Take. A refresh preserved the exact pelt in Equipment & Inventory → Held; [the screenshot](book-carrying.png) captures that saved state. The corpse no longer offered Buy after the projection fix. The web preview was stopped after capture. No native simulator or device ran.

The general Book rule says accepted Take returns to World, while the C3-specific text says Take history stays on item detail. The owner is resolving that conflict; no dependent routing change is included in this source head.

Ponytail Review: lean already; no additional abstraction or dependency was needed. Correctness self-review found and fixed dynamic pelt custody, generic corpse Buy, rat-only combat wording, and the Book test's direct kernel import. Independent review is still required.
