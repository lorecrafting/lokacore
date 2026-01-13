defmodule Loka.Testing.QuestStrategyTest do
  use Loka.DataCase, async: true

  alias Loka.Testing.QuestStrategy

  describe "initial_strategy_state/1" do
    test "creates initial state with storyline_id" do
      context = %{storyline_id: "monastery_arc"}
      state = QuestStrategy.initial_strategy_state(context)

      assert state.storyline_id == "monastery_arc"
      assert state.phase == :init
      assert state.current_quest_id == nil
      assert state.results.quests_completed == []
    end
  end

  describe "find_path/3" do
    test "returns empty path when already at destination" do
      assert {:ok, []} = QuestStrategy.find_path(%{}, "room_a", "room_a")
    end

    test "returns error when no path exists" do
      graph = %{
        "room_a" => %{"north" => "room_b"},
        "room_b" => %{"south" => "room_a"}
      }

      assert {:error, :no_path} = QuestStrategy.find_path(graph, "room_a", "room_c")
    end

    test "finds direct path" do
      graph = %{
        "room_a" => %{"north" => "room_b"},
        "room_b" => %{"south" => "room_a"}
      }

      assert {:ok, ["north"]} = QuestStrategy.find_path(graph, "room_a", "room_b")
    end

    test "finds multi-step path" do
      graph = %{
        "room_a" => %{"north" => "room_b"},
        "room_b" => %{"south" => "room_a", "east" => "room_c"},
        "room_c" => %{"west" => "room_b"}
      }

      assert {:ok, ["north", "east"]} = QuestStrategy.find_path(graph, "room_a", "room_c")
    end

    test "returns error for nil source" do
      assert {:error, :no_path} = QuestStrategy.find_path(%{}, nil, "room_a")
    end

    test "returns error for nil destination" do
      assert {:error, :no_path} = QuestStrategy.find_path(%{}, "room_a", nil)
    end
  end

  describe "find_best_dialogue_choice/2" do
    test "finds accept_quest choice" do
      choices = [
        %{text: "Hello", action: nil},
        %{text: "Accept", action: ["accept_quest", "intro_welcome"]},
        %{text: "Goodbye", action: nil}
      ]

      assert 1 =
               QuestStrategy.find_best_dialogue_choice(choices, {:accept_quest, "intro_welcome"})
    end

    test "finds complete_quest choice" do
      choices = [
        %{text: "More info", action: nil},
        %{text: "Complete", action: ["complete_quest", "intro_welcome"]}
      ]

      assert 1 =
               QuestStrategy.find_best_dialogue_choice(
                 choices,
                 {:complete_quest, "intro_welcome"}
               )
    end

    test "returns nil when choice not found" do
      choices = [
        %{text: "Hello", action: nil},
        %{text: "Goodbye", action: nil}
      ]

      assert nil ==
               QuestStrategy.find_best_dialogue_choice(choices, {:accept_quest, "intro_welcome"})
    end

    test "returns 0 for nil goal" do
      choices = [%{text: "Hello"}]
      assert 0 = QuestStrategy.find_best_dialogue_choice(choices, nil)
    end
  end

  describe "get_quest_order/1" do
    test "returns error for non-existent storyline" do
      assert {:error, :not_found} = QuestStrategy.get_quest_order("nonexistent_storyline")
    end

    # Note: Testing with real storyline requires storylines to be loaded
    # This would be an integration test
  end

  describe "successful?/1" do
    test "returns true for completed state with no failures" do
      state = %{phase: :complete, failure_reason: nil}
      assert QuestStrategy.successful?(state)
    end

    test "returns false for incomplete state" do
      state = %{phase: :init, failure_reason: nil}
      refute QuestStrategy.successful?(state)
    end

    test "returns false for failed state" do
      state = %{phase: :failed, failure_reason: :stuck}
      refute QuestStrategy.successful?(state)
    end
  end
end
