# D2 public Priory and held books — independent primary review

**Current scoped verdict: APPROVE.** D2-P1 and D2-H1 are closed by the independent
scoped fix rechecks below.

**Initial verdict: CHANGES REQUIRED.** Fresh independent Codex primary reviewer; authored
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

## Developer round-1 disposition — independent recheck pending

D2-P1 is implemented in `827abc72`; combined source after published D5 integration
and independent v027 pins is `de756710ea10322bd36ec339bd1d9abf1850067b`.
[Exact-source checks, controls and integration evidence](../evidence/2026-10-05-d2-priory-books/round-1.md)
retain the fix and its observed red/green controls. This disposition does not
change the independent verdict.

## Independent round-1 fix recheck — APPROVE

Fresh independent primary fix reviewer; authored none of the implementation.
Reviewed exact source `de756710ea10322bd36ec339bd1d9abf1850067b` through evidence-only
head `c7139a6797484f7ef77eb48640e7d426ec805d09` in a separate detached checkout.
Scope: D2-P1 fix/direct callers and D5/v027 integration; settled original mechanics
were not reopened. **D2-P1 closed; no new findings.**

Actual Book captures the invocation pending at mount, admits only its accepted
Read completion and restores that exact projected item/parent route once beneath
chapter Continue. Ward and Bell both exercise the real SQLite lost-acknowledgement
path. Later World return and pulse do not restore it again. Controlled projected
route probes preserve scene/combat precedence, refuse a missing target without
another-book fallback, and suppress closed-container recovery while retaining the
original item's exact history.

Independent bounded verification, using `mise exec --`:

- `node --test` across Book/authority Priory, kernel Priory/contract/Deep Fen and App
  chapter files: 28/28 pass. App `tsc --noEmit`: exit 0.
- In the throwaway checkout, removing only the settlement route makes the actual
  Book regression fail with `[]` after Continue (exit 1). Restoring exact source
  makes both Book Priory tests pass (2/2); no mutant or source edit is retained.
- The v027 Python oracle reproduces hash
  `2fda0a7f0a571c080c3d9d3969324a1a4920881ea48adab178684fc9330f94de`
  and all 127 IDs without a fixture diff. Published D5 room rows/catalog values and
  predecessor D5/provisional D2 fixture bytes remain intact; v027/API1.24 agree.
- All 11 round-1 retained evidence hashes verify; observed developer red/green
  outcomes agree with the independently repeated route control.

Ponytail Review: lean already; no complexity finding. Full publication checks,
save/protocol opinion, hosted CI and publication remain separate gates. Browser,
native and owner-save proof remain null; this verdict claims headless proof only.

## Hosted Sol review — PR223 exact head 59899fcb

Verbatim read-only response on `59899fcbd2e37dee177569f467540acfb7ede338`:

```text
VERDICT: CHANGES REQUIRED

- **D2-H1 — blocker — mobile/app/book/Book.tsx:61** (also :94): Remount Book during a held Ward Read with lost COMMIT acknowledgement, Continue to World, then tap the Scriptorium title before the next pulse. The press retries and confirms the retained Read, but its exact book route is never restored. Recovery handles only subscription `completion`; synchronous retries through `pressBook` bypass it.

  **Evidence:** Read-only probe using actual Book hooks and real in-memory SQLite at this head produced `pending=false`, `stack=[]`, and the confirmed Ward text in its exact item history. A subsequent pulse still left `stack=[]`. This violates `docs/system/book-ui.md`’s D2 confirmed-route requirement. The retained regression exercises pulse settlement only, so it misses this path.
```

## Developer D2-H1 disposition — scoped recheck pending

Implemented in `c838cac423c037572f298f0fa920789fb115983c`: synchronous retained
Read retry restores its exact projected book/parents once after confirmation.
[Actual title-press regression, controls and checks](../evidence/2026-10-05-d2-priory-books/hosted-h1.md)
retain the result. Save/authority and v027 pins are unchanged. This does not change
the hosted independent verdict.


## Independent D2-H1 scoped recheck — APPROVE

Exact source `c838cac423c037572f298f0fa920789fb115983c`, evidence/disposition head
`c7927528`; same independent primary reviewer in a separate detached checkout.
**D2-H1 closed; no new findings.** The synchronous title retry now restores the
accepted receipt's exact Ward/Bell identity and projected parent chain after
chapter Continue; pulse retains restoration beneath chapter. Recovery consumes
the captured invocation once, and committed Read history appends once.

Independent `mise exec -- node --test` across Book/authority Priory, presenter,
Lantern, kernel Priory/contracts/Deep Fen and App chapter files: 40/40 pass on
restored exact source. App `tsc --noEmit`: exit 0. Removing only the synchronous
route in the throwaway checkout fails the actual title-Pressable regression with
`[]` after confirmation; pulse remains green. Source was restored before the
passing run; no mutant or temporary probe is retained.

Additional actual-Book controlled Ward/Bell probes pass for both settlement
paths: subsequent Look stays on World with no old Read target; closing the real
container and pressing stale Read cannot reopen it or duplicate its literal Read
text. Refusal history may append normally. The exact-target route helper retains
scene/combat precedence and refuses missing/unavailable targets without fallback.
All eight H1 evidence hashes verify. Integration of `010dc994` is docs-only;
cartridge/API/hash/IDs and Game/authority/save contracts are unchanged.

Ponytail Review: lean already; no complexity finding. This scoped headless verdict
does not replace the hosted Sol recheck, exact-head CI or publication gates, and
adds no browser/native/owner-save proof.

## Final hosted Sol D2-H1 scoped recheck — APPROVE

Verbatim response for source `c838cac423c037572f298f0fa920789fb115983c` through
evidence `c7927528e57feb12612ffda7e5f9bcfe4bbc6705`:

```text
VERDICT APPROVE

No findings. D2-H1 is closed at c7927528.

Independently verified actual Book title-press and pulse recovery for Ward/Bell, wrong-target retry, unrelated Look, one-shot recovery, scene/combat precedence and unavailable-target refusal. The new test fails against pre-fix Book and both recovery-deletion and wrong-target mutations; restored focused suite passes 25/25.

Save, authority, contracts and pins are unchanged by the fix. Eight H1 evidence hashes verify. Ponytail Review found no unnecessary complexity.

Proof limits: headless checks only; four file-backed authority tests were blocked by read-only sandbox permissions. Hosted CI was reported green by the requester, not independently rerun.
```

The four sandbox-blocked file-backed cases do not add fresh save proof here;
[the independent save/protocol record](2026-10-05-d2-priory-books-save-second-review.md)
retains its approved carryover, and authority/contracts/pins remain unchanged.
