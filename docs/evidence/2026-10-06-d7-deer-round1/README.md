# D7 PR #253 round 1 fixes

Fresh primary and save/protocol reviews approved source head `776742a6`; the required foundation review found two P1 same-clock failures, copied verbatim into the primary review record. This fix is based on the unchanged v036/API1.31 content pin and frozen fixtures.

- D7-01: two deer have equal-time sight jobs after a surviving Willow round. Matching the encounter member in foundation, independent invariant and cold-save receipt checks admits the Willow handoff. The controlled kernel test failed `precondition_failed` before the fix and again with the member check removed; its literal answer is an accepted round advance, Willow flight and closed encounter.
- D7-02: an absent player's harmless Oak sight clears its slot, then the equal-due Oak population arrival binds that same member again. The protocol now states the sole sequential slot-write exception. The controlled kernel test failed `conflicting_write` before the fix; its literal answer is Oak in Willow, a single new sight binding due at 68700. A shifted unrelated slot writer still faults `conflicting_write`; broadening the exception made that red control fail.

The focused kernel cases passed 4/4; real file-backed deer SQLite passed 5/5, including cold reopen, COMMIT faults, lost acknowledgement and replay. `mise exec -- bin/check_all.sh` passed before commit, including Elixir, contracts, docs, TypeScript, headless simulation, size, lint and format. The push hook must also pass on the committed exact head. Mobile device and owner save remain paused.

Correctness self-review traced slot prior/overlay writes, typed population transfer and new sight schedule, member/generation/plan/job/due/cause matching, and unrelated target conflict refusal. Ponytail Review: the fix adds only the checked exception; the helper is split because the active 40-line function gate requires it. No new dependency, generic scheduler, whole-state clone or source size allowance.

Raw outputs were redacted by [capture.py](capture.py), hashed in [SHA256SUMS](SHA256SUMS), and checked in [verify.txt](verify.txt).
