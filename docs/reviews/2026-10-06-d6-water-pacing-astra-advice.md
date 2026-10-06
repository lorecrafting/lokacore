# D6 water pacing — independent Astra planning advice

**Advice only: no review verdict, policy adoption or source approval.** Inspected
published main `815f66f9039ca22f80d44112a1ff966eadb8381e`, including D1's
free Sedge lesson and D5's dry Black Pool bank. The published
[D6 brief](../briefs/chapter-one/d6-water-depths-brief-2026-10-05.md) remains
provisional. Separately inspected local D6 adoption head
`d7a357099138377357bb4fc8301a437f5a425e1b` and its corrected, documentation-approved
head `95431041505f8349fdc76f37793b3416e55cbf97`, with
`docs/reviews/2026-10-06-d6-water-depths-adoption-review.md` at that head.
Those local selections are not installed published behavior; their review did
not certify underwater playability. No source implementation was evaluated.

## Pacing finding

Published `cartridges/ashmere_missing_child/resources.json` starts **MV at 100**;
20 is starting pennies. The brief's MV 20 is a controlled acceptance input.
At rate 50, entry cost 10, drain 5 every 150 logical seconds and standing
recovery 18/3600, zero initial remainder gives these stationary boundaries:

| MV before entry | First lethal drain | Real elapsed |
|---|---|---|
| 100 | Tick 21: 90 + floor(21 × 0.75) − 105 = 0 | 63 seconds |
| 20 | Tick 3: 10 + floor(3 × 0.75) − 15 ≤ 0 | 9 seconds |
| 10 | Tick 1: 0 + floor(0.75) − 5 ≤ 0 | 3 seconds |

The nine/three-second windows punish reading and detail navigation. Full MV
is not the admission guarantee. Naively lengthening the interval also fails:
5 per 1000 logical seconds exactly matches standing recovery; resting/sleeping
matches it at 500. Restricting posture or suppressing recovery adds new rules.
[Book details](../system/book-ui.md#detail-page-order) place prose before options,
and [general reading protection](../system/book-ui.md#future-boundaries) remains
future work. The local D6 draft promises World Up controls, not escape from
every underwater detail page.

## Recommended smallest contract

Replace recurring drain with **one generation-bound deadline**, initially
3000 logical seconds (60 real seconds) after accepted entry. This is proposed
cartridge tuning requiring browser play, not a measured usability result.

- Retain acquired swim, load≤6000g, MV≥10, living/standing/out-of-encounter
  admission and refusal while Wren follows; no attribute floor or waiting gate.
  Refusal changes nothing. Entry spends 10 MV and atomically records occupancy
  and its single due job. MV 0 alone does not drown; ordinary recovery continues.
- At the deadline, revalidate current occupancy/generation and life. Apply
  positive HP→0 and the [existing fatal sequence](../system/mechanics.md#death1--corpse-custody-and-same-body-return-m5-b-foundation)
  once in one writer group, with typed drowning and null killer/credit. Cancel
  occupancy on any departure/death; stale jobs cannot affect a later dive.
- Free Surface remains available despite changed skill/load/MV/posture/light.
  Show the captured existing move offer and projected remaining time on every
  underwater page, with an entry warning; no separate renderer clock or modal
  reading trap. Return is confirmed only after commit.
- Preserve the [elapsed driver](../system/save.md#durable-elapsed-sessions):
  background/cold reopen settles durable debt before input, never resets the
  deadline. At equality the due death wins; a committed earlier Surface cancels
  it. Persist/reconcile occupancy, job, custody and receipts atomically; prove
  reopen, failed/unknown COMMIT, replay and malformed-state refusal.
- Retain the locally selected Chapel action transferring actual owned corpse
  roots, preserving descendants and empty corpse identity, allowing overload,
  with no fare/gear requirement, copies, deadline restoration or rewards.

Action-only costs avoid timers but permit indefinite submerged idling. A single
deadline preserves continuous-world drowning without an oxygen pool, recurring
drain or recovery exceptions. Existing jobs, movement, death and custody suffice.

Self-review: arithmetic and published/provisional boundaries checked; Ponytail
Review found no extra framework necessary. Documentation and whitespace checks
pass. No runtime tests, browser/native proof, owner-save access or publication
are claimed by this note.
