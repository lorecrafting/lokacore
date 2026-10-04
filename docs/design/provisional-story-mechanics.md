# Proposed Loka mechanics for gaps in LegendMUD evidence

**Current status, 2026-10-04:** the [PM reconciliation](../decisions/pm-decision-legend-mechanics-reconciliation-2026-10-04.md) governs current planning. The original proposal below remains a dated set of alternatives; its formulas are not adopted requirements.

| Original section | Current disposition |
|---|---|
| §1 time/pacing | M1 elapsed contracts, reading-time direction and the M4 first-fight contract supersede its open clock/menu/termination and queued-Flee proposals. |
| §§2–3 resolver | First fight is M4's untrained/unarmed profile, with no defense, critical, gear or derived-stat engine. Larger formulas remain unadopted alternatives. |
| §4 recovery | Planned M2 selects MV-only piecewise 18/36 per 3600 (2×), no implicit combat suppression. MV82 resting takes 164 real seconds at rate 50; future MV100 takes 200. Its all-pool/stat-scaled 4× model is superseded for this consumer. |
| §5 load | Planned M3 selects a 12000g positive-Take ceiling, not STR load bands or penalties. |
| §6 death | Planned M4/M5 uses all-held/worn durable corpse custody and safe chapel return. Protected caches/XP penalties are unadopted; recovery barriers follow the reconciliation's route/fallback gate. |
| §7 tuning | Historical targets remain provisional; tune the selected consumers against real play rather than adopt the alternatives by implication. |

**Proposal, 2026-10-03 — not approved implementation requirements.** The owner asked for sensible
starting mechanics that can be rebalanced after the initial game is built. These are Loka design
choices for five requested gaps in the [LegendMUD reference](../reference/legendmud-system.md):
dodge/parry odds, attack resolution order, recovery timing, encumbrance and death. They are not
claims about the running LegendMUD engine. Other unknowns, including spell concentration, general
skill success and arbitrary-level pool formulas, remain separate future design work.

The [baseline decision](../decisions/owner-decision-legendmud-baseline-2026-10-03.md) supplies the
planning direction. The [fixed-time decision](../decisions/owner-decision-fixed-time-2026-10-03.md)
forbids player-driven time skips; timing here follows the fixed-rate clock. This proposal changes
neither installed behavior nor the approved Gate C1 scope. Before code, an approved slice must amend
the relevant `docs/system` and any pinned contracts. All odds, coefficients, durations, thresholds and death policies below are
cartridge numbers under the [world-parameter rule](../system/owner-rules.md#architecture-and-engine).
The field names and storage schema are not frozen here.

## 1. Time and combat pacing

Keep automatic melee rounds, with one ordinary attack per combatant per round for the first
combat slice. Extra swings, dual wield and advanced weapon speed wait for content that needs them.
A valid special action uses that round's action opportunity instead of the ordinary attack;
its reuse timer is separate. Invalid commands consume neither an opportunity nor RNG. A failed
admitted skill attempt pays its costs and uses the opportunity.

For the offline Story app, propose these initial time values:

| Setting | Logical duration | Player-facing target at 72 real seconds per game hour |
|---|---|---|
| Host heartbeat | 1/72 game hour | 1 second; process due work |
| Combat round | 1/24 game hour | 3 seconds |
| Recovery interval | 1/12 game hour | 6 seconds |
| World tick / calendar hour | 1 game hour | 72 seconds |
| Calendar day | 24 game hours | 28.8 minutes |
| Death penalty | 2 game hours | 144 seconds at the target rate |

The current 3600-unit hour would make the heartbeat, combat round, recovery interval and death
penalty 50, 150, 300 and 7200 logical units respectively. This
explicitly replaces the archived plan's literal three-*logical*-second rounds; it is not a new
engine literal. The later time-model slice must reconcile these units before implementing combat.
The 72-second hour is the target already carried by the
[untimed-Lantern decision](../decisions/owner-decision-untimed-lantern-2026-10-02.md), not current behavior
or verified current LegendMUD timing. One world tick means one calendar hour; a game hour contains
24 combat rounds and 12 recovery intervals. The host heartbeat does not delay command admission:
player commands respond immediately, while admitted combat actions use the round opportunity.

The six-second interval is recovery cadence, not a universal world update. Combat rounds, recovery
and scheduled NPC/world events have their own due times on one fixed-rate clock. The host drives
that clock from elapsed time; player actions, resting and retrieval never add a jump to it.
Use the existing due-job foundation and derived resources rather than scanning/writing every actor
at each pulse. A future host clock driver is still needed; the current mobile proof has no live
world heartbeat. Exact scheduler/storage vocabulary belongs to the implementation slice.

Combat and recovery use the same logical clock. Under the owner's
[background-time decision](../decisions/owner-decision-background-time-2026-10-03.md), backgrounding
does not pause that clock: automatic attacks, recovery, effects, penalties and scheduled events
continue according to elapsed time. Resting in safety can recover resources; remaining in combat
can result in damage or death. Backgrounding does not change position or choose a new action.

If the OS suspends execution, resolve the elapsed interval on resume in the same due-time order,
including intermediate state changes, before accepting a new action. Do not merely evaluate the
final clock value, credit the same interval twice or discard elapsed attacks. Death interrupts
that actor's combat as usual. Bounded catch-up, persistence and clock-source details belong to the
future implementation slice; gameplay continuity does not require a background timer guarantee.

Propose that menus/dialogue also leave time running, to match the online expectation; that extension
is not approved by the owner's backgrounding instruction. Read-only inspection consumes no action,
while equipping or using an item during combat takes a round opportunity. The fully terminated-app
policy still needs a decision in the time-model slice.

For the initial one-opponent fight, the initiator acts first in odd rounds, the defender first in
even rounds. Recheck life/target/eligibility before each action; a dead actor never acts later in
the round. At a time boundary expire effects whose end time is at or before the boundary, apply periodic
damage from effects still active, then resolve combat actions, then recovery for surviving eligible
actors. Effects have an exclusive end time: an expired poison does not deal another tick. A lethal
damage result immediately interrupts that actor.
Multi-opponent initiative needs its own definition when first introduced.

Flee uses the round's opportunity, pays twice the exit's load-adjusted MV cost, and succeeds through a
traversable exit unless a status prevents escape. Resolve it in the same alternating action order: an
opponent acting first may hit before the escape; no extra attack follows a successful departure.
Validate the exit and available MV before paying, then use the normal movement/barrier checks.
This is a deterministic starting rule rather than another unknown escape probability. While engaged,
a directional move uses the same flee rule; touch or typed movement cannot bypass its turn or cost.

## 2. Accuracy, dodge, parry and shield block

Use an integer roll from 0 through 99 and succeed when the roll is strictly below the chance.
`T` truncates toward zero; `clamp(x,lo,hi)` bounds the result. H is attacker total hitroll; A is
defender total AC; D and C are defender current capped DEX and CON. W is the defender's weapon's
proficiency stat (STR, DEX or CON, declared by content). L is actor level.

| Check | Proposed percent chance | Eligibility |
|---|---|---|
| Accuracy | `clamp(75 + T(H/2) - T((100-A)/5) + 2*(attackerL-defenderL), 20, 95)` | Ordinary melee or physical projectile |
| Dodge | `clamp(5 + T((D-30)/5) - T(H/10) - loadPenalty, 0, 25)` | Learned and currently qualified dodge; standing and able to react |
| Parry | `clamp(5 + T((W-30)/5) - T(H/10), 0, 20)` | Learned/qualified parry; usable melee weapon; standing and able to react; melee only |
| Shield block | `clamp(10 + T((C-30)/10) - T(H/10), 0, 20)` | Learned/qualified block; equipped usable shield; standing and able to react |

These are conditional checks in order, not percentages added together. No eligible skill means
zero chance and no draw for that defense. Stunned or sleeping actors cannot actively defend;
resting/sitting actors also forgo active defenses until they stand. Armor still contributes AC.
Dodge/block can intercept physical projectiles; parry cannot. Ordinary damage spells use their
spell rules/resistances, not this melee defense chain. Environmental/periodic damage has no attack roll.

A standing defender with DEX100, CON100, W100 and natural AC65 faces H33 at the same level:
accuracy84%, dodge16%, parry16%, block14%. With all three defenses available, a physical strike
lands about51% of the time; without a shield about59%. This is a controlled example, not a universal
endgame balance target. No skill percentage growth or practice rank is invented by these formulas.

## 3. Resolve an attack

The order is: **validate/pay action → accuracy → dodge → parry → block → critical → weapon damage
and damroll → damage cap → physical mitigation → damage-type resistance → HP loss → death or wake**.
Stop at a miss or successful defense; skip its later draws and damage effects. Log the actual
outcome so a player can distinguish a miss, dodge, parry, block and absorbed damage.

Provisional damage details, also Loka choices:

- Roll one integer uniformly over the weapon's content-defined damage range. Treat each damroll
  point as a2% bonus to this roll; this application is unverified in Legend and deliberately
  avoids a large flat stat bonus overwhelming low-level HP.
- A landed ordinary attack has a5% critical chance and1.5× damage. A critical does not bypass
  active defenses. Skill/spell overrides must be explicit content, not inferred from their names.
- Apply the attack's damage cap after the critical multiplier. For the initial single swing,
  an attack and an attack line are equivalent; multi-swing content must define its line cap first.
- Physical mitigation reduces physical damage by its displayed percentage, bounded0–30%. Use the
  researched CON/Battle Training contribution and cap as the initial candidate; NPC and item
  modifiers must be declared. Elemental damage skips physical mitigation.
- Resistance is a damage-type percentage, initially bounded−50% to75%; negative resistance is
  vulnerability. Explicit immunity can yield zero. Otherwise final landed damage is at least1.
- Round down once after the damage multipliers/cap, before subtracting HP. Damage/status effects
  trigger only if their attack landed, and poison-on-hit requires positive HP damage.

Literal example: weapon roll10, damroll25, critical1.5, cap20, mitigation20%, resistance25%:
`min(10 * 1.50 * 1.50, 20) * 0.80 * 0.75 = 12 HP` lost. These stages must not be reordered.
A sleeping target takes2× damage before the cap and mitigation; a surviving target then wakes and
stands. The first hit cannot retroactively gain its newly available defenses. This retains the
old Loka sleeping-vulnerability direction while making its placement explicit.

Armor's AC affects accuracy; a separate mitigation value reduces landed damage. Do not also
convert that same AC into absorption. At0 HP apply death exactly once in the committed action.
A refusal, save retry or replay never rolls again or duplicates damage, costs or rewards.

## 4. Recovery

No passive HP, MA or MV recovery while engaged in combat. Healing skills, consumables and spells
remain tactical ways to recover. Dead actors do not recover. Bleeding/poison suppress passive HP
recovery until treated; their other pools may recover once outside combat.

For each pool, propose a baseline fraction of its maximum per recovery pulse:

`rate_basis_points = clamp(100 + (governing_stat - 50), 50, 150)`

CON governs HP, Mind governs MA, DEX governs MV.100 basis points is1%. Multiply the rate by:

| Condition | Multiplier |
|---|---|
| Standing or sitting | 1× |
| Resting or sleeping | 4× |
| Hungry | 0.5× |
| Thirsty | 0.5× |
| Carrying load | MV only, from the load table below |

Rest and sleep recover equally fast, consistent with the published Legend REST description.
At governing stat50, an empty pool takes about10 minutes standing or150 seconds resting; at
stat100, about100 seconds resting. Fractional recovery accumulates rather than rounding every
pulse up to one point. For a20-point maximum at stat50, five full resting pulses restore exactly4
points. This preserves useful pacing even for tiny early-game pools.

Integrate recovery only for the time actually spent under each rate: changing position, equipment,
load or hunger settles the preceding interval first. Resting just before a pulse cannot earn a
whole pulse of rest. Leaving combat also cannot retroactively credit its non-recovery interval.
The six-second pulse is the initial accrual/display cadence, not a loophole
to select the final position for all elapsed time. Reopening a save cannot credit the same interval twice.

Resting changes the recovery rate while the fixed clock continues. There is no rest-for-an-hour,
wait-until-healed, or other instant time skip. The temporary death timer follows the same clock;
rest does not deduct additional time from it. Background elapsed time applies to recovery and
penalty expiry under section1, using each interval's actual eligible state.

This deliberately proposes a level-scaled percentage model in place of copying LegendHUB's
level50 regeneration-point formulas into all levels. Keep its coefficients tunable and compare
its feel during play; adopting the exact Legend regen model later would be a mechanic change.

## 5. Encumbrance

Propose a normal carrying allowance in kilograms of `10 + 0.5*max(currentSTR,0)`. Count all held and worn
items plus nested contents; a bag contributes its own weight and does not erase its contents'
weight. Store weights in integer grams. STR30 gives25kg; STR100 gives60kg.

| Total weight | Movement cost | Dodge loadPenalty | MV recovery | Other restrictions |
|---|---|---|---|---|
| At or below allowance | 1× | 0 points | 1× | None |
| Above allowance through125% | 1.5×, round up | 5 points | 0.75× | None |
| Above125% through150% | 2×, round up | 10 points | 0.5× | No swim or climb |
| Above150% after forced changes | 3×, round up | 15 points | 0.25× | Same restrictions; ground walking still possible |

Refuse a voluntary pickup that would exceed150% of allowance. A forced grant, expired STR buff
or removed item may put a character over that threshold; retain every item. Removing equipment,
dropping items and giving items remain possible. Ground walking stays possible when MV can pay
its cost, avoiding a hard lock after losing STR. A cartridge must supply a usable route or transport
around weight-gated mandatory swim/climb passages; it cannot rely on destroying protected quest items.
HP and MA recovery are unaffected by weight in the initial proposal.

At STR30,25kg is unburdened;30kg is burdened;35kg is heavy. A base1-MV move costs1,2,2 respectively.
At40kg after a forced grant it costs3MV. These are upper-inclusive bands, with no random capacity check.

## 6. Death and return

The owner has decided on [one shared difficulty](../decisions/owner-decision-single-difficulty-2026-10-03.md).
The following death mechanics and values remain a proposal for that one ruleset:

1. At0 HP end that actor's combat, pending attacks and harmful periodic effects. Preserve completed
   quests, choices, discoveries, learned skills, practices and levels. Do not rewind the world.
2. Return the player standing to the last activated safe shrine, or the entry refuge if none exists,
   with50% maximum HP,50% MA and100% MV. These return percentages round up. The refuge cannot host hostile combat.
3. Retain worn equipment and items explicitly protected for quest progression. Place other carried
   items, including their container contents, in an owner-only recovery cache at the death site.
   Separate protected nested items safely before transferring their containers; no item duplication.
4. A cache has no expiry in offline play and NPCs cannot loot it. Further deaths do not overwrite
   earlier caches. Offer shrine recovery as a fallback: transfer all unrecovered items back to the
   player and allow overload rather than discard items. Retrieval does not jump the clock. This avoids a
   permanent lock when a corpse site becomes inaccessible, without requiring ghost mode first.
5. Earn75% of ordinary combat XP for the next two game hours of active time, or until leveling.
   Quest/exploration rewards are unaffected. Another death refreshes the timer; penalties do not stack.
   No permanent XP, level, stat, equipment or currency loss.

Protected items and shrine recovery must be content/engine policies, not a UI-only shortcut.
Deaths and retrievals move existing items in the same durable transaction as their receipt.
Loading or retrying cannot create a second cache, restore consumables or re-award completed quests.
Enemy deaths and their earned rewards stay committed; defeating an enemy immediately before
another lethal effect does not resurrect it on the player's return.

This replaces the older default ghost-walk plan with immediate shrine return plus a cache. Ghost
play or paid resurrection can return when content calls for them; they are not needed to test
combat balance. The adopted Legend reference motivates corpse recovery and a temporary XP penalty,
but the protection, fallback and exact penalties here are deliberate Loka adaptations.

## 7. First playtest and what can be tuned

Initial targets: a fair ordinary fight lasts6–10 rounds (18–30 seconds); a chapter boss10–20 rounds;
a resting character recovers from empty to full in roughly2–3 minutes at the fixed rate
around stat50. With real waiting required, this recovery target especially needs the first playtest;
adjust the rate if it interrupts the story. Keep the targets provisional: tune HP, weapon ranges,
accuracy/defense coefficients, crits, costs and recovery rates against actual chapter encounters,
not a level50 builder example.

Use the existing command/event traces to examine rounds per fight, effective landed-hit fraction,
HP/MV left, rest time, load refusals, deaths and cache retrievals. Record context (actor level/stats,
gear and enemy) so an aggregate does not hide a single frustrating encounter. No analytics service
or large telemetry system is proposed.

Before implementation, the slice fixtures should pin meaningful controlled cases: miss/defense
boundaries and skipped later draws, damage-stage order, waking only after the sleeping hit,
piecewise/fractional recovery, exact weight-band boundaries and STR loss, and death/retrieval under
receipt replay. Those are behavioral breaks; this proposal adds no source-text tests.

Numbers are cheap to tune. Changing resolution order, what survives death, timing semantics or
conditional eligibility changes mechanics and requires a spec amendment and normal review.
Rebalance after the first playable encounters, and again before release; do not wait for the whole
world to be finished to discover a pacing or recovery problem.
