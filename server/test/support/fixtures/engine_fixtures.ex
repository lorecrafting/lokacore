defmodule Loka.EngineFixtures do
  @moduledoc """
  Test helpers for creating entities.
  """

  alias Loka.Engine.Entities

  def unique_entity_key, do: "entity_#{System.unique_integer([:positive])}"

  def valid_entity_attrs(attrs \\ %{}) do
    Enum.into(attrs, %{
      type: "room",
      key: unique_entity_key(),
      short_desc: "Test Room",
      extra_desc: "A test room description"
    })
  end

  def entity_fixture(attrs \\ %{}) do
    {:ok, entity} =
      attrs
      |> valid_entity_attrs()
      |> Entities.create_entity()

    entity
  end

  def room_fixture(attrs \\ %{}) do
    entity_fixture(Map.merge(%{type: "room"}, attrs))
  end

  def npc_fixture(attrs \\ %{}) do
    entity_fixture(Map.merge(%{type: "npc", short_desc: "Test NPC"}, attrs))
  end

  def item_fixture(attrs \\ %{}) do
    entity_fixture(Map.merge(%{type: "item", short_desc: "Test Item"}, attrs))
  end

  # =============================================================================
  # Content Entity Fixtures (V2 — entities in DB instead of registries)
  # =============================================================================

  @doc """
  Creates a skill entity in the DB. Returns the EntitySchema.
  """
  def skill_fixture(attrs \\ %{}) do
    key = attrs[:key] || "skill_#{System.unique_integer([:positive])}"

    data =
      %{
        "category" => attrs[:category] || "general",
        "max_level" => attrs[:max_level] || 100,
        "xp_per_use" => attrs[:xp_per_use] || 1,
        "xp_per_level" => attrs[:xp_per_level] || 100,
        "point_cost_formula" => attrs[:point_cost_formula] || "level",
        "prerequisites" => attrs[:prerequisites] || [],
        "cost" => attrs[:cost],
        "stat" => attrs[:stat],
        "lag" => attrs[:lag],
        "cooldown" => attrs[:cooldown],
        "mv_cost" => attrs[:mv_cost],
        "mana_cost" => attrs[:mana_cost],
        "effect" => attrs[:effect],
        "trainers" => attrs[:trainers] || []
      }
      |> Enum.reject(fn {_k, v} -> is_nil(v) end)
      |> Map.new()

    {:ok, entity} =
      Entities.create_entity(%{
        type: "skill",
        key: key,
        short_desc: attrs[:name] || "Test Skill",
        is_prototype: true,
        components: %{"data" => data}
      })

    entity
  end

  @doc """
  Creates a quest entity in the DB. Returns the EntitySchema.

  ## Example
      quest = quest_fixture(%{
        key: "escape_quest",
        name: "Escape the Dungeon",
        objectives: [%{"id" => "reach_exit", "type" => "go_to", "target_id" => "dungeon_exit", "time_limit" => 300}],
        quest_type: "main"
      })
  """
  def quest_fixture(attrs \\ %{}) do
    key = attrs[:key] || "quest_#{System.unique_integer([:positive])}"

    data =
      %{
        "objectives" => attrs[:objectives] || [],
        "quest_type" => attrs[:quest_type],
        "giver" => attrs[:giver],
        "giver_key" => attrs[:giver_key],
        "turn_in_npc" => attrs[:turn_in_npc],
        "rewards" => attrs[:rewards] || %{},
        "description" => attrs[:description],
        "prerequisites" => attrs[:prerequisites] || [],
        "journal_entries" => attrs[:journal_entries] || %{}
      }
      |> Enum.reject(fn {_k, v} -> is_nil(v) end)
      |> Map.new()

    {:ok, entity} =
      Entities.create_entity(%{
        type: "quest",
        key: key,
        short_desc: attrs[:name] || "Test Quest",
        is_prototype: true,
        components: %{"data" => data}
      })

    entity
  end

  @doc """
  Creates a character entity in the DB (V2 player data).

  Returns the EntitySchema. Components mirror the old GameState fields:
  - `quest_progress`, `stats`, `inventory`, `equipment`, `flags`,
    `resources`, `skills`, `player` (settings).

  ## Example
      character = character_fixture(%{character_name: "TestChar", quests: %{}})
  """
  def character_fixture(attrs \\ %{}) do
    player = attrs[:player] || Loka.AccountsFixtures.player_fixture()

    schema =
      entity_fixture(%{
        type: "character",
        key: "player_test_#{System.unique_integer([:positive])}",
        short_desc: attrs[:character_name] || "TestChar",
        account_id: player.id,
        components: %{
          "quest_progress" => attrs[:quests] || %{},
          "stats" =>
            attrs[:stats] ||
              %{
                "str" => 10,
                "dex" => 10,
                "sta" => 10,
                "level" => 1,
                "xp" => 0,
                "skill_points" => 0
              },
          "inventory" => attrs[:inventory] || [],
          "equipment" => attrs[:equipment] || %{},
          "flags" => attrs[:flags] || %{},
          "resources" =>
            attrs[:resources] ||
              %{
                "health" => %{"current" => 100, "max" => 100},
                "mana" => %{"current" => 100, "max" => 100},
                "mv" => %{"current" => 150, "max" => 150}
              },
          "skills" => attrs[:skills] || %{},
          "player" => %{"settings" => attrs[:settings] || %{}}
        }
      })

    # Convert EntitySchema to Entity struct for framework functions
    Entities.to_entity(schema)
  end
end
