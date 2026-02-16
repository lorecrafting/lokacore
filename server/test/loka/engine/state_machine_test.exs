defmodule Loka.Engine.StateMachineTest do
  use ExUnit.Case, async: true

  alias Loka.Engine.StateMachine

  @quest_machine StateMachine.new(%{
                   initial: "available",
                   transitions: %{
                     "available" => ["accepted"],
                     "accepted" => ["in_progress", "abandoned"],
                     "in_progress" => ["objectives_complete", "abandoned", "failed"],
                     "objectives_complete" => ["turned_in", "abandoned"],
                     "abandoned" => ["accepted"],
                     "failed" => ["accepted"]
                   },
                   on_enter: %{
                     "accepted" => :start_objective_timers,
                     "turned_in" => :apply_rewards,
                     "failed" => :cleanup_quest_items
                   },
                   on_exit: %{
                     "in_progress" => :on_leave_in_progress
                   }
                 })

  describe "new/1" do
    test "creates machine with initial state" do
      machine =
        StateMachine.new(%{
          initial: "idle",
          transitions: %{"idle" => ["active"], "active" => ["idle"]}
        })

      assert machine.initial == "idle"
    end

    test "defaults initial to first key when not specified" do
      machine =
        StateMachine.new(%{
          transitions: %{"foo" => ["bar"], "bar" => []}
        })

      assert machine.initial in ["foo", "bar"]
    end

    test "collects all states from transitions" do
      states = StateMachine.states(@quest_machine)
      assert MapSet.member?(states, "available")
      assert MapSet.member?(states, "accepted")
      assert MapSet.member?(states, "turned_in")
      assert MapSet.member?(states, "failed")
      assert MapSet.member?(states, "objectives_complete")
    end

    test "defaults on_enter and on_exit to empty maps" do
      machine =
        StateMachine.new(%{
          initial: "idle",
          transitions: %{"idle" => ["active"]}
        })

      assert machine.on_enter == %{}
      assert machine.on_exit == %{}
    end
  end

  describe "transition/3" do
    test "valid transition succeeds" do
      assert {:ok, "accepted"} = StateMachine.transition(@quest_machine, "available", "accepted")
    end

    test "valid multi-target transition succeeds" do
      assert {:ok, "in_progress"} =
               StateMachine.transition(@quest_machine, "accepted", "in_progress")

      assert {:ok, "abandoned"} = StateMachine.transition(@quest_machine, "accepted", "abandoned")
    end

    test "invalid transition returns error" do
      assert {:error, {:invalid_transition, "available", "turned_in"}} =
               StateMachine.transition(@quest_machine, "available", "turned_in")
    end

    test "transition from unknown state returns error" do
      assert {:error, {:invalid_transition, "nonexistent", "accepted"}} =
               StateMachine.transition(@quest_machine, "nonexistent", "accepted")
    end

    test "re-accept after abandon" do
      assert {:ok, "accepted"} = StateMachine.transition(@quest_machine, "abandoned", "accepted")
    end

    test "re-accept after failure" do
      assert {:ok, "accepted"} = StateMachine.transition(@quest_machine, "failed", "accepted")
    end
  end

  describe "can_transition?/3" do
    test "returns true for valid transitions" do
      assert StateMachine.can_transition?(@quest_machine, "available", "accepted")
      assert StateMachine.can_transition?(@quest_machine, "in_progress", "failed")
    end

    test "returns false for invalid transitions" do
      refute StateMachine.can_transition?(@quest_machine, "available", "turned_in")
      refute StateMachine.can_transition?(@quest_machine, "failed", "turned_in")
    end
  end

  describe "available_transitions/2" do
    test "returns valid targets" do
      assert StateMachine.available_transitions(@quest_machine, "accepted") == [
               "in_progress",
               "abandoned"
             ]
    end

    test "returns empty for terminal states" do
      machine =
        StateMachine.new(%{
          initial: "loading",
          transitions: %{
            "loading" => ["alive"],
            "alive" => ["saved"],
            "saved" => []
          }
        })

      assert StateMachine.available_transitions(machine, "saved") == []
    end

    test "returns empty for unknown states" do
      assert StateMachine.available_transitions(@quest_machine, "nonexistent") == []
    end
  end

  describe "terminal?/2" do
    test "returns true for states with no outgoing transitions" do
      machine =
        StateMachine.new(%{
          initial: "loading",
          transitions: %{
            "loading" => ["alive"],
            "alive" => ["saved"],
            "saved" => []
          }
        })

      assert StateMachine.terminal?(machine, "saved")
      refute StateMachine.terminal?(machine, "alive")
    end

    test "turned_in is terminal in quest machine" do
      assert StateMachine.terminal?(@quest_machine, "turned_in")
      refute StateMachine.terminal?(@quest_machine, "abandoned")
    end
  end

  describe "states/1" do
    test "returns all defined states" do
      states = StateMachine.states(@quest_machine)
      assert MapSet.size(states) == 7

      for state <-
            ~w(available accepted in_progress objectives_complete turned_in abandoned failed) do
        assert MapSet.member?(states, state), "Expected #{state} in states"
      end
    end
  end

  describe "transition_with_callbacks/3" do
    test "returns callbacks on valid transition" do
      assert {:ok, "accepted", callbacks} =
               StateMachine.transition_with_callbacks(@quest_machine, "available", "accepted")

      assert callbacks == [enter: :start_objective_timers]
    end

    test "returns both exit and enter callbacks" do
      assert {:ok, "failed", callbacks} =
               StateMachine.transition_with_callbacks(@quest_machine, "in_progress", "failed")

      assert callbacks == [exit: :on_leave_in_progress, enter: :cleanup_quest_items]
    end

    test "returns empty callbacks when none defined" do
      assert {:ok, "in_progress", callbacks} =
               StateMachine.transition_with_callbacks(@quest_machine, "accepted", "in_progress")

      # on_enter not defined for in_progress, no on_exit for accepted
      assert callbacks == []
    end

    test "returns error for invalid transition" do
      assert {:error, {:invalid_transition, "available", "failed"}} =
               StateMachine.transition_with_callbacks(@quest_machine, "available", "failed")
    end

    test "exit callback fires before enter callback" do
      assert {:ok, "objectives_complete", callbacks} =
               StateMachine.transition_with_callbacks(
                 @quest_machine,
                 "in_progress",
                 "objectives_complete"
               )

      # Only exit callback (on_leave_in_progress), no enter for objectives_complete
      assert callbacks == [exit: :on_leave_in_progress]
    end
  end
end
