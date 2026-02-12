defmodule Loka.Engine.EventBusTest do
  use ExUnit.Case, async: true

  alias Loka.Engine.Event
  alias Loka.Engine.EventBus

  # Use a unique PubSub for each test to avoid cross-test interference
  defp test_pubsub, do: :"test_pubsub_#{:erlang.unique_integer()}"

  setup do
    pubsub = test_pubsub()
    start_supervised!({Phoenix.PubSub, name: pubsub})
    {:ok, pubsub: pubsub}
  end

  describe "subscribe/2 and emit/2" do
    test "subscriber receives events on global topic", %{pubsub: pubsub} do
      EventBus.subscribe("events:global", pubsub: pubsub)

      event = Event.new(:say, %{payload: %{text: "Hello"}})
      EventBus.emit(event, pubsub: pubsub)

      assert_receive {:event, received_event}
      assert received_event.type == :say
      assert received_event.payload == %{text: "Hello"}
    end

    test "subscriber receives events on type-specific topic", %{pubsub: pubsub} do
      EventBus.subscribe("events:attack", pubsub: pubsub)

      event = Event.new(:attack, %{payload: %{damage: 10}})
      EventBus.emit(event, pubsub: pubsub)

      assert_receive {:event, received_event}
      assert received_event.type == :attack
      assert received_event.payload == %{damage: 10}
    end

    test "subscriber receives events on room topic", %{pubsub: pubsub} do
      EventBus.subscribe("location:lobby", pubsub: pubsub)

      event = Event.new(:say, %{location: "lobby", payload: %{text: "Hello"}})
      EventBus.emit(event, pubsub: pubsub)

      assert_receive {:event, received_event}
      assert received_event.location == "lobby"
    end

    test "subscriber receives events on entity topic", %{pubsub: pubsub} do
      EventBus.subscribe("entity:player_123", pubsub: pubsub)

      event = Event.new(:damage, %{target: "player_123", payload: %{amount: 5}})
      EventBus.emit(event, pubsub: pubsub)

      assert_receive {:event, received_event}
      assert received_event.target == "player_123"
    end

    test "subscriber does not receive events from unsubscribed topics", %{pubsub: pubsub} do
      EventBus.subscribe("location:lobby", pubsub: pubsub)

      # Event in a different room
      event = Event.new(:say, %{location: "tavern", payload: %{text: "Hello"}})
      EventBus.emit(event, pubsub: pubsub)

      refute_receive {:event, _}, 100
    end
  end

  describe "unsubscribe/2" do
    test "unsubscribed process no longer receives events", %{pubsub: pubsub} do
      EventBus.subscribe("events:global", pubsub: pubsub)

      # Verify subscription works
      event1 = Event.new(:say, %{payload: %{text: "First"}})
      EventBus.emit(event1, pubsub: pubsub)
      assert_receive {:event, _}

      # Unsubscribe
      EventBus.unsubscribe("events:global", pubsub: pubsub)

      # Should not receive after unsubscribe
      event2 = Event.new(:say, %{payload: %{text: "Second"}})
      EventBus.emit(event2, pubsub: pubsub)
      refute_receive {:event, _}, 100
    end
  end

  describe "emit/2 with cancelled events" do
    test "cancelled events are not broadcast", %{pubsub: pubsub} do
      EventBus.subscribe("events:global", pubsub: pubsub)

      event =
        Event.new(:attack, %{cancellable?: true})
        |> Event.cancel()

      EventBus.emit(event, pubsub: pubsub)

      refute_receive {:event, _}, 100
    end

    test "non-cancelled cancellable events are broadcast", %{pubsub: pubsub} do
      EventBus.subscribe("events:global", pubsub: pubsub)

      event = Event.new(:attack, %{cancellable?: true})
      EventBus.emit(event, pubsub: pubsub)

      assert_receive {:event, received_event}
      assert received_event.type == :attack
    end
  end

  describe "build_topics/1" do
    test "includes global and type topics for minimal event" do
      event = Event.new(:say)

      topics = EventBus.build_topics(event)

      assert "events:global" in topics
      assert "events:say" in topics
    end

    test "includes room topic when location is set" do
      event = Event.new(:say, %{location: "room_123"})

      topics = EventBus.build_topics(event)

      assert "events:global" in topics
      assert "events:say" in topics
      assert "location:room_123" in topics
    end

    test "includes entity topic when target is set" do
      event = Event.new(:damage, %{target: "npc_456"})

      topics = EventBus.build_topics(event)

      assert "events:global" in topics
      assert "events:damage" in topics
      assert "entity:npc_456" in topics
    end

    test "includes all topics when location and target are set" do
      event = Event.new(:attack, %{location: "room_1", target: "npc_2"})

      topics = EventBus.build_topics(event)

      assert "events:global" in topics
      assert "events:attack" in topics
      assert "location:room_1" in topics
      assert "entity:npc_2" in topics
    end

    test "does not include room topic when location is nil" do
      event = Event.new(:say, %{location: nil})

      topics = EventBus.build_topics(event)

      refute Enum.any?(topics, &String.starts_with?(&1, "location:"))
    end

    test "does not include entity topic when target is nil" do
      event = Event.new(:say, %{target: nil})

      topics = EventBus.build_topics(event)

      refute Enum.any?(topics, &String.starts_with?(&1, "entity:"))
    end
  end

  describe "broadcast/3" do
    test "broadcasts to specific topic", %{pubsub: pubsub} do
      EventBus.subscribe("custom:topic", pubsub: pubsub)

      event = Event.new_unchecked(:custom_event)
      EventBus.broadcast("custom:topic", event, pubsub)

      assert_receive {:event, received_event}
      assert received_event.type == :custom_event
    end
  end

  describe "multiple subscribers" do
    test "all subscribers to same topic receive event", %{pubsub: pubsub} do
      # Create multiple test processes that subscribe
      parent = self()

      pids =
        for i <- 1..3 do
          spawn(fn ->
            EventBus.subscribe("events:global", pubsub: pubsub)
            send(parent, {:subscribed, i})

            receive do
              {:event, event} -> send(parent, {:received, i, event.type})
            end
          end)
        end

      # Wait for all subscriptions
      for i <- 1..3, do: assert_receive({:subscribed, ^i})

      # Emit event
      event = Event.new_unchecked(:test_event)
      EventBus.emit(event, pubsub: pubsub)

      # All should receive
      for i <- 1..3 do
        assert_receive {:received, ^i, :test_event}
      end

      # Cleanup
      Enum.each(pids, &Process.exit(&1, :normal))
    end
  end
end
