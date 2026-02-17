defmodule Loka.Testing.Quest.StateMachineTest do
  @moduledoc """
  Auto-generated quest state machine tests (Tier 2).

  For each quest definition, validates that the quest state machine
  handles standard lifecycle scenarios correctly:

  1. Accept quest (available → accepted)
  2. Double-accept rejected (accepted → accepted is invalid)
  3. Abandon quest (in_progress → abandoned)
  4. Re-accept after abandon (abandoned → accepted)
  5. Fail and re-accept (failed → accepted)
  6. Complete happy path (available → accepted → in_progress → objectives_complete → turned_in)
  7. Turn-in while incomplete rejected (in_progress → turned_in is invalid)
  8. Idempotent progress (transitioning to same state fails)
  9. Prerequisites checked (requires_quest field exists and is valid)
  10. Valid objectives (at least one objective defined)
  """

  use Loka.DataCase, async: false

  alias Loka.Engine.StateMachine
  alias Loka.Components.QuestProgress
  alias Loka.Content.Quest

  @machine QuestProgress.machine()

  describe "state machine core transitions" do
    test "accept from available" do
      assert {:ok, "accepted"} = StateMachine.transition(@machine, "available", "accepted")
    end

    test "double-accept rejected" do
      assert {:error, {:invalid_transition, "accepted", "accepted"}} =
               StateMachine.transition(@machine, "accepted", "accepted")
    end

    test "abandon from in_progress" do
      assert {:ok, "abandoned"} = StateMachine.transition(@machine, "in_progress", "abandoned")
    end

    test "re-accept after abandon" do
      assert {:ok, "accepted"} = StateMachine.transition(@machine, "abandoned", "accepted")
    end

    test "fail and re-accept" do
      assert {:ok, "failed"} = StateMachine.transition(@machine, "in_progress", "failed")
      assert {:ok, "accepted"} = StateMachine.transition(@machine, "failed", "accepted")
    end

    test "complete happy path" do
      assert {:ok, "accepted"} = StateMachine.transition(@machine, "available", "accepted")
      assert {:ok, "in_progress"} = StateMachine.transition(@machine, "accepted", "in_progress")

      assert {:ok, "objectives_complete"} =
               StateMachine.transition(@machine, "in_progress", "objectives_complete")

      assert {:ok, "turned_in"} =
               StateMachine.transition(@machine, "objectives_complete", "turned_in")
    end

    test "turn-in while incomplete rejected" do
      assert {:error, {:invalid_transition, "in_progress", "turned_in"}} =
               StateMachine.transition(@machine, "in_progress", "turned_in")
    end

    test "cannot skip from available to in_progress" do
      assert {:error, {:invalid_transition, "available", "in_progress"}} =
               StateMachine.transition(@machine, "available", "in_progress")
    end

    test "turned_in is terminal" do
      assert StateMachine.terminal?(@machine, "turned_in")
    end
  end

  describe "per-quest validation" do
    setup do
      Loka.Engine.EntitySeeder.seed()
      :ok
    end

    test "all quests have valid definitions" do
      definitions = Quest.all_definitions()
      assert definitions != [], "Expected at least one quest definition"

      for quest_def <- definitions do
        assert quest_def.id, "Quest missing id"
      end
    end

    test "all quests have at least one objective" do
      definitions = Quest.all_definitions()

      for quest_def <- definitions do
        objectives = quest_def.objectives || []

        assert objectives != [],
               "Quest '#{quest_def.id}' has no objectives"
      end
    end

    test "all quest prerequisites reference existing quests" do
      definitions = Quest.all_definitions()
      all_quest_ids = MapSet.new(Enum.map(definitions, & &1.id))

      for quest_def <- definitions, quest_def.requires_quest do
        prereq = quest_def.requires_quest

        assert MapSet.member?(all_quest_ids, prereq),
               "Quest '#{quest_def.id}' requires '#{prereq}' which does not exist"
      end
    end

    test "quest objectives have valid types" do
      valid_types = ~w(kill talk go_to get_item craft)a
      definitions = Quest.all_definitions()

      for quest_def <- definitions, obj <- quest_def.objectives || [] do
        assert obj.type in valid_types,
               "Quest '#{quest_def.id}' objective '#{obj.id}' has invalid type: #{inspect(obj.type)}"
      end
    end

    test "quest objectives have unique IDs within each quest" do
      definitions = Quest.all_definitions()

      for quest_def <- definitions do
        objectives = quest_def.objectives || []
        ids = Enum.map(objectives, & &1.id) |> Enum.reject(&is_nil/1)
        unique_ids = Enum.uniq(ids)

        assert length(ids) == length(unique_ids),
               "Quest '#{quest_def.id}' has duplicate objective IDs: #{inspect(ids -- unique_ids)}"
      end
    end

    test "quest state transitions are valid for each quest lifecycle" do
      definitions = Quest.all_definitions()

      for quest_def <- definitions do
        # Every quest should support the full happy path
        assert {:ok, "accepted"} = StateMachine.transition(@machine, "available", "accepted"),
               "Quest '#{quest_def.id}': available → accepted should be valid"

        assert {:ok, "in_progress"} = StateMachine.transition(@machine, "accepted", "in_progress"),
               "Quest '#{quest_def.id}': accepted → in_progress should be valid"

        assert {:ok, "objectives_complete"} =
                 StateMachine.transition(@machine, "in_progress", "objectives_complete"),
               "Quest '#{quest_def.id}': in_progress → objectives_complete should be valid"

        assert {:ok, "turned_in"} =
                 StateMachine.transition(@machine, "objectives_complete", "turned_in"),
               "Quest '#{quest_def.id}': objectives_complete → turned_in should be valid"
      end
    end

    test "no circular prerequisite chains" do
      definitions = Quest.all_definitions()
      prereq_map = Map.new(definitions, fn d -> {d.id, d.requires_quest} end)

      for quest_def <- definitions, quest_def.requires_quest do
        visited = detect_prereq_cycle(quest_def.id, prereq_map, MapSet.new())

        refute visited == :cycle,
               "Quest '#{quest_def.id}' has a circular prerequisite chain"
      end
    end
  end

  # Helpers

  defp detect_prereq_cycle(quest_id, prereq_map, visited) do
    if MapSet.member?(visited, quest_id) do
      :cycle
    else
      case Map.get(prereq_map, quest_id) do
        nil -> :ok
        "" -> :ok
        prereq -> detect_prereq_cycle(prereq, prereq_map, MapSet.put(visited, quest_id))
      end
    end
  end
end
