# Owner decision: NPC behaviours, NPCs that act as players do — 2026-11-06

Written 2026-11-06 in Claude Code (Opus 5.5), from the NPC routines design session (Beads loka-ni2zd).
The owner's words are paraphrased. The plan is [NPC behaviours](../rnd/npc-behaviours-2026-11-06.md),
written by Fable from this record.

## Already settled (owner, 2026-11-06, earlier the same day; paraphrased)

- NPCs walk leg by leg along exits (crow style), never jump at the hour, so players can meet, follow,
  rob or escort them.
- The sink that returns used-up items to the reserve is deferred.
- Items stay conserved: nothing is minted; regrowth and restock are custody moves (replenish).
- Saves and replays stay deterministic; day-to-day variance is a hash of NPC and day, never an
  authority RNG draw ([trap 5](../MECHANICS-TOOLBOX.md#traps)).
- Both kernels carry every rule, held by fixtures and differential tests (see the open point below).
- The prologue has no economy: this is for the paid books and the showcase, not v1.

## General, not an errand list

Owner, 2026-11-06 (paraphrased): do not hard-code what an NPC does (harvesting, selling). Build a
system expressive enough that an NPC plays like a real player and interacts with and shapes the
world, to make it more alive and immersive. The first recommendations were geared to a contrived
craft-and-sell loop; abstract them into a general engine. Offer canned behaviours an author attaches
to an NPC, in layers (sleep and wake at a place, harvesting, guarding a pasture and attacking
intruders), as long as layers do not collide; full expressivity, with the easy things easy.

The design the session proposed, which the owner asked to be planned (paraphrased: "the stuff with
the most impact"), and which this record adopts as the PM's recommendations, unobjected:

1. **Act, the primitive.** An NPC sends the player's own commands (move, take, put, give, harvest,
   attack, open, lock, light, perform, sell, buy, wear, eat, position verbs), through the same rule
   and admission, with the NPC as the command's actor (the 2026-09-25 puppeting rule: rules read the
   actor from the command). Verbs open to NPC actors one by one, each with an audit: third-person
   narration to observers, no player credit (quest, XP), save reopen.
2. **Arbiter.** One behaviour owns the NPC at a time. Four fixed layers, highest first: reflex (fight
   back, flee), duty (guard reacts), routine (sleep, wake, work), idle (wander, ambient); ties by
   declaration order; no numeric priorities. Preemption only between steps (each command is atomic).
   Each behaviour has `when` to start and `until` to stop (hysteresis) and declares resume or restart.
   The arbiter decides at step boundaries, hour marks and events a behaviour listens to.
3. **Plans, the expressive part.** Data, not a language (owner rule 2026-10-23, no script
   interpreter): sequence, conditions, bounded repeat, target finders (`find`), `go` (leg-by-leg walk,
   W26 pathing recomputed each leg), `wait`, `act`, `emote`/`say`; no variables, arithmetic or
   unbounded loops; caps of about 16 steps per plan and 8 behaviours per NPC.
4. **Canned behaviours.** Parameterised compile-time shortcuts that lower to plans (as `behaviours/`
   and `extends` lower today): `sleeps_at`, `works_at`, `harvests`, `guards`, `wanders`, `shelters`,
   and more. An author can open one and edit its plan.
5. **Movers.** An NPC uses the existing movers (daily schedule and cases, population wander, patrol,
   crow, escort, hireling) or behaviours, never both; folding them into the library is later.
6. **Needs.** No needs simulation ([trap 2](../MECHANICS-TOOLBOX.md#traps)): behaviour is authored
   conditions; "hungry" is a condition the author writes, not a hidden number.
7. **Time.** One pending job per behaving NPC, its next steps crossed inside an advance (the `next`
   drain); the existing away cap (`time_policy.away_cap_hours`) bounds catch-up; full fidelity, no
   summary mode unless cold open measures over about 3 s.
8. **Economy second.** First cut: the act primitive, the arbiter, plans, verbs move, take, put/drop,
   give, harvest, attack, plus the `emote` step, and the canned `sleeps_at`, `works_at`, `harvests`,
   `guards`, `wanders`, `shelters`. Second: open/close/lock, light, perform (craft, build, mend),
   sell/buy, wear, NPC posture (position@1 with an NPC scope).
9. **Economy rules.** NPCs trade with shops only (NPC-to-NPC stock is replenish content); purses are
   conserved resource rows; selling to a shop is a save slice (shop-receipt reconciliation knows no
   NPC trade) with a Fable review; the showcase closes its loop with a timed replenish shipping
   surplus out (not the deferred sink); replenish gains a `when` (seasonal regrowth).
10. **Immersion.** The session's catalogue of cheap immersion (daily life, weather, the player,
    between NPCs, world-shaping work, danger, animals, senses, memory, festivals) is good (owner,
    paraphrased); it is the plan's appendix. Ambient lines and emotes stay only while the player is
    present. Every player-facing line is the owner's; agents leave `~`.

## Amended by the Fable review (2026-11-06)

The plan changes point 1: the host admits only `world.character` as an actor (`bodyOf` and the
command identity check in `kernel/ts/src/runtime/`), so NPCs do not send commands. A behaviour step
calls the same body-level helper the verb's rule calls after `bodyOf`, with the NPC's body: one
admission per verb, no new actor, no receipts. Also: resume is one level deep; `attack` opens only as
a walk-in engage; no `say` step; reactions to NPC-caused events grant no player credit; canned
behaviours reuse the `behaviours` shortcut with parameters. The plan's section on the review lists each.

## Rulings on the plan's open questions

Owner, 2026-11-06 (paraphrased): go with the PM's recommendations.

1. **Elixir parity is compile-time.** The Elixir compiler carries every compile-time rule (schema,
   plan lowering, leaf allow-list, caps, mover exclusivity) plus a content test; TypeScript alone runs
   the arbiter (ADR-074). The runtime port waits for a Realm server that runs behaviours.
2. **Attack is walk-in engage first.** NPC-vs-NPC combat (a guard fighting a wolf with no player in
   the fight) is its own slice, loka-ni2zd.17, ranked right after the minimum set, since the owner's
   own example (guarding a pasture) needs it.
3. **Canned behaviours are a compile-time shortcut, not copies.** One source file per behaviour; each
   NPC names it with its parameters and the compiler expands it per NPC, so a fix reaches every user.
   A scaffolded copy exists only to open one NPC's plan for hand editing.
4. **Catch-up stops once per game hour** while behaviour jobs pend. Before the showcase adds more
   NPCs, a real catch-up with twenty behaving NPCs is timed on the browser build against the ~3 s
   cold-open goal.
5. The docs and the Beads checkpoint go straight to `main`.

## Effect

Supersedes the errand-list sketch in Beads loka-ni2zd. The plan's slices are Beads children of
loka-ni2zd. Docs/system is amended per slice, before its code.
