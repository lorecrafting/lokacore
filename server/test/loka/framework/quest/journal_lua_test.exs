defmodule Loka.Framework.Quest.JournalLuaTest do
  @moduledoc """
  Integration tests for Lua-based dynamic journal entries.

  These tests verify that journal entries can use Lua scripts to generate
  dynamic content based on player state, quest progress, and game data.
  """
  use ExUnit.Case, async: false

  alias Loka.Framework.Quest.Journal
  alias Loka.Framework.Quest.QuestRegistry
  alias Loka.Framework.Player.GameState
  alias Loka.TestCleanup

  # Add test quests to the main quests directory to avoid registry restart issues
  @quests_path "priv/world/quests"

  setup_all do
    # Create test quest files with Lua journal entries in the main quests directory

    # Quest with simple Lua returning a string
    File.write!(Path.join(@quests_path, "test_lua_simple.yml"), """
    id: test_lua_simple
    name: "Lua Simple Test"
    description: "Test quest with simple Lua journal entry"
    objectives:
      - id: test_obj
        type: go_to
        target_id: test_room
        description: "Test objective"
    journal_entries:
      accepted:
        lua: |
          return "Hello from Lua"
    """)

    # Quest with Lua accessing player stats
    File.write!(Path.join(@quests_path, "test_lua_stats.yml"), """
    id: test_lua_stats
    name: "Lua Stats Test"
    description: "Test quest with Lua accessing player stats"
    objectives:
      - id: test_obj
        type: go_to
        target_id: test_room
        description: "Test objective"
    journal_entries:
      accepted:
        lua: |
          local gold = game.player.get_stat("gold")
          if gold > 100 then
            return "Rich adventurer!"
          else
            return "Humble beginnings."
          end
    """)

    # Quest with Lua checking flags
    File.write!(Path.join(@quests_path, "test_lua_flags.yml"), """
    id: test_lua_flags
    name: "Lua Flags Test"
    description: "Test quest with Lua checking flags"
    objectives:
      - id: test_obj
        type: go_to
        target_id: test_room
        description: "Test objective"
    journal_entries:
      accepted:
        lua: |
          if game.player.has_flag("has_blessing") then
            return "You are blessed by the spirits."
          else
            return "You walk without blessing."
          end
    """)

    # Quest with Lua accessing objective progress
    File.write!(Path.join(@quests_path, "test_lua_progress.yml"), """
    id: test_lua_progress
    name: "Lua Progress Test"
    description: "Test quest with Lua accessing objective progress"
    objectives:
      - id: kill_goblins
        type: kill
        target_id: goblin
        target_count: 5
        description: "Defeat 5 goblins"
    journal_entries:
      accepted:
        lua: |
          local count = game.quest.get_objective_progress("kill_goblins")
          local target = game.quest.get_objective_target("kill_goblins")
          return string.format("Goblins slain: %d of %d", count, target)
    """)

    # Quest with Lua format_time function
    File.write!(Path.join(@quests_path, "test_lua_time.yml"), """
    id: test_lua_time
    name: "Lua Time Format Test"
    description: "Test quest with Lua time formatting"
    objectives:
      - id: test_obj
        type: go_to
        target_id: test_room
        description: "Test objective"
    journal_entries:
      accepted:
        lua: |
          local formatted = game.journal.format_time(125)
          return "Time remaining: " .. formatted
    """)

    # Quest with Lua checking inventory
    File.write!(Path.join(@quests_path, "test_lua_inventory.yml"), """
    id: test_lua_inventory
    name: "Lua Inventory Test"
    description: "Test quest with Lua checking inventory"
    objectives:
      - id: test_obj
        type: go_to
        target_id: test_room
        description: "Test objective"
    journal_entries:
      accepted:
        lua: |
          if game.player.has_item("magic_amulet") then
            return "The amulet glows with mysterious power."
          else
            return "I should find the magic amulet."
          end
    """)

    # Reload the quest registry to pick up the new test quests
    :ok = QuestRegistry.reload()

    on_exit(fn ->
      # Clean up test quest files using TestCleanup for robustness
      TestCleanup.cleanup_quest_test_files()

      # Reload registry to remove test quests
      QuestRegistry.reload()
    end)

    :ok
  end

  describe "Lua script execution in journal entries" do
    test "executes simple Lua script returning string" do
      state = %GameState{
        player_id: Ecto.UUID.generate(),
        quests: %{
          "active" => %{
            "test_lua_simple" => %{"objectives" => %{}}
          },
          "completed" => []
        },
        stats: %{},
        flags: %{},
        inventory: []
      }

      {:ok, text} = Journal.render_entry(state, "test_lua_simple", "accepted")
      assert text == "Hello from Lua"
    end

    test "Lua script can access player stats - rich player" do
      state = %GameState{
        player_id: Ecto.UUID.generate(),
        quests: %{
          "active" => %{
            "test_lua_stats" => %{"objectives" => %{}}
          },
          "completed" => []
        },
        stats: %{"gold" => 150},
        flags: %{},
        inventory: []
      }

      {:ok, text} = Journal.render_entry(state, "test_lua_stats", "accepted")
      assert text == "Rich adventurer!"
    end

    test "Lua script can access player stats - poor player" do
      state = %GameState{
        player_id: Ecto.UUID.generate(),
        quests: %{
          "active" => %{
            "test_lua_stats" => %{"objectives" => %{}}
          },
          "completed" => []
        },
        stats: %{"gold" => 50},
        flags: %{},
        inventory: []
      }

      {:ok, text} = Journal.render_entry(state, "test_lua_stats", "accepted")
      assert text == "Humble beginnings."
    end

    test "Lua script can check flags - has blessing" do
      state = %GameState{
        player_id: Ecto.UUID.generate(),
        quests: %{
          "active" => %{
            "test_lua_flags" => %{"objectives" => %{}}
          },
          "completed" => []
        },
        stats: %{},
        flags: %{"has_blessing" => true},
        inventory: []
      }

      {:ok, text} = Journal.render_entry(state, "test_lua_flags", "accepted")
      assert text == "You are blessed by the spirits."
    end

    test "Lua script can check flags - no blessing" do
      state = %GameState{
        player_id: Ecto.UUID.generate(),
        quests: %{
          "active" => %{
            "test_lua_flags" => %{"objectives" => %{}}
          },
          "completed" => []
        },
        stats: %{},
        flags: %{},
        inventory: []
      }

      {:ok, text} = Journal.render_entry(state, "test_lua_flags", "accepted")
      assert text == "You walk without blessing."
    end

    test "Lua script can access objective progress" do
      state = %GameState{
        player_id: Ecto.UUID.generate(),
        quests: %{
          "active" => %{
            "test_lua_progress" => %{
              "objectives" => %{
                "kill_goblins" => %{"progress" => 3, "completed" => false}
              }
            }
          },
          "completed" => []
        },
        stats: %{},
        flags: %{},
        inventory: []
      }

      {:ok, text} = Journal.render_entry(state, "test_lua_progress", "accepted")
      assert text == "Goblins slain: 3 of 5"
    end

    test "Lua script can use format_time function" do
      state = %GameState{
        player_id: Ecto.UUID.generate(),
        quests: %{
          "active" => %{
            "test_lua_time" => %{"objectives" => %{}}
          },
          "completed" => []
        },
        stats: %{},
        flags: %{},
        inventory: []
      }

      {:ok, text} = Journal.render_entry(state, "test_lua_time", "accepted")
      assert text == "Time remaining: 2m 5s"
    end

    test "Lua script can check inventory - has item" do
      state = %GameState{
        player_id: Ecto.UUID.generate(),
        quests: %{
          "active" => %{
            "test_lua_inventory" => %{"objectives" => %{}}
          },
          "completed" => []
        },
        stats: %{},
        flags: %{},
        inventory: ["magic_amulet", "health_potion"]
      }

      {:ok, text} = Journal.render_entry(state, "test_lua_inventory", "accepted")
      assert text == "The amulet glows with mysterious power."
    end

    test "Lua script can check inventory - missing item" do
      state = %GameState{
        player_id: Ecto.UUID.generate(),
        quests: %{
          "active" => %{
            "test_lua_inventory" => %{"objectives" => %{}}
          },
          "completed" => []
        },
        stats: %{},
        flags: %{},
        inventory: ["health_potion"]
      }

      {:ok, text} = Journal.render_entry(state, "test_lua_inventory", "accepted")
      assert text == "I should find the magic amulet."
    end
  end
end
