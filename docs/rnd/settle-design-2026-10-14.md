# Settle design: S3 settlement and S4 defense (2026-10-14)

Design plan for toolbox rows S3 (`docs/MECHANICS-TOOLBOX.md:213`, Beads `loka-mytp`) and S4 (`:214`, `loka-oxgk`),
read-only on main `b7b9bde6`. Facts cite file:line; proposals are marked. Builds on the Built rooms layer
(`docs/rnd/built-rooms-2026-10-11.md`, `loka-kgd.109`) and Homestead (`loka-kgd.108`), which land first; S1 is in
Homestead and S2 is cut (`docs/briefs/toolbox-priority-plan-2026-10-14.md` §6c). Every row here answers the Realm
seams checklist (`docs/decisions/owner-decision-realm-seams-2026-10-13.md`). Order follows that plan: Settle comes
after M15, Built rooms and Homestead; nothing here moves it earlier.

## 1. Player fantasy, core loop, the moments

**Fantasy.** You hold the charter of one small place on the road. You raise its buildings, and people come
because of what you built; they keep hours, trade, gossip and need paying. Once a month the band in the hills
comes down. What you did before the full moon decides what you find when you come back.

**Loop (one lunar cycle, real time).** Build a structure on a plot (Built rooms) -> a resident arrives and settles
(S3) -> their service opens and their goods flow into your chest and onto the town shelves (S3) -> upkeep falls due
each day; pay it or the resident leaves (S3) -> hire a guard or two, raise the palisade (S4) -> the full-moon raid
resolves with you present (a real fight with your guards as allies) or away (held or sacked by your watch) (S4) ->
repair, re-hire, grow renown, which draws the next resident and a bigger band (S3+S4).

**Moments a player tells a friend.**
1. "I built a smithy and a smith just *showed up* the next morning, with a line about it." (attraction is visible)
2. "I came back after a day and the recap said raiders came and my two guards held the square." (absence matters)
3. "I forgot to pay the miller; he packed up and I found him on the road and talked him back." (upkeep as story)
4. "The band is camped in my square. Shops shut, everyone in the cellar. I had to clear them room by room." (occupation)
5. "Flour from my mill sells for 2 in my town and 5 in the next; I run it over myself." (W11 prices, a real economy)

## 2. What the best settlement games teach, and what fits here

| Source | Principle | Borrow | Refuse (scope trap) |
|---|---|---|---|
| Dwarf Fortress, RimWorld | stories come from residents with names, schedules and memories, not from numbers | residents as authored NPCs with W10 schedules, W6 variants, W2/FD4 facts, W3 rumour | NPC needs or mood simulation (trap 2); procedural residents (trap 4) |
| Stardew, Animal Crossing | the town grows *visibly* from the player's choices; new faces are the reward | a new resident per built structure, announced in one line; the ledger board as the town's face | decoration without effect (S1 handles furnishing); dozens of residents |
| Kenshi, Mount & Blade | the enemy is a persistent band, not a spawn; towns can fall and be retaken | one raider plan whose living members persist in the hills, grow and are culled; occupation as a state | NPC-vs-NPC simulated combat; residents dying off-screen (griefing, data loss) |
| Frostpunk | upkeep is tension when it is periodic and visible | 22b wage as upkeep, a daily grid; unpaid residents leave with a line | a treasury pool, taxes, morale meters |
| classic MUD player towns | a town is shared world state: charter, roles, a notice board | G7 roles by grant; the ledger as a notice board; one town per world | free-text names and signs (trap 9) |

## 3. Mechanics model (composition first)

A town is: **authored plot rooms** (Built rooms `site` fields) around a square, **built structures** on them
(`State.created` rows with `origin.kind: built`, built-rooms §2), **residents** (population plans spawned by
reactions), **services** on residents, **trade** by replenish jobs, **upkeep** by the wage job, **roles** by G7 grants,
and **three bounded instance int facts** (`renown`, `watch`, `larder`) that every other row reads. No town object,
no new save section.

| Need | Reused piece (file:line) | How S3/S4 uses it |
|---|---|---|
| A building exists | Built rooms: `custom_event built` at completion (built-rooms §3 "Completion"), `built_count` leaf (§5 change 4) | the trigger for attraction; the leaf in W10 cases and lock policies |
| A resident arrives | `population.spawn {plan}` step, `spawn` in `kernel/ts/src/mechanics/population/react.ts`, dispatched at `kernel/ts/src/mechanics/reaction.ts:158`; `birth`/`birthSlot` (`population/birth.ts:7`, `settle.ts:92`) | reaction `custom_event built` -> `population.spawn {smith}` into the plan's `home` (the square); cap 1, targets 0 (37a rule, mechanics.md "Phased world events") |
| Residents keep hours | W10 `placeOf` (`kernel/ts/src/mechanics/schedule/behavior.ts:45-58`): first case whose `when` holds, instance facts only | cases: work plot by day, home by night, cellar while `population_count {raiders, at_least 1}`, the road once unpaid |
| Residents leave or return through doors | W26 `walks` (mechanics.md "NPCs use doors") | the smith walks to the road; the player locks the hut, the thief stays out |
| Settling and keep | G8 `member` (`kernel/ts/src/mechanics/escort/shared.ts:124`), 22a `stay` order, 22b `wage` job `runWage` (`kernel/ts/src/mechanics/escort/job.ts:39-81`): pays a prefix, sets `member` false for the rest | a resident is a member with `stay` true (never follows); the wage is the keep; unpaid -> member false -> `fact_changed {hired}` -> W10 case moves them out |
| Services | B3 shop and `shelf` (`kernel/ts/src/mechanics/commerce/shared.ts:88`), W11 `stock` prices, row 21 repair service, 20b orders | the smith repairs, the miller sells flour cheaper as his shelf fills |
| Trade and income | replenish `runReplenish` (`kernel/ts/src/mechanics/containment/job.ts:58`), `selected` (`containment/stock.ts:5`); `from`/`to` may be an NPC or an item (mechanics.md "Replenish") | mill -> miller (trade job, W11), mill -> the owner's locked chest (income as conserved items) |
| Roles and locks | G7 `lockRefused`/`chainRefused` (`kernel/ts/src/mechanics/locks.ts:11,27`); grants are W2 pair facts | charter holder, resident, guest; the chest and the storehouse are `owns_charter`-locked |
| Raiders | 37a `clock_hour` + `sky {lunar full}` rule and `raided` fact (`cartridges/raid_sampler/reactions/raid.json`, `calm.json`); G11 `disposition {hostile, engage}` engages on entry; row 9 `chance` plans (`settle.ts:59-91`) | one `raiders` plan (cap 3, targets 0): spawned at the full moon, hostile, engage |
| Guards | 22a guard order (`stay` + `fight`), `allyOf` (`combat/shared.ts`), party credit `combat/credit.ts:122` | hired guards fight beside the player; their count is the `watch` fact |
| Protect objective | row 38 rules (`raid_sampler/reactions/called_to_hold.json`, `gate_held.json`), per holder (RS-4) | `hold_the_square`, resolved by the moon |
| Consequences | `status.apply {room}` (SR9, `reaction.ts:237-255` `holdersOf`), `status.apply {npc}` (G3), W6 variants, `fact.adjust` clamp (`reaction.ts:264`) | a `sacked` status on the square, `frightened` on residents, `larder` and `renown` adjusted |
| Absence | elapsed host stops at every pending job but the calendar (`mobile/authority/local-story/elapsed.ts:61-70`); crossed due times run as their own drain step (`next`, mechanics.md "Replenish" Run) | every wage day, trade tick, schedule hour and raid hour runs once however an absence is chunked |
| Telling the player | W27 away recap groups receipt narration (mechanics.md "Away recap"); W10 `goal` narration; notice boards `noticeViews` (`kernel/ts/src/view/notice_boards.ts:12`) with `describe` variants | the recap and the ledger board are the town page |

**Genuinely new engine pieces (proposal), each with its consumer.**

| # | Piece | Why composition cannot do it | Size |
|---|---|---|---|
| N1 | Reaction step `narrate {text}`: one authored TextKey appended to the delivery's narration (`reaction.ts:128,169` already carry narration from `statusStep`) | only `status.apply` narrates; a resident arriving, leaving, a raid held or sacked would otherwise be silent, and W27 groups only narration. Trap 12 (text in words). Opt-in by presence; `kernel_api` bump | S |
| N2 | `npc.move {room, npc \| plan}`: `plan` moves every living member of a population plan to an authored room, EntityId order, one `entity.transfer` each, `entity_entered_room` per member (W1 sees them) | the kgd.22 step moves one authored NPC; spawned members have no DefinitionRef. The band must go to the hills when held and come back at the next full moon. Build as kgd.22's `plan` option or right after it (same `reaction.ts` thread) | S-M |

Everything else is content. **Cartridge owns:** plots and blueprints, which blueprint draws which plan, wage
amount and grid, hire fees, replenish counts and caps, prices tables, raid cadence (lunar phase), raider cap and how
many spawn at each renown band, `watch`/`larder`/`renown` bounds, every line. **Engine owns:** the two steps above,
the Built rooms layer, the existing rows. No number in engine code (owner rule, `AGENTS.md` mechanics vs numbers).

**Known limits accepted for v1.** One `wage` per cartridge, so every resident and guard costs the same keep
(22b); residents are members and so take no combat damage (G8), which is also the no-griefing guarantee;
replenish has no `when` gate, so the mill grinds during an occupation; schedule-case leaves other than facts read
the player (W10 known limit), so cases use instance facts and `population_count` only; services sit on the resident
NPC, not on the built room, so a resident serves from the plot room and the built room is the owner's workshop and
store (S1 fixtures); authored content cannot name a built room (built-rooms §7), so no schedule step enters one.

## 4. S4: raids that matter without data loss or griefing

**How a raid reaches the town.** Row 37a's rule, unchanged in shape: `clock_hour` with `when all [sky {lunar full},
fact_compare {raided false}]`, `apply [npc.move {plan raiders, room square} (N2), population.spawn {plan raiders},
fact.assign raided true, narrate raid.begins]`. The band is the persistent population: living members return from the
hills, and one more joins while a slot is free (cap bounds growth). A second rule at higher `renown` adds a second
spawn step (content scaling). Raiders are `hostile` with `engage`: a player entering the square is attacked (G11);
hired guards on the guard order strike as allies (22a) and the kill credits the player (G8 credit contract).
Residents hide: their W10 cases move them to the cellar while `population_count {raiders, at_least 1}`.

**The watch.** `watch` is a bounded instance int (0..3) that content adjusts: the hire choice `fact.adjust +1`, the
dismiss choice `-1`, a reaction on `entity_died {victim <guard>}` `-1`, and a reaction on `fact_changed {hired}` with
`when fact_compare {hired false}` `-1` (the wage job's dismissal emits it, `job.ts:61-68`; the brief verifies the
pair fact's `subject_id` reaches the trigger). A palisade blueprint's `built` event adds `+1`. Instance scope because
in a Realm every resident's guards defend one town (seam 5).

**Resolution at the new moon (`calm`).** `fact_changed {raided}` with `when fact_compare {raided false}` fans into
two content rules (equality-only `fact_compare`, so `any` trees over 0..3):
- *Held:* `population_count {raiders, at_least 1}` false (the player cleared them), or `watch` at least the living
  raider count -> `npc.move {plan raiders, room hills}`, `fact.adjust renown +1`, `narrate raid.held`.
- *Sacked:* otherwise -> `status.apply {room square, status sacked}` (SR9; variants read "ash in the square"),
  `status.apply {npc <each resident>, status frightened}` (W6: "the miller, pale"), `fact.adjust larder -2`,
  `fact.adjust renown -1`, `narrate raid.sacked`. The band *stays in the square*: an occupation. Shops are closed
  because their keepers are in the cellar; the player clears the band (alone or with new guards) and the next
  `calm` moves the survivors out.

**What a sack never does.** Takes nothing from the player's body, chest or bank (locks and escrow are untouched);
kills no resident (members take no damage); razes nothing (a built room's `condition` is Built rooms slice 3 and
only its decay and repair touch it); writes no player-scoped fact. Statuses expire or are cured (SR3 `status.cure`
from a repair recipe); `larder` and `renown` are bounded and recover by play. A town can be hurt, never deleted.

**Offline and long waits.** Every step above rides the calendar job's `clock_hour` or the plan job at logical due
times; the host segments an absence at pending job boundaries (`elapsed.ts:61`) and crossed dues drain in order, so a
raid that begins and ends during a two-day absence runs begin, hours, calm, resolution once each, in `(due_time,
job_id)` order, and reopen replays the same receipts (37a sampler proves no respawn on reopen). No device clock, no
skip, no new `from`/`until` (seam 4). The player returns to one W27 block: "Raiders came down from the hills. (1)
The watch held. (1)" **Precondition:** the long-wait fixes `loka-kgd.151` and `loka-kgd.152` (jobs scheduled inside one
long advance) are merged; S4's witness runs one 0-to-two-days advance against the same in hourly steps and expects
identical state.

## 5. Realm seams (S3 and S4)

1. **Actor.** Met: build, hire, settle and dismiss are the command actor's choices; locks read the actor; the wage
   job pays the one admitted character (22b known limit, Realm stores the payer); no new `world.character` read.
2. **Reactions.** Met: `built` names its doer (the builder), `fact_changed {hired}` its subject NPC, `entity_died` its
   victim, `clock_hour` and `fact_changed {raided}` have no subject and write only instance facts, room and NPC
   statuses and narration; N1 and N2 take no actor.
3. **Credit.** Met: a raider kill credits the encounter's character (G8 credit contract, Story default); `renown` is
   town state, not a payout; "held" credits no one. One line in the S4 mechanics section.
4. **Time.** Met: logical `clock_hour`, wage and replenish grids; no device clock, no skip, no new elapsed path.
5. **Scope.** Met: `renown`, `watch`, `larder`, `raided` are instance (world state); `owns_charter`, roles and
   `hired` are player or pair facts. Audience of the raid, the arrival and the sack: `public`, once per world.
6. **Text.** Met: every line is an authored TextKey (N1); town and building names are authored keys (built-rooms §7);
   `speech@1` unchanged.
7. **Ownership.** The charter (`owns_charter`) is **exclusive in intent** and stated so: in Story one character buys
   it (B8 entitlement); in the Realm it becomes world state on the square with transfer by sale or gift and
   inheritance on account loss, recorded in G7 when the Realm activity is chosen. Residents and guards are not owned;
   a built room's owner is its `origin.owner` (built-rooms §2). Theft never transfers anything.
8. **Trust.** Met: nothing imported; derived counts come from this authority's rows.
9. **Instancing.** None built; the town is **shared-world** in the Realm (one square, one band, one ledger per
   world): that is the point of the tier. A per-party town is a later instancing decision (spec 19), not assumed.

## 6. Book UI (minimal, touch-first)

No new component. The square is an ordinary World page; the plots and built rooms are places; residents are NPC
pages with their dialogue cards (Settle, Pay the keep, Stay/Follow, Hire guard, Dismiss) and shop or service offers.

- **Town page = the ledger board.** A notice board detail in the square (`notice_boards` projection, book-ui.md
  "Notice-board details") with three notices whose descriptions are `describe` variants over the facts: *Muster
  roll* ("Two of the watch stand at the gate"), *Larder* ("Stores for a lean week"), *Charter* ("Known along the
  valley road", from `renown`). Bounded ints, one authored line per value (trap 4 honoured). One tap from World.
- **Residents.** The square's entity list shows who is in town; W6 variants carry state ("the smith, soot-black",
  "the miller, pale"). A resident on the road reads "packed to leave" and offers "Talk" to settle again.
- **Upkeep.** Coins leave the purse on the wage day as today (22b silent); N1 adds the one line a player needs
  ("The miller shuts his door: no keep paid."), grouped by the recap after an absence.
- **Events.** Raid begins, held, sacked, band departs: one authored line each, in the World log or the recap.
  A `sacked` square and `frightened` residents read in the prose, not in a colour (trap 12).
- **Needs the designer:** wording of all lines and the three notice titles; whether the status line should
  carry a `watch` item during a raid (recommend no: the board holds it); the reason word for a `permission_denied`
  plot (G7 follow-up); any "follows you / stays" line (parked since G8).

## 7. Slice plan (M each unless noted; one row per developer run)

Dependencies for all: Built rooms slices 1-3 (`loka-kgd.109.1-.3`), Homestead S1, `loka-kgd.151/.152`, kgd.22
(`npc.move`). Sampler `cartridges/settle_sampler`: a square (entry) with the ledger board and a cellar, two plots
(smithy, mill) as sites, a hut (Built rooms), a road west, hills beyond; a showcase "Settle district" after S4.
`kernel_api`: one bump per engine slice; content slices bump nothing.

| Slice | Goal | Engine / contract | Acceptance witnesses | Riskiest part |
|---|---|---|---|---|
| **S3-1 Charter and arrival** | buy the charter (B8 entitlement, G7 locks on the storehouse chest); build the smithy; a smith arrives with a line and keeps hours | N1 `narrate` step (reaction schema, both compose paths, Elixir parity; `kernel_api` +1); content: `built` -> `population.spawn {smith}` + narrate; W10 cases | the smithy completes -> the smith stands in the square and "A smith has come to town" is the receipt line; 08:00 he is at the smithy plot, 20:00 the hut; save, reopen, replay: same smith id, same room; a second smithy spawns nobody (cap 1) | the `built` event's payload (built-rooms slice 2) must carry the blueprint for the trigger filter; agree the filter name there first |
| **S3-2 Keep and services** | residents are members with `stay`; the wage is the keep; unpaid residents leave with a line and can be talked back; the smith repairs, the miller sells | content only on 22a/22b, row 21, B3, W10, N1; verify `fact_changed {hired}` carries `subject_id` | pay 3 pennies a day: day 1 and 2 the smith stays; a purse of 2 at day 3 -> "The smith shuts the forge" and he walks to the road at the next listed hour; his Repair offer is gone from the plot; talk and pay -> back next hour; one 0-to-3-days advance equals three daily steps | the shared `wage` pays guards and residents in EntityId order: a broke day loses the lowest id first; the brief states it |
| **S3-3 Trade and the ledger** | the mill produces: flour to the miller's shelf (W11 price falls) and to the owner's chest; the ledger board shows `renown`, `watch`, `larder` as variant notices; `renown` rises on each arrival | content only (replenish entries, W11 `stock`, variants, reactions `fact.adjust`) | away 3 hours: the chest holds 3 flour, the miller's buy price went 5 -> 3 -> 2; sell him two flour and it reads 5 again; the Charter notice reads the renown-2 line after two arrivals; a stranger's Take from the chest is `permission_denied` | the mill's reserve is finite (19b known limit): declare the reserve large and route row 41 decay back into it, or accept a lifetime supply and say so |
| **S4-1 The band** | full-moon raid: the band returns and grows; guards adjust `watch`; present: engage and allied fight; away: held or sacked; occupation until cleared | N2 `npc.move {plan}` (with or after kgd.22; `kernel_api` +1); content: raid, calm, held, sacked rules; `sacked`/`frightened` statuses | watch 0, away one cycle: recap says sacked, the square reads ashen, the miller is pale and in the cellar, `larder` -2, two raiders stand in the square and engage on entry; watch 2 (two hired guards): recap says held, the band is in the hills; present at the full moon: the fight opens on entry, the guard strikes as ally, the kill credits the player; one long advance equals hourly steps | equality-only `fact_compare` vs `population_count` makes the held/sacked tree long; cap raiders at 3, watch at 3; a reaction.ts change must wait for the FD5/kgd.22 thread |
| **S4-2 Protect and reclaim** (S, content) | `hold_the_square` quest per holder (row 38); raid the hills to cull the band; repair cures the square; renown bands scale the spawn | content only on 38, SR3 `status.cure` via a G4 use recipe, 37b `aftermaths` | entering the square during a raid activates the quest; the moon resolves it held or fails it; killing all three in the hills leaves slots waiting out `replacement_delay`; at renown 3 the raid rule adds a second spawn | nothing engine; the showcase "Settle district" brief follows this slice |

Showcase per slice: S3-1 the arrival line; S3-2 the leaving smith on the road; S3-3 the ledger board; S4-1 the
recap after an away raid in both outcomes; S4-2 the hills camp. The district's blind playtest runs before the owner.

## 8. Owner questions (product and scope) with recommendations

1. **Can residents die?** Recommend **no** (v1): residents are members and take no damage; they are frightened and
   hide. Death of a named resident is permanent loss in a shared world (griefing) and Loka has no NPC-vs-NPC combat.
2. **Occupation:** do surviving raiders stay in the square after a sack until the player clears them? Recommend
   **yes**: it is the stake that makes the watch matter, and it is recoverable (hire guards, fight with allies).
3. **Upkeep paid from the purse** (pennies from the body), not a treasury? Recommend **yes**: 22b as is; a
   treasury is a new pool and a new writer for no new feeling.
4. **One town per world, shared in the Realm** (one charter, roles by grant)? Recommend **yes**; per-party towns
   wait for the instancing decision.
5. **Raid cadence:** full moon only, or also random road bandits (row 9)? Recommend **full moon only** in Settle:
   a visible countdown is the Frostpunk tension; road encounters stay Homestead flavour.
6. **Town and building names:** authored name keys only (no free text, built-rooms §7)? Recommend **yes**.
7. **Own showcase district** for Settle (after S4-2) rather than extending Homestead's? Recommend **yes**.

## 9. Risks

- **Long waits.** `loka-kgd.152` (a job scheduled inside one long advance faults) would refuse a real reopen after an
  absence spanning a raid; S4 must not start before it and `.151` merge. Witness: one long advance vs steps.
- **Dependency chain.** Built rooms slices 1-3 and the `built` event shape; kgd.22's `npc.move`; the `reaction.ts`
  single-thread rule (priority plan): N1 and N2 queue behind FD5. Expect Settle to start no earlier than two
  batches after Homestead.
- **Wage payer.** The wage job pays "the one admitted character" (`escort/job.ts:40-44`): correct in Story, a Realm
  save change later; said in the S3-2 brief.
- **Policy expressiveness.** Equality-only `fact_compare` and `at_least`-only `population_count` make the
  held/sacked rule verbose; if the brief finds it unreadable, a `fact_compare.at_least` field (S, policy thread)
  is the honest fix, not an engine branch on raids.
- **Replenish has no gate.** Production runs during an occupation; v1 accepts it (the band does not eat flour).
- **Designer load.** Eleven authored lines and three notices need wording approval; batch them in one designer run
  per slice as the depth study proposed.
- **Spec first.** Built rooms is a world-graph contract change with a decision record; S3/S4 add none, but N1 and
  N2 each need their reaction@1 table row and `docs/system/mechanics.md` section in the same PR.
