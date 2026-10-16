# Owner decision: settlements tabled, generated townsfolk — 2026-10-15

Written 2026-10-15 in Claude Code (PM), from the owner's answers in [HANDOFF](../HANDOFF.md) "Owner answers this session" (session 01da56d0).

Owner, 2026-10-15: "Hm lets table settlements for now i think homesteads is a good start and settlements can be an expansion later"; chosen option: "Land engine steps only (Recommended)".

Owner, 2026-10-15: "lets have generated residents"; chosen options: "Generated townsfolk (Recommended)", "Authored name list (Recommended)".

## Effect

1. Settlements are an expansion for later; Homestead comes first.
2. The #403 narrate and plan-move engine steps are landed; settle-3 is parked on branch `toolbox/settle-3`; the remaining `loka-mytp` children (.1 and .2 merged in #403) and `loka-oxgk` are deferred.
3. Townsfolk are generated; role-holders are authored (paraphrased).
4. PM ruling: a townsperson's name is picked from the authored name list by a hash of the entity id; no RNG and no save field.
