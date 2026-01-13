defmodule Loka.Behaviors.RunnerTest do
  use ExUnit.Case, async: true

  alias Loka.Behaviors.Runner
  alias Loka.Engine.{Entity, Event}

  # Test behavior that passes through
  defmodule PassBehavior do
    use Loka.Behaviors.Base

    @impl true
    def supported_types, do: [:npc]

    @impl true
    def handle_event(_entity, _event, state) do
      {:ok, Map.update(state, :pass_count, 1, &(&1 + 1))}
    end
  end

  # Test behavior that handles events
  defmodule HandleBehavior do
    use Loka.Behaviors.Base

    @impl true
    def supported_types, do: [:npc]

    @impl true
    def handle_event(_entity, %Event{type: :special}, state) do
      {:handled, state}
    end

    def handle_event(_entity, _event, state) do
      {:ok, state}
    end
  end

  # Test behavior that emits events
  defmodule EmitBehavior do
    use Loka.Behaviors.Base

    @impl true
    def supported_types, do: [:npc]

    @impl true
    def handle_event(_entity, _event, state) do
      new_event = Event.new_unchecked(:emitted_event, %{payload: %{from: "emit_behavior"}})
      {:ok, state, [new_event]}
    end
  end

  # Test behavior that halts
  defmodule HaltBehavior do
    use Loka.Behaviors.Base

    @impl true
    def supported_types, do: [:npc]

    @impl true
    def handle_event(_entity, %Event{type: :blocked}, _state) do
      {:halt, "Action blocked by behavior"}
    end

    def handle_event(_entity, _event, state) do
      {:ok, state}
    end
  end

  describe "process_event/2" do
    test "returns {:ok, []} for entity with no behaviors" do
      entity = %Entity{id: "test", type: :npc, key: "test", behaviors: nil}
      event = Event.new(:tick, %{})

      assert {:ok, []} = Runner.process_event(entity, event)
    end

    test "returns {:ok, []} for entity with empty behaviors list" do
      entity = %Entity{id: "test", type: :npc, key: "test", behaviors: []}
      event = Event.new(:tick, %{})

      assert {:ok, []} = Runner.process_event(entity, event)
    end

    test "processes event through single behavior" do
      entity = %Entity{
        id: "test",
        type: :npc,
        key: "test",
        behaviors: [PassBehavior]
      }

      event = Event.new(:tick, %{})

      assert {:ok, []} = Runner.process_event(entity, event)
    end

    test "stops processing when behavior returns :handled" do
      entity = %Entity{
        id: "test",
        type: :npc,
        key: "test",
        behaviors: [HandleBehavior, PassBehavior]
      }

      event = Event.new_unchecked(:special, %{})

      assert {:handled, []} = Runner.process_event(entity, event)
    end

    test "collects events from behaviors" do
      entity = %Entity{
        id: "test",
        type: :npc,
        key: "test",
        behaviors: [EmitBehavior]
      }

      event = Event.new(:tick, %{})

      assert {:ok, events} = Runner.process_event(entity, event)
      assert length(events) == 1
      assert hd(events).type == :emitted_event
    end

    test "returns :halt when behavior blocks action" do
      entity = %Entity{
        id: "test",
        type: :npc,
        key: "test",
        behaviors: [HaltBehavior]
      }

      event = Event.new_unchecked(:blocked, %{})

      assert {:halt, "Action blocked by behavior"} = Runner.process_event(entity, event)
    end

    test "processes multiple behaviors in order" do
      entity = %Entity{
        id: "test",
        type: :npc,
        key: "test",
        behaviors: [EmitBehavior, EmitBehavior]
      }

      event = Event.new(:tick, %{})

      assert {:ok, events} = Runner.process_event(entity, event)
      # Each EmitBehavior adds one event
      assert length(events) == 2
    end
  end

  describe "init_behaviors/1" do
    test "initializes behaviors with init callback" do
      entity = %Entity{
        id: "test",
        type: :npc,
        key: "test",
        behaviors: [PassBehavior],
        attributes: %{}
      }

      updated = Runner.init_behaviors(entity)

      # Should have behavior state saved
      state = Runner.get_behavior_state(updated, PassBehavior)
      assert is_map(state)
    end

    test "handles entity with no behaviors" do
      entity = %Entity{id: "test", type: :npc, key: "test", behaviors: nil}

      # Should not crash
      assert %Entity{} = Runner.init_behaviors(entity)
    end
  end

  describe "get_behavior_state/2" do
    test "returns empty map for missing state" do
      entity = %Entity{id: "test", type: :npc, key: "test", attributes: %{}}

      assert Runner.get_behavior_state(entity, PassBehavior) == %{}
    end

    test "returns stored state" do
      entity = %Entity{
        id: "test",
        type: :npc,
        key: "test",
        attributes: %{
          "behavior_state:pass_behavior" => %{counter: 5}
        }
      }

      state = Runner.get_behavior_state(entity, PassBehavior)
      assert state[:counter] == 5
    end
  end

  describe "save_behavior_state/3" do
    test "saves state to entity attributes" do
      entity = %Entity{id: "test", type: :npc, key: "test", attributes: %{}}

      updated = Runner.save_behavior_state(entity, PassBehavior, %{counter: 10})

      assert updated.attributes["behavior_state:pass_behavior"] == %{counter: 10}
    end
  end
end
