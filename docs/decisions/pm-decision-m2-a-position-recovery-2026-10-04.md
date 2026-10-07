# PM adoption: M2-A position recovery (2026-10-04)

Under the [autonomous mechanics delegation](owner-decision-autonomous-mechanics-2026-10-03.md),
PM adopts exact fractional resource recovery by position and the narrow final player
rate/position agreement guard. The governing behavior lives in
[mechanics](../system/mechanics.md#resource1-kerneltssrcmechanicsresourcets),
[composition and final adoption](../system/protocol.md#composition), and
[cartridge opt-in](../system/cartridge.md#compiler); the implementation brief is
[M2-A](https://github.com/lorecrafting/lokacore/blob/f8513671ea7dd84d681876b2e36850129a4b0564/docs/briefs/m2-a-position-recovery.md).

M2 follows reviewed M1-B2 merge `e1b90dca77303dbdbd5bc58284fb67282c3f21e6`.
The initial disjoint source draft has advanced to one vertical change: portable resource
contracts and twins, the position writer/final agreement guard, actual Save load and
reconciliation, and sampler0.0.5. API1.2 was available at the actual generation baseline
`6d9712ef2b0ea12be537e4ef4c826a6d04e155af`; earlier requirement ranges remain frozen.
The sampler authors MV82/start82/min0/gain18, every3600, rates18 standing/sitting
and36 resting/sleeping, MV1 movement and MV-specific condition labels.

Existing format-v2 saves and release pins are preserved. An opted release needs its
born player-body metadata and final rate/position agreement; incompatible or malformed
rows are save_corrupt. No old release is retargeted and no NPC pool is materialized.
Scheduled NPC transfer remains pool-free. Simulator and automated proofs precede a
batched native preview after recovery and carrying; physical-device work remains deferred.

Normal primary review, separate Sol re-check and fresh Astra implementation review of
proposal-loop changes remain required. Planning advice is not implementation approval.

PM scope amendment from actual prepush failure: generator14 seed1791136864905
exposed simulator drained rows authored as `{value, at:0}` despite the sampler's recovery
opt-in. The simulator may preserve newWorld's valid opted birth metadata while changing
only value; legacy drained rows remain exact. Record this seed through the existing seed
mechanism and demonstrate the old authoring red control. Draws, order, generator version,
validation and fixture answers remain unchanged. No general simulator work is authorized.
