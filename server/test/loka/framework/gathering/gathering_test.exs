defmodule Loka.Framework.GatheringTest do
  use Loka.DataCase

  alias Loka.Framework.Gathering
  alias Loka.Framework.Gathering.{GatheringNode, GatheringRegistry}
  alias Loka.Framework.Player.GameState

  import Loka.EngineFixtures
  import Loka.AccountsFixtures

  # =============================================================================
  # Test Setup and Helpers
  # =============================================================================

  setup do
    # Start the GatheringRegistry GenServer for tests (if not already started by app)
    # Use the default name since Gathering module calls GatheringRegistry without server param
    registry_pid =
      case start_supervised({GatheringRegistry, [load_on_start: false]}) do
        {:ok, pid} -> pid
        {:error, {:already_started, pid}} -> pid
      end

    # Restore production state on exit by reloading from disk
    on_exit(fn ->
      if Process.alive?(registry_pid) do
        GatheringRegistry.reload()
      end
    end)

    # Create test node definitions
    herb_node = %GatheringNode{
      key: "herb_patch",
      name: "Herb Patch",
      skill_required: "herbalism",
      skill_level: 1,
      yields: [
        %{item: "herb_healing", chance: 1.0, quantity: {1, 3}},
        %{item: "herb_rare", chance: 0.3, quantity: 1}
      ],
      respawn_time: 300,
      uses_per_respawn: 3,
      tool_required: "gathering_knife",
      xp_reward: %{skill: "herbalism", amount: 5},
      gather_message: "You carefully harvest from the herb patch.",
      success_message: "You find some useful herbs!",
      failure_message: "You find nothing of value.",
      exhausted_message: "The herb patch has been picked clean.",
      tags: ["herbalism", "outdoor"]
    }

    ore_node = %GatheringNode{
      key: "iron_vein",
      name: "Iron Vein",
      skill_required: "mining",
      skill_level: 2,
      yields: [
        %{item: "iron_ore", chance: 0.8, quantity: 2}
      ],
      respawn_time: 600,
      uses_per_respawn: 5,
      tool_required: "pickaxe",
      xp_reward: %{skill: "mining", amount: 10},
      gather_message: "You swing your pickaxe at the vein.",
      success_message: "You extract some iron ore!",
      failure_message: "You fail to extract any ore.",
      exhausted_message: "The vein has been depleted.",
      tags: ["mining", "underground"]
    }

    simple_node = %GatheringNode{
      key: "berry_bush",
      name: "Berry Bush",
      skill_required: nil,
      skill_level: 0,
      yields: [
        %{item: "berries", chance: 1.0, quantity: 3}
      ],
      respawn_time: 120,
      uses_per_respawn: 2,
      tool_required: nil,
      xp_reward: nil,
      gather_message: "You pick berries from the bush.",
      success_message: "You gather some fresh berries!",
      failure_message: "No berries are ripe.",
      exhausted_message: "All the berries have been picked.",
      tags: ["foraging"]
    }

    # Register nodes manually in the registry
    GenServer.call(GatheringRegistry, {:register_test_node, herb_node})
    GenServer.call(GatheringRegistry, {:register_test_node, ore_node})
    GenServer.call(GatheringRegistry, {:register_test_node, simple_node})

    %{
      registry_pid: registry_pid,
      herb_node: herb_node,
      ore_node: ore_node,
      simple_node: simple_node
    }
  end

  # Helper to create a room with gathering nodes
  defp room_with_nodes_fixture(node_keys) do
    nodes_map =
      Enum.reduce(node_keys, %{}, fn key, acc ->
        Map.put(acc, key, %{uses_remaining: 3, respawn_at: nil})
      end)

    components = %{
      "gathering_nodes" => nodes_map
    }

    room_fixture(%{
      name: "Forest Clearing",
      description: "A clearing with various resources",
      components: components
    })
  end

  # Helper to create a game state
  defp game_state_fixture(attrs \\ %{}) do
    player = player_fixture()

    {:ok, game_state} = GameState.create_state(player.id)

    stats =
      Map.merge(
        %{"str" => 10, "dex" => 10, "sta" => 10, "level" => 1, "xp" => 0, "gold" => 0},
        Map.get(attrs, :stats, %{})
      )

    inventory = Map.get(attrs, :inventory, [])

    {:ok, game_state} =
      GameState.update_state(game_state, %{
        stats: stats,
        inventory: inventory
      })

    game_state
  end

  # =============================================================================
  # list_nodes/1
  # =============================================================================

  describe "list_nodes/1" do
    test "lists all nodes in a room", %{herb_node: herb_node, simple_node: simple_node} do
      room = room_with_nodes_fixture(["herb_patch", "berry_bush"])

      nodes = Gathering.list_nodes(room)

      assert length(nodes) == 2

      # Check that we get tuples of {key, definition, state}
      assert Enum.any?(nodes, fn {key, def, _state} ->
               key == "herb_patch" && def.name == herb_node.name
             end)

      assert Enum.any?(nodes, fn {key, def, _state} ->
               key == "berry_bush" && def.name == simple_node.name
             end)
    end

    test "returns empty list for room with no nodes" do
      room = room_fixture()

      nodes = Gathering.list_nodes(room)

      assert nodes == []
    end

    test "skips nodes that don't exist in registry" do
      components = %{
        "gathering_nodes" => %{
          "nonexistent_node" => %{uses_remaining: 3, respawn_at: nil}
        }
      }

      room = room_fixture(%{components: components})

      nodes = Gathering.list_nodes(room)

      assert nodes == []
    end
  end

  # =============================================================================
  # list_available_nodes/1
  # =============================================================================

  describe "list_available_nodes/1" do
    test "only lists nodes with remaining uses" do
      components = %{
        "gathering_nodes" => %{
          "herb_patch" => %{uses_remaining: 3, respawn_at: nil},
          "berry_bush" => %{uses_remaining: 0, respawn_at: nil}
        }
      }

      room = room_fixture(%{components: components})

      available = Gathering.list_available_nodes(room)

      assert length(available) == 1
      assert {key, _def, _state} = List.first(available)
      assert key == "herb_patch"
    end

    test "returns empty list when all nodes exhausted" do
      components = %{
        "gathering_nodes" => %{
          "herb_patch" => %{uses_remaining: 0, respawn_at: nil},
          "berry_bush" => %{uses_remaining: 0, respawn_at: nil}
        }
      }

      room = room_fixture(%{components: components})

      available = Gathering.list_available_nodes(room)

      assert available == []
    end
  end

  # =============================================================================
  # can_gather?/3
  # =============================================================================

  describe "can_gather?/3" do
    test "returns :ok when all requirements met" do
      room = room_with_nodes_fixture(["berry_bush"])
      game_state = game_state_fixture()

      assert :ok = Gathering.can_gather?(game_state, room, "berry_bush")
    end

    test "returns error when node doesn't exist in registry" do
      room = room_with_nodes_fixture(["nonexistent"])
      game_state = game_state_fixture()

      assert {:error, :not_found} = Gathering.can_gather?(game_state, room, "nonexistent")
    end

    test "returns error when node not in room" do
      room = room_fixture()
      game_state = game_state_fixture()

      assert {:error, {:node_not_in_room, "herb_patch"}} =
               Gathering.can_gather?(game_state, room, "herb_patch")
    end

    test "returns error when node is exhausted" do
      components = %{
        "gathering_nodes" => %{
          "berry_bush" => %{uses_remaining: 0, respawn_at: nil}
        }
      }

      room = room_fixture(%{components: components})
      game_state = game_state_fixture()

      assert {:error, :node_exhausted} = Gathering.can_gather?(game_state, room, "berry_bush")
    end

    test "returns error when skill requirement not met" do
      room = room_with_nodes_fixture(["herb_patch"])
      game_state = game_state_fixture(%{stats: %{"skills" => %{"herbalism" => 0}}})

      assert {:error, {:skill_required, "herbalism", 1, 0}} =
               Gathering.can_gather?(game_state, room, "herb_patch")
    end

    test "returns :ok when skill requirement is met" do
      room = room_with_nodes_fixture(["herb_patch"])

      game_state =
        game_state_fixture(%{
          stats: %{"skills" => %{"herbalism" => 5}},
          inventory: ["gathering_knife"]
        })

      assert :ok = Gathering.can_gather?(game_state, room, "herb_patch")
    end

    test "returns error when required tool is missing" do
      room = room_with_nodes_fixture(["herb_patch"])

      game_state =
        game_state_fixture(%{
          stats: %{"skills" => %{"herbalism" => 5}},
          inventory: []
        })

      assert {:error, {:tool_required, "gathering_knife"}} =
               Gathering.can_gather?(game_state, room, "herb_patch")
    end

    test "returns :ok when required tool is in inventory" do
      room = room_with_nodes_fixture(["herb_patch"])

      game_state =
        game_state_fixture(%{
          stats: %{"skills" => %{"herbalism" => 5}},
          inventory: ["gathering_knife", "other_item"]
        })

      assert :ok = Gathering.can_gather?(game_state, room, "herb_patch")
    end
  end

  # =============================================================================
  # gather/3
  # =============================================================================

  describe "gather/3" do
    test "successfully gathers from a node" do
      room = room_with_nodes_fixture(["berry_bush"])
      game_state = game_state_fixture()

      assert {:ok, result} = Gathering.gather(game_state, room, "berry_bush")

      assert is_list(result.items)
      assert is_binary(result.message)
      assert is_boolean(result.node_exhausted)
      assert is_integer(result.new_uses_remaining)
      assert result.node_key == "berry_bush"
    end

    test "decrements node uses after gathering" do
      room = room_with_nodes_fixture(["berry_bush"])
      game_state = game_state_fixture()

      {:ok, result} = Gathering.gather(game_state, room, "berry_bush")

      # Started with 3 uses (from room_with_nodes_fixture)
      assert result.new_uses_remaining == 2
      assert result.node_exhausted == false
    end

    test "marks node as exhausted when uses reach 0" do
      components = %{
        "gathering_nodes" => %{
          "berry_bush" => %{uses_remaining: 1, respawn_at: nil}
        }
      }

      room = room_fixture(%{components: components})
      game_state = game_state_fixture()

      {:ok, result} = Gathering.gather(game_state, room, "berry_bush")

      assert result.new_uses_remaining == 0
      assert result.node_exhausted == true
      assert String.contains?(result.message, "picked")
    end

    test "returns items with quantities" do
      room = room_with_nodes_fixture(["berry_bush"])
      game_state = game_state_fixture()

      {:ok, result} = Gathering.gather(game_state, room, "berry_bush")

      # berry_bush has 100% chance to yield berries
      assert length(result.items) >= 1

      berry_item = Enum.find(result.items, &(&1.item == "berries"))
      assert berry_item != nil
      assert berry_item.quantity > 0
    end

    test "returns XP reward when items are gathered" do
      room = room_with_nodes_fixture(["herb_patch"])

      game_state =
        game_state_fixture(%{
          stats: %{"skills" => %{"herbalism" => 5}},
          inventory: ["gathering_knife"]
        })

      {:ok, result} = Gathering.gather(game_state, room, "herb_patch")

      # herb_patch has 100% chance on first yield
      if result.items != [] do
        assert result.xp != nil
        assert result.xp.skill == "herbalism"
        assert result.xp.amount == 5
      end
    end

    test "returns nil XP when no items gathered" do
      # Create a node with 0% chance yields
      zero_yield_node = %GatheringNode{
        key: "empty_node",
        name: "Empty Node",
        skill_required: nil,
        skill_level: 0,
        yields: [
          %{item: "nothing", chance: 0.0, quantity: 1}
        ],
        respawn_time: 60,
        uses_per_respawn: 1,
        tool_required: nil,
        xp_reward: %{skill: "test", amount: 5},
        gather_message: "You try to gather.",
        success_message: "Success!",
        failure_message: "Nothing found.",
        exhausted_message: "Empty.",
        tags: []
      }

      GenServer.call(GatheringRegistry, {:register_test_node, zero_yield_node})

      components = %{
        "gathering_nodes" => %{
          "empty_node" => %{uses_remaining: 1, respawn_at: nil}
        }
      }

      room = room_fixture(%{components: components})
      game_state = game_state_fixture()

      {:ok, result} = Gathering.gather(game_state, room, "empty_node")

      assert result.items == []
      assert result.xp == nil

      # When node is exhausted (uses_per_respawn is 1, so it becomes exhausted after first gather),
      # the exhausted message gets appended
      assert result.message == "Nothing found. Empty."
      assert result.node_exhausted == true
    end

    test "returns error when cannot gather" do
      room = room_with_nodes_fixture(["herb_patch"])

      game_state =
        game_state_fixture(%{
          stats: %{"skills" => %{}},
          inventory: []
        })

      # Missing skill requirement
      assert {:error, {:skill_required, "herbalism", 1, 0}} =
               Gathering.gather(game_state, room, "herb_patch")
    end
  end

  # =============================================================================
  # get_remaining_uses/2
  # =============================================================================

  describe "get_remaining_uses/2" do
    test "returns remaining uses for a node" do
      components = %{
        "gathering_nodes" => %{
          "berry_bush" => %{uses_remaining: 5, respawn_at: nil}
        }
      }

      room = room_fixture(%{components: components})

      uses = Gathering.get_remaining_uses(room, "berry_bush")

      assert uses == 5
    end

    test "returns default uses when state not set", %{simple_node: simple_node} do
      components = %{
        "gathering_nodes" => %{
          "berry_bush" => %{respawn_at: nil}
        }
      }

      room = room_fixture(%{components: components})

      uses = Gathering.get_remaining_uses(room, "berry_bush")

      # Should use default from node definition
      assert uses == simple_node.uses_per_respawn
    end

    test "returns 0 for non-existent node" do
      room = room_fixture()

      uses = Gathering.get_remaining_uses(room, "nonexistent")

      assert uses == 0
    end
  end

  # =============================================================================
  # exhausted?/2
  # =============================================================================

  describe "exhausted?/2" do
    test "returns true when uses are 0" do
      components = %{
        "gathering_nodes" => %{
          "berry_bush" => %{uses_remaining: 0, respawn_at: nil}
        }
      }

      room = room_fixture(%{components: components})

      assert Gathering.exhausted?(room, "berry_bush") == true
    end

    test "returns false when uses remain" do
      components = %{
        "gathering_nodes" => %{
          "berry_bush" => %{uses_remaining: 2, respawn_at: nil}
        }
      }

      room = room_fixture(%{components: components})

      assert Gathering.exhausted?(room, "berry_bush") == false
    end

    test "returns true for non-existent node" do
      room = room_fixture()

      assert Gathering.exhausted?(room, "nonexistent") == true
    end
  end

  # =============================================================================
  # tick_respawn/2
  # =============================================================================

  describe "tick_respawn/2" do
    test "sets respawn timer when node is depleted" do
      components = %{
        "gathering_nodes" => %{
          "berry_bush" => %{uses_remaining: 0, respawn_at: nil}
        }
      }

      room = room_fixture(%{components: components})
      current_time = 1000

      updated_nodes = Gathering.tick_respawn(room, current_time)

      berry_state = updated_nodes["berry_bush"]
      assert berry_state.respawn_at != nil
      # berry_bush respawn_time is 120 seconds
      assert berry_state.respawn_at == current_time + 120
    end

    test "does not change state when node has full uses", %{simple_node: simple_node} do
      components = %{
        "gathering_nodes" => %{
          "berry_bush" => %{
            uses_remaining: simple_node.uses_per_respawn,
            respawn_at: nil
          }
        }
      }

      room = room_fixture(%{components: components})
      current_time = 1000

      updated_nodes = Gathering.tick_respawn(room, current_time)

      berry_state = updated_nodes["berry_bush"]
      assert berry_state.uses_remaining == simple_node.uses_per_respawn
      assert berry_state.respawn_at == nil
    end

    test "respawns node when timer elapses", %{simple_node: simple_node} do
      respawn_time = 1000

      components = %{
        "gathering_nodes" => %{
          "berry_bush" => %{uses_remaining: 0, respawn_at: respawn_time}
        }
      }

      room = room_fixture(%{components: components})
      # Time has passed
      current_time = respawn_time + 1

      updated_nodes = Gathering.tick_respawn(room, current_time)

      berry_state = updated_nodes["berry_bush"]
      assert berry_state.uses_remaining == simple_node.uses_per_respawn
      assert berry_state.respawn_at == nil
    end

    test "keeps timer active when time hasn't elapsed" do
      respawn_time = 2000

      components = %{
        "gathering_nodes" => %{
          "berry_bush" => %{uses_remaining: 0, respawn_at: respawn_time}
        }
      }

      room = room_fixture(%{components: components})
      # Not yet time
      current_time = 1500

      updated_nodes = Gathering.tick_respawn(room, current_time)

      berry_state = updated_nodes["berry_bush"]
      assert berry_state.uses_remaining == 0
      assert berry_state.respawn_at == respawn_time
    end

    test "uses current system time when not provided" do
      components = %{
        "gathering_nodes" => %{
          "berry_bush" => %{uses_remaining: 0, respawn_at: nil}
        }
      }

      room = room_fixture(%{components: components})

      updated_nodes = Gathering.tick_respawn(room)

      berry_state = updated_nodes["berry_bush"]
      assert berry_state.respawn_at != nil
    end

    test "handles multiple nodes", %{herb_node: herb_node} do
      components = %{
        "gathering_nodes" => %{
          "berry_bush" => %{uses_remaining: 0, respawn_at: nil},
          "herb_patch" => %{uses_remaining: 1, respawn_at: nil}
        }
      }

      room = room_fixture(%{components: components})
      current_time = 1000

      updated_nodes = Gathering.tick_respawn(room, current_time)

      # Exhausted node gets respawn timer
      assert updated_nodes["berry_bush"].respawn_at != nil

      # Partial node with uses < max gets respawn timer too
      assert updated_nodes["herb_patch"].uses_remaining == 1
      # herb_patch has uses_per_respawn of 3, so with 1 use it should get a timer
      assert updated_nodes["herb_patch"].respawn_at == current_time + herb_node.respawn_time
    end
  end

  # =============================================================================
  # reset_node/1
  # =============================================================================

  describe "reset_node/1" do
    test "resets node to full uses", %{simple_node: simple_node} do
      assert {:ok, state} = Gathering.reset_node("berry_bush")

      assert state.uses_remaining == simple_node.uses_per_respawn
      assert state.respawn_at == nil
    end

    test "returns error for non-existent node" do
      assert {:error, :not_found} = Gathering.reset_node("nonexistent_node")
    end
  end

  # =============================================================================
  # Edge Cases and Integration
  # =============================================================================

  describe "edge cases" do
    test "handles room with nil components" do
      room = room_fixture(%{components: nil})

      nodes = Gathering.list_nodes(room)
      assert nodes == []

      available = Gathering.list_available_nodes(room)
      assert available == []
    end

    test "handles gathering nodes as list format" do
      # Some older data might have nodes as a list
      components = %{
        "gathering_nodes" => [
          %{node: "berry_bush", uses_remaining: 2, respawn_at: nil}
        ]
      }

      room = room_fixture(%{components: components})

      nodes = Gathering.list_nodes(room)
      assert length(nodes) == 1

      uses = Gathering.get_remaining_uses(room, "berry_bush")
      assert uses == 2
    end

    test "node with partial item ID match in inventory" do
      room = room_with_nodes_fixture(["herb_patch"])
      # Player has item that starts with tool_required
      game_state =
        game_state_fixture(%{
          stats: %{"skills" => %{"herbalism" => 5}},
          inventory: ["gathering_knife_rusty"]
        })

      # Should match because inventory check uses String.starts_with?
      assert :ok = Gathering.can_gather?(game_state, room, "herb_patch")
    end

    test "gathering from node with range quantities" do
      room = room_with_nodes_fixture(["herb_patch"])

      game_state =
        game_state_fixture(%{
          stats: %{"skills" => %{"herbalism" => 5}},
          inventory: ["gathering_knife"]
        })

      {:ok, result} = Gathering.gather(game_state, room, "herb_patch")

      # herb_patch yields have range {1, 3}
      if result.items != [] do
        healing_herb = Enum.find(result.items, &(&1.item == "herb_healing"))

        if healing_herb do
          assert healing_herb.quantity >= 1
          assert healing_herb.quantity <= 3
        end
      end
    end

    test "complete gathering workflow" do
      # Start with a fresh node
      room = room_with_nodes_fixture(["berry_bush"])
      game_state = game_state_fixture()

      # Check it's available
      available = Gathering.list_available_nodes(room)
      assert length(available) == 1

      # Gather from it
      {:ok, result1} = Gathering.gather(game_state, room, "berry_bush")
      assert result1.new_uses_remaining == 2

      # Update room state and gather again
      updated_components = %{
        "gathering_nodes" => %{
          "berry_bush" => %{
            uses_remaining: result1.new_uses_remaining,
            respawn_at: nil
          }
        }
      }

      room = Map.put(room, :components, updated_components)

      {:ok, result2} = Gathering.gather(game_state, room, "berry_bush")
      assert result2.new_uses_remaining == 1

      # One more time to exhaust it
      updated_components = %{
        "gathering_nodes" => %{
          "berry_bush" => %{
            uses_remaining: result2.new_uses_remaining,
            respawn_at: nil
          }
        }
      }

      room = Map.put(room, :components, updated_components)

      {:ok, result3} = Gathering.gather(game_state, room, "berry_bush")
      assert result3.new_uses_remaining == 0
      assert result3.node_exhausted == true

      # Now it's exhausted
      updated_components = %{
        "gathering_nodes" => %{
          "berry_bush" => %{
            uses_remaining: result3.new_uses_remaining,
            respawn_at: nil
          }
        }
      }

      room = Map.put(room, :components, updated_components)

      assert Gathering.exhausted?(room, "berry_bush") == true
      assert {:error, :node_exhausted} = Gathering.gather(game_state, room, "berry_bush")
    end
  end
end
