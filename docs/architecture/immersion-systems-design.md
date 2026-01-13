# Loka Immersion Systems Design Document

## Executive Summary

This document defines a comprehensive immersion system that densely layers narrative, mechanics, and player progression into a cohesive experience. The goal is to make every action feel meaningful while maintaining extensibility for builders.

**Core Philosophy**: Mechanics *are* storytelling. Every system teaches Buddhist philosophy through gameplay, not exposition.

---

## Part 1: Stat Architecture

### Design Philosophy

Keep the stat system **simple and grounded** in the existing primitives. Rather than adding many new tracking stats, we:

1. Use **Mind (mnd)** as a core attribute alongside str/dex/sta - governs spiritual abilities
2. Use **Karma** as the one special tracking stat - moral compass that affects story
3. Everything else derives from these + existing systems (skills, flags, quest completion)

### Current State Analysis

**Implemented in GameState:**
```elixir
@default_stats %{str: 10, dex: 10, sta: 10, level: 1, xp: 0, skill_points: 0}
```

**Gap**: Missing `mnd` (Mind) as core spiritual attribute. Karma referenced in content but not tracked.

### Proposed Stat Hierarchy (Simplified)

```
STATS (game_state.stats)
├── BASE ATTRIBUTES (Physical + Mental Foundation)
│   ├── str (Strength) - Physical power, melee damage, carrying
│   ├── dex (Dexterity) - Precision, critical chance, dodge
│   ├── sta (Stamina) - Endurance, health pool, recovery
│   └── mnd (Mind) - Spiritual power, meditation, perception
│
├── PROGRESSION STATS
│   ├── level - Current level (1-50)
│   ├── xp - Total experience accumulated
│   ├── xp_to_next - XP needed for next level
│   └── skill_points - Unspent points for abilities
│
├── SPECIAL STATS
│   └── karma - Moral balance (-100 to +100)
│
└── CURRENCIES
    └── gold - Standard currency

RESOURCES (game_state.resources)
├── health - {current, max} - Survival (scales with sta)
├── mana - {current, max} - Magical abilities (scales with mnd)
└── mv - {current, max} - Energy/vitality (scales with sta + mnd)
                          Used for: movement, meditation, mantras

SKILLS (game_state.skills)
├── combat_skills - Swordsmanship, archery, etc.
├── spiritual_skills - Meditation, mantras, etc. (use mnd, cost mv)
└── knowledge_skills - Lore, languages, etc.
```

**MV as Universal Energy:**
- Movement costs MV (walking between rooms)
- Meditation costs MV (sitting still takes effort too)
- Mantras cost MV (spiritual exertion)
- Scales with both STA (physical endurance) and MND (mental endurance)

### Why This Works

**Mind (mnd) replaces multiple concepts:**
- Higher mnd = better meditation outcomes
- Higher mnd = stronger mantra effects
- Higher mnd = resistance to illusion/confusion
- Higher mnd = see through deception (dialogue options)
- Higher mnd = larger MV pool (combined with sta)

**Karma as single moral tracker:**
- Tracks cumulative moral choices
- Affects NPC reactions ("karma_tier")
- Gates certain dialogue options
- Determines ending path eligibility
- Simple: +karma for good, -karma for bad

**Skills handle specific abilities:**
- `meditation` skill = can meditate, better with levels
- `mantra_om_mani` skill = knows that mantra
- Skill checks replace arbitrary "insight >= 5" checks

### Implementation: Core Changes

**1. Update GameState defaults** (`lib/loka/framework/player/game_state.ex`):

```elixir
@default_stats %{
  # Base attributes (4 core stats)
  str: 10,   # Strength - physical power
  dex: 10,   # Dexterity - precision, speed
  sta: 10,   # Stamina - endurance, health
  mnd: 10,   # Mind - spiritual power, perception

  # Progression
  level: 1,
  xp: 0,
  skill_points: 0,

  # Special
  karma: 0   # Moral balance (-100 to +100)
}

# Resources stay the same - MV now serves dual purpose
@default_resources %{
  health: %{current: 100, max: 100},  # sta-based
  mana: %{current: 100, max: 100},    # mnd-based
  mv: %{current: 150, max: 150}       # sta + mnd based (energy for all actions)
}
```

**2. Resource Formulas** (update `calculate_max_resources`):

```elixir
def calculate_max_resources(game_state) do
  stats = game_state.stats || @default_stats
  level = stats["level"] || stats[:level] || 1
  sta = stats["sta"] || stats[:sta] || 10
  mnd = stats["mnd"] || stats[:mnd] || 10
  dex = stats["dex"] || stats[:dex] || 10

  %{
    resources: %{
      health: %{max: 100 + sta * 10 + (level - 1) * 15},   # Stamina-based
      mana: %{max: 50 + mnd * 5 + level * 5},              # Mind-based
      mv: %{max: 100 + sta * 5 + mnd * 3 + dex * 2}        # Sta + Mnd + Dex
    }
  }
end
```

**3. Mind Stat Uses**

| System | How Mind (mnd) Affects It |
|--------|---------------------------|
| Meditation | Higher mnd = faster MV regen during meditation, more visions |
| Mantras | Higher mnd = stronger effects, shorter cooldowns |
| Illusion Resistance | mnd vs attacker's level for resist checks |
| Perception | mnd-gated dialogue options ("You sense deception") |
| MV Pool | mv_max includes mnd bonus (spiritual endurance) |
| Mana Pool | mana_max = 50 + mnd * 5 + level * 5 |

**4. Karma Module** (`lib/loka/framework/progression/karma.ex`):

```elixir
defmodule Loka.Framework.Progression.Karma do
  @moduledoc """
  Manages karma - the moral balance tracking stat.

  Karma ranges from -100 (dark) to +100 (enlightened).

  Affects:
  - NPC reactions (via karma_tier)
  - Available dialogue choices
  - Quest outcomes
  - Final ending eligibility
  """

  alias Loka.Framework.Player.GameState

  @karma_range -100..100

  @doc "Adjust karma by delta, clamping to valid range."
  def adjust(%GameState{} = state, delta, source \\ :action) do
    current = get(state)
    new_value = clamp(current + delta, @karma_range)

    message = format_change(delta, source)
    state = put_stat(state, :karma, new_value)

    {:ok, state, message}
  end

  @doc "Get current karma value."
  def get(%GameState{stats: stats}) do
    stats["karma"] || stats[:karma] || 0
  end

  @doc "Get karma tier for conditions/reactions."
  def tier(state) do
    karma = get(state)
    cond do
      karma >= 75 -> :enlightened
      karma >= 40 -> :virtuous
      karma >= 10 -> :good
      karma >= -10 -> :neutral
      karma >= -40 -> :troubled
      karma >= -75 -> :dark
      true -> :corrupted
    end
  end

  @doc "Check if karma meets threshold for action."
  def meets_threshold?(state, threshold) when is_integer(threshold) do
    get(state) >= threshold
  end

  def meets_threshold?(state, tier) when is_atom(tier) do
    tier_order = [:corrupted, :dark, :troubled, :neutral, :good, :virtuous, :enlightened]
    current_tier = tier(state)

    Enum.find_index(tier_order, &(&1 == current_tier)) >=
      Enum.find_index(tier_order, &(&1 == tier))
  end

  defp clamp(value, min..max), do: max(min, min(max, value))

  defp format_change(delta, _source) when delta > 0 do
    "Your karma lightens. (+#{delta})"
  end

  defp format_change(delta, _source) when delta < 0 do
    "Your karma darkens. (#{delta})"
  end

  defp format_change(0, _), do: nil
end
```

**5. Add Condition Support** (`lib/loka/framework/conditions/evaluator.ex`):

```elixir
# Add karma conditions
defp normalize(%{"karma_gte" => value}), do: {:karma_gte, value}
defp normalize(%{"karma_tier" => tier}), do: {:karma_tier, tier}
defp normalize(%{"mnd_gte" => value}), do: {:stat_gte, :mnd, value}

defp do_evaluate({:karma_gte, value}, state) do
  Karma.get(state) >= value
end

defp do_evaluate({:karma_tier, tier}, state) do
  Karma.meets_threshold?(state, String.to_atom(tier))
end
```

### Deriving "Spiritual Progress" from Existing Systems

Instead of tracking insight/paramitas separately, derive them:

```elixir
defmodule Loka.Framework.Progression.SpiritualProgress do
  @moduledoc """
  Calculates spiritual progress from existing systems.
  No new stats needed - just query what player has done.
  """

  @side_quests [
    "side_restless_spirits",
    "side_hermits_song",
    "side_mountain_peak",
    "side_butchers_burden",
    "side_tea_for_travelers",
    "side_musicians_tale",
    "side_forge_blessing"
  ]

  @doc "Get effective 'insight' level (0-10) from completed quests + meditation skill."
  def insight_level(game_state) do
    quest_bonus = count_completed_side_quests(game_state)  # 0-7
    meditation_bonus = div(get_skill_level(game_state, "meditation"), 20)  # 0-5
    mnd_bonus = div(get_stat(game_state, :mnd) - 10, 5)  # 0-4 for mnd 10-30

    min(10, quest_bonus + meditation_bonus + mnd_bonus)
  end

  @doc "Check if player has enough 'insight' for an action."
  def insight_gte?(game_state, required) do
    insight_level(game_state) >= required
  end

  defp count_completed_side_quests(game_state) do
    completed = StateHelper.get_completed(game_state.quests)
    Enum.count(@side_quests, &(&1 in completed))
  end
end
```

**Now conditions like `insight_gte: 5` translate to:**
- Player has completed some side quests, AND
- Player has trained meditation, AND
- Player has decent Mind stat

This is **earned through gameplay**, not just a counter.

---

## Part 2: Character Sheet Display

### Mobile App Integration

**Update TypeScript types** (`mobile/src/types/game.ts`):

```typescript
export interface Stats {
  // Base attributes (4 core stats)
  strength?: number;   // str
  dexterity?: number;  // dex
  stamina?: number;    // sta
  mind?: number;       // mnd [NEW - replaces int/wis/cha]

  // Progression
  level?: number;
  xp?: number;
  xp_to_next?: number;
  skill_points?: number;

  // Special
  karma?: number;  // -100 to +100

  // Currency
  gold?: number;

  [key: string]: number | undefined;
}

export interface Resources {
  health: ResourcePool;
  mana: ResourcePool;
  mv: ResourcePool;  // Energy for movement, meditation, mantras
}
```

**Update StatsPanel** (`mobile/src/components/StatsPanel.tsx`):

```tsx
// Attributes section - clean 4-stat layout
<Section title="Attributes">
  <StatGrid>
    <StatBox label="STR" value={stats.strength ?? 10} />
    <StatBox label="DEX" value={stats.dexterity ?? 10} />
    <StatBox label="STA" value={stats.stamina ?? 10} />
    <StatBox label="MND" value={stats.mind ?? 10} />
  </StatGrid>
</Section>

// Resources - MV is universal energy
<Section title="Vitals">
  <ResourceBar label="Health" current={health.current} max={health.max} color="red" />
  <ResourceBar label="Mana" current={mana.current} max={mana.max} color="blue" />
  <ResourceBar label="Energy" current={mv.current} max={mv.max} color="green" icon="energy" />
</Section>

// Karma as special display
<Section title="Spirit">
  <KarmaBar
    value={stats.karma ?? 0}
    tier={getKarmaTier(stats.karma)}
  />
</Section>
```

**Karma tier display:**
```typescript
function getKarmaTier(karma: number): { label: string; color: string } {
  if (karma >= 75) return { label: 'Enlightened', color: 'gold' };
  if (karma >= 40) return { label: 'Virtuous', color: 'green' };
  if (karma >= 10) return { label: 'Good', color: 'lightgreen' };
  if (karma >= -10) return { label: 'Neutral', color: 'gray' };
  if (karma >= -40) return { label: 'Troubled', color: 'orange' };
  if (karma >= -75) return { label: 'Dark', color: 'red' };
  return { label: 'Corrupted', color: 'purple' };
}
```

### Why 4 Core Stats?

| Stat | Governs | Resources |
|------|---------|-----------|
| **STR** | Melee damage, carrying, physical feats | - |
| **DEX** | Accuracy, dodge, speed, critical hits | Movement bonus |
| **STA** | Health pool, endurance, recovery | Health, Movement |
| **MND** | Spiritual power, perception, magic | Mana, MV bonus |

This is cleaner than 6 stats and more thematically appropriate for a Buddhist game:
- Physical prowess: STR + DEX + STA
- Mental/spiritual: MND

MND replaces INT/WIS/CHA because in Buddhist philosophy, these aren't separate - a trained mind encompasses understanding, wisdom, and presence.

---

## Part 3: Interactive World Objects

### System Design

Interactive objects allow players to **engage with the environment** rather than just read about it.

**Object Types:**
1. **Examinable** - Provides lore/flavor text
2. **Usable** - Single interaction (light lamp, ring bell)
3. **Container** - Holds items (chest, shrine offering bowl)
4. **Consumable** - Uses item from inventory
5. **Skill-gated** - Requires skill level
6. **Quest-linked** - Advances quest objectives

### YAML Schema

```yaml
# Room prototype with interactive objects
key: temple
type: room
name: "Main Temple"
description: "..."

interactive_objects:
  butter_lamps:
    name: "Butter Lamps"
    type: usable
    keywords: ["lamps", "butter lamps", "lights"]

    examine:
      default: "Rows of flickering butter lamps cast dancing shadows."
      insight_3: "Each flame represents a prayer, a wish for liberation."
      insight_7: "You see the flames as metaphor—consuming fuel to give light, as suffering transforms to wisdom."

    interact:
      verb: "light"
      cost:
        item: butter
        consume: true
      effects:
        - type: message
          text: "You add your light to the collective prayer."
        - type: stat
          stat: karma
          delta: 1
        - type: status
          status: blessed
          duration: 60
      cooldown: 300  # 5 minutes

  prayer_wheel:
    name: "Prayer Wheel"
    type: usable
    keywords: ["wheel", "prayer wheel", "bronze cylinder"]

    examine:
      default: "A bronze cylinder inscribed with Om Mani Padme Hum."

    interact:
      verb: "spin"
      effects:
        - type: message
          text: "The mantra vibrates through your fingertips."
        - type: extend_status
          status: blessed
          duration: 30
      cooldown: 60

  offering_bowl:
    name: "Offering Bowl"
    type: container
    keywords: ["bowl", "offering bowl", "bronze bowl"]

    examine:
      default: "An empty bronze bowl before the Buddha."
      has_offering: "A small offering rests in the bronze bowl."

    interact:
      verb: "offer"
      accepts:
        - item: incense
          effects:
            - type: message
              text: "Fragrant smoke rises toward the heavens."
            - type: karma
              delta: 3
            - type: flag
              flag: offered_incense_temple
        - item: rice
          effects:
            - type: message
              text: "The rice symbolizes abundance freely given."
            - type: karma
              delta: 2
        - item: flowers
          effects:
            - type: message
              text: "Beauty offered to beauty. The Buddha seems to smile."
            - type: karma
              delta: 2

  meditation_cushion:
    name: "Meditation Cushion"
    type: skill
    keywords: ["cushion", "zafu", "meditation spot"]

    examine:
      default: "A well-worn cushion invites stillness."

    interact:
      verb: "meditate"
      skill_required:
        skill: meditation
        level: 1
      duration: 60  # Seconds of meditation
      effects:
        - type: script
          script: meditation_session
        - type: resource_regen
          resource: mv
          amount: 50%
      first_time_bonus:
        - type: insight
          amount: 1
          flag: meditated_temple  # Prevents repeat
```

### Backend Implementation

**Create InteractiveObjects module** (`lib/loka/framework/world/interactive_objects.ex`):

```elixir
defmodule Loka.Framework.World.InteractiveObjects do
  @moduledoc """
  Handles player interactions with world objects.

  Commands:
  - examine <object> - View description (insight-scaled)
  - <verb> <object> - Interact (light lamp, spin wheel, etc.)
  - offer <item> to <object> - Offering interaction
  - meditate on <object> - Skill-gated meditation
  """

  alias Loka.Framework.Conditions.Evaluator
  alias Loka.Framework.Progression.SpiritualStats

  @doc "Get examine text scaled by player insight."
  def examine(object_def, game_state) do
    insight = SpiritualStats.get_insight(game_state)

    examine_texts = object_def["examine"]

    # Find highest applicable insight tier
    applicable = examine_texts
      |> Enum.filter(fn
        {"insight_" <> n, _} -> insight >= String.to_integer(n)
        {"default", _} -> true
        _ -> Evaluator.evaluate_show_if(elem(&1, 0), game_state)
      end)
      |> Enum.sort_by(fn
        {"insight_" <> n, _} -> -String.to_integer(n)
        {"default", _} -> -999
        _ -> 0
      end)
      |> List.first()

    case applicable do
      {_, text} -> text
      nil -> examine_texts["default"] || "You see nothing special."
    end
  end

  @doc "Execute interaction, applying all effects."
  def interact(object_def, verb, game_state, context \\ %{}) do
    interaction = object_def["interact"]

    cond do
      interaction["verb"] != verb ->
        {:error, "You can't #{verb} that."}

      not check_cost(interaction["cost"], game_state) ->
        {:error, cost_error_message(interaction["cost"])}

      on_cooldown?(object_def, game_state) ->
        {:error, "You've done that recently."}

      not check_skill(interaction["skill_required"], game_state) ->
        {:error, skill_error_message(interaction["skill_required"])}

      true ->
        execute_interaction(interaction, game_state, context)
    end
  end

  defp execute_interaction(interaction, game_state, context) do
    effects = interaction["effects"] || []

    {final_state, messages} =
      Enum.reduce(effects, {game_state, []}, fn effect, {state, msgs} ->
        {new_state, msg} = apply_effect(effect, state, context)
        {new_state, [msg | msgs]}
      end)

    # Check for first-time bonus
    {final_state, messages} =
      if first_time?(interaction, game_state) do
        apply_first_time_bonus(interaction, final_state, messages)
      else
        {final_state, messages}
      end

    {:ok, final_state, Enum.reverse(messages) |> Enum.reject(&is_nil/1)}
  end

  # Effect handlers
  defp apply_effect(%{"type" => "message", "text" => text}, state, _) do
    {state, text}
  end

  defp apply_effect(%{"type" => "stat", "stat" => stat, "delta" => delta}, state, _) do
    case stat do
      "karma" ->
        {:ok, new_state, msg} = SpiritualStats.adjust_karma(state, delta)
        {new_state, msg}
      "insight" ->
        {:ok, new_state, msg} = SpiritualStats.add_insight(state, delta)
        {new_state, msg}
      _ ->
        {put_stat(state, stat, get_stat(state, stat) + delta), nil}
    end
  end

  defp apply_effect(%{"type" => "status", "status" => status, "duration" => dur}, state, _) do
    # Apply status effect
    {StatusEffects.apply(state, status, dur), nil}
  end

  defp apply_effect(%{"type" => "script", "script" => script_key}, state, context) do
    # Execute named script
    {:ok, new_state, output} = ScriptRunner.run(script_key, state, context)
    {new_state, output}
  end

  defp apply_effect(%{"type" => "flag", "flag" => flag}, state, _) do
    {put_flag(state, flag, true), nil}
  end

  # ... more effect handlers
end
```

---

## Part 4: Meditation System

### Core Mechanic

Meditation is the **primary spiritual progression mechanic**. It teaches patience (real-time waiting) and rewards mindfulness.

### Meditation Locations

Each location grants different bonuses:

```yaml
# In room prototype
meditation:
  enabled: true
  quality: sacred  # mundane, peaceful, sacred, profound

  first_time:
    insight: 1
    message: "This is your first meditation here. Insight +1"
    flag: meditated_<room_key>

  effects:
    - restore_mv: 50%
    - clear_status: [confused, angry]

  visions:
    - weight: 10
      show_if: {quest_active: main_sleeping_master}
      text: "In the stillness, you glimpse Tenzin's face behind closed eyes."
    - weight: 5
      show_if: {insight_gte: 5}
      text: "The boundary between self and world grows thin."
    - weight: 3
      text: "Thoughts arise and pass like clouds."

  duration:
    min: 30   # Minimum seconds
    max: 300  # Maximum benefit at 5 minutes

  scaling:
    30: {mv_restore: 25%, vision_chance: 0}
    60: {mv_restore: 50%, vision_chance: 0.1}
    120: {mv_restore: 75%, vision_chance: 0.2}
    300: {mv_restore: 100%, vision_chance: 0.3}
```

### Meditation Quality Tiers

| Quality | Base MV Regen | Vision Chance | Examples |
|---------|---------------|---------------|----------|
| Mundane | 25% | 5% | Village square, market |
| Peaceful | 50% | 15% | Guest hall, herb garden |
| Sacred | 75% | 25% | Temple, meditation hall |
| Profound | 100% | 40% | Heart cave, mountain peak |

### Implementation

**Create Meditation module** (`lib/loka/framework/actions/meditation.ex`):

```elixir
defmodule Loka.Framework.Actions.Meditation do
  @moduledoc """
  Handles the meditate command and meditation sessions.

  Flow:
  1. Player types 'meditate'
  2. Check room has meditation enabled
  3. Check player has meditation skill
  4. Start meditation session (player enters meditation state)
  5. After duration, apply effects and check for vision
  6. Check for first-time insight bonus
  """

  @min_duration 30
  @qualities %{
    mundane: %{mv_mult: 0.25, vision_mult: 0.5},
    peaceful: %{mv_mult: 0.50, vision_mult: 1.0},
    sacred: %{mv_mult: 0.75, vision_mult: 1.5},
    profound: %{mv_mult: 1.00, vision_mult: 2.0}
  }

  def start_meditation(game_state, room) do
    meditation_config = get_meditation_config(room)

    cond do
      meditation_config == nil ->
        {:error, "This is not a place for meditation."}

      not has_meditation_skill?(game_state) ->
        {:error, "You don't know how to meditate. Find a teacher."}

      in_combat?(game_state) ->
        {:error, "You cannot meditate while in danger."}

      true ->
        session = %{
          started_at: DateTime.utc_now(),
          room_key: room.key,
          config: meditation_config
        }

        {:ok, put_meditation_session(game_state, session),
         "You settle into stillness, breath slowing..."}
    end
  end

  def end_meditation(game_state) do
    session = get_meditation_session(game_state)

    if session == nil do
      {:error, "You are not meditating."}
    else
      duration = seconds_since(session.started_at)
      results = calculate_results(session, duration, game_state)

      game_state = game_state
        |> clear_meditation_session()
        |> apply_meditation_results(results)

      {:ok, game_state, format_results(results)}
    end
  end

  defp calculate_results(session, duration, game_state) do
    config = session.config
    quality = @qualities[config.quality] || @qualities.peaceful

    effective_duration = min(duration, config.duration.max || 300)
    duration_mult = effective_duration / 300  # 0.0 to 1.0

    %{
      duration: effective_duration,
      mv_restored: round(100 * quality.mv_mult * duration_mult),
      vision: roll_vision(config, quality.vision_mult, duration_mult),
      first_time_bonus: check_first_time(config, game_state)
    }
  end

  defp roll_vision(config, quality_mult, duration_mult) do
    base_chance = 0.1 + (duration_mult * 0.2)  # 10% to 30%
    roll_chance = base_chance * quality_mult

    if :rand.uniform() < roll_chance do
      select_vision(config.visions)
    else
      nil
    end
  end
end
```

---

## Part 5: Mantra System

### Design Philosophy

Mantras are **learnable verbal abilities** that affect the world. They're the game's "spell" equivalent but themed as spiritual practice.

### Mantra Categories

1. **Protective** - Shield from harm, dispel illusions
2. **Compassion** - Calm hostiles, heal allies
3. **Insight** - Reveal hidden, understand deeper
4. **Purification** - Clear negative status, cleanse areas

### YAML Schema

```yaml
# priv/world/mantras/om_mani_padme_hum.yml
key: om_mani_padme_hum
name: "Om Mani Padme Hum"
category: compassion
description: "The mantra of Avalokiteshvara, embodying universal compassion."

learn_requirements:
  - type: quest_completed
    quest: intro_find_temple
  - type: item_has
    item: prayer_beads

learn_sources:
  - type: npc
    npc: teacher_lobsang
    dialogue_topic: learn_mantra_om_mani
  - type: object
    room: temple
    object: prayer_wheel
    first_interaction: true

cost:
  mv: 20

cooldown: 60

effects:
  - type: self_buff
    status: compassion_aura
    duration: 120

  - type: room_effect
    affect: hostile_npcs
    effect: calm
    duration: 30
    message_to_player: "Your chanting soothes the hostility around you."
    message_to_room: "{player} chants softly, and a sense of peace fills the air."

special_uses:
  - location: chamber_of_aversion
    effect: stop_enemy_multiplication
    message: "The enemies freeze, confused by your compassion."

  - location: restless_spirits
    effect: peaceful_resolution
    message: "The spirits bow in gratitude and fade to peace."

mastery:
  uses_to_master: 50
  mastered_bonus:
    cooldown_reduction: 50%
    mv_cost_reduction: 25%
```

### Learning Flow

```
1. Player discovers mantra exists (NPC mentions, book describes)
2. Player meets requirements (quest, item, skill level)
3. Player performs learning action:
   - Talk to teacher NPC with specific topic
   - Find and read sutra scroll
   - Interact with sacred object
4. Mantra added to known_mantras in game_state
5. Player can now use 'recite <mantra>' command
```

### Backend Structure

```elixir
# In game_state.skills, add mantras section
%{
  skills: %{
    "swordsmanship" => %{level: 5, xp: 230},
    "meditation" => %{level: 3, xp: 150}
  },
  mantras: %{
    "om_mani_padme_hum" => %{
      learned_at: ~U[2024-01-15 10:30:00Z],
      uses: 23,
      mastered: false
    }
  }
}
```

---

## Part 6: Trial Chamber Mechanics

### Core Concept

Each trial chamber embodies a **poison** (klesha) and teaches its antidote through gameplay mechanics, not just flavor text.

### Chamber of Attachment (Raga)

**Poison**: Craving, grasping, desire
**Antidote**: Non-attachment, contentment
**Mechanic**: Temptation resistance

```yaml
key: attachment_chamber
type: room

room_mechanic:
  type: temptation

  # Phantom treasures appear periodically
  temptations:
    interval: 30  # seconds
    duration: 20  # how long they stay
    types:
      - key: golden_chalice
        description: "A chalice of purest gold materializes, gleaming."
        examine: "It feels real. Solid. Yours for the taking."
        take_result:
          message: "The gold crumbles to ash in your hands."
          effect: {progress_reset: true}
          karma: -1

      - key: silk_robes
        description: "Robes of imperial silk appear, soft as clouds."
        take_result:
          message: "The silk unravels into nothing."
          effect: {progress_reset: true}

      - key: lovers_embrace
        description: "A figure from your past reaches out to you."
        take_result:
          message: "The figure dissolves. You grasp only air."
          effect: {progress_reset: true}
          karma: -1

  # Victory conditions
  victory:
    resist_count: 3  # Ignore 3 temptations to pass
    alternative:
      mantra: om_mani_padme_hum
      message: "You recite the mantra. The illusions fade."

  on_victory:
    - type: message
      text: "The treasures vanish. You have seen through attachment."
    - type: insight
      amount: 1
    - type: advance_quest
      quest: main_three_trials
      objective: defeat_attachment
    - type: spawn
      npc: raga_mara_defeated
      dialogue: post_trial_attachment

  hints:
    resist_1: "The gold feels hollow in your hands."
    resist_2: "Each treasure taken weighs heavier than the last."
    fail_3: "Perhaps there's another way. What dispels illusions?"
```

### Chamber of Aversion (Dvesha)

**Poison**: Hatred, anger, rejection
**Antidote**: Patience, loving-kindness
**Mechanic**: Escalation avoidance

```yaml
key: aversion_chamber
type: room

room_mechanic:
  type: escalation

  combat_modifier:
    # Aggressive attacks cause enemy multiplication
    on_player_attack:
      - type: multiply_enemies
        multiplier: 1.5
        message: "Your anger feeds them. More shadows coalesce."

    # Receiving damage increases rage counter
    on_player_damaged:
      - type: increment_counter
        counter: rage
        message_at:
          3: "Anger rises within you."
          5: "Your vision reddens with fury."
          7: "RAGE threatens to consume you."
          10:
            message: "You are lost to rage."
            effect: {instant_death: true}

  victory:
    # Stay calm (no attack) for 60 seconds
    calm_duration: 60
    message: "Your patience dissolves the shadows."
    alternative:
      mantra: may_all_beings_be_free
      message: "Your compassion transforms hatred to peace."

  on_victory:
    - type: message
      text: "The shadows bow and fade. You have conquered aversion."
    - type: insight
      amount: 1
    - type: karma
      delta: 3
    - type: advance_quest
      quest: main_three_trials
      objective: defeat_aversion

  hints:
    rage_3: "Fighting only makes them stronger."
    rage_5: "What is the opposite of hatred?"
    player_attacked_3_times: "Violence begets violence here."
```

### Chamber of Ignorance (Moha)

**Poison**: Delusion, confusion, not seeing clearly
**Antidote**: Wisdom, clear seeing
**Mechanic**: Maze with meditation solution

```yaml
key: ignorance_chamber
type: room

room_mechanic:
  type: maze

  confusion:
    # Exits randomize after each move
    exit_shuffle: true
    exit_shuffle_message: "The passage twists. You're not sure which way you came."

    # False memories appear as hints
    false_hints:
      - "You remember: the exit was north."
      - "A voice whispers: 'Go back the way you came.'"
      - "You're certain you've been here before. Or have you?"

    # Player gets more lost over time
    confusion_buildup:
      moves_to_max: 10
      effects_at:
        3: {perception: -10}
        5: {perception: -20, message: "The darkness presses in."}
        7: {perception: -30, message: "Which way is up?"}
        10: {teleport: maze_entrance, message: "You emerge where you started."}

  victory:
    # Meditation reveals the true path
    meditation:
      duration: 30
      message: "In stillness, you see: the maze exists only in your confusion."
      effect: {reveal_true_exit: true}
    alternative:
      item: lamp_of_wisdom
      message: "The lamp illuminates the one true path."

  on_victory:
    - type: message
      text: "The walls fade. There was never a maze—only your delusion."
    - type: insight
      amount: 1
    - type: advance_quest
      quest: main_three_trials
      objective: defeat_ignorance
    - type: flag
      flag: saw_through_ignorance

  hints:
    moves_3: "Movement doesn't seem to help."
    moves_5: "What would reveal what the eyes cannot see?"
    moves_7: "The maze is not in the cave. The maze is in the mind."
```

---

## Part 7: Consequence System

### Design Philosophy

Early choices create **echoes** that manifest in later gameplay. This creates a sense of a living world that remembers.

### Consequence Categories

1. **Immediate** - Direct result of action
2. **Echo** - Referenced later in dialogue
3. **Mechanical** - Affects stats/combat
4. **Narrative** - Changes story beats

### Implementation Schema

```yaml
# priv/world/consequences/quest_choices.yml
consequences:
  restless_spirits:
    compassion_path:
      trigger:
        quest: side_restless_spirits
        outcome: peaceful

      immediate:
        - message: "The ghosts bow in gratitude and fade to peace."
        - karma: +5
        - insight: +1
        - flag: spirits_freed_peacefully

      echoes:
        # NPC dialogue changes
        - type: npc_dialogue
          npc: abbot_jampa
          adds_topic: spirits_peace
          text: "I heard what you did for the restless dead. Compassion is true strength."

        # Room description changes
        - type: room_modifier
          room: cemetery
          add_description: "A sense of peace pervades the cemetery now."
          remove_ambient: ["Ghostly wails echo through the tombstones."]

        # Final boss modifier
        - type: combat_modifier
          target: mara_the_deceiver
          when: final_confrontation
          effect:
            mara_weakness: +5%
            trigger_dialogue: "You remember the peaceful faces of the freed spirits. Mara's form wavers."

    violence_path:
      trigger:
        quest: side_restless_spirits
        outcome: combat

      immediate:
        - message: "The ghosts shriek and disperse, but anger lingers in the air."
        - karma: -3
        - flag: spirits_destroyed

      echoes:
        - type: npc_dialogue
          npc: abbot_jampa
          adds_topic: spirits_violence
          text: "I sense... disturbance from the cemetery. Some wounds leave scars."

        - type: room_modifier
          room: cemetery
          add_description: "An unsettled feeling lingers here."
          add_ambient: ["Cold spots mark where spirits fell."]

        - type: combat_modifier
          target: mara_the_deceiver
          when: final_confrontation
          effect:
            mara_strength: +5%
            trigger_dialogue: "Ghostly faces flash in Mara's eyes—spirits you destroyed. He grins."

  butchers_burden:
    compassion_path:
      trigger:
        quest: side_butchers_burden
        outcome: forgiveness

      echoes:
        - type: npc_state_change
          npc: butcher_sonam
          new_state: redeemed
          new_occupation: "Temple Helper"
          new_location: temple

        - type: add_ambient
          room: temple
          message: "Sonam sweeps the temple steps, face serene."

        - type: unlock_dialogue
          npc: butcher_sonam
          topic: post_redemption
          text: "Every day I wake grateful. You showed me another path."
```

### Consequence Tracker Module

```elixir
defmodule Loka.Framework.Consequences.Tracker do
  @moduledoc """
  Tracks and triggers consequences based on player choices.

  Consequences are registered when:
  - Quest completes with specific outcome
  - Dialogue choice with 'consequence' tag
  - Combat ends with specific result

  Echoes trigger when:
  - Player enters relevant room
  - Player talks to relevant NPC
  - Combat begins with relevant enemy
  """

  def register_consequence(game_state, consequence_key, outcome) do
    consequences = game_state.flags["consequences"] || %{}
    new_consequences = Map.put(consequences, consequence_key, outcome)
    put_flag(game_state, "consequences", new_consequences)
  end

  def check_echoes(game_state, context) do
    consequences = game_state.flags["consequences"] || %{}

    # Find applicable echoes for current context
    applicable = load_consequence_definitions()
      |> Enum.flat_map(fn {_key, def} ->
        get_applicable_echoes(def, consequences, context)
      end)

    apply_echoes(game_state, applicable)
  end

  defp get_applicable_echoes(definition, player_consequences, context) do
    # Match player's recorded outcomes against echo triggers
    # Return list of echoes to apply
  end
end
```

---

## Part 8: Dynamic World State

### World State Tiers

The monastery has different "moods" based on story progress:

```yaml
# priv/world/states/monastery_states.yml
world_states:
  crisis:
    description: "Tenzin is trapped. The monastery is anxious."
    active_when:
      quest_not_completed: main_sleeping_master

    room_modifiers:
      monastery_gate:
        add_description: "The usual calm is absent. Monks hurry past with worried faces."
      meditation_hall:
        add_description: "Empty cushions. No one can focus on practice."
        remove_ambient: ["Soft breathing of meditating monks."]

    npc_modifiers:
      novice_pema:
        location: tenzins_cell
        state: vigil
        ambient_actions:
          - "Pema wipes tears from her eyes."
          - "The novice stares at Tenzin's unmoving form."
      abbot_jampa:
        demeanor: worried
        add_topics: [crisis_discussion, help_needed]

    ambient_global:
      - "An unusual silence hangs over the monastery."
      - "Prayer flags snap urgently in the wind."

  hope:
    description: "Trials completed. Liberation possible."
    active_when:
      all:
        - quest_completed: main_three_trials
        - quest_not_completed: main_liberation

    room_modifiers:
      monastery_gate:
        add_description: "Cautious optimism shows on passing faces."
      meditation_hall:
        add_description: "A few monks have returned to practice."

    npc_modifiers:
      novice_pema:
        state: hopeful
        ambient_actions:
          - "Pema stands straighter now, determination in her eyes."
      abbot_jampa:
        demeanor: hopeful
        add_topics: [final_preparation]

    ambient_global:
      - "The prayer flags flutter with renewed energy."
      - "Butter lamps burn brighter than before."

  liberation:
    description: "Tenzin freed. The monastery rejoices."
    active_when:
      quest_completed: main_liberation

    room_modifiers:
      meditation_hall:
        replace_description: "Lama Tenzin sits teaching a circle of attentive monks."
        add_ambient:
          - "Tenzin's voice carries wisdom hard-earned."
      monastery_gate:
        add_description: "Celebration banners flutter alongside prayer flags."

    npc_modifiers:
      lama_tenzin:
        location: meditation_hall
        state: teaching
        add_topics: [gratitude, wisdom_sharing, player_future]
      novice_pema:
        location: meditation_hall
        state: student
        ambient_actions:
          - "Pema sits at Tenzin's feet, eyes bright with attention."

    ambient_global:
      - "Joyful chanting echoes through the courtyard."
      - "The mountain itself seems to breathe easier."
```

---

## Part 9: NPC Micro-Reactions

### Design

NPCs notice and comment on player state, creating a sense of being seen.

```yaml
# In NPC prototype
npc_reactions:
  # React to player stats
  stat_reactions:
    - condition: {insight_gte: 7}
      priority: 10
      text: "The Abbot studies your face intently. 'Your eyes hold depths they did not before.'"
      once_per_session: true

    - condition: {karma_tier: virtuous}
      priority: 8
      text: "He bows slightly. 'Your virtue precedes you.'"

    - condition: {karma_tier: troubled}
      priority: 8
      text: "His eyes hold concern. 'Something weighs on your spirit, child.'"

  # React to player status effects
  status_reactions:
    - status: blessed
      text: "He nods approvingly. 'I see you've visited the temple.'"

    - status: poisoned
      text: "His brow furrows. 'You are unwell. Seek the healer.'"

  # React to player items
  item_reactions:
    - item: meditation_journal
      text: "His gaze falls to the journal. 'You've found it. Handle it with care.'"
      once_per_item: true

    - item: mara_crown
      text: "He recoils. 'What dark trophy is this?!'"

  # React to completed quests
  quest_reactions:
    - quest_completed: side_butchers_burden
      text: "'Sonam speaks of your kindness. You helped him find peace.'"

    - quest_completed: side_restless_spirits
      flag: spirits_freed_peacefully
      text: "'The cemetery is quiet now, thanks to you.'"

  # React to flags
  flag_reactions:
    - flag: saw_true_nature_of_mara
      text: "'You've glimpsed the demon's truth. That knowledge will serve you.'"
```

### Implementation

```elixir
defmodule Loka.Framework.NPC.Reactions do
  @moduledoc """
  Handles dynamic NPC reactions to player state.

  Called when:
  - Player enters room with NPC
  - Player initiates conversation
  - Periodically during idle
  """

  def get_reaction(npc_def, game_state) do
    reactions = npc_def["npc_reactions"] || %{}

    # Gather all applicable reactions with priorities
    applicable = []
      |> add_stat_reactions(reactions["stat_reactions"], game_state)
      |> add_status_reactions(reactions["status_reactions"], game_state)
      |> add_item_reactions(reactions["item_reactions"], game_state)
      |> add_quest_reactions(reactions["quest_reactions"], game_state)
      |> add_flag_reactions(reactions["flag_reactions"], game_state)
      |> filter_already_shown(game_state)
      |> Enum.sort_by(& &1.priority, :desc)

    case applicable do
      [reaction | _] ->
        mark_shown(game_state, reaction)
        {:ok, reaction.text}
      [] ->
        {:none, nil}
    end
  end
end
```

---

## Part 10: Scripting Infrastructure for Builders

### Design Goals

1. **YAML-first**: Most customization through YAML, no code required
2. **Progressive complexity**: Simple effects in YAML, complex logic in Elixir scripts
3. **Safe**: Sandboxed execution, no system access
4. **Extensible**: New effect types can be added by developers

### Effect Types (YAML)

These are the building blocks builders use:

```yaml
effects:
  # Player State
  - type: message
    text: "You feel a presence."

  - type: stat
    stat: karma | insight | str | dex | etc
    delta: +5 | -3

  - type: flag
    flag: some_flag
    value: true | false | "string" | 123

  - type: resource
    resource: health | mana | mv
    delta: +50 | -20 | 50%

  # Status Effects
  - type: status
    status: blessed | poisoned | etc
    duration: 60

  - type: clear_status
    status: confused | angry

  # Quest/Story
  - type: advance_quest
    quest: quest_id
    objective: objective_id

  - type: complete_quest
    quest: quest_id

  - type: accept_quest
    quest: quest_id

  # Items
  - type: give_item
    item: item_key
    count: 1

  - type: take_item
    item: item_key
    count: 1

  # World
  - type: spawn
    entity_type: npc | item
    entity_key: entity_id
    location: room_key | here

  - type: despawn
    entity: entity_id | target

  - type: teleport
    destination: room_key
    message: "The world blurs..."

  # Dialogue
  - type: start_dialogue
    npc: npc_key
    topic: topic_id

  # Scripts (for complex logic)
  - type: script
    script: script_key
    args:
      custom_arg: value
```

### Condition Types (YAML)

```yaml
show_if:
  # Quest conditions
  quest_active: quest_id
  quest_completed: quest_id
  quest_not_active: quest_id
  quest_not_completed: quest_id

  # Stat conditions
  level_gte: 5
  insight_gte: 3
  karma_gte: 20
  stat_gte: {stat: wis, value: 12}

  # Flag conditions
  flag: flag_name
  not_flag: flag_name

  # Item conditions
  has_item: item_key
  not_has_item: item_key

  # Karma tier
  karma_tier: virtuous | good | neutral | troubled | dark

  # Faction
  faction_gte: {faction: monastery, value: 50}

  # Paramita
  paramita_gte: {virtue: patience, level: 2}

  # Combined (AND)
  all:
    - quest_completed: intro_welcome
    - insight_gte: 3

  # Combined (OR)
  any:
    - flag: took_violence_path
    - karma_tier: dark
```

### Script Hooks

For complex logic that can't be expressed in YAML:

```yaml
# Room with script hooks
key: heart_cave
type: room

hooks:
  on_enter:
    - script: heart_cave_entry

  on_exit:
    - script: heart_cave_exit

  on_combat_start:
    - script: mara_battle_begin

  on_combat_end:
    - script: mara_defeated
      condition: {enemy_defeated: mara_the_deceiver}
```

```elixir
# priv/world/scripts/heart_cave_entry.exs
# Called when player enters heart cave

# Check if player has completed all trials
if context.player.quests.completed?("main_three_trials") do
  # Trigger cutscene
  cutscene("mara_revelation")
else
  # Not ready yet
  message("A force pushes you back. You are not ready to enter.")
  teleport(context.player, "threshold")
end
```

### Creating New Effect Types (Developer)

```elixir
# To add a new effect type, implement in EffectExecutor
defmodule Loka.Framework.Effects.Executor do
  # ... existing effects

  # New effect: create_light
  def execute(%{"type" => "create_light", "intensity" => intensity}, state, context) do
    room = context.room
    LightingSystem.add_light_source(room, intensity)

    {:ok, state, "Light blooms around you."}
  end

  # New effect: time_skip
  def execute(%{"type" => "time_skip", "hours" => hours}, state, context) do
    DayNightCycle.advance(hours)

    {:ok, state, "Time passes..."}
  end
end
```

---

## Part 11: Integration Checklist

### Backend Changes Required

1. **GameState** (`lib/loka/framework/player/game_state.ex`)
   - [ ] Add `mnd` (Mind) to `@default_stats`
   - [ ] Add `karma` to `@default_stats`
   - [ ] Update `calculate_max_resources` with mnd contribution to MV

2. **New Modules**
   - [ ] `Karma` - Karma tracking and tier calculation
   - [ ] `SpiritualProgress` - Derived insight calculation
   - [ ] `InteractiveObjects` - World object interactions
   - [ ] `Meditation` - Meditation action and MV restoration
   - [ ] `Consequences` - Choice tracking and echoes
   - [ ] `WorldState` - Dynamic world state management
   - [ ] `NPCReactions` - Micro-reaction system

3. **Condition Evaluator** (`lib/loka/framework/conditions/evaluator.ex`)
   - [ ] Add `karma_gte`, `karma_tier` conditions
   - [ ] Add `mnd_gte` (maps to stat_gte for mnd)
   - [ ] Add `skill_gte` for skill-based checks
   - [ ] Add `world_state` condition

4. **Skill Definitions** (`priv/world/skills/`)
   - [ ] Define `meditation` skill
   - [ ] Define mantra skills (om_mani_padme_hum, etc.)
   - [ ] Link mantras to teacher NPCs

5. **Commands**
   - [ ] `meditate` - Start/end meditation, restores MV
   - [ ] `recite <mantra>` - Use mantra skill, costs MV
   - [ ] `examine <object>` - Mnd-scaled descriptions
   - [ ] `<verb> <object>` - Object interactions

### Mobile App Changes

1. **Types** (`mobile/src/types/game.ts`)
   - [ ] Change from 6 stats to 4 (str, dex, sta, mnd)
   - [ ] Add karma to Stats interface

2. **StatsPanel** (`mobile/src/components/StatsPanel.tsx`)
   - [ ] Update to 4-stat grid layout
   - [ ] Rename MV bar to "Energy" (used for movement + spiritual)
   - [ ] Add Karma balance display with tier

3. **Backend Serializers**
   - [ ] Ensure mnd and karma are sent with stats_update

### Content Changes

1. **Rooms** - Add `interactive_objects` and `meditation` config
2. **NPCs** - Add `npc_reactions`
3. **Quests** - Add `consequences` to outcomes
4. **Skills** - Define spiritual skills as regular skills
5. **New Directories**:
   - [ ] `priv/world/skills/` (if not exists)
   - [ ] `priv/world/consequences/`
   - [ ] `priv/world/states/`

### Migration Notes

**From old insight/paramita concept:**
- `insight_gte: 5` → `skill_gte: {skill: meditation, level: 50}` OR derived check
- `paramita: patience` → `quest_completed: side_restless_spirits`
- Mantras → Regular skills learned from NPCs

**Simplified tracking:**
- Karma is the ONLY moral/spiritual tracking number
- Everything else derives from: skills, quests completed, flags, mnd stat

---

## Appendix A: Full Example Room

```yaml
key: temple
type: room
parent: base_room
name: "Main Temple"
subtype: sacred

description: |
  Butter lamps flicker before a towering golden Buddha,
  casting dancing shadows across painted murals of the
  Buddha's life. The air is thick with juniper incense.

  Prayer cushions line the floor before the altar.

senses:
  sound:
    ambient: "Distant chanting rises and falls like ocean waves."
    dawn: "A single bell rings, clear as mountain water."
  smell:
    ambient: "Juniper incense mingles with butter lamp smoke."
  touch:
    floor: "Cool flagstones worn smooth by centuries of devotion."

ambient_messages:
  dawn:
    - "Monks file in silently for morning prayers."
    - "The first light touches the Buddha's face."
  day:
    - "A monk adjusts the butter lamps, adding fresh offerings."
    - "Incense smoke curls toward the high ceiling."
  night:
    - "A single monk sits in meditation before the Buddha."
    - "Shadows dance in the lamp-light."

interactive_objects:
  butter_lamps:
    name: "Butter Lamps"
    keywords: ["lamps", "butter lamps", "offerings"]
    examine:
      default: "Rows of flickering butter lamps cast dancing shadows."
      insight_5: "Each flame represents a prayer, a wish for liberation."
    interact:
      verb: "light"
      cost: {item: butter}
      effects:
        - type: message
          text: "You add your light to the collective prayer."
        - type: karma
          delta: 1
        - type: status
          status: blessed
          duration: 60

  prayer_wheel:
    name: "Prayer Wheel"
    keywords: ["wheel", "prayer wheel"]
    examine:
      default: "A bronze cylinder inscribed with Om Mani Padme Hum."
    interact:
      verb: "spin"
      effects:
        - type: message
          text: "The mantra vibrates through your fingertips."
        - type: extend_status
          status: blessed
          duration: 30
      first_time:
        - type: learn_mantra
          mantra: om_mani_padme_hum
          show_if: {quest_completed: intro_find_temple}

  meditation_cushion:
    name: "Meditation Cushion"
    keywords: ["cushion", "zafu"]
    examine:
      default: "A well-worn cushion before the altar."
    interact:
      verb: "meditate"
      skill_required: {skill: meditation, level: 1}
      effects:
        - type: script
          script: temple_meditation

meditation:
  enabled: true
  quality: sacred
  first_time:
    insight: 1
    flag: meditated_temple
  visions:
    - weight: 10
      show_if: {quest_active: main_sleeping_master}
      text: "In stillness, you glimpse Tenzin behind closed eyes."
    - weight: 5
      text: "The Buddha seems to smile at you."

on_enter:
  - type: status
    status: blessed
    duration: 30
    message: "The temple's sacred atmosphere washes over you."

npc_reactions:
  # When player enters with certain states
  entry_reactions:
    - condition: {status: poisoned}
      message: "A monk rushes forward. 'You are unwell! Come, rest here.'"
    - condition: {karma_tier: virtuous}
      message: "Monks bow deeply as you enter."
```

---

## Appendix B: Character Sheet Mockup

```
┌─────────────────────────────────────────────┐
│           ✦ TENZIN WANGMO ✦                 │
│         Mountain Pilgrim • Level 7          │
├─────────────────────────────────────────────┤
│  VITALS                                     │
│  ♥ Health  ████████░░  145/180             │
│  ◆ Mana    ██████████  95/95               │
│  ⚡ Energy  ████████░░  135/170             │
├─────────────────────────────────────────────┤
│  ATTRIBUTES                                 │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐           │
│  │ STR │ │ DEX │ │ STA │ │ MND │           │
│  │  12 │ │  10 │ │  14 │ │  15 │           │
│  └─────┘ └─────┘ └─────┘ └─────┘           │
├─────────────────────────────────────────────┤
│  SPIRIT                                     │
│  ☯ Karma  ━━━━━━━━━━━◆━━━  +45             │
│           Dark      Neutral      Virtuous   │
│                          ▲                  │
│                        [Good]               │
├─────────────────────────────────────────────┤
│  SKILLS                                     │
│  ⚔ Swordsmanship    ████████░░  Lvl 8      │
│  ◎ Meditation       ██████░░░░  Lvl 6      │
│  ✦ Om Mani Mantra   ████░░░░░░  Lvl 4      │
├─────────────────────────────────────────────┤
│  ⊛ Gold: 340                                │
└─────────────────────────────────────────────┘
```

### Design Notes

**Simplified from 6 stats to 4:**
- STR, DEX, STA handle physical
- MND handles all mental/spiritual (replaces INT+WIS+CHA)

**Karma as visual balance:**
- Shown as a slider/balance beam
- Position indicates moral standing
- Tier label below (Dark → Neutral → Virtuous)

**Skills replace "paramitas" and "mantras":**
- Mantras are just skills you learn
- Spiritual progress shown through skill levels
- "Insight" is derived from mnd + meditation skill + quests completed

**MV renamed to "Energy":**
- Universal resource for all actions
- Movement, meditation, mantras all cost Energy
- Scales with STA + MND + DEX

---

## Appendix C: Data Flow Diagram

```
PLAYER ACTION
     │
     ▼
┌─────────────────┐
│ Command Parser  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Action Handler  │────▶│ Condition Check │
│ (meditate, etc) │     │   (Evaluator)   │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Effect Executor │
│  (apply_effect) │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────────┐
│ Stat  │ │ Consequence│
│Update │ │  Tracker   │
└───┬───┘ └─────┬─────┘
    │           │
    ▼           ▼
┌─────────────────────┐
│    GameState        │
│  (stats, flags,     │
│   resources, etc)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Channel Broadcast  │
│   (stats_update)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│    Mobile App       │
│   (re-render UI)    │
└─────────────────────┘
```

---

## Implementation Priority

### Phase 1: Foundation (Required for immersion)
1. Add `mnd` stat and `karma` to GameState defaults
2. Update MV formula to include mnd contribution
3. Implement Karma module (adjust, tier, conditions)
4. Update Condition Evaluator with karma_gte, karma_tier
5. Update mobile StatsPanel (4 stats, rename MV to Energy, karma display)

### Phase 2: Core Mechanics
6. Meditation system (command, MV restoration, vision rolls)
7. Interactive objects framework (examine, interact verbs)
8. Define meditation + mantra skills in YAML
9. Trial chamber unique mechanics (temptation, escalation, maze)

### Phase 3: Deep Immersion
10. Consequence/echo system (choice tracking)
11. Dynamic world states (monastery mood by quest progress)
12. NPC micro-reactions (notice player state)
13. Sensory layering in rooms (sound, smell, touch)

### Phase 4: Polish
14. Full content pass - update all rooms with interactive_objects
15. Full content pass - update all NPCs with npc_reactions
16. Balance tuning (karma deltas, MV costs, mnd scaling)
17. Mobile UI polish (animations, karma tier transitions)

---

## Summary

### What We're Building

A **densely immersive** text-based RPG where:
- Every room has objects to interact with, not just read about
- Meditation is a real gameplay verb with mechanical rewards
- Moral choices (karma) echo through the story
- NPCs notice and react to player state
- The world changes based on story progress
- Mantras are learnable skills with tactical uses
- Trial chambers each have unique puzzle mechanics

### What's Different from Typical MUDs

| Typical MUD | Loka Approach |
|-------------|---------------|
| 6 stats (str/dex/con/int/wis/cha) | 4 stats (str/dex/sta/mnd) - thematically focused |
| Alignment as label | Karma as active tracker affecting story |
| Static room descriptions | Mind-scaled examine, interactive objects |
| Combat-focused progression | Meditation, wisdom, compassion as progression |
| Linear quests | Choices create echoes in later content |

### The Builder Experience

Builders can create immersive content using **only YAML**:

```yaml
# A room with everything
key: meditation_grotto
type: room

description: "A natural cave..."

interactive_objects:
  crystal_pool:
    examine:
      default: "Still water reflects the ceiling."
      mnd_15: "You see your reflection... and something else."
    interact:
      verb: "gaze"
      effects:
        - type: karma
          delta: 1
          message: "Self-reflection brings clarity."

meditation:
  enabled: true
  quality: profound
  first_time_bonus: {flag: meditated_grotto}

npc_reactions:
  - condition: {karma_tier: virtuous}
    text: "The hermit smiles knowingly at you."

consequences:
  - trigger: {chose: peaceful_resolution}
    echo:
      location: final_boss
      text: "You remember choosing peace. Mara hesitates."
```

No code required. The framework handles:
- Condition evaluation
- Effect execution
- State persistence
- Channel broadcasts
- Mobile UI updates

### Extensibility for Developers

To add new effect types:

```elixir
# In EffectExecutor
def execute(%{"type" => "summon_companion", "npc" => npc_key}, state, _context) do
  companion = spawn_companion(npc_key)
  {:ok, add_companion(state, companion), "#{companion.name} joins you!"}
end
```

Then builders can use it in YAML immediately:
```yaml
effects:
  - type: summon_companion
    npc: novice_pema
```

This architecture serves as a **template** for any narrative-focused MUD, demonstrating how to layer mechanics, story, and player agency into a cohesive experience.
