# M20-B2 independent review — Maud’s Cellar

PR #172 makes the five-rat quest playable with an earned storage key, +5 trust and ordinary chest storage, and corrects a false Book ending hint.

Source reviewed: `adc0d6715f123bba76601ef9f578e605f3d54a6a`.
Reviewer: fresh Codex agent; authored none of the source change.
Verdict: **APPROVE** — no findings or open items.

## Requirements derived before reading the diff

Authority: [Maud’s Cellar](../system/cartridge.md#mauds-cellar-content-m20-b2), [Book UI](../system/book-ui.md), [save opening and commits](../system/save.md), the M20-B2 brief, and archived [chapter content](../archive/spec/00a-chapter-one-content.md) as reconciled by the consuming specification.

- Production Maud offers acceptance once, without a reward. All five distinct durable rat credits are required; actual lethal credits before acceptance count and four credits cannot resolve.
- Successful turn-in transfers Maud’s original 100g cellar key, adds five to bounded player trust and sets instance cellar-cleared while resolving quest/choice in one ordinary durable commit. No special engine branch or replacement key.
- Separate empty 8000g/12-item chest starts locked upstairs, names that earned key and requires ordinary Unlock/Open/Put/Close/Take. Attic brass-key trunk, free cellar access and equipment-free recovery remain intact.
- Current source, independent canonical/hash answer and actual App pin agree on 0.0.10/API1.7. Old0.0.9 answer stays byte-identical; an unmatched save pin refuses without writes or automatic migration.
- Completing a terminal side quest must not imply whole-story completion. Ordinary travel/storage remain usable and existing Book receipt/freshness behavior applies.
- Retained Release evidence must show real fresh production combat/reward/storage plus cold retrieval, identify source/hash, retain failures and verify hashes. Simulator and owner save are outside this review.

## Correctness and Ponytail review

The actual diff satisfies the requirements. Production objective leaves and death-credit mappings remain five distinct credits. The offer excludes all existing quest states. Turn-in binds Maud’s original key, uses additive bounded trust and instance completion, and relies on the reviewed B1 atomic dialogue/containment path. Chest and attic lids name separate keys. No room, combat value, recovery gate, engine rule, protocol schema or capability vocabulary changed.

The Book correction deletes the terminal-journal heuristic and its former test, then checks the real RoomPage renderer after production Maud resolution. This follows the amended Book clause: an explicit main-story terminal consumer remains future work. The production authority tests use real SQLite and actual combat, including shrine recovery, cold reopen, early acceptance and each missing credit. Literal ID, fact and journal expectations are independent; no new source-text guard or redundant B1 fault suite was added.

The sampler Python oracle independently declares mechanics and references, copying only catalog text. The old 0.0.9 fixture is byte-identical to the base’s current fixture. Frozen combat/transcripts and B1 controlled fixtures now select that historical pin explicitly; current compiler, App and production tests consume0.0.10.

Composes-with: actual lethal producers write player facts; the current-state quest reads them; dialogue transfers conserved custody and adjusts facts; barriers/storage consume ordinary item references and transfers; the authority persists changed rows and receipts. Content names content by design. No capability special-case was introduced.

Ponytail Review: **Lean already. Ship.** The runtime change removes an incorrect heuristic, reuses existing reward/storage mechanics and adds no dependency or speculative abstraction.

## Independent checks and red controls

All commands ran with the pinned mise toolchain in an isolated detached review worktree. The PM verified all six GitHub checks green at the exact reviewed source head before review.

- `node --test mobile/authority/local-story/mauds_cellar.test.ts mobile/authority/local-story/mauds_cellar_book.test.ts mobile/app/sampler.test.ts`: exit 0, seven tests passed.
- `mix test test/loka/content_sampler_test.exs test/loka/cartridge_cross_kernel_test.exs test/loka/content_reward_storage_test.exs`: exit 0, eight tests passed; compiler, independent answer and loader parity verified.
- `npm test` in `mobile/app`: exit 0, 279 passed, one existing skip, zero failures. This includes the B1 storage-fault/retry tests.
- `node --test kernel/ts/test/transcripts.test.ts`: exit 0; frozen transcripts replayed.
- A controlled real 0.0.9 save opened through `openGame` with only the current 0.0.10 bundle: `pinned_release_missing`, the literal historical/current hashes, and Start over were observed; SHA-256 of the closed file stayed unchanged.

Two independently executed mutations tested the tests, with byte-exact restoration:

1. Deleted the fifth objective leaf from actual production source, compiled it with `mix loka.compile`, and loaded the resulting valid artifact into the production test fixture. `node --test mobile/authority/local-story/mauds_cellar.test.ts` exited 1: the four-credit negative failed because the missing-fifth case became available.
2. Restored the former terminal-journal heuristic at the actual RoomPage render site. `node --test mobile/authority/local-story/mauds_cellar_book.test.ts` exited 1: the rendered false ending claim failed its assertion.

After restoration, the combined production authority/Book suite exited 0. `git diff --quiet` over cartridges, kernel, mobile, protocol and test confirmed no surviving source mutations. No new custom check was added by this PR, so no additional planted checker violation was required.

## Retained native evidence and limits

Audited the [evidence](../evidence/2026-10-05-m20-b2-mauds-cellar/README.md), including final visible-control traces, selected screenshots and SQLite snapshots. All 231 `SHA256SUMS` entries verified independently. Independent assertions confirmed five preacceptance credits, no early key, original key to body, trust 5, cellar cleared, resolved Maud quest, same brass EntityId stored across cold reopen and retrieved to body under the current literal hash.

The Release capture identifies source `b2601c47a1bc14001399e7bcdfdfe7a5b07996b9`, hash `285f75c2786b96e2e1c92cc8fb859ff30bf59a6b76b51d131481cef1c1564f8c`, build configuration and executable/bundle hashes. The diff from that source to the reviewed head changes only documentation/evidence and a test-loader import; runtime/content inputs are identical. Earlier failed/stale captures are retained and explicitly separated from final proof. Final native rows show no player death; the production SQLite test separately proves actual death/free shrine return.

No Simulator was operated and no owner save was opened, inspected or altered. This is approval of the Maud/storage slice, not of the unfinished Missing Child chapter or a release.


## Adjacent owner play report: elapsed freshness race

While this review was active, the owner reported repeated `stale_view` during ordinary footer movement. This is an owner report, not a reviewer-operated native reproduction. Source inspection supports the race: `mobile/app/App.tsx:96` schedules active pulses every 250 ms, while `mobile/app/book/joystick.ts:57` captures grant-time props and `:78` releases using that capture. A pulse that advances the projection before release can invalidate its drawn token. The capture, elapsed scheduling and invocation routing are unchanged against this PR’s base. The [Book contract](../system/book-ui.md#minimap-map-and-presentation-controls) explicitly requires gesture-start freshness; replacing it silently with a newer target/token is not an authorized fix.

Retained actions049/051/052 separately show repeated stale Maud turn-ins before successful retry. Those refusals preserve the pending reward; final evidence still proves successful reward and cold storage retrieval. They do not measure ordinary human gesture failure frequency, and the native walk must not be described as friction-free.

Classification: a separate pre-existing M1-B2 UI issue needing PM tracking, outside the B2 changed behavior. It does not invalidate the demonstrated B2 reward/storage path or add a B2 finding. The B2 verdict remains APPROVE; wider stage playability/owner acceptance and the appropriate freshness-preserving repair remain separate work.
