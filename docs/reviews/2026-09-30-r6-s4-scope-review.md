# Review: R6 S4 scope (owner decision, ROADMAP rows) — 2026-09-30

- PR: #72, branch `r6-s4-scope`
- Commit reviewed: `910cdf7`
- Reviewer: independent (Claude Code, Opus); docs-only, short review, no mutation testing
- Verdict: **APPROVE WITH NOTES**

## What must be true (written before reading the diff)

1. The record states options A and B and marks the owner's words paraphrased.
2. Resume notes agree with 07 §10 (one wall-clock sample, cartridge-declared clamp/rollback
   policy, idempotent resume input on the normal decision path, no double-applied interval)
   and 04 §5.4 (whole-advance due set, fixed allowance, over-limit discards the advance).
3. S4, S6 and R6P rows agree; each moved item has one home.
4. No row or record claims a gate pass for `real_elapsed` or OFF-08/09/13.
5. No `docs/spec/` edit.

## Checks

- 1: holds (record lines 3-4, 13-23).
- 2: holds; the notes are labelled "PM notes, not decisions" and contradict no clause
  (see N1, N2).
- 3: holds within the R6 table; S4 row points, S6 owns the `play_time` proof, R6P owns the
  drain. See S-1 for the Early R7/R8 row.
- 4: holds (ROADMAP S4 row; record line 20).
- 5: holds; the diff touches only `docs/ROADMAP.md` and `docs/decisions/`.

## Findings

### S-1 should-fix — `docs/ROADMAP.md:52` (R6P row) vs `docs/ROADMAP.md:51` (Early R7/R8 row)

The R6P row says the drain lands in P3/P4 "with the first real job, Bram's schedule". But
P4 depends on "P2/P3 + selected early R7/R8 slices" (pre-release-proof.md:74), and the
Early R7/R8 row owns "NPC calendar/schedule/behavior". Bram's schedule moves him "through a
durable scheduled command" (00a:689), so the NPC schedule slice is the first `job.schedule`
emitter. Failure: the Early R7/R8 schedule slice is built and reviewed before P4 with no
drain, so it cannot prove a wait moves Bram (its acceptance has nothing to run), or it
builds the drain itself and the R6P row now names a second owner. Fix: name one owner,
e.g. "the drain lands with the Early R7/R8 NPC schedule slice that P4 integrates", or say
on the Early R7/R8 row that its schedule slice carries the drain.

### N1 nit — `docs/decisions/owner-decision-s4-scope-2026-09-30.md:15-16`

The quote "wait to hour 19 moves Bram through a durable scheduled command" is linked to
`pre-release-proof.md` but comes from 00a:689. A reader following the link does not find
it. Link 00a, or quote pre-release-proof.md:59/74.

### N2 nit — `docs/decisions/owner-decision-s4-scope-2026-09-30.md:37-43`

07 §10 makes clamp/rollback "the cartridge's documented" policy; the note states one fixed
formula. And "committed chunks" for a long absence is the catch-up batching that 04 §5.4
says "needs a separately tested durable continuation/ordering contract". Failure: a later
builder treats the note as the policy and skips the declared-policy field or the
continuation contract. Fix: "per the cartridge's declared policy, e.g. ..." and cite the
04 §5.4 continuation requirement beside "committed chunks".

## Fix round 1 — `2b3db0e`

Verdict: **APPROVE WITH NOTES**

- S-1: resolved. The Early R7/R8 row (`docs/ROADMAP.md:51`) owns the drain in its schedule
  slice; the R6P row (`:52`) and the S4 row (`:66`) only point to it.
- N1: resolved; the quote now links 00a.
- N2: resolved; the notes say the cartridge declares the policy, the formula is an example,
  and chunks need the 04 §5.4 continuation contract.

### R1-1 should-fix — `docs/decisions/owner-decision-s4-scope-2026-09-30.md:14-16`

The record restates the placement as a second fact ("the PM placed its owner in the Early
R7/R8 ROADMAP row, which R6P P4 integrates"), and its link goes to `#proposed-r6-slices`,
while the Early R7/R8 row is under `#slices` (ROADMAP line 45). Failure: a later ROADMAP
move of the drain leaves this record stating the old row, and the link lands on the R6
table. Fix: "(owner: R6P P3/P4; the [ROADMAP](../ROADMAP.md#slices) holds the placement)".
Line 14 also runs past the file's wrap width and line 17 is an orphaned fragment (nit).

### Q1 question

The owner chose "R6P P3/P4"; the PM moved the owner of the drain to the Early R7/R8 schedule
slice. Pre-release-proof.md:74 makes that slice a P4 input, so it lands on the same path,
which reads as a placement refinement. Confirm that the owner does not need to re-approve it.

## Fix round 2 — `9ee3af0`

Verdict: **APPROVE**

- R1-1: resolved. The record keeps the owner's "R6P P3/P4" wording and points to the
  ROADMAP for the placement without restating it; the link anchor is `#slices`; line 14 is
  rewrapped. The orphaned fragment at line 16 ("`real_elapsed` time and") remains, cosmetic
  only, not reopened.
- Q1 (owner confirmation of the Early R7/R8 owner) stays with the PM.
