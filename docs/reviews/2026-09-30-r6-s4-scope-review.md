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
