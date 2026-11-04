# Owner decision: corpses and respawn — 2026-11-02

Written 2026-11-02 by the developer of Beads `loka-kgd.203`, from the PM's relay of the owner's words.
The owner's words are verbatim, typos kept.

Owner, 2026-11-02 (verbatim): "corpses on the floor should say what the corpse is of. LIke 'The corpse of
a raider is here'"

Owner, 2026-11-02 (verbatim): "No corpses should not be abel to be carried, but they can be looked inside
of like an open container to take stuff from."

Owner, 2026-11-02 (verbatim): "Hm shoudl we make coprse decay, i leave that up to you for the interval ...
We dont want things respawning and then having tons of corpses all around forever. I also leave up respawn
time up to you, something suitable for a prologue game"

What follows:

- A corpse's text may name its victim (`{victim}`, the victim's short). The showcase's NPC corpse reads
  "The corpse of {victim} is here." after the owner's example; its short "the corpse of {victim}" follows
  it. The player corpse keeps its words.
- Corpses stay uncarriable (death@1 already refused Take); Look inside and Take from work as for an open
  container, an owned player corpse only for its owner.
- Corpses decay, opt-in per world: when the time is up the corpse's direct items spill to its room and the
  corpse leaves play. Nothing is destroyed. [Mechanics](../system/mechanics.md#death1--corpse-custody-and-same-body-return-m5-b-foundation).

The owner left the numbers to the PM. These are the prologue's starting values, at rate 50 (one real minute
is 3000 units), open to tuning:

| Setting | Value | Real time |
|---|---|---|
| `world.death.npc_corpse_decay` | 15000 | 5 minutes |
| `world.death.player_corpse_decay` | 90000 | 30 minutes |
| Goblin populations' `replacement_delay` | 45000 | 15 minutes (not yet applied: the goblins' `wander_interval` exceeds it, which the schema refuses; the showcase keeps 8640000 until the PM decides) |

Hens keep 86400.
