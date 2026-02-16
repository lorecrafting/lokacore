defmodule Loka.Engine.BehaviorTest do
  use ExUnit.Case, async: true

  alias Loka.Engine.{Behavior, Entity, Event}

  # Test behavior module that tracks events
  defmodule TestBehavior do
    @behaviour Loka.Engine.Behavior

    @impl true
    def handle_event(entity, %Event{type: :test_event} = _event, _context) do
      updated = Map.update(entity, :test_count, 1, &(&1 + 1))
      {:ok, updated}
    end

    def handle_event(entity, _event, _context) do
      {:ok, entity}
    end
  end

  # Behavior that can filter events with can_handle?
  defmodule FilteringBehavior do
    @behaviour Loka.Engine.Behavior

    @impl true
    def can_handle?(_entity, :allowed_event), do: true
    def can_handle?(_entity, _other), do: false

    @impl true
    def handle_event(entity, _event, _context) do
      updated = Map.put(entity, :filtering_handled, true)
      {:ok, updated}
    end
  end

  # Behavior that returns additional events
  defmodule EventEmittingBehavior do
    @behaviour Loka.Engine.Behavior

    @impl true
    def handle_event(entity, %Event{type: :trigger_emit}, _context) do
      emitted_event = Event.new_unchecked(:emitted_event, %{payload: %{source: "behavior"}})
      {:ok, entity, [emitted_event]}
    end

    def handle_event(entity, _event, _context) do
      {:ok, entity}
    end
  end

  # Behavior that returns an error
  defmodule ErrorBehavior do
    @behaviour Loka.Engine.Behavior

    @impl true
    def handle_event(_entity, %Event{type: :error_event}, _context) do
      {:error, :behavior_failed}
    end

    def handle_event(entity, _event, _context) do
      {:ok, entity}
    end
  end

  defp test_entity(traits \\ []) do
    %Entity{
      id: "test_entity_#{:erlang.unique_integer()}",
      type: :npc,
      traits: traits
    }
  end

  describe "process_event/3" do
    test "processes event through single behavior" do
      entity = test_entity([TestBehavior])
      event = Event.new_unchecked(:test_event)

      assert {:ok, updated, []} = Behavior.process_event(entity, event)
      assert updated.test_count == 1
    end

    test "processes event through multiple behaviors" do
      entity = test_entity([TestBehavior, EventEmittingBehavior])
      event = Event.new_unchecked(:trigger_emit)

      assert {:ok, _updated, emitted_events} = Behavior.process_event(entity, event)
      assert length(emitted_events) == 1
      assert hd(emitted_events).type == :emitted_event
    end

    test "accumulates multiple handler calls" do
      entity = test_entity([TestBehavior])
      event = Event.new_unchecked(:test_event)

      {:ok, entity1, _} = Behavior.process_event(entity, event)
      {:ok, entity2, _} = Behavior.process_event(entity1, event)
      {:ok, entity3, _} = Behavior.process_event(entity2, event)

      assert entity3.test_count == 3
    end

    test "respects can_handle? filtering" do
      entity = test_entity([FilteringBehavior])

      # Allowed event should be processed
      allowed_event = Event.new_unchecked(:allowed_event)
      {:ok, updated, _} = Behavior.process_event(entity, allowed_event)
      assert updated.filtering_handled == true

      # Disallowed event should not set the flag
      disallowed_event = Event.new_unchecked(:disallowed_event)
      {:ok, untouched, _} = Behavior.process_event(entity, disallowed_event)
      refute Map.has_key?(untouched, :filtering_handled)
    end

    test "halts on error and returns error tuple" do
      entity = test_entity([ErrorBehavior])
      event = Event.new_unchecked(:error_event)

      assert {:error, :behavior_failed} = Behavior.process_event(entity, event)
    end

    test "returns empty events list when no events emitted" do
      entity = test_entity([TestBehavior])
      event = Event.new_unchecked(:test_event)

      {:ok, _updated, events} = Behavior.process_event(entity, event)
      assert events == []
    end

    test "accumulates events from multiple behaviors" do
      entity = test_entity([EventEmittingBehavior, EventEmittingBehavior])
      event = Event.new_unchecked(:trigger_emit)

      {:ok, _updated, events} = Behavior.process_event(entity, event)
      assert length(events) == 2
    end

    test "handles entity with no behaviors" do
      entity = test_entity([])
      event = Event.new_unchecked(:any_event)

      assert {:ok, ^entity, []} = Behavior.process_event(entity, event)
    end

    test "passes context to behaviors" do
      # Test that context is available by using a behavior that checks it
      defmodule ContextCheckBehavior do
        @behaviour Loka.Engine.Behavior

        @impl true
        def handle_event(entity, _event, context) do
          if context[:test_key] == "test_value" do
            {:ok, Map.put(entity, :context_received, true)}
          else
            {:ok, entity}
          end
        end
      end

      entity = test_entity([ContextCheckBehavior])
      event = Event.new_unchecked(:any_event)
      context = %{test_key: "test_value"}

      {:ok, updated, _} = Behavior.process_event(entity, event, context)
      assert updated.context_received == true
    end
  end

  describe "behavior callbacks" do
    test "can_handle? is optional" do
      # TestBehavior doesn't implement can_handle? - should default to handling all
      entity = test_entity([TestBehavior])
      event = Event.new_unchecked(:any_event_type)

      # Should not raise and should return ok
      assert {:ok, _, _} = Behavior.process_event(entity, event)
    end
  end
end
