# Owner decision: local draft-PR cadence — 2026-10-05

Owner direction (paraphrased): after the five already-open PRs are merged, keep new
development and reviews local for now. Merge each approved work unit into **local**
`main` with a merge commit after its full local checks and independent review. A
new work unit uses its own worktree and feature branch as a local draft PR. Its
brief, base and exact head, check result, review record and proposed PR
description form the handoff. The merge history and records remain in the local
integration repository. Local Git history and review
records provide the trail without another server. Periodically publish the
accumulated local `main` history for review and hosted checks before merging it
to **remote** `main`. Local merge is not hosted CI proof.

The owner separately authorized a **one-time hosted-CI exception** for the following
five reviewed PRs during [GitHub's Actions runner-assignment incident](https://www.githubstatus.com/):

- [#200 Book keyboard exits](https://github.com/lorecrafting/lokacore/pull/200)
- [#201 authored calendar and Book sky status](https://github.com/lorecrafting/lokacore/pull/201)
- [#202 fox/silent-bell outcome](https://github.com/lorecrafting/lokacore/pull/202)
- [#203 Chandler's Debt quest contract](https://github.com/lorecrafting/lokacore/pull/203)
- [#204 Green finale and five outcomes plan](https://github.com/lorecrafting/lokacore/pull/204)

Each had a fresh independent approval and passing applicable full local or docs
checks. Hosted jobs were queued or cancelled before completion; no source-test failure
was observed. They were merged in that order with exact-head merge commits. This
exception does not waive CI for later remote merges or turn a cancelled hosted job
into proof.
