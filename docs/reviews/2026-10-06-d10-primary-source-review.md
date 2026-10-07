# D10 primary source review — 2026-10-06

Fresh independent primary reviewer; authored none of the candidate. Reviewed source
`806bfe4f3a507fad21b4da793518031ab0300f3b` against published main
`8dbd14bb6cbeb3cde372bcee3616cce69444f706`, then scoped test followup
`b8c4e8ec` and invariant fix `8a4b8b04b7ab183e86fe791e112320aed965d50c`.
This final SHA is the source covered by this verdict.

Governors: [brief](../briefs/chapter-one/d10-map-where-knock-brief-2026-10-05.md),
[PM selection](../decisions/pm-decision-d10-finding-way-2026-10-06.md),
[mechanics](../system/mechanics.md#d10-discovered-places-observations-and-knock-selected-pending-implementation),
[composition](../system/protocol.md#d10-knowledge-and-knock-composition),
[cartridge](../system/cartridge.md#d10-map-positions-and-chapel-door-selected-pending-implementation),
[Book](../system/book-ui.md#minimap-map-and-presentation-controls), and
[save](../system/save.md#d10-discovered-place-and-observation-recovery).

## Independent requirements

- Visits belong to the actor and arise from committed body entry, including ferry,
  water and death return; projection, failed travel and stale input cannot discover rooms.
- Map draws visited rooms and real links between visited endpoints. Remote links
  promise no live admission; current exits retain the ordinary door and D9 gates.
- Where exposes visible presence or an exact saved observation, including in darkness;
  unknown names reveal no unseen identity or location. Touch preserves exact identities.
- Knock uses a declared local physical face and actual responder presence, with no
  barrier/payment/quest write. Both boots remain recoverable distinct ordinary items.
- v042/API1.37 pins reflect source; recovery rejects malformed/forged knowledge in
  place and preserves receipt-bound all-prior/all-next commit behavior.

## Verdict: APPROVE WITH NOTES

No additional primary source findings. The separate foundation review owns its F1
finding and final disposition; this reviewer checked the narrow fix and its direct tests.
The candidate keeps the selected composition: shared body-transfer integration and
visible observation recording, final knowledge writer grouping, ordinary changed-row
storage, existing admission/resolution, and presentation without knowledge writes.
Ponytail Review: **Lean already. Ship.** No new dependency, route engine, tracker,
migration or speculative abstraction was found.

## Verification

- Focused kernel, contract, allocation, Book and real SQLite run: **19 passed**.
  Compiler/current-source and portable composition run: **13 passed**.
- Independently planted source mutants in a disposable detached checkout: omitted
  proposal entry recording failed two unit tests; replacing Where visibility with
  raw co-location failed the dark-room test. Restored **8 passed**; checkout removed.
- Independent Python source overlay onto frozen v041 reproduced the v042 canonical
  artifact and hash `43d90ba39b07188e62e0bf96d41963554b691134f6763cf9bf975f631ba26afc`.
  A separate source-file allocation walk using Python SHA-256/UUID reproduced all
  **211 IDs / 57 rooms**, without compiler, loader or kernel helpers.
- Reviewed retained source mutations and headless simulator results. At `8a4b8b04`,
  all **42** retained source evidence digests verified. The 24 authority-suite baseline
  failures reported on published main were not treated as D10 regressions.
- Scoped followups: null-row invariant tests **2 TS passed**; those Elixir tests and
  the three current-source test files **9 passed**. Fixture annex coordinates restore
  exact map coverage without weakening production validation.

## Delivery gates

Exact-candidate isolated Book/browser proof, the final full local gate, required
independent opinions and exact-head hosted CI remain publication gates. No browser,
native or owner-save session was run by this reviewer. Native work and cosmetic blur
remain deferred. The generated contract descriptions/whitespace followup is pending
and needs only a narrow check if its diff remains nonbehavioral.

PM subsequently reported a browser contradiction: the answered Knock text says the
chapel is open even after Close. A presence-only text correction and independently
regenerated v042 hash are pending. This verdict covers the source above; the final
Knock text/hash require a scoped recheck before publication.

## Scoped final content and contract recheck — APPROVE

Reviewed `8a4b8b04..3a4ec6d2d645c6e7f566157e1e339859d2c68f9e` only.
The answered Chapel Knock now says “I’m here,” making no assertion about open/closed
barrier state. An actual-source probe of both states returned the same presence-only
answer and zero delta operations. No gameplay rule changed.

Independent Python applied that one source text edit to the previously reviewed
artifact and reproduced the complete final canonical value/hash:
`5d8b0e3a16b209733707a8450cee5a4330965092498cf1d31ab8fdae9a50fc8b`.
The 211-ID oracle is byte-identical. Compiler/current-source tests: **11 passed**;
focused contract/presentation/allocation/App save tests: **14 passed**; every chapter
transcript replayed successfully, including the recaptured current knowledge trace.

Nine schema descriptions are the only generated DEFS changes; validation constraints
are unchanged. Full candidate `git diff --check` is clean. The four stale source-test
expectations were already checked in the first review's `b8c4e8ec` followup; this range
contains no further source-test changes. Ponytail Review found nothing to cut.

One nonblocking documentation correction remains: `KnownNpcView` should include
currently visible NPCs as well as previously observed NPCs. Its current description
omits the supported visible-without-a-saved-observation case; runtime and the focused
unit regression already handle it. PM has assigned the description correction.
Browser completion, full gate, independent opinions and exact-head CI remain
publication gates.

## Final description closure and hosted Astra opinion

The `KnownNpcView` description was corrected in `3e2a5b72`; the primary reviewer
independently rechecked it. Schema constraints, cartridge hash, IDs and behavior did not
change. The full local gate and hosted checks passed at the PR source head.

```text
VERDICT: APPROVE WITH NOTES

PR #263
Head: f1ec101a1f5602a6539e8f2bd5a57b9f117983b2
Base: 8dbd14bb6cbeb3cde372bcee3616cce69444f706

Findings: none. F1 remains closed.

Verified exact-head CI, including headless simulation and Book E2E; focused tests and additional knowledge-enabled bleed/death, Where and shared-door probes passed. Independently verified the v042 hash, 211 IDs, 57-room coverage and retained evidence digests.

The 24 synthetic authority failures are documented failures reproduced on published main, not D10 regressions.

Read-only limits: filesystem-dependent SQLite/compiler and source-mutation checks were assessed through code, retained red controls and independent review records rather than rerun locally. No files, Git state or owner saves were changed. Explicit pin-mismatch refusal remains intact; mobile and UI blur work remain deferred.
```