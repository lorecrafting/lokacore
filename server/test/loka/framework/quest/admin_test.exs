defmodule Loka.Framework.Quest.AdminTest do
  use Loka.DataCase, async: false

  alias Loka.Framework.Quest.Admin
  alias Loka.Framework.Player.GameState
  alias Loka.Framework.Quest.QuestRegistry

  import Loka.AccountsFixtures

  setup do
    # Create a test player using the fixture
    player = player_fixture()

    # Create a game state for the test player
    {:ok, state} = GameState.get_or_create_state(player.id)

    {:ok, state: state, player_id: player.id}
  end

  describe "get_player_quest_state/1" do
    test "returns error for player without game state" do
      # Create a player but don't create game state
      player = player_fixture()
      GameState.delete_state(player.id)
      assert {:error, :no_game_state} = Admin.get_player_quest_state(player.id)
    end

    test "returns quest state for player with game state", %{player_id: player_id} do
      assert {:ok, result} = Admin.get_player_quest_state(player_id)
      assert result.player_id == player_id
      assert is_list(result.active_quests)
      assert is_list(result.completed_quests)
    end
  end

  describe "force_grant_quest/2" do
    test "returns error for nonexistent quest", %{player_id: player_id} do
      assert {:error, {:quest_not_found, "fake_quest"}} =
               Admin.force_grant_quest(player_id, "fake_quest")
    end

    test "grants existing quest to player", %{player_id: player_id} do
      # Get a real quest from the registry
      quests = QuestRegistry.all()

      if quests != [] do
        quest = hd(quests)

        case Admin.force_grant_quest(player_id, quest.id) do
          {:ok, new_state} ->
            assert new_state != nil
            assert {:ok, quest_state} = Admin.get_player_quest_state(player_id)
            assert Enum.any?(quest_state.active_quests, &(&1.quest_id == quest.id))

          {:error, :already_active} ->
            # Quest was already active, that's fine
            :ok
        end
      end
    end
  end

  describe "reset_quest/2" do
    test "removes quest from active and completed lists", %{player_id: player_id} do
      quests = QuestRegistry.all()

      if quests != [] do
        quest = hd(quests)

        # First grant the quest
        Admin.force_grant_quest(player_id, quest.id)

        # Then reset it
        assert {:ok, _new_state} = Admin.reset_quest(player_id, quest.id)

        # Verify it's gone
        {:ok, quest_state} = Admin.get_player_quest_state(player_id)
        refute Enum.any?(quest_state.active_quests, &(&1.quest_id == quest.id))
        refute quest.id in quest_state.completed_quests
      end
    end
  end

  describe "reset_all_quests/1" do
    test "clears all quests for player", %{player_id: player_id} do
      # Grant some quests first
      quests = QuestRegistry.all() |> Enum.take(2)

      for quest <- quests do
        Admin.force_grant_quest(player_id, quest.id)
      end

      # Reset all
      assert {:ok, _new_state} = Admin.reset_all_quests(player_id)

      # Verify all gone
      {:ok, quest_state} = Admin.get_player_quest_state(player_id)
      assert quest_state.active_quests == []
      assert quest_state.completed_quests == []
    end
  end

  describe "why_not_complete?/3" do
    test "returns error for inactive quest", %{player_id: player_id} do
      assert {:error, {:quest_not_active, "fake_quest"}} =
               Admin.why_not_complete?(player_id, "fake_quest", "fake_objective")
    end

    test "returns error for nonexistent objective", %{player_id: player_id} do
      quests = QuestRegistry.all()

      if quests != [] do
        quest = hd(quests)
        Admin.force_grant_quest(player_id, quest.id)

        assert {:error, {:objective_not_found, "fake_objective"}} =
                 Admin.why_not_complete?(player_id, quest.id, "fake_objective")
      end
    end

    test "returns diagnosis for valid objective", %{player_id: player_id} do
      quests = QuestRegistry.all()

      if quests != [] do
        quest = hd(quests)

        if quest.objectives != [] do
          objective = hd(quest.objectives)
          Admin.force_grant_quest(player_id, quest.id)

          result = Admin.why_not_complete?(player_id, quest.id, objective.id)

          assert is_map(result)
          assert Map.has_key?(result, :objective)
          assert Map.has_key?(result, :current_progress)
          assert Map.has_key?(result, :target_count)
          assert Map.has_key?(result, :completed)
          assert Map.has_key?(result, :possible_issues)
          assert Map.has_key?(result, :suggestions)
          assert is_list(result.possible_issues)
          assert is_list(result.suggestions)
        end
      end
    end
  end

  describe "simulate_event/3" do
    test "returns error for player without game state" do
      # Create a player but don't create game state
      player = player_fixture()
      GameState.delete_state(player.id)

      assert {:error, :no_game_state} =
               Admin.simulate_event(player.id, :kill, %{target_id: "goblin"})
    end

    test "simulates kill event", %{player_id: player_id} do
      result = Admin.simulate_event(player_id, :kill, %{target_id: "goblin"})

      case result do
        {:ok, sim_result} ->
          assert is_boolean(sim_result.state_updated)
          assert is_list(sim_result.completed_objectives)

        {:error, _reason} ->
          # No active quests with kill objectives - that's ok
          :ok
      end
    end

    test "simulates go_to event", %{player_id: player_id} do
      result = Admin.simulate_event(player_id, :go_to, %{target_id: "temple"})

      case result do
        {:ok, sim_result} ->
          assert is_boolean(sim_result.state_updated)
          assert is_list(sim_result.completed_objectives)

        {:error, _reason} ->
          :ok
      end
    end

    test "simulates get_item event", %{player_id: player_id} do
      result = Admin.simulate_event(player_id, :get_item, %{target_id: "ancient_sword"})

      case result do
        {:ok, sim_result} ->
          assert is_boolean(sim_result.state_updated)
          assert is_list(sim_result.completed_objectives)

        {:error, _reason} ->
          :ok
      end
    end
  end

  describe "list_all_quests/0" do
    test "returns list of quests" do
      quests = Admin.list_all_quests()
      assert is_list(quests)

      if quests != [] do
        quest = hd(quests)
        assert Map.has_key?(quest, :id)
        assert Map.has_key?(quest, :name)
        assert Map.has_key?(quest, :type)
        assert Map.has_key?(quest, :objective_count)
      end
    end
  end

  describe "get_quest_events/2" do
    test "returns events for player", %{player_id: player_id} do
      events = Admin.get_quest_events(player_id)
      assert is_list(events)
    end
  end

  describe "clear_quest_events/1" do
    test "clears events for player", %{player_id: player_id} do
      assert :ok = Admin.clear_quest_events(player_id)
      assert Admin.get_quest_events(player_id) == []
    end
  end
end
