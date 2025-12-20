defmodule Exmud.Engine.EventTest do
  use ExUnit.Case, async: true

  alias Exmud.Engine.Event

  describe "new/2" do
    test "creates a new event with a UUID and timestamp" do
      event = Event.new(:say, %{payload: %{text: "Hello"}})

      assert event.id != nil
      assert event.type == :say
      assert event.payload == %{text: "Hello"}
      assert event.timestamp != nil
      assert event.cancelled? == false
    end
  end

  describe "cancel/1" do
    test "cancels a cancellable event" do
      event = Event.new(:attack, %{cancellable?: true})

      cancelled = Event.cancel(event)

      assert cancelled.cancelled? == true
    end

    test "does not cancel non-cancellable event" do
      event = Event.new(:attack, %{cancellable?: false})

      unchanged = Event.cancel(event)

      assert unchanged.cancelled? == false
    end
  end

  describe "cancelled?/1" do
    test "returns true for cancelled events" do
      event =
        Event.new(:attack, %{cancellable?: true})
        |> Event.cancel()

      assert Event.cancelled?(event)
    end

    test "returns false for non-cancelled events" do
      event = Event.new(:attack)

      refute Event.cancelled?(event)
    end
  end
end
