defmodule Loka.Engine.Script.ActionQueueTest do
  use ExUnit.Case, async: true

  alias Loka.Engine.Script.ActionQueue

  setup do
    ActionQueue.init()
    on_exit(fn -> ActionQueue.clear() end)
    :ok
  end

  describe "init/0 and clear/0" do
    test "initializes empty queue" do
      ActionQueue.clear()
      ActionQueue.init()
      assert ActionQueue.get() == []
    end

    test "clears the queue" do
      ActionQueue.queue({:say, %{entity: %{id: "1"}, message: "hi"}})
      assert length(ActionQueue.get()) == 1

      ActionQueue.clear()
      ActionQueue.init()
      assert ActionQueue.get() == []
    end
  end

  describe "queue/1" do
    test "queues a say action" do
      entity = %{id: "npc_1", short_desc: "Guard"}
      assert :ok = ActionQueue.queue({:say, %{entity: entity, message: "Halt!"}})

      actions = ActionQueue.get()
      assert length(actions) == 1
      assert {:say, %{entity: ^entity, message: "Halt!"}} = hd(actions)
    end

    test "queues multiple actions in order" do
      ActionQueue.queue({:say, %{entity: %{id: "1"}, message: "First"}})
      ActionQueue.queue({:say, %{entity: %{id: "1"}, message: "Second"}})
      ActionQueue.queue({:say, %{entity: %{id: "1"}, message: "Third"}})

      actions = ActionQueue.get()
      assert length(actions) == 3

      messages = Enum.map(actions, fn {:say, %{message: msg}} -> msg end)
      assert messages == ["First", "Second", "Third"]
    end

    test "queues spawn action" do
      assert :ok =
               ActionQueue.queue(
                 {:spawn_entity,
                  %{
                    prototype_key: "goblin",
                    room_id: "room_1",
                    attrs: %{mood: "aggressive"}
                  }}
               )

      [{:spawn_entity, params}] = ActionQueue.get()
      assert params.prototype_key == "goblin"
      assert params.room_id == "room_1"
    end

    test "queues damage action" do
      assert :ok =
               ActionQueue.queue(
                 {:damage,
                  %{
                    target_id: "player_1",
                    amount: 10,
                    type: :fire
                  }}
               )

      [{:damage, params}] = ActionQueue.get()
      assert params.amount == 10
      assert params.type == :fire
    end
  end

  describe "rate limiting" do
    test "enforces spawn limit" do
      # Queue up to the limit
      for i <- 1..10 do
        assert :ok =
                 ActionQueue.queue(
                   {:spawn_entity,
                    %{
                      prototype_key: "mob_#{i}",
                      room_id: "room_1"
                    }}
                 )
      end

      # Next one should fail
      assert {:error, :rate_limited} =
               ActionQueue.queue(
                 {:spawn_entity,
                  %{
                    prototype_key: "mob_11",
                    room_id: "room_1"
                  }}
               )
    end

    test "enforces message limit" do
      for i <- 1..50 do
        assert :ok = ActionQueue.queue({:say, %{entity: %{id: "1"}, message: "msg_#{i}"}})
      end

      assert {:error, :rate_limited} =
               ActionQueue.queue(
                 {:say,
                  %{
                    entity: %{id: "1"},
                    message: "too many"
                  }}
               )
    end

    test "enforces teleport limit" do
      for i <- 1..5 do
        assert :ok = ActionQueue.queue({:teleport, %{entity_id: "e_#{i}", room_id: "r_1"}})
      end

      assert {:error, :rate_limited} =
               ActionQueue.queue(
                 {:teleport,
                  %{
                    entity_id: "e_6",
                    room_id: "r_1"
                  }}
               )
    end

    test "tracks damage total" do
      # Total damage limit is 1000
      for _ <- 1..100 do
        assert :ok = ActionQueue.queue({:damage, %{target_id: "t1", amount: 9}})
      end

      # 900 total, should still work
      assert :ok = ActionQueue.queue({:damage, %{target_id: "t1", amount: 99}})

      # Now at 999, one more should exceed
      assert {:error, :rate_limited} =
               ActionQueue.queue({:damage, %{target_id: "t1", amount: 10}})
    end
  end

  describe "check_limit/1" do
    test "returns :ok for allowed action" do
      assert :ok = ActionQueue.check_limit({:say, %{}})
    end

    test "returns error when limit reached" do
      for i <- 1..10 do
        ActionQueue.queue({:spawn_entity, %{prototype_key: "m#{i}", room_id: "r1"}})
      end

      assert {:error, :rate_limited} = ActionQueue.check_limit({:spawn_entity, %{}})
    end
  end

  describe "get_counts/0" do
    test "tracks action counts by category" do
      ActionQueue.queue({:say, %{entity: %{id: "1"}, message: "hi"}})
      ActionQueue.queue({:say, %{entity: %{id: "1"}, message: "bye"}})
      ActionQueue.queue({:spawn_entity, %{prototype_key: "mob", room_id: "r1"}})

      counts = ActionQueue.get_counts()
      assert counts.messages == 2
      assert counts.spawns == 1
    end
  end

  describe "limits/0" do
    test "returns the limits map" do
      limits = ActionQueue.limits()
      assert is_map(limits)
      assert limits.spawns == 10
      assert limits.messages == 50
      assert limits.damage_total == 1000
    end
  end

  describe "schedule action" do
    test "queues a schedule action with entity_id" do
      action =
        {:schedule,
         %{
           delay: 60,
           script_key: "patrol_script",
           entity_id: "npc_guard_1",
           context: %{route: ["a", "b", "c"]}
         }}

      assert :ok = ActionQueue.queue(action)

      [{:schedule, params}] = ActionQueue.get()
      assert params.delay == 60
      assert params.script_key == "patrol_script"
      assert params.entity_id == "npc_guard_1"
      assert params.context.route == ["a", "b", "c"]
    end

    test "enforces schedule limit" do
      for i <- 1..5 do
        assert :ok =
                 ActionQueue.queue(
                   {:schedule,
                    %{
                      delay: 60,
                      script_key: "script_#{i}",
                      entity_id: "entity_1",
                      context: %{}
                    }}
                 )
      end

      # Next one should fail
      assert {:error, :rate_limited} =
               ActionQueue.queue(
                 {:schedule,
                  %{
                    delay: 60,
                    script_key: "script_6",
                    entity_id: "entity_1",
                    context: %{}
                  }}
               )
    end
  end
end
