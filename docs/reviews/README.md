# Independent reviews

Each record is written by a fresh agent that authored none of the reviewed work (AGENTS.md).
A record is `<YYYY-MM-DD>-<slice>-review.md` (a second opinion or audit may say so in the slug)
and states the PR or local branch, the exact commit reviewed and the verdict; findings,
dispositions and later fix rounds are appended to the same record. There is no per-record
index (it made every record commit conflict): list this directory, newest last, with
`ls docs/reviews` or `git log --oneline -- docs/reviews`, and grep it for a PR number.
`bin/check_docs.exs` checks each record's name and links.

Records of closed work are deleted once their lesson is folded, and linked by permalink
([move forward](../decisions/owner-decision-move-forward-2026-10-07.md)); the last per-record
index is [this file at `e38af110`](https://github.com/lorecrafting/lokacore/blob/e38af110e829b75b1df567e2c55b8765759894c6/docs/reviews/README.md)
and older lines are in [this index at `15c7d41b`](https://github.com/lorecrafting/lokacore/blob/15c7d41be6c54208cd37b03aa87420f9f4b90d8e/docs/reviews/README.md).
Reviews before R2 live in the [legacy repository](https://github.com/lorecrafting/lokacore-v2-legacy)
(commit `997a7a8`, `docs/rewrite-v3/reviews/`).
