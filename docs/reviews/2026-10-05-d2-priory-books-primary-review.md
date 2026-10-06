# D2 public Priory and held books — independent primary review

**Verdict: CHANGES REQUIRED.** Fresh independent Codex primary reviewer; authored
none of the implementation. Source `de1ea634fdec61f5e13aa1acc0c3e59fda7137e0`,
evidence head `d5c2ea2f0da85f6474f281f10e2145c3f25368d8`, unpublished branch
`chapter-one/d2-priory-books`. Review delta starts at its actual published base
`ac9b22757a82c4b4c3d60ddf8f94e5c98014bae4`. Newer main-only changes at
`b0bf6c60` are integration work, not source deletions. Save/protocol second opinion,
hosted CI and publication remain separate requirements.

## Requirements derived before the diff

[Mechanics](../system/mechanics.md#d2-held-books-and-public-priory-selected-contract),
[authoring](../system/cartridge.md#d2-public-priory-and-book-authoring),
[protocol](../system/protocol.md#d2-held-readable-composition),
[save](../system/save.md#d2-book-knowledge-and-read-recovery), and
[Book](../system/book-ui.md#d2-held-book-details), as adopted in the
[brief](../briefs/chapter-one/d2-priory-books-brief-2026-10-05.md), require:

- Ten public rooms retain the literal reciprocal, ungated safe routes and public
  Aldric/Wick consumers. Two distinct novices retain the specified schedule edges.
- Only exact actor-held/open-chain explicit Read narrates the declared book and
  idempotently grants its Ward/Bell topic. Ordinary notices grant nothing.
- Existing containment, topics, facts, schedules and receipt owners remain sole
  writers; no portable operation or new framework is needed.
- Confirmed Read history remains attached to the original item. Cold recovery
  restores its reachable item/parent route after chapter Continue, including a
  previously uncertain Read once confirmed, without optimistic or fallback text.

## Finding

**D2-P1 — blocker — open:**
`mobile/app/book/Book.tsx:100` and `mobile/app/book/Book.tsx:58` at the source SHA.
Item-route recovery runs only during initial `useState`. If Book mounts while
Read is uncertain, Game correctly withholds its narration and the initial item
stack is empty. The later confirmed subscription adds exact book history but
`useUpdates` only passes the empty stack through `pagesAfter`; it never recovers
the now-confirmed item route. After chapter Continue the player lands on World,
with the confirmed book page hidden.

Controlled reproduction: real SQLite host; move to Scriptorium; Take original
Ward; inject lost COMMIT acknowledgement for explicit Read; confirm pending;
mount the actual default `Book` component; release the read fault and settle
`game.pulse('active')`; Continue the chapter. A minimal React hook/native harness,
following the existing keyboard-test approach, executes actual Book state and
subscription code. Its rendered stack is `[]` while its exact Ward history is
present. The assertion requiring the original book detail fails with exit 1.
The existing test named “Book remount during lost Read acknowledgement” creates
only a presenter, so its passing history assertions miss the route failure.

Required disposition: recover the exact confirmed Read and currently projected
parents once when a remounted pending invocation settles; preserve chapter,
scene/combat and unavailable-target precedence. Add a regression through actual
Book state/subscription behavior, not only presenter or model helpers.

## Independent checks and simplicity

Pinned `mise exec -- node --test` in a throwaway detached source checkout:
9 Priory kernel/contract tests and 7 Priory Book/real-SQLite tests pass. Removing
the book grant fails two focused cases; allowing room custody in held-only reach
fails the explicit Read case. Restore returns all 9 kernel/contract tests green.
The separate actual-Book recovery probe fails as described above.

Read the compiler/loader/schema, authored content, action admission/projection,
Book/presenter and small save-composition diff. Source pins are explicitly
provisional; concurrent release/API/content/Book changes still need integration
and independent final pins. Developer evidence reports a passing full active
check; this reviewer did not rerun the full line. Native and browser proof: null.
Ponytail Review: lean reuse of existing owners; no complexity finding.
