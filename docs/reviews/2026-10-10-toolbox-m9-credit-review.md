# Review: M9 pack kill credit and sim checker envelope (loka-lpq6, loka-th7x)

- Branch `toolbox/m9-credit`, head `ac6ab6a45e2a0978746296b3c39848b6ca0e3a95`, diffed against `82cefdf2` (base of `toolbox/batch-m9`). No PR (batch model). No `kernel_api` bump.
- Governing: [Party credit](../system/mechanics.md#npc-vs-npc-damage-allies-and-kill-credit-toolbox-row-6b) (amended here, `mechanics.md:2259`), [Experience](../system/mechanics.md#experience-and-levelling-toolbox-row-4) (`mechanics.md:1837`), Beads `loka-lpq6`, `loka-th7x`.
- Hosted ci and book-e2e green on the head (`gh run list --commit`, reviewer).
- Verdict: **APPROVE WITH NOTES** (no blocker, no should-fix, three nits, one question).

## Must be true

1. A death in the player's encounter, by the body's or a listed ally's round blow, pays once, whether the victim is the primary or another starting roster member and whether the fight closes or the pack fights on.
2. No credit without the round's own proof: the attack_result, corpse, fatal hp write and the round job's own close or advance in the same writer group; a status tick, bleed job or spell kill earns nothing (no attack_result under its cause).
3. Two kills in one round compose into one levelling write.
4. Chapter 1 receipts unchanged: its only `death_credit` rows are the five cellar rats (ordinary fights); hounds have no mapping and no levelling.
5. `lastOpponent` equals each replaced expression, including `active_ids` absent and empty.
6. The liquid checker exempts exactly Step's envelope order (`world.ts:184-188`: NIL, then context, then actor), only once an offer exists (offers imply the capability and no pending ancestry).

## Proof

- Named files green at head: `combat_credit`, `c4_pack`, `c4_pack_flight`, `hounds`, `e1_creatures`, `transcripts`, `showcase_combat`, `liquid`, `targets`, `sim_mechanics`; `npm run typecheck` exit 0.
- Mutants (detached worktree, reverted): victim must be primary (`credit.ts:101`) red (targets, showcase 9); close only, no advance (`credit.ts:71`) red; `lastOpponent` `?? 0` red; round always closes on a kill (`round_attack.ts:145`) red (4); NIL exemption dropped (`invariants_view.ts:190`) red; exemptions moved before the offer lookup red (pre-choice test).
- Survivors (rerun against all named files plus `combat`, `levelling`, `c5_bleed`): find's causation filter dropped (`credit.ts:74`) is equivalent: one proposal holds at most one round per encounter, since an elapsed past the successor's due time faults `nonfuture_job` (probe: rat at hp 2, one elapsed 0 to 300); ending `writer_group` match dropped (`credit.ts:72`) (nit 2), the same mutant on the base `closed` check also survives.
- Other death paths: status tick, bleed, water expiry and spell kills carry no attack_result under their cause, so `attackOf` (unchanged, `credit.ts:63`) refuses them; no dedicated test pins this (pre-existing). Pack flight then kill closes with `expected` holding the starting roster (`round.ts:81`), so the kill pays; `c4_pack_flight` green, but no credited cartridge exercises it. Replacements and helpers enter only through admission or a later round's advance; a round only prunes the roster (`round_flow.ts:179`), so no member joins mid-round outside `expected.active_ids`.
- Probes: NIL plus foreign actor gives `permission_denied` in Step and the checker agrees; a stale `world_context_id` is caught earlier at `invariants_view.ts:42` (sim passes `world_context_id`, `sim.ts:264`).
- Refactor: `!a || a.length === 1` and `(a?.length ?? 1) === 1` agree for undefined, `[]`, one and many.
- Claim cites rerun: `mechanics.md:2259` is the amended Party credit; "Chapter 1 hound receipts unchanged" holds (point 4, hounds and transcripts green).

## Findings

1. **nit**, `kernel/ts/src/mechanics/combat/credit.ts:107`: repeats the causation equality already required at `:74` (with `job.due_time === event.logical_time` at `:106` they are the same test). Drop `:107`.
2. **nit**, `kernel/ts/src/mechanics/combat/credit.ts:72`: no test fails when the ending's `writer_group` match is removed (pre-existing: the same mutant on the base `closed` check survives). Scenario: a counterfeit ops list with the round's close in another group still credits; the counterfeit list in `combat_credit.test.ts:27` has no such row.
3. **nit**: no developer `/code-review` result reported in the handoff; run in the fix round.

## Questions

- Respawned pack members pay again on each death (`replacement_delay`). This matches `mechanics.md:1837` ("each death ... adds"); whether to cap farming is a PM/designer call, not a defect here.
