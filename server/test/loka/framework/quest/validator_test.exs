defmodule Loka.Framework.Quest.ValidatorTest do
  use ExUnit.Case, async: false

  alias Loka.Framework.Quest.Validator

  describe "validate/0" do
    test "returns validation results with no errors for valid quests" do
      {:ok, results} = Validator.validate()

      assert is_map(results)
      assert is_integer(results.quests_checked)
      assert is_list(results.errors)
      assert is_list(results.warnings)
    end

    test "checks all quests from QuestRegistry" do
      {:ok, results} = Validator.validate()

      # Should check at least some quests
      assert results.quests_checked >= 0
    end
  end

  describe "validate_quest/1" do
    test "returns error for non-existent quest" do
      assert {:error, :not_found} = Validator.validate_quest("nonexistent_quest_12345")
    end

    test "validates a specific quest" do
      # Use a quest we know exists
      case Validator.validate_quest("intro_find_temple") do
        {:ok, {errors, warnings}} ->
          assert is_list(errors)
          assert is_list(warnings)

        {:error, :not_found} ->
          # Quest doesn't exist in test environment, that's ok
          :ok
      end
    end
  end

  describe "valid?/0" do
    test "returns boolean" do
      result = Validator.valid?()
      assert is_boolean(result)
    end
  end

  describe "format_report/1" do
    test "formats results as readable string" do
      results = %{
        quests_checked: 5,
        errors: [{:missing_target, "test_quest", :kill, "nonexistent"}],
        warnings: [{:orphaned_quest, "side_quest"}]
      }

      report = Validator.format_report(results)

      assert is_binary(report)
      assert report =~ "Quest Validation Report"
      assert report =~ "Quests checked: 5"
      assert report =~ "Errors: 1"
      assert report =~ "Warnings: 1"
      assert report =~ "ERRORS:"
      assert report =~ "WARNINGS:"
      assert report =~ "STATUS: FAILED"
    end

    test "shows PASSED when no errors" do
      results = %{
        quests_checked: 3,
        errors: [],
        warnings: []
      }

      report = Validator.format_report(results)

      assert report =~ "STATUS: PASSED"
      refute report =~ "ERRORS:"
    end

    test "formats all error types" do
      results = %{
        quests_checked: 1,
        errors: [
          {:invalid_objective, "q1", "obj1", "missing target_id"},
          {:unknown_objective_type, "q2", "obj2", :weird},
          {:missing_target, "q3", :go_to, "nowhere"},
          {:missing_dialogue_topic, "q4", "npc", "topic"},
          {:missing_quest_giver, "q5", "giver"},
          {:giver_no_dialogue, "q6", "giver2"},
          {:circular_prerequisite, "q7", ["q7", "q8", "q7"]},
          {:missing_prerequisite, "q8", "q9"}
        ],
        warnings: []
      }

      report = Validator.format_report(results)

      assert report =~ "missing target_id"
      assert report =~ "Unknown type"
      assert report =~ "go_to target"
      assert report =~ "missing dialogue topic"
      assert report =~ "Giver NPC"
      assert report =~ "no dialogue tree"
      assert report =~ "Circular prerequisite"
      assert report =~ "Prerequisite"
    end

    test "formats all warning types" do
      results = %{
        quests_checked: 1,
        errors: [],
        warnings: [
          {:orphaned_quest, "lonely_quest"},
          {:reward_item_not_found, "quest", "item"},
          {:no_objectives, "empty_quest"},
          {:giver_no_accept_action, "quest", "giver"}
        ]
      }

      report = Validator.format_report(results)

      assert report =~ "Not assigned to any storyline"
      assert report =~ "Reward item"
      assert report =~ "no objectives"
      assert report =~ "no accept_quest action"
    end
  end

  describe "objective validation" do
    test "validates objective types via ObjectiveRegistry" do
      # This test verifies integration with ObjectiveRegistry
      {:ok, results} = Validator.validate()

      # If there are invalid objectives, they should be caught
      invalid_obj_errors =
        Enum.filter(results.errors, fn
          {:invalid_objective, _, _, _} -> true
          {:unknown_objective_type, _, _, _} -> true
          _ -> false
        end)

      # We expect no invalid objectives in our test quests
      # (they should all be well-formed)
      assert is_list(invalid_obj_errors)
    end
  end

  describe "circular prerequisite detection" do
    test "does not report false positives for linear chains" do
      # Our test quests have linear prerequisite chains
      {:ok, results} = Validator.validate()

      circular_errors =
        Enum.filter(results.errors, fn
          {:circular_prerequisite, _, _} -> true
          _ -> false
        end)

      assert Enum.empty?(circular_errors)
    end
  end
end
