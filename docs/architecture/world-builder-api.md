# World Builder API: LLM-Assisted Content Creation

## Overview

A sandboxed API layer that allows LLMs (or human builders) to create game content entirely through database operations - no code access required.

**Key Principle:** Everything a builder creates is stored in the database, validated before use, and can be approved/rejected by admins.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     LLM BUILDER INTERFACE                           │
│  Natural language → Structured API calls → Database storage         │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     WORLD BUILDER API                                │
│  Sandboxed, validated, rate-limited content creation                │
│                                                                      │
│  ├── Prototypes (NPCs, Items, Rooms)                                │
│  ├── Scripts (behavior logic)                                        │
│  ├── Quests (objectives, rewards)                                   │
│  ├── Dialogues (conversation trees)                                 │
│  └── World Layout (connections, zones)                              │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        DATABASE LAYER                                │
│  prototypes | scripts | quests | dialogues | world_layout           │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     RUNTIME ENGINE                                   │
│  Loads content from DB → Spawns entities → Runs scripts             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### 1. Prototypes Table

Replaces/supplements YAML files for builder-created content:

```elixir
schema "prototypes" do
  field :key, :string              # Unique identifier
  field :type, :string             # npc, item, room, container, etc.
  field :name, :string             # Display name (short_desc)
  field :description, :string      # Long description
  field :extra_desc, :string       # Examine text
  field :keywords, {:array, :string}
  field :components, :map          # Component data as JSON
  field :scripts, :map             # Hook -> script_key mapping
  field :parent_key, :string       # Prototype inheritance
  field :zone_id, :string          # Which zone this belongs to

  # Builder metadata
  field :status, :string           # draft, pending, approved, rejected
  field :created_by, :string
  field :approved_by, :string
  field :approved_at, :utc_datetime
  field :version, :integer, default: 1

  timestamps()
end
```

### 2. Quests Table

```elixir
schema "quests" do
  field :key, :string              # Quest identifier
  field :name, :string             # Display name
  field :description, :string      # Quest journal entry
  field :type, :string             # main, side, daily, repeatable
  field :level_range, :map         # %{min: 1, max: 10}
  field :prerequisites, {:array, :string}  # Quest keys required

  # Quest structure
  field :stages, {:array, :map}    # List of stage definitions
  field :objectives, {:array, :map}
  field :rewards, :map             # XP, items, currency, flags

  # NPCs and locations
  field :giver_key, :string        # NPC who gives quest
  field :location_keys, {:array, :string}  # Related rooms

  field :status, :string
  field :created_by, :string

  timestamps()
end
```

### 3. Dialogues Table

```elixir
schema "dialogues" do
  field :key, :string              # Dialogue identifier
  field :entity_key, :string       # Which NPC uses this
  field :trigger, :string          # on_talk, on_look, keyword:help

  field :nodes, {:array, :map}     # Conversation nodes
  field :conditions, :map          # Global conditions for dialogue

  field :status, :string
  field :created_by, :string

  timestamps()
end
```

### 4. World Layout Table

```elixir
schema "world_layout" do
  field :zone_key, :string         # Zone identifier
  field :zone_name, :string
  field :room_key, :string         # Room prototype key
  field :coordinates, :map         # %{x: 0, y: 0, z: 0} for mapping

  # Connections
  field :exits, {:array, :map}     # [{direction, target_room_key, door_state}]

  # Spawns in this room
  field :spawns, {:array, :map}    # [{prototype_key, count, respawn_time}]

  field :status, :string
  field :created_by, :string

  timestamps()
end
```

---

## World Builder API

### Module: `Loka.WorldBuilder`

The main API that LLMs interact with:

```elixir
defmodule Loka.WorldBuilder do
  @moduledoc """
  Sandboxed API for creating game content.

  All operations:
  - Validate input against schemas
  - Store in database (not files)
  - Return structured results
  - Support approval workflow
  """

  alias Loka.WorldBuilder.{Prototypes, Scripts, Quests, Dialogues, Layout}

  # ==========================================================================
  # PROTOTYPE CREATION
  # ==========================================================================

  @doc """
  Create an NPC prototype.

  ## Example

      WorldBuilder.create_npc(%{
        key: "elder_monk",
        name: "Elder Tenzin",
        description: "A wizened monk with kind eyes.",
        keywords: ["monk", "elder", "tenzin"],
        components: %{
          character: %{level: 10, health: 100},
          dialogue: %{default: "elder_monk_dialogue"}
        },
        scripts: %{
          on_say: "elder_monk_say",
          on_death: "elder_monk_death"
        },
        zone_id: "monastery"
      }, created_by: "builder_llm")
  """
  def create_npc(attrs, opts \\ []) do
    attrs
    |> Map.put(:type, "npc")
    |> Prototypes.create(opts)
  end

  @doc """
  Create an item prototype.
  """
  def create_item(attrs, opts \\ []) do
    attrs
    |> Map.put(:type, "item")
    |> Prototypes.create(opts)
  end

  @doc """
  Create a room prototype.
  """
  def create_room(attrs, opts \\ []) do
    attrs
    |> Map.put(:type, "room")
    |> Prototypes.create(opts)
  end

  # ==========================================================================
  # SCRIPT CREATION
  # ==========================================================================

  @doc """
  Create a script for entity behavior.

  ## Example

      WorldBuilder.create_script(%{
        key: "elder_monk_say",
        hook: "on_say",
        source: ~S'''
        keyword = downcase(context.message)

        cond do
          contains?(keyword, "help") ->
            say("I can offer guidance, young one.")
            :handled
          true ->
            :continue
        end
        '''
      }, created_by: "builder_llm")
  """
  def create_script(attrs, opts \\ []) do
    Scripts.create(attrs, opts)
  end

  # ==========================================================================
  # QUEST CREATION
  # ==========================================================================

  @doc """
  Create a quest with stages and objectives.

  ## Example

      WorldBuilder.create_quest(%{
        key: "monastery_mystery",
        name: "The Monastery Mystery",
        description: "Investigate the strange happenings at the monastery.",
        type: "main",
        level_range: %{min: 1, max: 5},
        giver_key: "elder_monk",
        stages: [
          %{
            id: "investigate",
            description: "Speak with the monks about the disturbances.",
            objectives: [
              %{id: "talk_to_pema", type: "talk", target: "novice_pema"},
              %{id: "talk_to_chen", type: "talk", target: "monk_chen"}
            ]
          },
          %{
            id: "explore_caves",
            description: "Explore the caves beneath the monastery.",
            objectives: [
              %{id: "find_entrance", type: "reach_room", target: "cave_entrance"},
              %{id: "defeat_shadow", type: "kill", target: "shadow_creature", count: 3}
            ]
          }
        ],
        rewards: %{
          xp: 500,
          items: ["monastery_robe"],
          currency: %{gold: 100},
          flags: ["monastery_hero"]
        }
      }, created_by: "builder_llm")
  """
  def create_quest(attrs, opts \\ []) do
    Quests.create(attrs, opts)
  end

  # ==========================================================================
  # DIALOGUE CREATION
  # ==========================================================================

  @doc """
  Create a dialogue tree for an NPC.

  ## Example

      WorldBuilder.create_dialogue(%{
        key: "elder_monk_dialogue",
        entity_key: "elder_monk",
        trigger: "on_talk",
        nodes: [
          %{
            id: "greeting",
            text: "Greetings, traveler. What brings you to our humble monastery?",
            choices: [
              %{text: "I seek wisdom.", next: "wisdom"},
              %{text: "I'm looking for work.", next: "work"},
              %{text: "Just passing through.", next: "farewell"}
            ]
          },
          %{
            id: "wisdom",
            text: "Wisdom comes to those who listen. The mountain speaks, if you have ears to hear.",
            conditions: %{has_flag: "meditation_complete"},
            choices: [
              %{text: "Teach me.", next: "teaching", action: "start_quest:meditation_path"}
            ]
          },
          %{
            id: "work",
            text: "We could use help with the disturbances in the caves...",
            conditions: %{not_quest_active: "monastery_mystery"},
            choices: [
              %{text: "Tell me more.", next: "quest_intro", action: "start_quest:monastery_mystery"}
            ]
          }
        ]
      }, created_by: "builder_llm")
  """
  def create_dialogue(attrs, opts \\ []) do
    Dialogues.create(attrs, opts)
  end

  # ==========================================================================
  # WORLD LAYOUT
  # ==========================================================================

  @doc """
  Connect rooms together.
  """
  def connect_rooms(room1_key, direction, room2_key, opts \\ []) do
    Layout.connect(room1_key, direction, room2_key, opts)
  end

  @doc """
  Place a spawn in a room.
  """
  def add_spawn(room_key, prototype_key, opts \\ []) do
    Layout.add_spawn(room_key, prototype_key, opts)
  end

  @doc """
  Create a zone with multiple rooms.
  """
  def create_zone(zone_attrs, rooms, opts \\ []) do
    Layout.create_zone(zone_attrs, rooms, opts)
  end

  # ==========================================================================
  # QUERIES (Read-only)
  # ==========================================================================

  def list_prototypes(filters \\ []), do: Prototypes.list(filters)
  def get_prototype(key), do: Prototypes.get(key)

  def list_scripts(filters \\ []), do: Scripts.list(filters)
  def get_script(key), do: Scripts.get(key)

  def list_quests(filters \\ []), do: Quests.list(filters)
  def get_quest(key), do: Quests.get(key)

  def list_dialogues(filters \\ []), do: Dialogues.list(filters)
  def get_dialogue(key), do: Dialogues.get(key)

  def list_zones, do: Layout.list_zones()
  def get_zone(key), do: Layout.get_zone(key)

  # ==========================================================================
  # VALIDATION
  # ==========================================================================

  @doc """
  Validate all references in a piece of content.
  Returns list of warnings/errors.
  """
  def validate_references(type, key) do
    # Check that all referenced entities exist
    # - Script references valid hooks
    # - Quest references valid NPCs, items, rooms
    # - Dialogue references valid quest keys
    # - Spawns reference valid prototype keys
  end

  @doc """
  Test a script in isolation.
  """
  def test_script(script_key, test_context \\ %{}) do
    Scripts.test(script_key, test_context)
  end
end
```

---

## LLM Integration Layer

### Natural Language → API Calls

```elixir
defmodule Loka.WorldBuilder.LLMInterface do
  @moduledoc """
  Interface for LLM-assisted building.

  Provides:
  1. Structured prompts for content creation
  2. Validation of LLM outputs
  3. Conversion to WorldBuilder API calls
  """

  @doc """
  Process a natural language building request.

  ## Example

      LLMInterface.build(\"\"\"
        Create a mysterious old wizard NPC named Gandalf who lives in
        the tower. He should have a quest about finding a lost ring.
        When players say "ring" he should react dramatically.
      \"\"\", created_by: "user_123")

  Returns:
      {:ok, %{
        prototypes: [%{key: "gandalf", ...}],
        scripts: [%{key: "gandalf_say", ...}],
        quests: [%{key: "lost_ring", ...}],
        dialogues: [%{key: "gandalf_dialogue", ...}]
      }}
  """
  def build(natural_language_request, opts \\ []) do
    # 1. Parse request into structured intent
    # 2. Generate content using LLM with structured output
    # 3. Validate all generated content
    # 4. Store via WorldBuilder API
    # 5. Return summary of created content
  end

  @doc """
  Available building commands for LLM context.
  """
  def available_commands do
    %{
      create_npc: %{
        description: "Create a new NPC",
        required: [:key, :name, :description],
        optional: [:keywords, :components, :scripts, :zone_id]
      },
      create_item: %{
        description: "Create a new item",
        required: [:key, :name, :description],
        optional: [:keywords, :components, :effects]
      },
      create_room: %{
        description: "Create a new room",
        required: [:key, :name, :description],
        optional: [:exits, :spawns, :scripts]
      },
      create_quest: %{
        description: "Create a quest with objectives",
        required: [:key, :name, :stages],
        optional: [:rewards, :prerequisites, :level_range]
      },
      create_script: %{
        description: "Create entity behavior script",
        required: [:key, :hook, :source],
        optional: [:description]
      },
      create_dialogue: %{
        description: "Create conversation tree",
        required: [:key, :entity_key, :nodes],
        optional: [:trigger, :conditions]
      },
      connect_rooms: %{
        description: "Connect two rooms with an exit",
        required: [:room1, :direction, :room2],
        optional: [:door_state, :bidirectional]
      }
    }
  end
end
```

### Structured Output Schema

For LLM to generate valid content:

```elixir
defmodule Loka.WorldBuilder.Schemas do
  @moduledoc """
  JSON Schemas for LLM structured output.
  """

  def npc_schema do
    %{
      type: "object",
      required: ["key", "name", "description"],
      properties: %{
        key: %{type: "string", pattern: "^[a-z_]+$"},
        name: %{type: "string", maxLength: 100},
        description: %{type: "string", maxLength: 1000},
        keywords: %{type: "array", items: %{type: "string"}},
        components: %{
          type: "object",
          properties: %{
            character: %{
              type: "object",
              properties: %{
                level: %{type: "integer", minimum: 1, maximum: 100},
                health: %{type: "integer", minimum: 1}
              }
            }
          }
        },
        scripts: %{
          type: "object",
          additionalProperties: %{type: "string"}
        }
      }
    }
  end

  def script_schema do
    %{
      type: "object",
      required: ["key", "hook", "source"],
      properties: %{
        key: %{type: "string", pattern: "^[a-z_]+$"},
        hook: %{type: "string", enum: ["on_look", "on_say", "on_enter", "on_attack", ...]},
        source: %{type: "string", maxLength: 10000}
      }
    }
  end

  # ... schemas for quest, dialogue, etc.
end
```

---

## Safety & Validation

### Rate Limits

```elixir
defmodule Loka.WorldBuilder.RateLimiter do
  @limits %{
    prototypes_per_hour: 50,
    scripts_per_hour: 100,
    quests_per_hour: 20,
    total_per_day: 500
  }

  def check_limit(builder_id, type) do
    # Track and enforce limits per builder
  end
end
```

### Validation Pipeline

```elixir
defmodule Loka.WorldBuilder.Validator do
  @doc """
  Validate content before saving.
  """
  def validate(type, attrs) do
    with :ok <- validate_schema(type, attrs),
         :ok <- validate_references(type, attrs),
         :ok <- validate_content_policy(type, attrs),
         :ok <- validate_balance(type, attrs) do
      :ok
    end
  end

  # Check all referenced entities exist
  defp validate_references(:quest, attrs) do
    errors = []

    # Check giver NPC exists
    if attrs[:giver_key] && !Prototypes.exists?(attrs[:giver_key]) do
      errors = ["NPC #{attrs[:giver_key]} does not exist" | errors]
    end

    # Check all objective targets exist
    for stage <- attrs[:stages] || [],
        objective <- stage[:objectives] || [] do
      case objective[:type] do
        "kill" -> validate_prototype_exists(objective[:target])
        "reach_room" -> validate_room_exists(objective[:target])
        "collect" -> validate_item_exists(objective[:target])
        _ -> :ok
      end
    end

    if errors == [], do: :ok, else: {:error, errors}
  end

  # Check for inappropriate content
  defp validate_content_policy(_type, attrs) do
    text = extract_all_text(attrs)
    # Basic content filtering
    # Could integrate with moderation API
    :ok
  end

  # Check game balance
  defp validate_balance(:item, attrs) do
    # Check stats are within bounds
    # Check value/power ratio
    :ok
  end
end
```

---

## Approval Workflow

```elixir
defmodule Loka.WorldBuilder.Approval do
  @moduledoc """
  Content approval workflow.

  Status flow:
  draft -> pending -> approved/rejected

  Draft: Only visible to creator
  Pending: Awaiting admin review
  Approved: Active in game
  Rejected: With feedback
  """

  def submit_for_approval(type, key, submitter) do
    # Move from draft to pending
    # Notify admins
  end

  def approve(type, key, admin, opts \\ []) do
    # Move to approved
    # Trigger content reload
  end

  def reject(type, key, admin, feedback) do
    # Move to rejected
    # Store feedback
    # Notify creator
  end

  def list_pending do
    # All content awaiting review
  end
end
```

---

## Runtime Integration

### Content Loading

```elixir
defmodule Loka.Engine.ContentLoader do
  @moduledoc """
  Loads content from both YAML files and database.
  Database content takes precedence (allows overrides).
  """

  def load_prototype(key) do
    # First check database
    case Repo.get_by(Prototype, key: key, status: "approved") do
      nil -> load_from_yaml(key)  # Fallback to YAML
      proto -> convert_to_entity(proto)
    end
  end

  def reload_content(type, key) do
    # Hot-reload content without restart
    # Notify relevant EntityServers
  end
end
```

### Content Sync

```elixir
defmodule Loka.WorldBuilder.Sync do
  @moduledoc """
  Sync database content to/from YAML for version control.
  """

  def export_to_yaml(type, key) do
    # Export DB content to YAML file
    # For backup/version control
  end

  def import_from_yaml(path) do
    # Import YAML to database
    # Preserves existing DB content
  end
end
```

---

## Example: LLM Building Session

```
User: Create a haunted library area with a ghost librarian who gives
      a quest to find three lost books scattered around the library.

LLM (via WorldBuilder API):

1. Create zone "haunted_library"

2. Create rooms:
   - haunted_library_entrance (Entry hall with cobwebs)
   - haunted_library_main (Main reading room)
   - haunted_library_archives (Dusty archives)
   - haunted_library_restricted (Restricted section)

3. Create NPC "ghost_librarian":
   - Description: "A translucent figure in spectacles..."
   - Scripts: on_look, on_say

4. Create items:
   - lost_tome_history
   - lost_tome_magic
   - lost_tome_prophecy

5. Create quest "lost_tomes":
   - Giver: ghost_librarian
   - Objectives: Collect all 3 tomes
   - Rewards: Spectral Bookmark (item), 500 XP

6. Create dialogue "ghost_librarian_dialogue":
   - Greeting with quest hook
   - Progress check
   - Completion dialogue

7. Create scripts:
   - ghost_librarian_say: Keyword responses
   - ghost_librarian_on_look: Quest-aware description

8. Connect rooms and place spawns

Result: 4 rooms, 1 NPC, 3 items, 1 quest, 1 dialogue, 3 scripts
Status: draft (awaiting approval)
```

---

## Implementation Priority

### Phase 1: Database Foundation
- [ ] Prototypes table and CRUD
- [ ] Scripts table enhancement
- [ ] Basic WorldBuilder API

### Phase 2: Full Content Types
- [ ] Quests table and API
- [ ] Dialogues table and API
- [ ] World layout table

### Phase 3: LLM Integration
- [ ] Structured output schemas
- [ ] Natural language parser
- [ ] LLMInterface module

### Phase 4: Approval & Admin
- [ ] Approval workflow
- [ ] Admin review UI
- [ ] Content diff/preview

### Phase 5: Runtime Integration
- [ ] Hot content reload
- [ ] YAML sync (import/export)
- [ ] Performance optimization
