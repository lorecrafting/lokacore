# Owner decision: one lane, the mechanics toolbox; Storybook polish paused — 2026-10-12

Written 2026-10-12 04:26 UTC in the Pi harness by anthropic/claude-opus-5-5 (PM, Pi session 01a12e09).

On 2026-10-09 the owner ran two parallel tracks: Storybook polish (Beads `loka-x6t`) and the mechanics
toolbox (`loka-kgd`). After the M9 batch merged (PR #378) the PM asked whether to keep one lane.
Owner's words, 2026-10-12 (source: Pi session 01a12e09):

> wait just pause the storybook line for now because we will reactivate it later.

> Yes we will run pi until all our tokens run out and then wait until wednesday.

## Effect

- One development lane: the [mechanics toolbox](../MECHANICS-TOOLBOX.md), batch by batch (M9b next),
  run continuously; the PM starts the next row without asking ([mechanics lane autonomy](../system/owner-rules.md)).
- The Storybook [live polish session](../WORKFLOW.md#live-polish-session) lane is paused, not closed:
  its Beads items stay open and parked; no polish sessions or picker watches run until the owner
  reactivates it. Playtest-found Book bugs are still filed in Beads.
- Budget (paraphrased): the lane runs in Pi until the owner's token budget is spent, then waits for
  the Claude Code weekly reset (Wednesday 2026-10-14).
