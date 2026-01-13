# Storyline System Architecture

The storyline system provides a formal way to string together quests into coherent narrative arcs with prerequisite enforcement.

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Storyline                                │
│  (priv/world/storylines/monastery_arc.yml)                      │
├─────────────────────────────────────────────────────────────────┤
│  key: monastery_arc                                             │
│  name: "The Monastery Arc"                                      │
│  starting_room: monastery_gate                                  │
│  acts:                                                          │
│    - id: act1, requires: [], quests: [quest1, quest2, quest3]   │
│    - id: act2, requires: [act1], quests: [quest4, quest5]       │
│    - id: act3, requires: [act2], quests: [quest6, quest7]       │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    StorylineRegistry                            │
│  (Loads YAML on app start, provides lookup APIs)                │
├─────────────────────────────────────────────────────────────────┤
│  get(storyline_id) → {:ok, storyline}                           │
│  all() → [storyline, ...]                                       │
│  prerequisites_for(quest_id) → [quest_id, ...]                  │
│  check_prerequisites(quest_id, completed) → :ok | {:error, ...} │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      QuestRegistry                              │
│  (Loads quests from priv/world/quests/*.yml)                    │
├─────────────────────────────────────────────────────────────────┤
│  get(quest_id) → {:ok, quest}                                   │
│  all() → [quest, ...]                                           │
│  by_type(type) → [quest, ...]                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
priv/world/
├── storylines/
│   ├── monastery_arc.yml      # Main storyline definition
│   └── side_stories.yml       # Optional side content
├── quests/
│   ├── main_sleeping_master.yml
│   ├── main_three_trials.yml
│   ├── side_herb_gathering.yml
│   └── ...
└── prototypes/
    ├── npcs/
    │   ├── novice_pema.yml    # Quest givers with dialogue_tree
    │   └── ...
    └── ...
```

## Storyline YAML Format

```yaml
# priv/world/storylines/monastery_arc.yml
key: monastery_arc
name: "The Monastery Arc"
description: |
  The main storyline taking place in and around
  the remote mountain monastery.

starting_room: monastery_gate
tags:
  - main
  - monastery

acts:
  - id: act1_arrival
    name: "Arrival at the Monastery"
    description: "The player arrives and learns about the situation"
    requires: []  # First act, no prerequisites
    quests:
      - main_sleeping_master
      - side_herb_gathering  # Optional side quest

  - id: act2_trials
    name: "The Three Trials"
    description: "The player must complete three trials"
    requires:
      - act1_arrival  # Must complete Act 1 first
    quests:
      - main_three_trials
      - main_trial_wisdom
      - main_trial_courage
      - main_trial_compassion

  - id: act3_resolution
    name: "The Resolution"
    description: "The final confrontation"
    requires:
      - act2_trials
    quests:
      - main_final_confrontation
```

## Quest YAML Format

```yaml
# priv/world/quests/main_sleeping_master.yml
id: main_sleeping_master
name: "The Sleeping Master"
description: |
  Investigate what happened to Lama Tenzin
  and why he won't wake from his meditation.

type: main  # main, side, daily, etc.
giver: abbot_jampa
level_requirement: 1

objectives:
  - id: talk_abbot
    type: talk
    target_id: abbot_jampa
    description: "Speak with Abbot Jampa"

  - id: find_prayer_beads
    type: get_item
    target_id: prayer_beads
    description: "Find the sacred prayer beads"

  - id: visit_meditation_cave
    type: go_to
    target_id: meditation_cave
    description: "Visit the meditation cave"

rewards:
  xp: 100
  items:
    - cave_entrance_key
  unlocks:
    - main_three_trials

journal_entries:
  started: "Abbot Jampa asked me to investigate..."
  find_prayer_beads: "I should look for the prayer beads..."
  complete: "I discovered the truth about Lama Tenzin."
```

## Objective Types

| Type | Description | target_id |
|------|-------------|-----------|
| `talk` | Talk to an NPC | NPC entity key |
| `kill` | Defeat enemies | Mob prototype key |
| `get_item` | Obtain an item | Item entity/prototype key |
| `go_to` | Visit a location | Room entity key |

For `kill` objectives, use `target_count` for multiples:

```yaml
- id: defeat_bandits
  type: kill
  target_id: bandit
  target_count: 5
  description: "Defeat 5 bandits"
```

## API Usage

### Getting Storylines

```elixir
alias Loka.Framework.Storyline.{Storyline, StorylineRegistry}

# Get a specific storyline
{:ok, storyline} = StorylineRegistry.get("monastery_arc")

# List all storylines
storylines = StorylineRegistry.all()

# Get storylines by tag
main_storylines = StorylineRegistry.by_tag("main")
```

### Checking Progress

```elixir
# Get all quests in order
quest_order = Storyline.quest_order(storyline)
# => ["main_sleeping_master", "side_herb_gathering", "main_three_trials", ...]

# Check if an act is available
completed_quests = ["main_sleeping_master", "side_herb_gathering"]
Storyline.act_available?(storyline, "act2_trials", completed_quests)
# => true

# Get current act
Storyline.current_act(storyline, completed_quests)
# => %Act{id: "act2_trials", ...}

# Calculate progress
Storyline.progress(storyline, completed_quests)
# => %{total: 7, completed: 2, percentage: 28.5}
```

### Quest Prerequisites

```elixir
alias Loka.Framework.Quest

# Quest acceptance enforces prerequisites
player = get_player()

# This will fail if prerequisites aren't met
case Quest.accept_quest(player, "main_three_trials") do
  {:ok, updated_player} ->
    # Quest accepted

  {:error, {:missing_prerequisites, ["main_sleeping_master"]}} ->
    # Must complete "The Sleeping Master" first
end
```

## Prerequisite Enforcement

The `Quest.accept_quest/2` function automatically checks prerequisites:

```elixir
# lib/loka/framework/quest/progress.ex
def accept_quest(player, quest_id) do
  completed = get_completed_quest_ids(player)

  case check_quest_prerequisites(quest_id, completed) do
    :ok ->
      # Add quest to player's active quests
      do_accept_quest(player, quest_id)

    {:error, {:missing_prerequisites, missing}} ->
      {:error, {:missing_prerequisites, missing}}
  end
end

defp check_quest_prerequisites(quest_id, completed_quests) do
  case StorylineRegistry.check_prerequisites(quest_id, completed_quests) do
    {:ok, :available} -> :ok
    {:error, reason} -> {:error, reason}
  end
end
```

## NPC Quest Givers

Quest givers use the `dialogue_tree` component to offer quests:

```yaml
# priv/world/prototypes/npcs/abbot_jampa.yml
key: abbot_jampa
parent: base_npc
name: "Abbot Jampa"
short_desc: "a serene elderly monk"
primary_keyword: "abbot"

components:
  dialogue_tree:
    default_node: greeting
    nodes:
      greeting:
        text: "Welcome, traveler. These are troubled times..."
        options:
          - text: "What troubles you?"
            next: explain_problem
          - text: "I should go."
            next: farewell

      explain_problem:
        text: "Our master, Lama Tenzin, will not wake..."
        options:
          - text: "I will help you."
            action:
              type: offer_quest
              quest_id: main_sleeping_master
            next: quest_accepted
          - text: "I cannot help now."
            next: farewell

      quest_accepted:
        text: "Thank you! Please hurry to the meditation cave."
        options:
          - text: "I'll investigate immediately."
            next: null  # Ends dialogue
```

## Validation

Validate storylines with the mix task:

```bash
# List all storylines
mix loka.test.storyline --list

# Validate structure
mix loka.test.storyline monastery_arc --verbose

# Run full playthrough with bot
mix loka.test.storyline monastery_arc --run
```

**Validation checks:**
- All referenced quests exist
- Quest objectives have valid targets
- Act prerequisites form a valid DAG (no cycles)
- Starting room prototype exists
- Quest giver NPCs have dialogue trees

## Integration with Quest Events

When quest objectives complete, events fire for storyline tracking:

```elixir
# Player talks to NPC
Event.emit(:quest_objective_progress, %{
  player_id: player.id,
  quest_id: "main_sleeping_master",
  objective_id: "talk_abbot",
  progress: 1,
  target_count: 1
})

# Quest completes
Event.emit(:quest_completed, %{
  player_id: player.id,
  quest_id: "main_sleeping_master"
})
```

Hooks can listen for these to update UI or trigger story beats:

```elixir
Hooks.register(:at_quest_complete, MyModule, :on_quest_complete)

def on_quest_complete(_hook, %{quest_id: quest_id, player_id: player_id}) do
  # Check if this unlocks new content
  case StorylineRegistry.storyline_for_quest(quest_id) do
    {:ok, storyline} ->
      check_act_transitions(storyline, player_id)
    _ ->
      :ok
  end
end
```

## Best Practices

1. **One quest per objective type** - Keep quests focused
2. **Clear quest chains** - Use prerequisites to guide players
3. **Side quests are optional** - Don't block main story on side content
4. **Test with bots** - Run `mix loka.test.storyline --run` regularly
5. **Journal entries** - Provide clear guidance at each step
6. **Level gates sparingly** - Use story prerequisites over level requirements
