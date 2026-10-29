# Abilities design: professions, skills and spells (draft, 2026-10-23)

Status: design, owner-reviewed 2026-10-23 and corrected by the [design audit](../rnd/design-audit-abilities-authoring-2026-10-23.md). The build order is the audit's §4 plan (owner order: docs, tools, source shortcuts; the prologue sampler waits for prologue lore; Beads `loka-kgd.194`). Mechanics and balance only; lore
proposals are in [abilities-lore-2026-10-23](../worldbuilding/notes/abilities-lore-2026-10-23.md).
It fills the [15-professions](15-professions/) and [03-orders](03-orders/) stubs from what the
engine already does. Each "today" fact is one line and a link to its home in
[mechanics.md](../system/mechanics.md).

## 0. Starting point

### Decided, not reopened

| Rule | Source |
|---|---|
| SWG-style skill trees (Koster / LegendMUD line) | [homestead skill path](../decisions/owner-decision-homestead-skill-path-2026-10-15.md) |
| Several hidden elite professions; the warden order is one | same record, point 3; Beads `loka-ikch` |
| Homestead crafting runs on the player's own skills; a paid NPC reaches beginner tier only | same record, Effect 1-2 |
| A box costs a trainer coin fee; **XP is never spent**; a novice box is free | same record, rulings 2 |
| A failed craft loses its inputs | same record, rulings 1 |
| Mechanics in `docs/game-design/`, lore in `docs/worldbuilding/` | [decoupled](../decisions/owner-decision-worldbuilding-decoupled-2026-10-15.md) |
| Skills show on the Character page | [skills on Character](../decisions/pm-decision-skills-on-character-2026-10-15.md) |
| Practical skills D12 (careful harvest, haggle) | [D12](../decisions/pm-decision-d12-practical-skills-2026-10-06.md) |
| Aimed actions live on the target's page or the combat foe line; the say field casts only untargeted words; pick lists show only what the game offers | owner 2026-10-23 (paraphrased), [Book UI](../system/book-ui.md) "Pick a second thing" |
| Later: bottom-bar icon (`loka-x6t.110`), configurable hotbar (`loka-x6t.111`), aimed skills (`loka-x6t.109.6`) | Beads |

One deliberate departure from SWG: SWG spent typed XP at the trainer. Loka never spends XP; a
box costs a fee and its prerequisites read use counts. Everything below keeps that.

### What the engine has today

| Piece | Today | Home |
|---|---|---|
| Skill | A learned bool fact `skill_<key>`, a stat `qualification`, optional `growth` (1-8 use thresholds) | [rows 5/G5](../system/mechanics.md#skill-growth-and-opposed-checks-toolbox-rows-5-and-g5) |
| XP | One use count per skill, `uses_<key>`, +1 per opposed check, pass or fail | same |
| Check | Deterministic opposed check (level against a detail `rating` or an NPC attribute); also luck, threshold, track | same; `kernel/ts/src/mechanics/scripted_action/rule.ts` |
| Tree | `prerequisite` policy, `hidden`, `profession` text key; learned through a teacher's dialogue with `lesson_payment` | [hs-11](../system/mechanics.md#skill-trees-homestead-hs-11), [hs-14](../system/mechanics.md#skill-tree-view-homestead-hs-14) |
| Passive voice | `skill_compare` leaf; room and detail `asides` | [FD2](../system/mechanics.md#passive-skill-voices-toolbox-row-fd2) |
| Social | Dialogue choice `check` (skill or attribute), failure closes the talk | [row 14](../system/mechanics.md#dialogue-skill-checks-toolbox-row-14) |
| Craft | Scripted action `craft {consume, yield}`; custody moves only | [hs-10](../system/mechanics.md#craft-homestead-hs-10) |
| Spell | A scripted action with target `{kind: spell, word, learned}`; `cast {word}`; costs are pools; cooldown; `reason` text | [29a](../system/mechanics.md#spell-cast-admission-toolbox-row-29a) |
| Spell effects | `status.apply`, `damage`, `light.ignite`, spell-only steps | [29b](../system/mechanics.md#spell-effects-toolbox-row-29b) |
| Aimed spell | `aimed {scopes}`, `cast {word, target_id}`, offered on the target's entry; kernel_api 1.119 | merged #460 (`loka-x6t.109`, aimed targets); brief `docs/briefs/aimed-targets/README.md` |
| Levelling | Class-free experience from kills and quests; attribute points | [row 4](../system/mechanics.md#experience-and-levelling-toolbox-row-4) |
| Titles | A name variant on a fact | [W15/FD9](../system/mechanics.md#recognition-and-earned-titles-toolbox-rows-w15-and-fd9) |
| Delayed effects | Reaction `after`, `fact.stamp`, `time_since` | [FD1](../system/mechanics.md#delayed-reactions-toolbox-row-fd1) |

Verified in code: a scripted action pays its costs before its check, and a failure commits costs,
cooldown and steps like a success (`scripted_action/rule.ts` header). So a fizzled cast already
costs its mana. That answers the [costs-and-risks](../worldbuilding/02-magic/costs-and-risks.md)
question "does casting follow the failed-craft rule": yes, by default.

### The model in one paragraph

A **profession** is a named group of boxes (today a `profession` text key). A **box** is one
skill definition: learned once from a teacher for a fee, with a level that rises by use. A
**skill** in play is a scripted action or dialogue choice gated on a box's level; using it grows that box.
A **spell** is a scripted action cast by a learned word, paid in pools, gated on a box or a found text.
Skills grow by doing; spells are learned whole and get stronger only through higher spells and
the box that governs them. One shared shape covers targeting, costs, cooldowns and refusals (§4).

## 1. Profession roster

### 1.1 Starting professions

Landing stage: §1.1 to §1.6 apply after the prologue's landing; nobody builds them before the
prologue's 20 boxes are played (audit finding 8).

| Option | Shape | Verdict |
|---|---|---|
| A. Four starters, one per [player fantasy](../worldbuilding/00-foundations/player-fantasy.md) plus scholar | Few trees, thin choice | Too narrow for hybrids |
| **B. Six starters** (SWG's count) | Tiller, Wright, Healer, Scout, Guard, Scholar | **Recommended** |
| C. Eight or more (add Trader, Host) | Offline social and trade play is thin without other players | Later, as advanced |

Recommended six (working names; lore names later):

| Starter | Branches (3 boxes each) | Fantasy served | Showcase precedent |
|---|---|---|---|
| Tiller | Fields, Beasts, Hearth (cooking), Stores (keeping food) | Pioneer | `kitchen`, farming hs-2, animals hs-4 |
| Wright | Timber, Carving, Joinery, Stone | Pioneer / founder | `forestry`, `woodcraft` |
| Healer | Herbs, Dressing (wounds, bleed), Remedies (cures), Calm (fear, madness) | Guardian | D12 herbalism, bandage C5 |
| Scout | Tracking, Bow, Wayfinding, Survival (exposure) | Seeker / guardian | tracking W13, ranged row 17, `stealth` |
| Guard | Blade, Shield, Brawl, Watch (escort, detect) | Guardian | `blade`, `disarm`, `intimidate` |
| Scholar | Letters, Lore, Signs (identify), Elemental arts | Seeker | grimoire topics, row 27, spells |

Trade and civic play is not a starter. Haggle is a Scout or Scholar dabble box (D12), and civic
roles are offices outside the budget (§1.5).

### 1.2 Tree grammar

| Option | Shape | Engine | Verdict |
|---|---|---|---|
| A. SWG fixed: novice, 4 branches of 4, master (18 boxes) | Heavy: 6 x 18 = 108 skill files | none | Too heavy to author and balance (CU pruned SWG for this reason, [Koster report](../rnd/koster-design-lessons-2026-10-15.md)) |
| **B. House shape: novice, 3-4 branches of 3, master (11-14 boxes), cartridge-chosen** | One file per box | none; shape is an authoring rule | **Recommended**; showcase uses novice, 2 branches of 2, master (6) |
| C. Branch = one skill whose levels are the boxes | Fewer files | needs a "trained ceiling" so a level must be bought; new rule | No: the fee per box falls out of A/B for free |

Edges: a branch's first box has `prerequisite: skill_compare <novice> 1`; each next box reads the
box before it at a level (`skill_compare <prev> N`), so the branch is trained by using it. The
master box reads the top of every branch. Leaves allowed in a box prerequisite: `skill_compare`,
`fact_compare` (deeds, quests, places), `stat_compare`, `level_compare`, `has_item`,
`time_since`. Advanced and elite boxes may read boxes of other trees (SWG hybrids).

### 1.3 What a box grants

A box grants nothing by itself; other content reads it. That is how the engine works today and
it keeps grants honest (the reader is the gate).

| Grant | How (today) | Note |
|---|---|---|
| Scripted actions (schematics, actions) | scripted action `policy: skill_compare <box> N` | |
| Spell words | spell `learned` names the box's own acquired fact `skill_<box>` | the compiler merges the engine's `skill_<key>` facts before the spell check (`lib/loka/content/compiler.ex:222-231`, `spells.ex:51-67`); prove in the first sampler ([audit](../rnd/design-audit-abilities-authoring-2026-10-23.md) finding 5) |
| Dialogue options | dialogue `policy` or choice availability | |
| Asides (the body learning, hints) | `asides` with `skill_compare` | FD2 |
| Titles | `world.identity.name_variants` on `skill_compare <master> 1` | FD9 |
| Access | barrier `opens_when`, dialogue policy | |
| Attribute bonuses | not offered | Koster's horizontal power: new verbs, not bigger numbers; revisit after paper prototype |

For discovery (§6) a box may carry an authored **`unlocks`** text key, a sentence like the
existing `requirement` ("Teaches: Cook a stew; the word *lux*"). Text only, no logic. Engine
change S.

### 1.4 Advanced professions

Visible, demanding, reached by mixing trees. Examples (SWG pattern from the
[SWG notes](../rnd/koster-research-notes/star-wars-galaxies.md)):

| Advanced | Requires (any one route) |
|---|---|
| Ranger | Scout master; or Scout Wayfinding III + Healer Herbs III |
| Physician | Healer master |
| Builder | Wright Joinery III + Wright Stone III |
| Smith | Wright novice + Guard Blade II + a forge found (fact) |
| Trader | any two novices + haggle box |

### 1.5 Capacity and surrender (neither exists today; landing stage, audit finding 4)

**Capacity.** Each box declares a cost; the character's total cost of acquired boxes may not pass
`world.skills.capacity`. Derived on read (sum of acquired boxes), so no new save row.

| Option | Verdict |
|---|---|
| A. No cap | Offline needs no rationing, but identity and later Realm interdependence die ([Koster](../rnd/koster-design-lessons-2026-10-15.md) "hard capacity budget that favors hybrids") |
| **B. Per-box `cost`, world capacity, cost 0 for offices** | **Recommended**. Default tuning: about three masters and a dabble (SWG manual). Cost 0 is SWG's Politician pattern |
| C. Count boxes, no per-box cost | Simpler, but elites and offices cannot differ |

Two elites at once: content can forbid it with no engine (an elite novice's prerequisite holds
`not skill_compare <other elite novice> 1`). Recommend one elite per character.

**Surrender.** A new command (or dialogue step) that sets `skill_<box>` false. Rules: only the top
of a line (no held box may need it, SWG); it frees capacity; it does not refund the fee. Save
impact: today an acquired fact only goes false to true, and save recovery validates each true
acquired fact against one accepted grant receipt ([save](../system/save.md), C1 skills;
`mobile/authority/local-story/skills-save.ts`). Surrender adds a receipt kind that recovery must
accept, and relearning makes a second grant for one skill.

| Option for the box's use count on surrender | Verdict |
|---|---|
| **A. Keep `uses_<key>`; relearning costs the fee again** ("the hands remember") | **Recommended**; fits "XP never spent"; respec costs coin and the walk to a teacher |
| B. Reset the count to 0 | SWG-like loss; harsh on phone play |
| C. Halve it | A number to tune for no clear gain |

### 1.6 Hidden elites and the unlock grammar

Rule zero ([Jedi lesson](../rnd/koster-design-lessons-2026-10-15.md)): `hidden` keeps a box
off the player's screen, and per the [secret-elites ruling](../decisions/owner-decision-hidden-elites-secret-2026-10-15.md) it shows nowhere until the player qualifies; that stays; the cartridge is on the phone and will be read. Design every elite as if
its requirements are on a wiki, and make the path worth walking anyway.

| Option | Verdict |
|---|---|
| A. Secret list (SWG launch) | Fails the moment three players compare notes |
| B. Per-character random subset, seeded | Still decodable; forces disliked play |
| **C. Public, in-play path: staged facts, two or more routes from different starters, rarity by cost and duty** | **Recommended** |

Grammar for every elite:
1. **Stages** are facts: stirring, search, trial, acceptance
   ([warden path](../worldbuilding/03-orders/warden-path-and-unlock.md)). Each stage has asides
   that hint at the next (FD2), so a player who never reads a wiki still finds it.
2. **Routes**: the trial's policy is an `any` of at least two routes, each reachable from a
   different starter. No route asks for a profession the player avoided ("Everyone started
   playing everything they didn't like").
3. **Allowed leaves**: mastery of the player's own boxes, deed counts (reaction `fact.adjust`),
   places (a found-fact), conduct (the [witness ledger](../system/mechanics.md#witness-ledger-and-reaction-moves-toolbox-row-fd5-loka-kgd22)
   or counters), time (`time_since`, `sky`). No level grind as the main gate.
4. **Rarity by cost, not secrecy**: elite boxes cost more capacity; duties as statuses that
   block verbs ([SR4](../system/mechanics.md#command-blocks-and-resistances-on-a-status-toolbox-rows-sr4-and-sr5));
   slow growth (high thresholds). Do not max both rarity and power.
5. **Before, during, after**: before, only asides and rumours; during, the stage facts change
   asides and the teacher appears; after, the elite profession shows on the tree and a title.

Roster proposal (categories from [hidden-elites overview](../worldbuilding/03-orders/hidden-elites-overview.md);
names are placeholders):

| Elite | Category | Routes in (any one) | Power (new verbs) | Duty or cost |
|---|---|---|---|---|
| Warden | the order | Healer Calm III + conduct; or Scholar Lore III + conduct; or Guard Watch III + conduct | resonance words (§3), sensing, calming | vows as blocks; conduct breaks it |
| Ember school | arcane | Scholar Elemental master; or Wright Stone III + a found text | high coarse spells | weight (§3.4) rises fast |
| Lodge | craft | Wright master; or Tiller master | top-tier scripted actions others need | stocks, not power |
| Steward | civic | an office held, a town need met | town actions | cost 0 (office), outside budget |
| Deepwalker | wild | Scout master; or Tiller Beasts III + places | mounts, rare harvests, guidance | long absences |
| Night guild | shadow | Scout stealth + offences; or Guard + fences | theft, disguise | wanted, bounties |

Recommend shipping two first: Warden and one craft elite, then the rest as the world needs them.

## 2. Skills

### 2.1 Kinds and growth sources

| Kind | Played through | Grows today? | Gap |
|---|---|---|---|
| Craft | scripted action with `craft` and opposed check | yes | none |
| Lore, picking, searching | scripted action check at a detail | yes | none |
| Social | dialogue `check` | yes | none |
| Gathering | D12 careful harvest; luck checks (fishing) | no for careful harvest | growth on harvest |
| Trade | D12 haggle discount | no | growth on a discounted buy (capped per day or per shop) |
| Combat | weapon `skill` (G2) in rounds | no | **combat growth** |
| Spellcasting | spell scripted action | no: a spell's opposed check must name an NPC, no fixed rating | **spell rating check** |

XP kinds:

| Option | Verdict |
|---|---|
| **A. XP is each box's own use count; a box prerequisite may read several boxes** | **Recommended**: exists; "a type of XP for every major activity" (Koster) is met by giving each activity a box |
| B. Pooled XP kinds (combat XP, craft XP) spent across boxes | Adds a pool and a spend rule that "XP never spent" forbids |

### 2.2 No bottomfeeding (deferred to a playtest that shows grinding)

Use counts already stop at a box's last `growth` threshold, so no rating grinds a box past its
authored top (audit finding 3). The window below waits for evidence.

Today a use counts on every check, at any rating, so a rating-1 chest teaches as much as a
rating-7 vault. That is UO's bottomfeeding ([Koster](../rnd/koster-design-lessons-2026-10-15.md)).

| Option | Engine | Verdict |
|---|---|---|
| A. Keep: every attempt counts | none | Breaks the rule |
| **B. A use counts only inside a window: rating from level minus `below` to level plus `above`** | skills@1 rule, new floor | **Recommended**; both cartridge-owned, default 0 and 1 |
| C. A gain chance that falls with the gap (RNG) | RNG draw per use | Players macro for rolls; replay noise |

The window shuts both ends: a rating-1 chest stops teaching a level-3 picker, and failing a
rating-99 vault forever teaches nothing either. Failure costs something only where content says
so (craft loses inputs, a cast its mana, a failed talk closes); a plain check at a detail costs
nothing, so the authoring rule (§7) is: every scripted action that grows a skill declares a cost or a
cooldown.

### 2.3 Checks

Keep the deterministic opposed check as the default: it passes when level is at least rating,
so "practice persuades in the end" ([row 14](../system/mechanics.md#dialogue-skill-checks-toolbox-row-14)).
Luck checks stay for gathering and fishing. Qualification (stats at use) stays separate from
level: a strong novice can lift but not yet carve well.

### 2.4 Combat growth (gap)

| Option | Verdict |
|---|---|
| A. One use per blow | Macro-friendly; floods counts |
| **B. One use per encounter won against a foe whose `rating` is inside the window** | **Recommended**; NPC gains an optional `rating` (or reads an attribute) |
| C. Use per hit, capped per round | More tuning, same effect as B |

### 2.5 Passive voices

FD2 carries "the body learning": each box should have at least one aside somewhere in the world
that only its holder sees, and the box below a hidden one should hint at it. Authoring rule, not
engine.

### 2.6 Aimed skills (`loka-x6t.109.6`)

Same field as aimed spells: a plain scripted action may declare `aimed {scopes}`; it is offered on each
admitted target's entry (and on combat foe lines) as `perform` with that `target_id`; its policy
reads the target. It differs from a `use` pair: a use pair needs a carried tool and two objects;
an aimed skill needs one target (any tool is a `has_item` in its policy). The aimed-spells slice
refuses `aimed` on a `use` scripted action; keep that.

An aimed skill needs effects: today `status.apply` and `damage` are spell-only. Recommend lifting
them to any aimed scripted action (one effect vocabulary, §4). Engine M.

## 3. Spells

### 3.1 Identity and the three laws

A spell is a word, a learned gate, costs, a cooldown, a policy and a sequence (29a). Under the
three laws ([first](../worldbuilding/02-magic/first-law-understanding.md),
[second](../worldbuilding/02-magic/second-law-limits-and-costs.md),
[third](../worldbuilding/02-magic/third-law-expand-before-adding.md)):
- First: a spell solves only what the player has been shown it can solve; its `reason` text
  says why it refuses.
- Second: every spell declares a cost and a limit (pool, cooldown, policy). No free spell.
- Third: deepen schools before adding systems. A stronger spell is a new spell of the same
  school, gated on a higher box.

Mechanically there are two schools of source
([source and access](../worldbuilding/02-magic/source-and-access.md)): a **coarse school**
anyone can learn by use and study, paid in mana and reagents; and a **resonance school** of the
warden order, paid in a stillness pool and gated by conduct. Both are spells (words). The lore
note maps them.

### 3.2 Learning

| Route | How (today) |
|---|---|
| Grimoire | readable `topic` sets the learned fact |
| Teacher | dialogue choice assigns the fact, or the box is the gate (§1.3) |
| Order | the elite box's acquired fact is the learned gate |
| Quest | a reaction sets the fact |

Recommend: a spell a profession teaches uses the box's acquired fact, so surrender takes the
word back; a found spell keeps its own fact.

### 3.3 Growth

| Option | Engine | Verdict |
|---|---|---|
| A. Spells never grow; tiers are separate spells | none | Part of the answer |
| **B. A + the school box grows when its spells are cast against a rating (target NPC or a fixed spell `rating`), inside the window** | allow a fixed rating on a spell check | **Recommended**; also gives fizzle risk |
| C. Damage scales with level | formula in the engine | Players decode it; numbers drift |

### 3.4 Costs and risk

| Cost | Today | Proposal |
|---|---|---|
| Mana | a pool with regen by position | keep |
| Stillness (resonance school) | none | a second pool, filled by a meditate scripted action at rest; content only |
| Reagents | pools (`ash`) | stay pools: the compiler refuses `craft` on a spell (`lib/loka/content/replenish.ex`); item reagents wait for `loka-kgd.83` (foundation change) |
| Fatigue | `mv` pool | a cost on heavy spells; never tied to session length (Koster) |
| Fizzle | failure outcome, costs still paid | via §3.3 B |
| Backlash | failure outcome `status.apply` on the caster | content |
| Weight (corruption) | none | a bounded int fact the coarse harmful spells raise (scripted actions have no `fact.adjust` step, so the spell's `event.emit` drives a reaction's `fact.adjust`: content only), read by resonance gates and asides, lowered by deeds; a W8 permanent mark at the top |

### 3.5 Aimed and untargeted

Decided: an aimed spell lives on its target's page or the foe line; the say field casts only
untargeted words. Design rule: aim a spell when it acts on a thing; leave it untargeted when it
acts on the caster or the room (ward, a light without a lamp, a sense).

### 3.6 Rituals

A scripted action `duration` is refused in a fight and in `real_elapsed` cartridges (the showcase), so
rituals cannot be long casts.

| Option | Engine | Verdict |
|---|---|---|
| **A. Content: a start scripted action stamps a fact and applies a "channelling" status (blocks attack and cast); a reaction with `after` fires the effect if the status still holds; a room-exit reaction or a fight cures it, so walking away breaks the ritual** | none (FD1, SR4, `sky`, `time_window`) | **Recommended**; consistent with FD1 (the fired rule re-reads `when` for the stored actor; audit finding 9); prove in a sampler |
| B. Row 20 timed jobs (commission-style claim) | exists | For crafted ritual goods |
| C. A ritual row with group and site rules | new row | Realm, later |

## 4. Shared model

| Aspect | Skill | Spell | Shared rule |
|---|---|---|---|
| Entry | offered action (scripted action key) | typed word (untargeted) or offer (aimed) | aimed of either kind: `aimed {scopes}`, offered on the target entry |
| Targeting | detail, `use` pair, aimed entity | none or aimed entity | scopes: room occupants, room contents, inventory |
| Costs | pools (mv), held items (`craft.consume`) | pools (mana, stillness, reagents) | `ActionCost`; paid before the check, kept on failure |
| Cooldown | scripted action `cooldown` | scripted action `cooldown` | combat abilities: cooldown at least one `combat.interval` (content rule) |
| Learning | box from a teacher, fee | grimoire, teacher, box | gate is a fact; the box is the usual one |
| Growth | box use count, inside the growth window | the school box, inside the window (§3.3) | one rule in skills@1 |
| Effects | fact, resource, event; + status, damage when aimed (§2.6) | + status, damage, light | one effect vocabulary |
| Refusal | `invalid_state` + `reason` text; `resource.short` | same; an unknown or unlearned word is a plain `invalid_state` | the GameView and the command read one admission |
| Combat | aimed skills on foe lines | casts between rounds, no `duration` | see pacing |
| Gating by profession | box level in the policy | box fact as `learned` | profession is never a separate gate |

**Combat pacing.** Rounds run on `combat.interval`; casts between them. Options: A. content
cooldowns of one interval (recommended now); B. an engine "one aimed action per round" budget
(only if playtest shows spam); C. a per-fight ability count. Start with A.

## 5. Interdependence and economy

Koster's rules applied ([report](../rnd/koster-design-lessons-2026-10-15.md)): every profession
rests on systemic demand, not authored content; every faucet has a sink; skill-up crafting is
never a sure money loser; paid NPCs stop at beginner tier.

| Profession | Output | Consumed by (system) | Offline buyer | Gap |
|---|---|---|---|---|
| Tiller | food, buffs | hunger G13, spoilage row 41, `hearty` | inn, commissions | none |
| Wright | tools, furniture, rooms | durability row 21, built rooms | repair service, settlers | tool wear (only weapons wear) |
| Healer | dressings, remedies | bleed, wounds, statuses (cures) | infirmary | none |
| Scout | hides, meat, guidance | crafts, escorts | traders, escort jobs | none |
| Guard | protection | raids, escorts, bounties | town defence | raids (Settle S4) |
| Scholar | identification, light, words | unidentified items row 27, dark rooms | sage service | translation |
| Elites | top-tier goods and verbs | everyone above | NPC commissions | per elite |

Offline substitute for other players: NPC commissions (row 20) and replenished shelves (19b)
buy and sell within caps, so a crafter can live off fighters' wear without a player market.
Fighters need crafters because weapons break and only repair restores them; crafters need
fighters and scouts for inputs.

| Offline demand option | Verdict |
|---|---|
| **A. NPC commissions and replenished shelves within caps** | **Recommended**: installed (rows 20, 19b); caps stop a gold spigot |
| B. Simulated settlement needs (settlers consume stock over time) | Better feel; needs Settle S3 |
| C. Nothing until the Realm | Crafters have no buyer offline; fails the owner's crafting decision | Track faucets and sinks per profession
([economy ledger](12-economy/economy-ledger-and-metrics.md)).

## 6. UI

Rules in force: aimed actions on the target's page or foe line; the say field untargeted only;
pick lists show only GameView offers.

**Conflict to settle.** The PM ruling keeps Skills on Character "until a second profession
exists", then splits a Skills page out. The showcase already declares three (`forestry`,
`kitchen`, `woodcraft`), so the trigger has fired. Options: A. split a Skills page now, as ruled;
B. keep Character, collapse each profession to its title line (tap opens the tree); C. wait for
the first real-game tree. Recommend B now, A when a character can hold more than two
professions. B departs from the ruling, so it needs a new decision record.

**Tree view** (exists, [skill tree details](../system/book-ui.md#skill-tree-details)): learned
boxes with level, locked and not-learned notes with their requirement. Add per box: the
`unlocks` line (§1.3) and the capacity line ("Capacity 24 of 40") once §1.5 lands. Hidden boxes
draw nothing until the player qualifies ([secret-elites ruling](../decisions/owner-decision-hidden-elites-secret-2026-10-15.md)).

**What to train next.** The player learns it from: the requirement and unlocks lines; teacher
lesson lines; asides that appear as a box nears its next level; FD9 titles at mastery. No
"recommended next" list: discovery stays in the world.

**Bottom-bar icon (`loka-x6t.110`).** One "Abilities" list: untargeted spells (castable rows);
aimed spells and skills, each with "Cast on…" or "Use on…" opening the pick list of its
admitted targets (the reverse list the owner approved for the Spells block); a link to the tree.

**Hotbar (`loka-x6t.111`).** The player pins abilities from that list. Options: A. a Book
preference on the device (no save, no protocol); B. a saved player setting (Realm-portable).
Recommend A now. A pinned aimed ability opens its pick list; it never sends without a target.

## 7. Authoring

Per **profession**:

| Option | Verdict |
|---|---|
| **A. A text key only (today), on each box** | **Recommended**: no file; capacity and offices live on box `cost` |
| B. `professions/<key>.json` (order, novice, master, title) | Only when a profession needs data a box cannot hold |
| C. Derived from boxes (the novice box names the profession) | Same as A with more rules |

Per **box** (`skills/<key>.json`): `label`, `requirement`, `qualification`, `profession`,
`prerequisite`, `growth`, optional `hidden`; new: `cost` (§1.5), `unlocks` (§1.3). Plus a teacher
dialogue choice with `skill.acquire` and `lesson_payment` (free for a novice), and at least one
aside.

Per **spell** (`actions/<key>.json`): `target {kind: spell, word, learned, aimed?}`, `costs`,
`cooldown`, `policy`, `reason`, `check` (new: fixed rating), `sequence`, `narration`.

Per **elite**: the boxes (all `hidden`), stage facts, an `any` trial policy, the teacher, the
asides, a title variant. The hs-14 load checks bind this: a non-hidden skill, a dialogue
`policy`, a dialogue `label` or a riddle may not name a hidden skill. So stage hints read the
stage facts and the player's own non-hidden boxes, never the hidden box, and the elite teacher's
dialogue carries no label.

Every scripted action that grows a skill declares a cost or a cooldown (§2.2). Keep it small: a starter
tree is about 11 box files, 11 lesson choices, 6-10 scripted actions, 6 asides.

## 8. Build order

| Option | Verdict |
|---|---|
| **A. Content-only slice 0, then engine rows** | **Recommended**: proves the shape on installed mechanics; finds real gaps |
| B. Engine rows first (capacity, growth), then content | Builds rules no content has tested |
| C. One large district with every layer | Too big to review; mixes contract and content |

**Superseded by the [audit plan](../rnd/design-audit-abilities-authoring-2026-10-23.md#4-plan)
(owner 2026-10-23).** The first content slice is the prologue's Tending basic built as quests
(audit phase 1), and it waits for prologue lore. Before it: content tools (coverage, rule
explainer) and compile-time source shortcuts. The guild-hall slice (fees, a master title, an
elite) belongs to the landing.

**Then engine rows, in this order:**
1. Spell rating checks (§3.3), when a prologue word needs a fizzle.
2. At the landing: capacity and surrender (§1.5); the growth window (§2.2) only if a playtest shows grinding.
3. Aimed skills with shared effects (§2.6), after aimed spells merge.
4. Combat growth (§2.4); harvest and haggle growth.
5. Box `unlocks` text; Skills collapse on Character (§6).
6. Item reagents (§3.4).
7. Abilities icon, then hotbar (Book only).

Paper-prototype combat math and buff stacking before row 3 ships to a district (Koster: "We
never paper gamed combat").

## 9. Engine impact

| Item | Protocol | Save | kernel_api | Size | Depends on |
|---|---|---|---|---|---|
| Slice 0 content | none | none | none | M content | aimed spells for aimed lux |
| Spell `learned` = a box fact | none | none | none | none | read in code (audit finding 5) |
| Growth window (`world.skills.window {below, above}`) | cartridge schema | none | next floor after 1.119 | S | — |
| Spell fixed rating check | action schema | none | yes | S | growth window |
| Box `cost` + `world.skills.capacity` | cartridge schema, GameView (capacity) | none (derived) | yes | S-M | — |
| Surrender | command schema (or a dialogue step), GameView offer | **yes**: recovery must accept a surrender receipt and a second grant (`skills-save.ts`) | yes | M | capacity |
| Aimed skills (`aimed` on scripted actions) | action, command, GameView | none | yes | M | `loka-x6t.109.2` |
| Effect steps on aimed scripted actions | action schema | none | yes | S | aimed skills |
| Combat growth + NPC `rating` | cartridge schema | none | yes | M | growth window |
| Harvest and haggle growth | none | none | maybe | S each | growth window |
| Box `unlocks` text | cartridge, GameView | none | yes | S | — |
| Item reagents on spells | action schema; foundation (`loka-kgd.83`) | foundation | yes | L | `loka-kgd.83` |
| One aimed action per round | none | none | maybe | S | only if playtest asks |
| Abilities icon, hotbar (device pref) | none | none | none | S-M Book | aimed skills |

No item needs a new save section; surrender changes save recovery. Kernel rules stay TypeScript-only; the Elixir side is the
loader twin and `bin/contracts.exs`.

## 10. Open questions for the owner

Each has a default that applies if unanswered.

1. Six starters (Tiller, Wright, Healer, Scout, Guard, Scholar)? Default: yes.
2. House tree shape: novice, 3-4 branches of 3, master; showcase 6 boxes? Default: yes.
3. Capacity cap (landing): about three masters and a dabble? Default: yes, tuned in playtest.
4. Surrender (landing) keeps the use count and charges the fee again to relearn? Default: yes.
5. One elite per character? Default: yes.
6. Elites are public paths (requirements assumed known), rare by cost and duty, not secrecy? Default: yes.
7. First two elites: Warden and one craft elite? Default: yes.
8. Growth window: only if a playtest shows grinding (use counts already stop at the top threshold)? Default: yes, deferred.
9. Combat growth counts per encounter won, not per blow? Default: yes.
10. Spells never grow by themselves; tiers are new spells; the school box grows by casting? Default: yes.
11. Two magic schools: coarse (mana, reagents, weight) and resonance (stillness, conduct)? Default: yes.
12. A failed cast keeps costing its mana (engine default today)? Default: yes.
13. Skills on Character: collapse each profession to a title line now (a new record replacing the split ruling), split a page later? Default: yes.
14. Hotbar is a device preference, not saved? Default: yes.
15. No attribute bonuses from boxes for now (new verbs only)? Default: yes.
16. Keep class-free levelling (row 4) beside boxes, as attribute growth only? Default: yes.
17. Prologue: all four basics (Tending, Making, Guarding, Words) free for everyone, each a descent stage? Default: yes.
18. Prologue depth: the 20-box roster in §11, each box learned by a short quest of gifts or labour, no coin? Default: yes.
19. (Parked to the landing) houses one per character, guilds several at once? Default: decide at the landing.

## 11. The prologue aboard the Forest Ark (added 2026-10-23)

Owner (paraphrased): aim this at the prologue; everyone can learn basic spells, skills, combat
and crafting, and may specialize by joining a guild or house. Lore read:
[main arc Act I](../worldbuilding/21-story/main-storyline-arc.md),
[starting region](../worldbuilding/05-geography/starting-region.md),
[metaphysics](../worldbuilding/01-cosmology/metaphysics.md). Research:
[Morrowind note](../rnd/elder-scrolls-morrowind-skills-2026-10-23.md).

**The key fit.** In Act I, learning is the descent. Every first taste, first garment, first tool
lowers the ark's frequency until it phases into the dead world's sky. So the prologue's skill
progress *is* its story clock: the four basics are the stages of the starting region's
devolution, and the Seer's revelation lands once the player has learned them.

| Basic (free novice box) | Descent stage it opens | First use |
|---|---|---|
| Tending (gather, sap, herbs) | Stage 1, first food: shadows, twilight | taste the sap, gather plants |
| Making (wood, stone, cloth) | Stage 2-3, labour, garments and shelter: stamina, cold | clear brush, build the shelter |
| Guarding (spar, block) | Comradeship: sparring with the companion, never a kill | train with the companion |
| Words (the first coarse spell) | Stage 3, night turns pitch black | the first light word when the inner light is gone |

The fourth row is the turn of the screw: the player starts luminous and needs no light, and
learns a light spell exactly when their own light dies. Words that command matter are a sign of
the fall (lore note).

**Should there be three professions?** No: no class, house or guild in the prologue.

Owner 2026-10-23 (paraphrased): houses and guilds wait until the landing, after the prologue;
the prologue is still an involved game.

| Option | Verdict |
|---|---|
| A. Three classes chosen at the start | No: Skyrim's lesson (classes picked before the player knows the skills), and it closes the basics |
| **B. No choice in the prologue; all four basics for everyone; the player leans by use** | **Decided (owner)**; houses and guilds after the landing |
| C. A house vow at the Divergence of Vows | Deferred by the owner to after the landing |

**Depth without houses.** The prologue stays involved through use, as Skyrim's "define your
character as you play": every basic has its novice box and the first boxes of its branches
(two branches of two each), taught by ark teachers; the player raises what they practise. At
the landing the Character page shows the leaning the player built, and houses and guilds open
then, reading that leaning in their entry policies. The four basics stay open to everyone.

**Prologue roster (proposal; 20 boxes).**

| Basic (novice box) | Branch I, II | Branch I, II | Descent stage |
|---|---|---|---|
| Tending: gather, forage, taste the sap | Herbs: know plants, careful harvest; poultice, dressing | Hearth: sap cakes; warming stew (buff) | 1, first food |
| Making: clear brush, carry, whittle | Wood: carving; joinery (the shelter) | Weaving: cord; garments against the cold | 2-3, labour and cold |
| Guarding: spar at drill posts and with the companion | Staff: strike; disarm | Stand: block; hold firm (a ward) | comradeship; no kill |
| Words: *lux*, the night the inner light goes out | Fire: kindle; a small flame | Water: douse; warmth (self status) | 3, the dark |

Resonance is never taught aboard: it is what the player loses.

**Learning in the prologue: quests, not fees.** Owner 2026-10-23 (paraphrased): in the
prologue a box is learned by gifts or labour, through a quest or task; when the questline is
done the skill is learned, and it is then used in later quests. Coins do not exist until descent
stage 4, so the coin fee starts after the prologue. This departs from the coin-fee ruling
([homestead skill path](../decisions/owner-decision-homestead-skill-path-2026-10-15.md), ruling
2) for the prologue only; it needs its own decision record.

| Option | Engine | Verdict |
|---|---|---|
| **A. The questline ends at the teacher: a dialogue choice offered once the quest's objective holds does `skill.acquire`, no payment** | none: quests, dialogue choices and `skill.acquire` exist | **Recommended**; a choice may teach a skill with no payment (`lib/loka/content/skills.ex:313-316`); the gift to the teacher is a `hand_over` (the player gives; `receive` is the reverse, the NPC giving, as `cartridges/toolbox_showcase/dialogues/aldous_lesson.json` does) |
| B. A `skill.acquire` step on the `quest_resolved` reaction | new reaction step; save recovery checks each acquired fact against a dialogue grant receipt (`skills-save.ts`) | Only if A cannot carry it |
| C. Gift as a `lesson_payment` in items | lesson payments are coin today | Not needed: the gift is a quest objective |

Variant (audit approach A, "the quest is the box"): the quest's objective is the box itself
(`skill_compare`), its journal stages say what to practise, and `quest_resolved` reactions set the
descent-stage facts that room variants and the sky read. Either order works; this one needs fewer
facts. The first sampler decides.

Gifts and labour are the quest's objectives: hand the teacher what was asked (an existing
hand-over), or do the work (a scripted action whose success sets a fact, counted toward the objective).
Each box's quest is short, a task of one to three steps, and the next box's quest opens only once
the box below has reached its level by use. A learned box is then a requirement of later quests
(a quest offer or choice policy with `skill_compare`), which is how "the skill is used for other
quests".

**Later, after the landing (parked).** Houses (choose one, Morrowind's Great Houses) and guilds
(several at once) as rank facts whose policies read favored boxes, deeds and standing; one house
is a `not fact_compare` on the others; expulsion a reaction on a witnessed offence; readmission
`time_since`. Content only, no engine change. Names and number wait for the landing's lore.

**First-hour rule.** Every prologue rating is passable at novice level, so nothing "swings and
misses" in the first hour. A failed craft still loses its inputs (owner rule), so prologue
inputs are plentiful (replenish).

## Top recommendation

- Build the foundation first (content tools, compile-time source shortcuts), then the prologue's
  Tending basic as quests on installed mechanics once its lore is laid down (audit plan).
- A box is one skill file; XP is its own use count, never spent; the fee and the prerequisite are
  the only gates.
- Engine rows only on evidence: spell rating checks, aimed skills with one shared effect
  vocabulary; capacity, surrender and the growth window at the landing.
- Treat every elite's requirements as public: staged facts, two or more routes from different
  starters, rarity by cost and duty.
- Keep spells as learned words that grow through their school box and higher tiers, paid in
  pools, with failure costing what it cost.
