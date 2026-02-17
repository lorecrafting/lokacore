defmodule Loka.Engine.StateMachinePropertyTest do
  use ExUnit.Case, async: true
  use ExUnitProperties

  alias Loka.Engine.StateMachine

  @quest_machine StateMachine.new(%{
                   initial: "available",
                   transitions: %{
                     "available" => ["accepted"],
                     "accepted" => ["in_progress", "abandoned"],
                     "in_progress" => ["objectives_complete", "abandoned", "failed"],
                     "objectives_complete" => ["turned_in", "abandoned"],
                     "abandoned" => ["accepted"],
                     "failed" => ["accepted"],
                     "turned_in" => []
                   }
                 })

  describe "transition properties" do
    property "valid transitions always succeed" do
      # Generate random valid from→to pairs from the machine
      transitions = @quest_machine.transitions

      valid_pairs =
        Enum.flat_map(transitions, fn {from, tos} ->
          Enum.map(tos, fn to -> {from, to} end)
        end)

      check all({from, to} <- member_of(valid_pairs)) do
        assert {:ok, ^to} = StateMachine.transition(@quest_machine, from, to)
      end
    end

    property "invalid transitions always fail" do
      all_states = MapSet.to_list(@quest_machine.states)

      check all(
              from <- member_of(all_states),
              to <- member_of(all_states)
            ) do
        valid_targets = StateMachine.available_transitions(@quest_machine, from)

        if to in valid_targets do
          assert {:ok, _} = StateMachine.transition(@quest_machine, from, to)
        else
          assert {:error, {:invalid_transition, ^from, ^to}} =
                   StateMachine.transition(@quest_machine, from, to)
        end
      end
    end

    property "terminal states have no outbound transitions" do
      all_states = MapSet.to_list(@quest_machine.states)

      check all(state <- member_of(all_states)) do
        transitions = StateMachine.available_transitions(@quest_machine, state)

        if StateMachine.terminal?(@quest_machine, state) do
          assert transitions == []
        else
          assert transitions != []
        end
      end
    end

    property "transition_with_callbacks includes callbacks when defined" do
      machine =
        StateMachine.new(%{
          initial: "a",
          transitions: %{"a" => ["b"], "b" => ["c"], "c" => []},
          on_enter: %{"b" => :entered_b},
          on_exit: %{"b" => :exited_b}
        })

      assert {:ok, "b", callbacks} = StateMachine.transition_with_callbacks(machine, "a", "b")
      assert {:enter, :entered_b} in callbacks

      assert {:ok, "c", callbacks} = StateMachine.transition_with_callbacks(machine, "b", "c")
      assert {:exit, :exited_b} in callbacks
    end
  end

  describe "can_transition? consistency" do
    property "can_transition? agrees with transition" do
      all_states = MapSet.to_list(@quest_machine.states)

      check all(
              from <- member_of(all_states),
              to <- member_of(all_states)
            ) do
        can? = StateMachine.can_transition?(@quest_machine, from, to)
        result = StateMachine.transition(@quest_machine, from, to)

        if can? do
          assert {:ok, _} = result
        else
          assert {:error, _} = result
        end
      end
    end
  end
end
