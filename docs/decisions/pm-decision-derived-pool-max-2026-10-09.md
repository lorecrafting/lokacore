# PM decision: HP maximum derived from attributes — 2026-10-09

A PM decision under the owner's grant of autonomy on mechanics (2026-10-09, given in session and
noted in Beads `loka-kgd.8`; paraphrased: the PM decides mechanics questions in the toolbox track
without asking), within the [autonomous PM ladder](../archive/decisions/owner-decision-autonomy-2026-09-30.md). It completes
[toolbox row 2](../MECHANICS-TOOLBOX.md#ranked-toolbox) (Beads `loka-kgd.8`, split from `loka-kgd.3`)
and amends [resource@1](../system/mechanics.md#resource1-kerneltssrcmechanicsresourcets).

Decided (paraphrased from the Beads notes):

1. The player body's effective HP maximum is the pool's authored `maximum` plus the derived
   `hp_max` bonus (the row 2 formula; the cartridge chooses the attributes, normally CON). It is
   computed on read; no maximum is stored.
2. A current value above a lowered maximum is clamped to it at the next write of the pool and is
   shown clamped in the GameView. Regeneration stops at the effective maximum.

Completed by the developer, as the closest sound option where the decision was silent:

3. The effective maximum never falls below the pool's `minimum`.
4. A fresh character starts at the pool's authored `start` value, as before; a raised maximum is
   reached by regeneration, not granted at selection, so no new writer is added. A `start` above a
   lowered maximum reads as that maximum.
5. The death restore value is capped at the effective maximum.
6. Composition carries the effective maximum as a non-saved `resource_maxima` map keyed by the exact
   resource target, in both kernels' portable foundation, so composition and the independent replay
   agree with the kernel's read. A row stored above it reads as it with no recovery fraction. NPC
   bodies and other pools are unchanged.
