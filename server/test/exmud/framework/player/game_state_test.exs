defmodule Exmud.Framework.Player.GameStateTest do
  use Exmud.DataCase

  alias Exmud.Framework.Player.GameState

  import Exmud.AccountsFixtures

  describe "changeset/2" do
    test "valid changeset with all fields" do
      player = player_fixture()

      attrs = %{
        player_id: player.id,
        inventory: ["item_1", "item_2"],
        equipment: %{weapon: "sword_01", armor: "plate_01", accessory: nil},
        quests: %{"quest_1" => %{status: "active"}},
        flags: %{tutorial_complete: true},
        stats: %{str: 15, dex: 12, sta: 14, level: 5, xp: 1000},
        health: %{current: 80, max: 100},
        current_room_id: Ecto.UUID.generate()
      }

      changeset = GameState.changeset(%GameState{}, attrs)

      assert changeset.valid?
    end

    test "requires player_id" do
      changeset = GameState.changeset(%GameState{}, %{})

      refute changeset.valid?
      assert %{player_id: ["can't be blank"]} = errors_on(changeset)
    end

    test "allows partial attributes" do
      player = player_fixture()

      changeset = GameState.changeset(%GameState{}, %{player_id: player.id})

      assert changeset.valid?
    end

    test "validates unique player_id constraint on insert" do
      player = player_fixture()

      # Create first state
      {:ok, _state1} = GameState.create_state(player.id)

      # Try to create duplicate
      {:error, changeset} = GameState.create_state(player.id)

      assert %{player_id: ["has already been taken"]} = errors_on(changeset)
    end
  end

  describe "get_state/1" do
    test "returns nil for player without state" do
      player = player_fixture()

      assert GameState.get_state(player.id) == nil
    end

    test "returns state when it exists" do
      player = player_fixture()
      {:ok, created_state} = GameState.create_state(player.id)

      state = GameState.get_state(player.id)

      assert state != nil
      assert state.id == created_state.id
      assert state.player_id == player.id
    end

    test "returns state with default values" do
      player = player_fixture()
      {:ok, _created_state} = GameState.create_state(player.id)

      state = GameState.get_state(player.id)

      assert state.inventory == []
      # JSON fields are loaded with string keys, not atom keys
      assert state.equipment == %{"weapon" => nil, "armor" => nil, "accessory" => nil}
      assert state.quests == %{}
      assert state.flags == %{}
      assert state.stats == %{"str" => 10, "dex" => 10, "sta" => 10, "level" => 1, "xp" => 0}
      assert state.health == %{"current" => 100, "max" => 100}
    end
  end

  describe "get_or_create_state/1" do
    test "creates state when it doesn't exist" do
      player = player_fixture()

      assert GameState.get_state(player.id) == nil

      {:ok, state} = GameState.get_or_create_state(player.id)

      assert state != nil
      assert state.player_id == player.id
    end

    test "returns existing state without creating duplicate" do
      player = player_fixture()
      {:ok, created_state} = GameState.create_state(player.id)

      {:ok, fetched_state} = GameState.get_or_create_state(player.id)

      assert fetched_state.id == created_state.id
      assert fetched_state.player_id == player.id
    end

    test "returns same state on multiple calls" do
      player = player_fixture()

      {:ok, state1} = GameState.get_or_create_state(player.id)
      {:ok, state2} = GameState.get_or_create_state(player.id)

      assert state1.id == state2.id
    end
  end

  describe "create_state/1" do
    test "creates new state with defaults" do
      player = player_fixture()

      {:ok, state} = GameState.create_state(player.id)

      assert state.player_id == player.id
      assert state.inventory == []
      assert state.equipment == %{weapon: nil, armor: nil, accessory: nil}
      assert state.quests == %{}
      assert state.flags == %{}
      assert state.stats == %{str: 10, dex: 10, sta: 10, level: 1, xp: 0}
      assert state.health == %{current: 100, max: 100}
      assert state.current_room_id == nil
    end

    test "returns error when creating duplicate" do
      player = player_fixture()

      {:ok, _state1} = GameState.create_state(player.id)
      {:error, changeset} = GameState.create_state(player.id)

      refute changeset.valid?
    end

    test "creates states for different players" do
      player1 = player_fixture()
      player2 = player_fixture()

      {:ok, state1} = GameState.create_state(player1.id)
      {:ok, state2} = GameState.create_state(player2.id)

      assert state1.player_id != state2.player_id
      assert state1.id != state2.id
    end
  end

  describe "update_state/2 with GameState struct" do
    test "updates inventory" do
      player = player_fixture()
      {:ok, state} = GameState.create_state(player.id)

      {:ok, updated_state} = GameState.update_state(state, %{inventory: ["sword", "potion"]})

      assert updated_state.inventory == ["sword", "potion"]
    end

    test "updates equipment" do
      player = player_fixture()
      {:ok, state} = GameState.create_state(player.id)

      new_equipment = %{weapon: "sword_01", armor: "plate_01", accessory: "ring_01"}
      {:ok, updated_state} = GameState.update_state(state, %{equipment: new_equipment})

      assert updated_state.equipment == new_equipment
    end

    test "updates quests" do
      player = player_fixture()
      {:ok, state} = GameState.create_state(player.id)

      quests = %{"quest_1" => %{status: "active", progress: 50}}
      {:ok, updated_state} = GameState.update_state(state, %{quests: quests})

      assert updated_state.quests == quests
    end

    test "updates flags" do
      player = player_fixture()
      {:ok, state} = GameState.create_state(player.id)

      flags = %{tutorial_complete: true, first_login: true}
      {:ok, updated_state} = GameState.update_state(state, %{flags: flags})

      assert updated_state.flags == flags
    end

    test "updates stats" do
      player = player_fixture()
      {:ok, state} = GameState.create_state(player.id)

      new_stats = %{str: 15, dex: 12, sta: 14, level: 5, xp: 1000}
      {:ok, updated_state} = GameState.update_state(state, %{stats: new_stats})

      assert updated_state.stats == new_stats
    end

    test "updates health" do
      player = player_fixture()
      {:ok, state} = GameState.create_state(player.id)

      {:ok, updated_state} = GameState.update_state(state, %{health: %{current: 50, max: 100}})

      assert updated_state.health == %{current: 50, max: 100}
    end

    test "updates current_room_id" do
      player = player_fixture()
      {:ok, state} = GameState.create_state(player.id)

      room_id = Ecto.UUID.generate()
      {:ok, updated_state} = GameState.update_state(state, %{current_room_id: room_id})

      assert updated_state.current_room_id == room_id
    end

    test "updates multiple fields at once" do
      player = player_fixture()
      {:ok, state} = GameState.create_state(player.id)

      updates = %{
        inventory: ["item1"],
        stats: %{str: 20, dex: 15, sta: 18, level: 10, xp: 5000},
        health: %{current: 150, max: 150}
      }

      {:ok, updated_state} = GameState.update_state(state, updates)

      assert updated_state.inventory == ["item1"]
      assert updated_state.stats.level == 10
      assert updated_state.health.max == 150
    end

    test "persists changes to database" do
      player = player_fixture()
      {:ok, state} = GameState.create_state(player.id)

      {:ok, _updated_state} = GameState.update_state(state, %{inventory: ["sword"]})

      # Fetch from database
      fetched_state = GameState.get_state(player.id)
      assert fetched_state.inventory == ["sword"]
    end
  end

  describe "update_state/2 with player_id" do
    test "updates existing state by player_id" do
      player = player_fixture()
      {:ok, _state} = GameState.create_state(player.id)

      {:ok, updated_state} = GameState.update_state(player.id, %{inventory: ["item1"]})

      assert updated_state.player_id == player.id
      assert updated_state.inventory == ["item1"]
    end

    test "creates state if it doesn't exist" do
      player = player_fixture()

      assert GameState.get_state(player.id) == nil

      {:ok, state} = GameState.update_state(player.id, %{inventory: ["item1"]})

      assert state.player_id == player.id
      assert state.inventory == ["item1"]
    end

    test "works with binary player_id" do
      player = player_fixture()
      binary_id = player.id

      {:ok, state} = GameState.update_state(binary_id, %{inventory: ["test"]})

      assert state.player_id == binary_id
      assert state.inventory == ["test"]
    end
  end

  describe "delete_state/1 with GameState struct" do
    test "deletes existing state" do
      player = player_fixture()
      {:ok, state} = GameState.create_state(player.id)

      {:ok, deleted_state} = GameState.delete_state(state)

      assert deleted_state.id == state.id
      assert GameState.get_state(player.id) == nil
    end

    test "state is removed from database" do
      player = player_fixture()
      {:ok, state} = GameState.create_state(player.id)

      GameState.delete_state(state)

      assert GameState.get_state(player.id) == nil
    end
  end

  describe "delete_state/1 with player_id" do
    test "deletes state by player_id" do
      player = player_fixture()
      {:ok, _state} = GameState.create_state(player.id)

      {:ok, _deleted} = GameState.delete_state(player.id)

      assert GameState.get_state(player.id) == nil
    end

    test "returns error when state doesn't exist" do
      player = player_fixture()

      assert {:error, :not_found} = GameState.delete_state(player.id)
    end
  end

  describe "get_players_in_room/2" do
    test "returns empty list when no players in room" do
      room_id = Ecto.UUID.generate()

      players = GameState.get_players_in_room(room_id)

      assert players == []
    end

    test "returns players in specified room" do
      room_id = Ecto.UUID.generate()
      player1 = player_fixture()
      player2 = player_fixture()
      player3 = player_fixture()

      # Put player1 and player2 in room
      {:ok, _} = GameState.update_state(player1.id, %{current_room_id: room_id})
      {:ok, _} = GameState.update_state(player2.id, %{current_room_id: room_id})
      # player3 in different room
      {:ok, _} = GameState.update_state(player3.id, %{current_room_id: Ecto.UUID.generate()})

      players = GameState.get_players_in_room(room_id)

      assert length(players) == 2
      assert player1.id in players
      assert player2.id in players
      refute player3.id in players
    end

    test "excludes specified player" do
      room_id = Ecto.UUID.generate()
      player1 = player_fixture()
      player2 = player_fixture()
      player3 = player_fixture()

      {:ok, _} = GameState.update_state(player1.id, %{current_room_id: room_id})
      {:ok, _} = GameState.update_state(player2.id, %{current_room_id: room_id})
      {:ok, _} = GameState.update_state(player3.id, %{current_room_id: room_id})

      players = GameState.get_players_in_room(room_id, exclude: player2.id)

      assert length(players) == 2
      assert player1.id in players
      assert player3.id in players
      refute player2.id in players
    end

    test "returns empty list when only excluded player is in room" do
      room_id = Ecto.UUID.generate()
      player = player_fixture()

      {:ok, _} = GameState.update_state(player.id, %{current_room_id: room_id})

      players = GameState.get_players_in_room(room_id, exclude: player.id)

      assert players == []
    end

    test "works with nil current_room_id" do
      room_id = Ecto.UUID.generate()
      player1 = player_fixture()
      player2 = player_fixture()

      {:ok, _} = GameState.update_state(player1.id, %{current_room_id: room_id})
      {:ok, _} = GameState.update_state(player2.id, %{current_room_id: nil})

      players = GameState.get_players_in_room(room_id)

      assert length(players) == 1
      assert player1.id in players
    end
  end

  describe "integration tests" do
    test "complete player lifecycle" do
      player = player_fixture()

      # Create state
      {:ok, state} = GameState.create_state(player.id)
      assert state.inventory == []

      # Add items to inventory
      {:ok, state} = GameState.update_state(state, %{inventory: ["sword", "shield"]})
      assert length(state.inventory) == 2

      # Equip items
      equipment = %{weapon: "sword", armor: "shield", accessory: nil}
      {:ok, state} = GameState.update_state(state, %{equipment: equipment})
      # update_state returns the struct with atom keys (before JSON round-trip)
      assert state.equipment[:weapon] == "sword"

      # Start a quest
      quests = %{"quest_main" => %{status: "active", progress: 0}}
      {:ok, state} = GameState.update_state(state, %{quests: quests})
      # String keys are preserved for the top level, nested maps have atom keys before reload
      assert state.quests["quest_main"][:status] == "active"

      # Level up
      stats = %{str: 15, dex: 12, sta: 14, level: 2, xp: 500}
      {:ok, state} = GameState.update_state(state, %{stats: stats})
      # update_state returns the struct with atom keys (before JSON round-trip)
      assert state.stats[:level] == 2

      # Move to a room
      room_id = Ecto.UUID.generate()
      {:ok, state} = GameState.update_state(state, %{current_room_id: room_id})
      assert state.current_room_id == room_id

      # Verify persistence
      fetched = GameState.get_state(player.id)
      # JSON fields are loaded with string keys, not atom keys
      assert fetched.stats["level"] == 2
      assert fetched.current_room_id == room_id
    end

    test "multiple players in same room" do
      room_id = Ecto.UUID.generate()

      # Create 3 players
      players = Enum.map(1..3, fn _ -> player_fixture() end)

      # Put them all in the same room
      Enum.each(players, fn p ->
        {:ok, _} = GameState.update_state(p.id, %{current_room_id: room_id})
      end)

      # Each player should see the others
      for player <- players do
        others = GameState.get_players_in_room(room_id, exclude: player.id)
        assert length(others) == 2
        refute player.id in others
      end
    end
  end
end
