# Owner decision: fast provisional local integration — 2026-10-05

The owner asked to optimize the new local workflow for speed and said, “we can
afford to go fast and break things if needed if the things that break are things
we can fix just before release, we just wanna go FAST.” This supersedes only
the requirement in the [earlier local cadence](owner-decision-local-draft-pr-cadence-2026-10-05.md)
to wait for independent review before merging a complete slice into **local**
`main`. It does not authorize publishing unreviewed work to GitHub `main` or
calling a provisional slice chapter-complete.

For a complete player outcome, the developer keeps a separate worktree, writes
the governing spec before code, and self-reviews the exact diff. Before a
provisional local merge, run the normal hook, touched-layer compile/type checks
and focused behavioral tests. A changed schema also gets its generator/check;
new save or receipt behavior gets focused real-SQLite reopen and fault checks.
Record any unavailable check and the exact error. The full `bin/check_all.sh`,
broad red-control suite and headless simulator may wait for the accumulated
publication head; do not rerun them after an unchanged result. The PM may
then merge the slice into local
`main` with a merge commit marked **provisional**. Start the next sequential
source slice from that local integration head while a fresh independent reviewer
checks the exact source/merge head. A required separate save/protocol/foundation
opinion runs in parallel. The same developer fixes findings on the original
slice branch; the PM merges reviewed fixes into local `main`. Keep review records
and unresolved findings visible in the handoff. A reviewer finding does not
silently become accepted behavior merely because local `main` advanced.

The public completion count advances only after review findings close and the
player outcome is complete. Before batching local history to remote `main`,
close every open review finding, run the active full checks and required red
controls on the exact accumulated head, and require hosted CI on the publication
head. A new guard still needs one focused behavioral red control during its
slice; the full schema mutant sweep may wait for publication. The release proof gates
remain separate. Preserve the owner checkout and saves; native builds and UI
blur stay deferred.

To reduce ceremony, a settled small spec amendment may be the first commit of
its implementation branch and receive one combined independent review. A
cross-mechanic or save contract gets a short planning review first when that
can prevent rework, as the B3 shop review did for Chandler's Debt balances.
Batch related content/copy/UI polishing into a coherent work unit. No new
framework, forge server, parallel edit of the same source files, repeated full
check without a change, or compatibility adapter is needed for this speedup.
Keep review records short: links to governing clauses, verdict, concrete findings
and proof of each disposition. Fix rechecks examine the changed code and direct
callers, not the whole slice again unless the fix rewrites the core. No separate
review for every copy tweak inside one work unit; its combined outcome gets one
review before remote publication.
