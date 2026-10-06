# D2 public Priory books — hosted D2-H1 fix

Source `c838cac423c037572f298f0fa920789fb115983c`, following PR223's reviewed
`59899fcbd2e37dee177569f467540acfb7ede338`. The hosted Sol response is preserved
verbatim in the [primary record](../../reviews/2026-10-05-d2-priory-books-primary-review.md).
Independent scoped primary/Sol rechecks: pending; this developer disposition does
not close D2-H1. The source integrates docs-only main
`010dc99447ef1916b5928e7be02aac2805c1f4ca` and preserves prior review history.

Actual Book can retry its original uncertain Read through a later title press as
well as through pulse completion. The presenter now exposes the exact accepted
Read detail already resolved from its committed receipt. Book captures the pending
invocation before a synchronous press and restores that Read's currently projected
parent/item route once when the exact retry confirms. Another accepted/rejected
command supplies no Read target; no older item history is selected. Existing
scene/combat precedence and unavailable-target refusal remain in the route helper.

The existing actual-Book harness now shares minimal controlled input between two
distinct tests: pulse settlement beneath chapter Continue, and Continue to World
followed by the actual Scriptorium title Pressable before any pulse. Each covers
Ward/Bell in an open held chest. The new title path failed on the old source with
confirmed history but actual `[]` instead of the literal parent/item route.
Replacing the receipt-resolved target with the retrying title button's target also
fails only the title path; restoration passes all three Book tests. Later World
return/pulse remains World, proving recovery is consumed once.

| Check | Result |
|---|---|
| Book/presenter/Lantern/SQLite/kernel/D5/App focused before main merge | Exit 0; 55/55 |
| Integrated Book/presenter/SQLite/kernel/D5/App focused on source | Exit 0; 40/40 |
| Full mobile suite | Exit 0; 501 outcomes including the unchanged skip |
| App typecheck | Exit 0 |
| Changed mobile source size and formatting | Exit 0; no allowance raised |
| Initial regression / wrong retry-target mutant | Exit 1, restored 3/3 green |

The full publication gate runs through the ordinary pre-push hook after this
evidence commit; its result and exact remote head are handed to PM separately.
[Capture](hosted-h1-capture.py), [hashes](H1-SHA256SUMS) and
[verification](H1-SHA256SUMS.verify) retain redacted outcomes.

Correctness/Ponytail self-review: minimum presentation metadata over existing
confirmed receipt routing and captured invocation; no new dependency, GameView,
Game protocol, save contract or authority change. Move the existing text-label
helper into words.ts to keep presenter.ts below its existing source limit.
Verbatim hosted-response whitespace is intentionally preserved. B9 overlap now
includes Book.tsx/presenter.ts and one Logs field, plus the helper move to words.ts;
no Page or pagesAfter change. Cartridge/API/hash/127-ID pins are unchanged from v027.

Browser proof remains the targeted Priory/Ward/Bell navigation, Read, history/topic
display and refresh/reopen path. Hosted CI and scoped rechecks remain ahead;
owner save/native proof is null and native work remains paused.
