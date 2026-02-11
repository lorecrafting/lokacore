defmodule Loka.Engine.Script.SignalTest do
  use ExUnit.Case, async: true

  alias Loka.Engine.Script.ActionQueue
  alias Loka.Engine.Event

  setup do
    ActionQueue.init()
    on_exit(fn -> ActionQueue.clear() end)
    :ok
  end

  describe "signal action queuing" do
    test "queues a signal action" do
      action =
        {:signal,
         %{
           source_id: "pressure_plate_1",
           target_id: "iron_door_1",
           signal_name: "activate",
           data: %{triggered_by: "player_1"}
         }}

      assert :ok = ActionQueue.queue(action)

      [{:signal, params}] = ActionQueue.get()
      assert params.source_id == "pressure_plate_1"
      assert params.target_id == "iron_door_1"
      assert params.signal_name == "activate"
      assert params.data == %{triggered_by: "player_1"}
    end

    test "queues signal with empty data" do
      action =
        {:signal,
         %{
           source_id: "lever_1",
           target_id: "gate_1",
           signal_name: "toggle",
           data: %{}
         }}

      assert :ok = ActionQueue.queue(action)

      [{:signal, params}] = ActionQueue.get()
      assert params.data == %{}
    end

    test "queues multiple signals in order" do
      for i <- 1..3 do
        ActionQueue.queue(
          {:signal,
           %{
             source_id: "src",
             target_id: "target_#{i}",
             signal_name: "ping",
             data: %{}
           }}
        )
      end

      actions = ActionQueue.get()
      assert length(actions) == 3

      targets = Enum.map(actions, fn {:signal, %{target_id: tid}} -> tid end)
      assert targets == ["target_1", "target_2", "target_3"]
    end
  end

  describe "signal rate limiting" do
    test "enforces signal limit of 10" do
      for i <- 1..10 do
        assert :ok =
                 ActionQueue.queue(
                   {:signal,
                    %{
                      source_id: "src",
                      target_id: "target_#{i}",
                      signal_name: "ping",
                      data: %{}
                    }}
                 )
      end

      # 11th should be rate limited
      assert {:error, :rate_limited} =
               ActionQueue.queue(
                 {:signal,
                  %{
                    source_id: "src",
                    target_id: "target_11",
                    signal_name: "ping",
                    data: %{}
                  }}
               )
    end

    test "signal category appears in counts" do
      ActionQueue.queue(
        {:signal, %{source_id: "src", target_id: "tgt", signal_name: "test", data: %{}}}
      )

      counts = ActionQueue.get_counts()
      assert counts.signals == 1
    end
  end

  describe "signal Event creation" do
    test "signal event type is valid" do
      assert Event.valid_type?(:signal)
    end

    test "creates signal event with correct fields" do
      event =
        Event.new(:signal, %{
          source: "plate_1",
          target: "door_1",
          payload: %{signal_name: "activate", data: %{force: true}}
        })

      assert event.type == :signal
      assert event.source == "plate_1"
      assert event.target == "door_1"
      assert event.payload.signal_name == "activate"
      assert event.payload.data == %{force: true}
    end

    test "signal payload validates against schema" do
      event =
        Event.new(:signal, %{
          payload: %{signal_name: "activate"}
        })

      assert :ok = Event.validate_payload(event)
    end

    test "signal payload requires signal_name" do
      event =
        Event.new(:signal, %{
          payload: %{data: %{}}
        })

      assert {:error, errors} = Event.validate_payload(event)
      assert "missing required field: signal_name" in errors
    end
  end

  describe "signal limits config" do
    test "limits include signals" do
      limits = ActionQueue.limits()
      assert limits.signals == 10
    end
  end
end
