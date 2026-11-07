# NPC behaviours: NPCs that act as players do (plan, loka-ni2zd)

Design only. No code. Fable's second opinion on the
[owner decision of 2026-11-06](../decisions/owner-decision-npc-behaviours-2026-11-06.md) and the plan
it asked for. Paths are repo-relative at main `7c6a183ef`. Binding constraints: every player-facing
word is the owner's (keys below carry `~`); the engine owns mechanics and the cartridge every number;
no script language ([owner rule](../system/owner-rules.md), 2026-10-23); traps 1 to 12 of the
[toolbox](../MECHANICS-TOOLBOX.md#traps); the [Realm seams](../decisions/owner-decision-realm-seams-2026-10-13.md).

## 0. What this review changes, and why

| Record said | This plan says | Why |
|---|---|---|
| An NPC sends the player's own commands, with the NPC as the command's actor. | A behaviour step calls the verb's **body-level helper** (the function the rule itself calls once it has the actor's body), with the NPC's body. No Command, no CharacterId per NPC. | `bodyOf` answers only `world.character` (`kernel/ts/src/runtime/decision.ts:186`), the host refuses any command whose actor is not that character (`runtime/world.ts:202`), `run_job` carries no actor, and a Command has a receipt. Giving NPCs CharacterIds widens that trust boundary and leaks into quests, levelling and the position fact, all player-scoped. "Same rule" still holds: one admission function per verb, which view = use already forces. |
| One pending job per NPC, steps crossed by the `next` drain. | The same, plus: the elapsed host stops at each **hour mark** while any behaviour job is pending, instead of at every step. | `boundary` (`mobile/authority/local-story/elapsed.ts:67`) stops at every pending job: one proposal and one SQLite commit per NPC step on catch-up, so twenty NPCs cost about a thousand commits per absent day. Folding steps into one run_job per hour gives about 24 proposals a day and stays under `due_jobs_per_advance` (1024). |
| Each behaviour declares resume or restart. | Resume keeps the step index, one level deep (one saved cursor per NPC); preempted twice, the lower behaviour restarts. `go` re-paths every leg, so a resumed walk needs no saved path. | Bounded save shape; a crow-style cursor on the job row. |
| Verbs include `attack`. | `attack` opens as: a hostile behaving NPC that **walks into the player's room engages** (lifting G11's "an NPC that walks in engages no one"). NPC-vs-NPC fights are out. | combat@1 is player-centred: foes strike only the player, allies strike the player's target (row 6b). A bar fight or a bandit robbing a traveller needs a combat@1 change, not a verb opening. |
| Verbs include `say`; `emote`/`say` steps. | Steps are `emote` and `line` (an authored key told to the room). No `say`. | speech@1 is a player verb; NPC speech shown to others is `speech@2` (seam 5). A keyword dialogue opened by an NPC has no reader. |
| Variety by a hash of NPC and day. | A behaviour's optional `chance` (1 to 100), rolled as ambient emotes roll (SHA-256 of ref, index and the day number), read once per day. No RNG. | Trap 5; the ambient roll exists (`kernel/ts/src/mechanics/emote/`). |
| Canned behaviours as a library. | Canned behaviours are **templates copied into the cartridge** by `bin/loka new behaviour <name> --from <canned>`, then attached with the existing `behaviours` list, `params` and `with`. No engine-shipped library, no new shortcut. | The shortcut exists (`lib/loka/content/behaviours.ex`, `params.ex`); a behaviour file gains an optional `plan` beside `reactions`. "Open one and edit its plan" is literally the copy. |
| Not stated. | Events an NPC's act causes carry **no crediting character**: in a reaction to them, `experience.grant`, `quest.*` and an unnamed player-scope `fact.assign` write nothing. | Reactions keep the root actor (the player) as the listener (seam 2); the crow's `item_acquired` already has this hole. A gatherer's harvest must never pay the player. |
| `when`/`until` read the world. | First cut: the W10 allow-list (world-state leaves; NPC-relative reads through `subject: "target"` and `{npc}`). "I hold none" is `find {held_by: self}` with `on_fail`. NPC-relative `has_item`, `wearing` etc. are a later slice. | The policy evaluator takes a CharacterId; making body-relative leaves read an NPC is a cross-cutting change. The finder covers the common case for free. |

Everything else in the record stands: four fixed layers, ties by declaration order, preemption only
between steps, movers or behaviours never both, no needs simulation, economy second, NPCs trade with
shops only, the immersion catalogue as the appendix.

## 1. What is there today (read-only findings)

- **Actor.** Every verb resolves its body by `bodyOf(world, actor)`, which is `world.character`'s
  body or nothing (`runtime/decision.ts:186`). `admitted` lists that one pair (`:194`). The host's
  `identity` refuses a command whose `actor_id` is not `world.character` (`runtime/world.ts:202`).
  `run_job` has no `actor_id` (`contracts.gen.ts` CommandPayload) and only the host's drain builds
  it (`runtime/proposal.ts:300`). So no command can run as an NPC today, and a forged one is refused
  at the host. The helpers under the rules mostly take a body already: containment's `move(body)`
  and `reach(world, body, …)`, `carryingExchange(world, body, …)`, `tagHeld(world, body, …)`; but
  `harvest(world, actor, …)`, `movementPlan(world, actor_id, …)`, `lockRefused(world, actor_id, …)`
  and `actorLine(world, actor, …)` take the character.
- **Walking NPCs.** `npcPassage` and `walkPath` (`mechanics/movement/shared.ts:73`, `:111`) decide one
  NPC exit and a breadth-first path with keys and relocking (W26). The crow walks leg by leg with one
  job per leg and revalidates custody each leg (`mechanics/crow/job.ts`). Population wander moves one
  exit per occurrence (`population/settle.ts:185`). A schedule case with `walks` jumps the whole path
  in one step (W26 known limit: nobody sees it pass).
- **Jobs.** One `JobRow` type with optional per-kind fields (`runtime/rows.ts:109`: `crow_phase`,
  `sight`, `bleed_body_id`…), routed by `jobRoute` (`mechanics/schedule/rule.ts`). A run may return
  `next` and the drain queues the crossed step as a sub-step under the same job id
  (`runtime/proposal_hours.ts` `queueHour`); every sub-step counts toward `due_jobs_per_advance`
  (1024); a run schedules at most `created_jobs` (64). The elapsed host stops at every pending job
  except the calendar job and a folding permanent tick (`elapsed.ts:67`).
- **Narration to observers.** Engine lines carry participants; the Book words first or third person
  (`engineLine`, `mechanics/line.ts:28`; emote lines are told only when the emoter is a living NPC in
  the reader's room and visible, `mechanics/emote/line.ts`). loka-glj8 (merged #477) added
  "<Name> arrives from the south." and "<Name> leaves north." where the engine knows the direction.
- **Credit.** Quest activation and progress are player-scoped (`quest/lifecycle.ts:38`); kill credit
  names `credited_character_id` (`combat/credit.ts`); reactions run with the root actor as listener,
  except `quest_resolved` (seam 2). The crow's `item_acquired` names the crow as holder and is
  documented as never crediting the player.
- **Authoring shortcuts.** `behaviours/<name>.json` holds `{reactions}`; an NPC or item lists
  `"behaviours": ["name" | {"behaviour", "with"}]`; `params` and `{"param": …}` markers fill per
  attachment ([cartridge.md](../system/cartridge.md#source-shortcuts)). The compiler is Elixir, so any
  lowering is Elixir by construction.
- **Economy hooks.** Replenish moves conserved items on a grid and admits an NPC as `from`/`to`
  (row 19b); stock prices follow the shopkeeper's count (W11); the mobile commerce save reconciles
  shop receipts and knows no job payment (row 22b known limit); theft's `take` from an NPC exists
  (row 33). No `when` on replenish yet.

## 2. The design as amended

### 2.1 Act: the verb's body-level helper, run from the NPC's job

A behaviour step `act` runs a verb for the NPC exactly where the player's rule runs it, but one
level down: each opened verb factors into `refuse(world, body, …)` and `effects(world, body, …)`,
and the player's rule becomes `bodyOf` plus those two. The behaviour job calls the same two with the
NPC's body. Nothing is duplicated, no second rule file, no NPC CharacterId, and the host's actor check
stands. Where a helper reads a character-only thing (a skill level, a derived carry table, a G7 lock,
the player's position fact), the NPC form is stated in the verb's audit (section 2.8): usually
"not read" (an NPC harvests the ordinary way; an NPC never passes a G7 lock, as W26).

A step's admission is the verb's own refusal; a refused step is not a fault. The step's `on_fail`
says what the plan does (`next`, the default, or `stop`, which ends the behaviour so the arbiter
decides again).

### 2.2 Behaviours, layers and the arbiter

An NPC with `behaviours` has one pending job of kind `behaviour`. The arbiter runs at every step
boundary of that job (so a `wait` is a boundary) and nowhere else in the first cut; an event wake
(a reaction step `behaviour.start`) is a later slice.

Rules, in order:

1. **Candidates.** The NPC's behaviours in declaration order, each with a `layer` (`reflex`, `duty`,
   `routine`, `idle`), optional `when`, `until` and `chance`, and `on_end` (`restart` or `resume`).
2. **Holds.** A behaviour is a candidate when its `when` holds (absent: holds), and, with `chance`,
   its day roll passes (section 2.3). `when` and `until` read the proposal so far at the step's due
   time, as W10 cases do; the NPC is the policy target (`subject: "target"`, `{npc}` reads).
3. **Pick.** The highest layer with a candidate wins; ties go to the earliest declared. The current
   behaviour stays while its `until` does not hold and no higher-layer behaviour is a candidate
   (hysteresis: `when` to start, `until` to stop; a behaviour with no `until` ends with its plan).
4. **Switch.** When another behaviour wins between steps, the current one is preempted. If it declares
   `resume`, its step index is saved as the NPC's one `resume` cursor (overwriting any older one);
   `restart` saves nothing. When the winner ends, the arbiter prefers the saved cursor's behaviour if
   it is still a candidate, continuing at that index; else it picks afresh.
5. **End.** A plan that runs out of steps ends; `on_end: restart` runs it again from step 0 while it
   still holds, `resume` ends it until `when` holds again.
6. **Nothing.** No candidate: the job waits `pace` and decides again (an idle NPC stands where it is).
7. **Dead, engaged, rooted.** A dead NPC's job completes with nothing. An engaged NPC (in the player's
   fight) or one whose status bars moving (`moves`) skips its step and tries again after `pace`
   (the crow's rooted rule).

No numeric priorities, no per-step priorities, no variables. Eight behaviours per NPC and sixteen
steps per plan are compiler caps (safety budgets, engine-owned).

### 2.3 Plans: the step vocabulary

A plan is a flat list of steps. Each step may carry `when` (skip the step when false) and `on_fail`.

| Step | Fields | What it does | Duration |
|---|---|---|---|
| `go` | `room` or `detail` or `npc` or `find` | One leg toward the target: breadth-first path over exits `npcPassage` admits with walks (keys and relocking as W26), recomputed every leg; moves one exit; emits `entity_entered_room`; tells `~npc.left` in the room left and `~npc.arrived` in the room entered when the player's body is there and sees the NPC (direction bound). At the target the step completes. No path: the step fails. | `pace` per leg |
| `wait` | `for` (clock units) or `until` (hour of day) | Nothing; the next decision is then. | as given |
| `act` | `verb`, `target` (a ref or `find`), `times` (1 to 16, `act` only), verb inputs (`container` for put, `recipient` for give) | The verb's effects for the NPC's body (section 2.1). `times` repeats until the count or the first refusal. | `pace` |
| `emote` | `emote` | The G9 emote line to the room (existing step). | none |
| `line` | `text` | One authored key told when the player's body is in the room and sees the NPC. | none |

`find {kind: item | npc | detail, tag?, keyword?, in: here | room | held_by self}` resolves at the
step, lowest EntityId first, one query step per entity (as the G4 pair walk), charged to the run.
Nothing found: the step fails.

`chance`: `h = SHA-256("<npc ref>:<behaviour index>:<day>")`, `day` the due time's calendar day;
the behaviour is a candidate for the day when the u32 of bytes 4 to 7 modulo 100 is below `chance`.
Stable within a day, different between NPCs and days, replay-identical. No authority RNG.

That is the whole language: no branch but `when` on a step, no loop but `times` and `on_end: restart`,
no nesting, no arithmetic, no reference to another plan. It is data the compiler can enumerate, so
reach reports and the Story map can walk it.

### 2.4 Authoring shape and canned behaviours

Opt-in: `world.behaviours {pace}` (clock units per leg or act; the cartridge's number; an NPC may
override with `pace`). Without it, `behaviours[i].plan` is UNDECLARED_CAPABILITY.

A behaviour file may hold `reactions` (today), a `plan` (new) or both. The NPC lists them; order is
the arbiter's tie order. An NPC with a `plan` behaviour and a `daily_schedule`, a patrol, an escort
role or a spawn template is SCHEMA_VIOLATION `invalid_value` at `npcs/<key>.behaviours` (movers or
behaviours, never both). Ambient emotes and dialogue stay.

The canned template `harvests`, copied by `bin/loka new behaviour harvests --from harvests`:

```json
{
  "params": ["patch", "home", "from", "to", "times"],
  "plan": {
    "layer": "routine",
    "when": {"kind": "time_window", "from": {"param": "from"}, "to": {"param": "to"}},
    "until": {"kind": "not", "policy": {"kind": "time_window", "from": {"param": "from"}, "to": {"param": "to"}}},
    "on_end": "resume",
    "steps": [
      {"go": {"detail": {"param": "patch"}}},
      {"act": "harvest", "target": {"param": "patch"}, "times": {"param": "times"}, "on_fail": "next"},
      {"go": {"room": {"param": "home"}}},
      {"wait": {"until": {"param": "to"}}}
    ]
  }
}
```

The NPC:

```json
{
  "name": "~npc.maud.name",
  "location": {"in": "room", "room": "cottage"},
  "behaviours": [
    {"behaviour": "shelters", "with": {"room": "cottage"}},
    {"behaviour": "sleeps_at", "with": {"room": "cottage", "from": 22, "to": 6}},
    {"behaviour": "harvests", "with": {"patch": "herb_patch", "home": "cottage", "from": 6, "to": 12, "times": 3}},
    {"behaviour": "wanders", "with": {"rooms": ["lane", "green"]}}
  ]
}
```

What `harvests` lowers to on Maud (the compiler fills the markers; the artifact carries the plan
under the NPC, never `params` or `with`):

```json
{
  "layer": "routine",
  "when": {"kind": "time_window", "from": 6, "to": 12},
  "until": {"kind": "not", "policy": {"kind": "time_window", "from": 6, "to": 12}},
  "on_end": "resume",
  "steps": [
    {"go": {"detail": "herb_patch"}},
    {"act": "harvest", "target": "herb_patch", "times": 3, "on_fail": "next"},
    {"go": {"room": "cottage"}},
    {"wait": {"until": 12}}
  ]
}
```

The other first-cut templates, each one short plan:

- `sleeps_at {room, from, to}`: routine; `go room`, `act posture sleeping` (once posture exists;
  before it, nothing), `wait until to`.
- `works_at {room, from, to}`: routine; `go room`, `wait until to`. Authors add `line` or `emote`
  steps after copying.
- `wanders {rooms}`: idle; `go` to each listed room in turn with `pace` waits between.
- `shelters {room}`: duty; `when sky rain` (or any sky cut the cartridge names), `until not`; `go room`,
  `wait for pace`.
- `guards {room, when}`: duty; `when` the author's intruder condition (the player present at night,
  a fact), `go room`; the NPC's `disposition.hostile` does the rest (section 2.8, attack).

An author who wants more opens the copy and edits its steps; the compiler checks the result like
any plan.

### 2.5 Time and budget model

- **Steps are jobs.** Each step occurrence is the NPC's one job due at its time. A `go` leg and an
  `act` take `pace`; a `wait` takes what it says; `emote` and `line` take nothing and run inside the
  step that follows them (the decision that reaches them continues to the next timed step).
- **Crossed steps fold.** A run whose next step is due inside the advance returns `next`; the drain
  queues it as a sub-step under the same job id in `(due_time, job_id)` order with the other NPCs'
  steps (`queueHour`), so hour-by-hour play and one long wait give the same order and the same world.
  Only the last sub-step schedules the job after the target.
- **The host stops at hour marks.** While any behaviour job is pending, the elapsed host's `boundary`
  also stops at the calendar job's next hour (it exempts the calendar job today). A day of absence is
  then about 24 proposals, each holding every NPC's steps of that hour, instead of one proposal per
  step. The away cap (`time_policy.away_cap_hours`, default one calendar day) bounds the whole.
- **Budgets.** Sub-steps count toward `due_jobs_per_advance` (1024): the sampler proves twenty
  behaving NPCs over an eight-hour player wait stay under it, and the plan doc states the authoring
  guide: at most about forty steps per NPC per hour of wait. `find` and the path walk charge the run's
  `query_steps`. Every run schedules exactly one job, so `created_jobs` is untouched.
- **Fidelity.** Full fidelity (every step runs) unless cold open of the showcase measures over about
  3 s with its behaving NPCs; then a summary mode is a new decision, not a quiet change.
- **After a capped absence.** The skipped span never runs, so the cursor is stale (mid-walk at the
  wrong hour). The next decision reads the real hour: `until` ends the stale behaviour and the arbiter
  picks the right one; `go` re-paths from wherever the NPC stands. No special case.

### 2.6 Save shape

No new state section. The behaviour job row carries, as the crow row carries `crow_phase`:
`npc` (the NPC's authored instance EntityId), `behaviour` (index into the NPC's list), `step`,
`times_left`, and optionally `resume {behaviour, step}`. The `job.schedule` op gains those optional
fields (`protocol/delta.schema.json`), the job save loader routes `kind: "behaviour"`
(`local-story/job-save.ts` reads `jobRoute`), and a cold reopen replays the receipts as for any job.
Fable reviews this slice (contract and save). Items move by `entity.transfer` only, so conservation
and the commerce save are untouched until sell/buy opens.

### 2.7 Collisions

- **Player and NPC on one item in one advance.** Jobs run after the root command and read the
  proposal so far: an item the player took is not present for the NPC's take, and the step fails
  (`on_fail`). Two NPCs on one item run in `(due_time, job_id)` order; the second finds it gone. A step
  that writes a row an earlier run wrote joins that run's writer group (`joinEarlier`), as replenish
  and decay do. A root command that both moves an item and advances time keeps the known `P.roots`
  limit (hs-1); the audit requires each verb's step never to write a row the root wrote in the same
  command, and the sampler has one test for it (take then wait).
- **Existing movers.** The compiler refuses both on one NPC. A reaction's `npc.move`, an arrest or
  flight may still move a behaving NPC; the next `go` leg re-paths, nothing breaks.
- **The player in the way.** A door the player locked refuses the NPC without the key: the leg fails
  and the behaviour's `on_fail` says what happens (`next`: she waits at the door and tries the next
  step; `stop`: the arbiter picks again). Nothing teleports.
- **Combat.** An engaged NPC skips steps until the encounter closes (section 2.2 rule 7).

### 2.8 Per-verb opening audit checklist

A verb opens in its own slice. The brief and the review answer every line.

1. **Body, not character.** The helper takes the body; `bodyOf` stays in the rule; no `world.character`
   read. Name each character-only read (skill, derived stat, lock, position fact, dialogue state) and
   state the NPC form of it.
2. **One admission.** The rule, the GameView offer and the step call the same refusal; a new refusal
   path is listed where step would list it.
3. **Narration.** One third-person key per outcome (`~<verb>.npc.<outcome>`), told only when the player's
   body is in the NPC's room and sees it (`visible`); nothing to a player elsewhere; no "you" line; no
   generated words (trap 4).
4. **Events.** The NPC is the subject (holder, entrant, attacker); the delivery carries no crediting
   character: `experience.grant`, `quest.activate`, `quest.*` and an unnamed player-scope `fact.assign`
   in a reaction to it write nothing; a named `fact.assign {npc}` and an instance fact still write.
5. **Credit.** No quest objective, experience, death credit, wage, levelling or balance ledger entry.
6. **Collisions.** The step reads the proposal so far; never writes a row the root command wrote; joins
   earlier runs' groups through the drain.
7. **Save.** Existing ops only, or the slice is a save slice with a Fable review (sell/buy).
8. **Budget.** Query steps charged to the run; no unbounded walk; the sampler's long wait stays under
   `due_jobs_per_advance`.
9. **Realm seams** 1 to 9 answered in the mechanics section.
10. **Sampler and tests.** One sampler row per refusal path, one red control, a cold-reopen test.

First-cut verbs and their known NPC forms: `move` (as `go`; W26 locks and keys; never a G7 lock),
`take`/`drop`/`put` (reach, carry if the NPC declares `carry`, else unbounded; G7 `get`/`put` locks
refuse an NPC as W26's traverse does; theft from an NPC by an NPC is not opened), `give` (to an NPC or
the player's body; a gift to the player is an ordinary `item_acquired` for the player, a legitimate
credit), `harvest` (ordinary only; no careful method; tool gate reads the NPC's held items), `attack`
(walk-in engage only: a behaving NPC that arrives hostile with an `attack` and `engage` line opens the
encounter as a player's move into its room would; never in a sanctuary). Second cut: `open`/`close`/
`lock`/`unlock` (keys held), `ignite`/`douse`, `perform` (craft, build, mend: costs from the NPC's own
pools, no check draws unless the action has none), `sell`/`buy` (shops only, Fable review), `wear`,
NPC posture.

### 2.9 Book effect

No new World page element. Everything the player sees is already a log line or a listing: the
people list (an NPC walking through), the item list (a patch emptied), third-person lines from the
engine (`~npc.left`, `~npc.arrived`, `~harvest.npc.taken`, emotes) placed by the existing line rules,
and the away recap grouping them. Arrival and departure wording follows loka-glj8's third-person
forms; the `go` leg binds the direction, so "<Name> leaves north." reads with it. Darkness and
concealment use `visible`, so an unseen NPC tells nothing (the "nameless footsteps" line is a later
unseen variant, not in the first cut). An NPC's holdings already show on its page (row 33's Look
sentence), so "she carries three sprigs" needs no element.

### 2.10 Elixir parity: recommendation

Keep the existing practice: the Elixir compiler carries every compile-time rule (schema, the
`plan` lowering, `params` filling, references, the `when`/`until` leaf allow-list, the mover
exclusivity refusal, the caps), and one content test pins each sampler's compiled hash; the
TypeScript kernel alone runs the arbiter and the plans (ADR-074, `portable_capability` rules are
TypeScript-only until a server consumes them). Reasons: the lowering is Elixir by construction, so
Elixir already holds the part an author can get wrong; a runtime port doubles the engine work with
no consumer; the differential tests the owner cites hold the foundation (encoding, deltas, ids),
which this work does not touch. If the owner's "both kernels carry every rule" means a runtime port,
it costs about as much again as the engine slices below and should wait for the Realm's first host.
To confirm with the owner.

## 3. Proof

**Sampler** `cartridges/behaviour_sampler`: a cottage (west), a lane (entry), a herb patch (east, a
harvest detail with three sprigs, replenished from a sealed store on a grid), a green (north of the
lane) and a pasture (south, behind a gate whose key the warden holds). Maud: `shelters`, `sleeps_at`
22 to 6, `harvests` 6 to 12 (three sprigs), `wanders` lane and green. The warden: `guards` the pasture
at night (hostile while the player is in the pasture after dusk), `works_at` the green by day. All
numbers in the cartridge. Text keys `~`.

**Walk transcript** (the pin, hand-checked literals):

1. 05:55 in the lane: nobody. Wait to 06:00: "Maud arrives from the west." Wait `pace`: "Maud leaves
   east."
2. Follow east: Maud is in the patch; wait `pace` three times: the harvest line three times; the
   patch lists no sprigs; Maud's page lists three.
3. Take a sprig before her second act: the patch has one sprig after her run, her plan went on
   (`on_fail: next`), no fault.
4. Wait to 12:10 from the patch: she left west; the cottage holds her; the `resume` cursor is unset
   (her plan ended).
5. Rain (a sky cut): she goes home from wherever she is and waits; dry again, `harvests` resumes at
   the same step (resume), not from the start (restart would re-walk).
6. Lock the cottage door with its key from outside at 21:50: at 22:00 she stands in the lane
   (`go` failed, `on_fail: next`, `wait until 6`); unlock it: nothing moves until the next decision.
7. At night in the pasture: the warden arrives through the gate, which reads locked after, and the
   encounter opens with his engage line; in the green by day he does nothing.
8. One wait from 05:55 to the next 05:55 equals steps 1 to 7 walked hour by hour (same rooms, same
   custody, same lines) and stays under `due_jobs_per_advance`; a cold reopen mid-walk replays.
9. Twenty copies of Maud (a test world) over an eight-hour wait: under budget; the count is pinned.

**Showcase addition** (one M slice after the first cut): in the Homestead district, a gatherer with
`harvests` on the existing herb patch and `sleeps_at` the crofter's cottage; in the social district a
sweeper on the green with `take` of items tagged `junk` the player drops and `put` into the midden
bin. Words `~` for the owner. Pinned by `showcase_homestead.test.ts` and `showcase_social.test.ts`.

## 4. Slices, ordered by alive-ness per unit of cost

Each is one developer run. "Fable" marks a Fable review (trust boundary, contract or save).
Minimum-alive set: 1 to 6 and 9 (marked *). Cut first, from the bottom.

| # | Title | Scope | Depends on | Fable | Size |
|---|---|---|---|---|---|
| 1* | Plan runner | `world.behaviours.pace`, NPC `behaviours[i].plan` with one routine, steps `go`, `wait`, `line`, `emote`, `find`; the behaviour job row and op fields; the `next` fold; the elapsed hour stop; mover exclusivity; Elixir schema and lowering; `behaviour_sampler` with Maud's harvest walk minus the harvest (she walks and waits). | none | yes | M |
| 2* | Arbiter | Layers, `when`/`until`, `chance`, `on_end`, preemption, one-level resume; the engaged and rooted skips; the sampler's rain and night rows. | 1 | no | M |
| 3* | Take, drop, put, give and the no-credit rule | Containment's helpers take a body; `act` for the four verbs with `container`/`recipient`; third-person keys `~`; events from an NPC's act credit nothing; the sweeper and gift rows. | 1 | yes (credit) | M |
| 4* | Harvest | `harvest` takes a body; ordinary only; tool gate reads the NPC; the patch-emptying row and the take-first collision test. | 3 | no | S |
| 5* | Canned behaviours | The five canned behaviours as the compile-time `behaviours` shortcut with per-NPC parameters (one source file, expanded per NPC, so a fix reaches every user; owner ruling 2026-11-06); `bin/loka new behaviour --from` only to open one NPC's plan for hand editing; Builders' Guide rows. | 2 | no | S |
| 6* | Walk-in engage | A hostile behaving NPC arriving in the player's room engages (G11 limit lifted for `go` arrivals); the warden row. | 2 | no | S |
| 7 | Replenish `when` | A policy gate on a replenish entry (world-state leaves); seasonal regrowth row. | none | no | S |
| 8 | Event wake | Reaction step `behaviour.start {npc, behaviour}`: cancels the NPC's pending job and schedules a decision at the cause time + 1; alarm and deer rows. | 2 | no | S |
| 9* | Showcase: gatherer and sweeper | The section 3 addition; words `~`; the two district pins. | 3, 4, 5 | no | M |
| 10 | NPC posture | A reserved entity fact `posture` an `act posture` step writes; Talk refused while sleeping (dialogue policy reads it); variants by `fact_compare subject target`; `sleeps_at` gains its step. | 2 | no | S |
| 11 | Doors and lights | `open`/`close`/`lock`/`unlock` and `ignite`/`douse` take a body; the shopkeeper and lamplighter rows. | 3 | no | M |
| 12 | The day's pick, readable | Policy leaf `behaving {npc, behaviour}` (the NPC's current behaviour); "what she did today" dialogue row. | 2 | no | S |
| 13 | NPC-relative conditions | `holds` for a body: `has_item`, `wearing`, `status_active self`, `resource_compare` read the NPC in `when`/`until`; the "hungry is an authored condition" row. | 2 | no | M |
| 14 | Perform | `perform` takes a body; costs from the NPC's pools; no RNG check; the woodcutter and mender rows. | 3 | no | M |
| 15 | Sell and buy | Shops only; the NPC's purse a conserved row; the commerce save knows NPC trade; the miner-sells-ore row and the showcase's surplus shipment. | 3, 14 | yes (save) | L |
| 16 | Leads | `go` with `with: [npc]` or a population plan (herder, couple, prisoner); followers take the leader's leg. | 2 | no | M |
| 17 | NPC-vs-NPC combat | A behaving NPC engages another NPC with no player in the fight (guard and wolf); owner ruling 2026-11-06 ranks it right after the minimum set. | 2, 6 | yes (contract) | L |

Not planned: NPC `say`, the item sink,
a summary mode for long absences, an engine-shipped behaviour library. Each is a new decision.

Budget note: slices 1 to 3 carry the design risk and should land before the plan drops around
2026-11-10; 4 to 6 and 9 are S or content-heavy and fit a lean workflow. 7, 8, 10 and 12 are S
each and can run as a batch with one reviewer.

## 5. Owner rulings (2026-11-06)

All four questions were ruled with the PM's recommendations: compile-time Elixir parity; walk-in engage first and NPC-vs-NPC combat as slice 17; canned behaviours as the compile-time shortcut, not copies; the hour stop, with a timed twenty-NPC catch-up on the browser build before the showcase adds more. See the [decision record](../decisions/owner-decision-npc-behaviours-2026-11-06.md).

## Appendix: immersion catalogue (session brainstorm 2026-11-06; owner: "good")

Tags: C content today; V needs one verb opened to NPCs; S small engine add; P needs the behaviour
system (arbiter, go/find, plan steps). Every line is the owner's; agents leave `~`.

- **Daily life:** wakes and goes to work (P); lunch break, stall empty at noon (P); sits at hearth
  (P, S posture); sleeps lying down, Talk unavailable (C variant and dialogue policy, S posture);
  lamplighter at dusk and dawn (V light); opens, closes and locks the shop with her key (V open, lock);
  sweeps, puts dropped junk back (V take, put); fetches water from the well (V fill, P); seeded day off
  (P chance); market or holy day routine (P calendar `when`).
- **Weather, season, time:** shelters from rain (P sky); soaked mood text (C); weather remarks in talk
  (C); cloak in winter (C, or V wear); harvest only in season (S replenish `when`); fire on cold nights
  (V light); night watch with a torch lights dark rooms he passes (V light, P); stargazer at full moon
  (P sky lunar); fishers at high tide (P sky tide); dawn and dusk ambient emotes (C).
- **With the player:** greeting that warms over visits (C reaction and pair facts); watches a stranger
  (C or P); avoids you when wanted (P); curious child follows a few rooms (P `until`); returns what you
  dropped (V take, give); magpie NPC keeps it (V take, P); waits at a meeting place after a quest (P);
  asks for help while bleeding (C dialogue policy on status); remarks on what you carry (C, check the
  leaf reads the player); thanks for herbs you sold (C); gift on a day you helped (V give); remembers you
  saved her (C standing).
- **Between NPCs:** visits a friend, emote to (P and emote `to`); gossip by co-presence (C W3); rivals
  avoid each other (P, needs `npc_present` for an NPC's room: later); couple walks together (P go to a
  moving NPC, slice 16); parent fetches child at dusk (P); apprentice brings tools (V take, give, P);
  haggling emotes at a stall (C, later V sell); festival bar fight (not planned: NPC-vs-NPC combat);
  guard escorts a prisoner (P, S leads); mourns at a grave after a death (P).
- **Work that shapes the world:** gatherer empties the patch before you (V harvest); woodcutter fills the
  mill pile, price drops (V perform, W11); farmer sows and harvests (V put, harvest, farming content);
  builder raises a hut over days (V perform build); mender reopens a storm-broken bridge (V perform,
  barrier); miner sells ore to the smith (V harvest, sell); cook makes stew from the fisher's catch
  (V perform craft); carter ships surplus out (C timed replenish); herder moves sheep (P, S leads a
  population); scavenger clears the road (V take, P).
- **Danger:** guards a pasture and engages intruders (P, walk-in engage); alarm sends everyone indoors
  (P event wake); flees when hurt, returns healed (P `stat_compare`, slice 13); hides while hounds roam
  (P `population_count`); watchman locks the gate at night (V lock, W26); hunter checks traps at dawn
  (V take); bandages herself (V bandage); rearms with a dropped weapon (V take, wield); bandit robs a lone
  NPC traveller (not planned: theft from an NPC by an NPC); avenges a friend (C pair fact, then walk-in
  engage).
- **Animals:** cat follows the sun (P); dog barks at strangers, follows owner (C, P); general crow steals
  shiny-tagged things (V take, P find by tag); deer flee a shout (P event wake); rats raid the larder at
  night (V take, P); honey regrows only while the hive lives (C and S replenish `when`); horse waits at
  the post (P).
- **Senses:** hear the smith next door while she works (C G6 cue with `when`); bread smell at baking
  hour (C); hums while working (C ambient); nameless footsteps pass in the dark (S unseen passing line,
  later); a moving lamp changes dark rooms (V light).
- **Memory:** tells you what she did today (S the day's pick as a readable leaf, slice 12); scar or limp
  after a fight (C W8); visits where you met weekly (P); shop remembers a thief (C standing); chronicle of
  world events (C FD6).
- **Festivals:** market day fills the square (P); harvest festival (P and C); funeral procession (P);
  storm evacuation (P, phased events 37a).
- **Avoid:** hidden need numbers (trap 2); RNG picks (trap 5); generated prose (trap 4); global gossip
  (trap 3); unbounded memory (trap 7); mood gating quests (trap 8); unseen chatter (lines only with the
  player present).
- **Most-reused verbs:** first take, put/drop, give, harvest; second open/close/lock, light, perform,
  sell/buy, wear. Small engine adds that pay most: NPC posture, passing lines with direction, the day's
  pick as a readable leaf, replenish `when`, NPC leads NPC or population.
