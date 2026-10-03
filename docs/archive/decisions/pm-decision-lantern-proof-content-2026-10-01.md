# PM decision: Lantern proof content rulings (R6P P3) — 2026-10-01

**Status.** PM rulings, auto-approved under owner overnight authority (paraphrased). The owner
reviews them on return; any of them can be reversed by editing `cartridges/lantern_proof/` and
its known answer.

Scope: [pre-release-proof.md, Concrete proof](../spec/pre-release-proof.md#concrete-proof-the-ferrymans-lantern),
built as `cartridges/lantern_proof/` with the known answer `protocol/fixtures/cartridge_lantern_hash.json`.

1. **The blocked west exit is a locked gate.** Barrier `old_gate` between landing (west) and
   shelter (east), `initial: locked`, `key_item: lantern`. Why: the spec wants a blocked west exit
   with no new room, but the compiler rejects a locked barrier whose key is never in reach
   (`BARRIER_UNREACHABLE_KEY`) and one-way exits (`BARRIER_MISMATCH`), and a Connection has no
   policy. A held lantern can unlock it, so the exit is blocked only until the player has the
   lantern. This is a spec conflict; it is flagged to the owner.
2. **"Available dialogue changes" means Bram's talk becomes unavailable after either ending.**
   The endings differ by the fact `search_plan`, the lantern's holder and the landing's
   description variant. Why: one dialogue per speaker is a loader rule, and the talk's policy is
   the quest being active.
3. **"Waits only through 23:00" is the fixture's claim limit, not an authored rule.** Why: `wait`
   is an engine verb and the kernel schedules daily; nothing is authored for it.
   Superseded 2026-10-02: the Lantern has no wait ([owner decision](../../decisions/owner-decision-untimed-lantern-2026-10-02.md)).
4. **Bram's talk policy stays "quest active"**, with no lantern requirement. Custody and presence
   are checked at `choose` through the dialogue's roles. Why: this matches the spec's "both
   choices require current lantern custody and Bram's presence" at the choice, and the ferry
   cartridge's shape.

**Q-1 (from the P3 review, flagged to the owner).** Holding the lantern, the player can unlock the
west gate, so after `carry` the west exit is no longer blocked. This is harmless: the frozen cases
only move west before unlocking (`exit_locked`), so they are unaffected. It follows from ruling 1.
