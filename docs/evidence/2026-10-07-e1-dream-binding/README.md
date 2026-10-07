# E1 presentation-only dream witness checkpoint

Clean source `3d33413033f589928cd42a81bccad7768d2ab040`, check digest
`611235329e8d69d15ef4251df50eca8046070394be36d43451871e0f191ed269`,
and the fixed v042 candidate content hash
`5d8b0e3a16b209733707a8450cee5a4330965092498cf1d31ab8fdae9a50fc8b`
bind both selected dream options and their acknowledged scene steps. Each accepted
command is checked against the displayed bed-local dream state, and replay
derives the same paths. A shown or offered option alone earns no witness.

The focused real SQLite suite passed 6/6. Removing the selected-choice witness
left the prior five cases green and failed the new two-branch test. TypeScript
typecheck and the docs check passed. The clean-head recorder then exited
**2, pending**: all 18 isolated SQLite cases and semantic replays passed, all
ten previously open dream-scene paths were witnessed, and **499 authored paths**
remain open. E1 is not certified.

The independent review found that the initial test did not check the Rest
command that first displays the dream. Test commit `8373c0f3` adds an explicit
no-credit assertion on that committed display in both branches. The focused
suite passed 6/6 again. A premature-Rest-credit mutant left the prior five
cases green and failed the new dream case; the corrected test does not alter
the source-bound recorder code or its check digest. The full recorder must be
rerun on the final combined source.

The [report](report.json), [two dream traces](dream-follow_fox.jsonl) (including
the [wake branch](dream-wake.jsonl)), redacted [CLI log](cli.log), and
[green](rest-focused.log)/[old suite](rest-old-mutant.log)/[new case](rest-new-mutant.log)
negative-control logs are hashed
in [SHA256SUMS](SHA256SUMS), with [verification](SHA256SUMS.verify). The complete
isolated output was hashed at capture in [case-SHA256SUMS](case-SHA256SUMS),
with [verification](case-SHA256SUMS.verify). The recorder's `redact()` covers
local paths and host identifiers in failure output.

The diff reuses the existing witness/replay path and adds no dependency or
configuration. Its Ponytail Review found no extra abstraction; the remaining
dialogue, recipe and other authored paths still need their own exact receipts.
