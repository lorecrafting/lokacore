# D2 — public Priory and held-book Read: developer source handoff

Source `de1ea634fdec61f5e13aa1acc0c3e59fda7137e0`, branch
`chapter-one/d2-priory-books`, unpublished. The revalidated published prerequisites
and source base are in the [adopted brief](../../briefs/chapter-one/d2-priory-books-brief-2026-10-05.md).
Independent source reviews, hosted PR, CI and publication: null. Native, browser
and owner-save proof: null; no preview, build, Simulator or owner-save operation.

The four reciprocal public branches complete the Priory. Two actual 100g books
explicitly teach their declared Ward/Bell membership only under held/open-chain
Read. Separate Ash/Hale schedules retain the 19:00 overlap. Read composes existing
containment reach, B6 topic lowering and fact ownership; schedules remain the sole
NPC location writer, authority the persistence writer, and Book uses captured
invocations plus local detail routes. No portable operation or dependency was added.
Governing clauses: [mechanics](../../system/mechanics.md#d2-held-books-and-public-priory-selected-contract),
[authoring](../../system/cartridge.md#d2-public-priory-and-book-authoring),
[protocol](../../system/protocol.md#d2-held-readable-composition),
[save](../../system/save.md#d2-book-knowledge-and-read-recovery),
[Book](../../system/book-ui.md#d2-held-book-details).

## Source pins and checks

Provisional chapter `0.0.26`, API1.24, hash
`117b27fcb5ff551550c48bcb89c1909565db14a9b063b3bbbe9c4504a8f35749`, 121 IDs.
The [independent Python answer](../../../test/loka/cartridge_missing_child_v026_hash.py)
starts from frozen v025 and hand-declares D2 additions; compiler and kernel supply
no expected answers. Its artifact and allocation fixtures remain provisional until
PM integration order is settled. Last remote observation: `b0bf6c60`; no main merge
or re-pin was performed in this source branch.

| Command on the source head | Result |
|---|---|
| `mise exec -- bin/check_all.sh` | Exit 0; 349 Elixir tests, full kernel/type/contract/feature/size/lint/red controls and headless simulation |
| `mise exec -- npm test` in `mobile/app` | Exit 0; 497 passed, one existing skip |
| `mise exec -- node_modules/.bin/tsc --noEmit` in `mobile/app` | Exit 0 |
| Focused Lantern/presenter/D2 SQLite | Exit 0; 32 tests |
| `elixir bin/contracts.exs --check`, `elixir bin/features.exs --check` through mise | Exit 0 |

The D2 SQLite cases exercise file-backed legal intermediate reopen, real
rollback-journal (`delete`) first/already-known Read COMMIT failures, absent and
committed uncertain outcomes, exact retry, typed forged-history refusal with
unchanged file bytes, actual fatal fight/shrine/original-corpse recovery, saved
novice departure and pending Read remount. Actual Item controls prove explicit
Read, ordered exact history and local Back; they do not prove native layout.

## Observed red controls and self-review

Removing the book grant, allowing room custody, ignoring the commanded actor,
swapping topic mappings, checking historical Read against today's custody,
teaching on Examine, teaching from an ordinary notice, conflating novice card
labels, automatic child Read, dropping the Game confirmation guard and routing
recovered text to World each failed its focused behavior test. Existing focused
lids and presenter tests kill omitted closed-ancestor admission and removed
same-receipt history suppression; no overlapping replacement tests were added.
The older notice/Wisp tests passed the omitted book-grant mutation before D2 cases
were added. Both new ItemReadable required-field removals failed; removing closed
metadata failed contract generation. Every mutation was restored. Red controls are retained as redacted raw outputs;
[SHA256SUMS](SHA256SUMS) and its [verification](SHA256SUMS.verify) bind the retained bytes.

Self-review fixed the pending-remount issue at the Book-facing Game adapter:
raw Story narration retains the frozen Lantern receipt-inspection contract;
Game withholds it while an invocation is pending, then background projection
routes the confirmed line to its original detail. Existing conversation recovery
and frozen Lantern adverse cases pass with D2. The active App pin test inherited
B6's hash despite bundling B8; the published B8 mismatch was reproduced, then the
current literal pin was advanced. Compiler text collection was simplified to meet
existing size/Credo limits without raising them. Ponytail Review: **Lean already.
Ship.** No remaining correctness or complexity finding in this developer pass.

## Integration overlap and remaining proof

Likely shared source: cartridge manifest/facts/text, installed API, active App and
current source pins, feature map, `commands/{action_input,actions}.ts`,
`view/{action_lists,read_actions}.ts`, `content/cartridge_refs.ts`, and
`mobile/authority/local-story/{session,topics-save,exchange-save}.ts`.
B9 Book overlap is `model.ts`, `Book.tsx`, `Body.tsx`, `Menu.tsx`, `pages.tsx` and
`presenter.ts`. D2 adds no Page union, pagesAfter or GameView schema change;
final `book/logs.ts` and raw `local-story/save.ts` match the published base.
C3's provisional v026 fixture names and shared release/API pins require coordinated
integration and independent re-pinning. No other source worktree was modified.

Fresh primary and separate save/protocol reviews are required. Browser interaction,
native/storage equivalence, hosted exact-head CI and publication remain unproved.
