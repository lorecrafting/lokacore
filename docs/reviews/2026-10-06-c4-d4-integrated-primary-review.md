# C4 over published D4 — integrated independent primary review

**APPROVE. No open primary findings.** Exact production source
`749a1705d41ddd86273231ac8661793b7f5a19ce`, frozen evidence-only head
`d4597c4c1c8a62e2e877d133c102f27a49ed3554`, published D4 ancestor
`536c80bc76882839465aecc330e22e891e1e137d`. The reviewer authored none of
C4 or D4 and used a separate detached worktree. This review changes only this
record and its index; no developer checkout, device, owner save, push or PR was
changed.

The governing [C4 brief](../briefs/chapter-one/chapter-one-c4-hound-behavior-brief-2026-10-05.md),
[mechanics](../system/mechanics.md#c4-hound-response-pack-assistance-and-flight-selected-contract),
[protocol](../system/protocol.md#c4-pack-encounter-and-flight-composition),
[save](../system/save.md#c4-pack-and-flight-recovery) and
[Book](../system/book-ui.md#c4-pack-response-and-enemy-flight-details) were checked
with the prior C4 primary/save/foundation approvals and the published D4
primary/save reviews. The C3 proposal/Astra review remains the foundation
precedent; C4 does not change `runtime/proposal.ts`.

## Integrated behavior and independent checks

- The D4 merge retains one combat encounter/job and C3 slot lineage. Attack
  admits exact current co-present members once; one selected member supplies
  each opponent opportunity. A selected wounded hound uses a legal area exit,
  retains its pelt, and leaves the roster. The even-round player opportunity,
  whole-pack Flee/death closure, same-clock population suppression and atomic
  flight/encounter/receipt path remain intact. D4 opted food and terminal custody
  keep their published path; Book Combat projects the current primary and exact
  active roster above committed history with Stand/Look/Flee controls.
- Independently reconstructed the v032 artifact solely from published D4 v031
  plus the C4 pack/narration deltas. Its API is `1.28`, canonical SHA-256 is
  `b8e7b783483c598e6a455d8c117674bd01b96aaab5edc80b6be8df9e3b8db2bd`,
  and all **167** unique genesis IDs agree with the v032 fixture and D4's
  independent prior allocation. The final exact-head content/compiler check is
  covered by the full gate.
- A focused independent kernel/SQLite/Book line passed **39 Node cases** and
  **10 ExUnit cases** on the D4-integrated source. I temporarily retargeted the
  existing real-SQLite C4 suite to the current v032 artifact, changing only its
  old v029 identity-order/slot assumptions in the isolated probe: cold reopen
  after rotated flight and failed-COMMIT/exact retry passed **2/2**. The test file
  was restored. A helper-for-primary attacker mutation failed the named actual
  helper identity case, then the restored pack suite passed.
- The final source adds literal invalid inputs for pack threshold/required
  declarations, three encounter roster caps, Book Combat roster bounds/member
  fields and nonnegative flight time. Focused recheck passed **16 Node** and
  **9 ExUnit** cases. My independent delete-one-guard sweep of the **23** C4
  required/bound additions changed from **17 survivors** before the fix to
  **zero survivors** afterward. The developer's retained 23-case red sweep and
  zero-threshold compiler mutant agree; no changed schema or generated file was
  left in the review checkout.
- I independently ran `mise exec -- bin/check_all.sh` on the final source:
  **368 ExUnit tests and all active checks pass**. A fresh simulator run passed
  **18 tests**; the frozen run records **503 sequences and 16,744 steps**. The
  isolated web Combat test passes with the current target and helper narration;
  omitting the roster projection fails at the target assertion. This browser
  check proves the visible admission route, while the focused kernel/SQLite
  checks prove later attacks, flight and recovery.

All **31** retained [C4 raw logs](../evidence/2026-10-06-c4-hound-behavior/README.md)
are listed once and match `SHA256SUMS`. The evidence-only commits after the
source add no production changes. The new sweep capture initially missed some
privacy patterns; the final script now covers scratch paths, device and signing
identifiers, and app-container IDs. Its controlled redaction test is **19/19
green**, while bypassing redaction fails **19/19**; I also found no raw home or
scratch path in the retained sweep/redaction logs. The script correction is
closed at the frozen evidence head.

Ponytail Review: lean already. The D4 integration and C4 fix reuse existing
composition, encounter, population, food, receipt, GameView and Book paths. No
new framework, scheduler, ledger, compatibility adapter or dependency appears.
No additional complexity finding. The separate save/protocol carryover opinion
retains ownership of its contract and recovery verdict. Hosted CI, native and
owner-save evidence are outside this local review.
