# C3 living hounds — provisional source evidence

The first source head was `18aa78c5f015dd1936a37598259f0fbf9152d5ff` on the isolated C3 branch, integrating published B8 source. Its independent answer was `0.0.26` / kernel API `1.24`, SHA-256 `79191ce8a2653728c4ee1a4ad5cd31eacd38120bd420c8be413c9d0b92afc440`, with 124 genesis IDs. This section records that frozen predecessor proof; later integrations follow below. Independent source review and publication remain pending.

## Checks

| Command | Result |
| --- | --- |
| `mise exec -- bin/check_all.sh` | Exit 0; `check-all.log` (351 Elixir tests, contract/schema/docs/architecture, kernel TypeScript, size and formatting). |
| `mise exec -- node --test --experimental-strip-types kernel/ts/test/hounds.test.ts` | Exit 0, 8/8. |
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
| Add a no-op slot1 transition to each population job | Exit 1; both real equal-time order proofs failed, including the new focused test. |

Every planted source edit was restored immediately after its red run.

## Browser walk

On an isolated localhost web preview, a fresh chapter showed four separate, same-named hounds in Hound Run and adjacent Map sight. I opened one hound, used its Attack action, observed creature-neutral combat narration and automatic closure, opened its real corpse and nested pelt, then used Take. A refresh preserved the exact pelt in Equipment & Inventory → Held; [the screenshot](book-carrying.png) captures that saved state. The corpse no longer offered Buy after the projection fix. The web preview was stopped after capture. No native simulator or device ran.

The general Book rule said accepted Take returned to World, while the C3-specific text placed Take history on the item detail. The owner resolved this after the first source head.

Ponytail Review: lean already; no additional abstraction or dependency was needed. Correctness self-review found and fixed dynamic pelt custody, generic corpse Buy, rat-only combat wording, and the Book test's direct kernel import. Independent review is still required.

## Published D5 integration and corpse-detail ruling

Merged published D5 source `010dc99447ef1916b5928e7be02aac2805c1f4ca` and the [owner's corpse-detail decision](../../decisions/owner-decision-corpse-loot-take-detail-2026-10-06.md). The separate combined answer is provisionally `0.0.27` / API `1.24`, SHA-256 `c0d0891c2ce45e6d3f0b417adbf435a25febf7ae713f8fe4bc662ec91f1896ea`, with 130 genesis IDs. The frozen C3 and D5 predecessor fixtures were not edited. D2 has since published `v027`; this integration's active pin is temporary and must advance again.

The local authority recognizes corpse Take only from an exact validated saved command, its transfer out of a death-origin corpse, and the matching acquired event. The Book routes a confirmed result to the corpse detail and adds the named pickup there once. A nested pelt's Leave returns to that corpse; its Leave returns to World. Cold reopen reconstructs the pickup from the same receipt, including after the pelt is subsequently dropped. Generic Take retains its World route. Pending/refused/faulted commands do not claim pickup.

`integrated-full-check.log` records `mise exec -- bin/check_all.sh` exit 0 after the integration; the focused Book suite passed 16/16, C3 kernel 8/8, Elixir content 6/6, and mobile TypeScript compilation passed. `corpse-route-red.log` records a real component failure when the corpse route was deliberately changed to return World. The mutation was restored. No new native or browser session ran for this routing amendment.

## Published D2 integration

Merged published D2 source `4bcb2eafd0a984c611b71c3e4dc1e0d26defd533` with C3. D2 owns published `v027`; C3's combined successor is provisionally `0.0.28` / API `1.24`, independently derived SHA-256 `eb1e069d3ab049cb389bb525ece5ad596909967dda9432ad530b861433cc177f`, with 140 genesis IDs. D2's frozen `v026` and `v027`, D5's frozen answer and C3's original B8-based answer remain separate and unchanged in content; C3's original `v026` files were renamed to `missing_child_c3_b8_*` to avoid colliding with D2's published `v026` fixture.

D2's held-book Back and pending Read recovery compose with C3's corpse route in the same Book component. The actual component walks pelt Back to corpse, reopens the pelt, waits through a lost Take acknowledgement without claiming custody, retries the exact Take, keeps one pickup in corpse history through a refused repeat Take, then cold-reopens after a later Drop without moving the saved pickup to World. The authority additionally refuses to reconstruct that pickup when the saved Take receipt lacks its acquired event.

`d2-integrated-full-check.log` records `mise exec -- bin/check_all.sh` exit 0 after the D2 merge (353 Elixir tests plus active contracts, mobile, kernel, docs, architecture, size and formatting checks). Focused C3 and D2 kernel tests passed 17/17, Book tests passed 19/19, real SQLite Priory and hound tests passed 9/9, and TypeScript compilation passed. `d2-corpse-route-red.log` records the component failure when the exact corpse route returned World; `d2-receipt-evidence-red.log` records the real SQLite failure when the receipt event guard was removed. Both source mutations were restored. No native or new browser session ran. Independent review and final release pin remain pending, especially if B9 publishes first.

## Independent review fixes, provisional successor

The [primary review](../../reviews/2026-10-06-c3-living-hounds-primary-review.md) and [save/protocol review](../../reviews/2026-10-06-c3-hounds-save-second-review.md) were integrated as separate review-authored commits. Fix source head `8e767434425658d27e1b13f7da99744b09302015` closes their four findings:

- **R1:** a remounted uncertain pelt Take uses the exact confirmed saved receipt to return to the corpse detail, with one corpse-local pickup and Back to World. The real Book component test remounts between lost acknowledgement and pulse.
- **R2:** a controlled death of extra slot 5 at logical time 108150 retains generation 1 at the daytime 198000 wander and advances only at night 244800.
- **S1:** population plans themselves activate existing accepted-receipt replay. A loader-accepted population-only cartridge's real file-backed wander receipt, forged actor and cold reopen now return `save_corrupt` without changing bytes.
- **S2:** final composition and independent preconditions in both portable kernels require each spawned pair, initial home/held-pelt custody, HP and matching slot/generation in one group. Proposal prefix reads remain composable. The additive literal fixture pins accepted rows, malformed complete bundles and paired prefix behavior; the portable kernels agree after those independent answers.

`review-fixes-full-check.log` is the full `mise exec -- bin/check_all.sh` result on that committed source head: exit 0, 356 Elixir tests, all kernel TypeScript tests, contract, architecture, documentation, size and format checks. Mobile app TypeScript compilation and focused Book 15/15, authority hounds 3/3, kernel hounds 9/9, spawned fixture TypeScript 2/2 and Elixir 3/3 also passed. `review-fixes-red-controls.log` records six restored, failing source mutants across the four findings.

The optional broad mobile test run is retained in `review-fixes-mobile-test.log`: 505 passed, 2 failed, 1 skipped. The chapter test expects the published predecessor hash while C3 still carries its provisional combined pin; successor re-pin waits for B9 publication. The Combat Flee assertion also fails with the reviewed pre-fix Book source, confirmed by a controlled source substitution, and is outside these four C3 fixes. No final pin, hosted CI, PR, native build or new browser proof is claimed. Ponytail Review and diff self-review found no extra dependency or general framework to remove; the only added final-mode switch preserves existing proposal prefix hydration.

## Strict final slot membership follow-up

Scoped re-review found three remaining S2 shapes admitted by final composition and preconditions at the preceding source head: an extra foreign-plan slot, an extra same-plan slot in a hound-free writer group, and a standalone occupied slot assigning an existing hound without a birth. Source head `2dbf55b51cf7ae6bf930a550bb2dd61327a4127e` closes them in both portable composers and independent invariants. Every occupied slot with no due time must bind a newborn in the same writer group by full plan, slot, generation and member ID. Death/due rows and explicit nonfinal prefix hydration retain their separate behavior. The old row-only composition fixtures now state final refusal and retain their original literal rows as nonfinal prefix answers; the governing protocol section says why.

`strict-slots-full-check.log` is the full `mise exec -- bin/check_all.sh` result on that committed source: exit 0, 358 Elixir tests, active TypeScript kernel, contracts, documentation, architecture, size and formatting checks. Focused spawned-bundle and population-composition suites passed 6/6 in TypeScript and 7/7 in Elixir. `strict-slots-red-controls.log` records eight restored old-predicate mutants, each failing a focused test. The independent Astra source audit approved this exact source head; the scoped save review remains separate. This is still a provisional successor; B9 publication may require a fresh release pin. No PR, push, native build or browser run is claimed for this follow-up.

Ponytail Review: four direct guard predicates and one fixture-mode correction were sufficient; no adapter, compatibility branch or dependency was added. Diff self-review confirmed the final-only rule against legal birth, replacement, fatal and prefix shapes and retained the composed `conflicting_write` fault priority.
