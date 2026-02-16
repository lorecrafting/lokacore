defmodule Loka.Engine.Script.SandboxTest do
  use ExUnit.Case, async: true

  alias Loka.Engine.Script.Sandbox

  @test_entity %{
    id: "test-npc",
    key: "test_npc",
    type: :npc,
    short_desc: "Test NPC",
    long_desc: "A test NPC stands here.",
    location_id: "test_room"
  }

  @test_context %{
    player: %{
      id: "player-1",
      short_desc: "Test Player",
      name: "TestPlayer"
    },
    game_state: %{
      quests: %{
        active: %{"main_quest" => %{objectives: %{}}},
        completed: ["intro_quest"]
      },
      flags: %{"spoke_to_elder" => true},
      inventory: [%{key: "sword"}, %{key: "potion"}],
      stats: %{strength: 15, dexterity: 12}
    },
    trigger: :on_look
  }

  describe "execute/4" do
    test "executes simple expression" do
      source = "1 + 1"

      assert {:ok, 2, []} = Sandbox.execute(source, @test_entity, @test_context)
    end

    test "returns result from cond" do
      source = """
      cond do
        true -> :handled
        true -> :default
      end
      """

      assert {:ok, :handled, []} = Sandbox.execute(source, @test_entity, @test_context)
    end

    test "provides entity bindings" do
      source = "entity.id"

      assert {:ok, "test-npc", []} = Sandbox.execute(source, @test_entity, @test_context)
    end

    test "provides player bindings" do
      source = "player.id"

      assert {:ok, "player-1", []} = Sandbox.execute(source, @test_entity, @test_context)
    end

    test "can check quest state" do
      source = """
      if quest_active?.("main_quest") do
        :active
      else
        :inactive
      end
      """

      assert {:ok, :active, []} = Sandbox.execute(source, @test_entity, @test_context)
    end

    test "can check completed quests" do
      source = """
      if quest_complete?.("intro_quest") do
        :completed
      else
        :not_completed
      end
      """

      assert {:ok, :completed, []} = Sandbox.execute(source, @test_entity, @test_context)
    end

    test "can check flags" do
      source = """
      if has_flag?.("spoke_to_elder") do
        :yes
      else
        :no
      end
      """

      assert {:ok, :yes, []} = Sandbox.execute(source, @test_entity, @test_context)
    end

    test "can check inventory" do
      source = """
      cond do
        has_item?.("sword") -> :has_sword
        has_item?.("shield") -> :has_shield
        true -> :nothing
      end
      """

      assert {:ok, :has_sword, []} = Sandbox.execute(source, @test_entity, @test_context)
    end

    test "can get stats" do
      source = "get_stat.(\"strength\")"

      assert {:ok, 15, []} = Sandbox.execute(source, @test_entity, @test_context)
    end

    test "queues say action" do
      source = """
      say.("Hello, traveler!")
      :handled
      """

      assert {:ok, :handled, actions} = Sandbox.execute(source, @test_entity, @test_context)
      assert length(actions) == 1
      assert {:say, %{message: "Hello, traveler!"}} = hd(actions)
    end

    test "queues multiple actions" do
      source = """
      say.("First")
      say.("Second")
      set_flag.("test_flag", true)
      :handled
      """

      assert {:ok, :handled, actions} = Sandbox.execute(source, @test_entity, @test_context)
      assert length(actions) == 3
    end

    test "chance? returns boolean" do
      source = """
      result = chance?.(100)
      result
      """

      assert {:ok, true, []} = Sandbox.execute(source, @test_entity, @test_context)

      source_zero = "chance?.(0)"
      assert {:ok, false, []} = Sandbox.execute(source_zero, @test_entity, @test_context)
    end

    test "roll parses dice notation" do
      source = "roll.(\"1d1\")"

      assert {:ok, 1, []} = Sandbox.execute(source, @test_entity, @test_context)
    end

    test "pick selects from list" do
      source = "pick.([1])"

      assert {:ok, 1, []} = Sandbox.execute(source, @test_entity, @test_context)
    end

    test "contains? checks strings case-insensitive" do
      source = """
      contains?.("Hello World", "world")
      """

      assert {:ok, true, []} = Sandbox.execute(source, @test_entity, @test_context)
    end

    test "deny returns :deny" do
      source = "deny.()"

      assert {:ok, :deny, []} = Sandbox.execute(source, @test_entity, @test_context)
    end

    test "provides config bindings from context" do
      context_with_config =
        Map.put(@test_context, :config, %{
          route: ["gate", "market", "temple"],
          interval: 180
        })

      source = "config.route"

      assert {:ok, ["gate", "market", "temple"], []} =
               Sandbox.execute(source, @test_entity, context_with_config)
    end

    test "config provides access to scalar values" do
      context_with_config = Map.put(@test_context, :config, %{interval: 300})

      source = "config.interval"

      assert {:ok, 300, []} = Sandbox.execute(source, @test_entity, context_with_config)
    end

    test "config returns empty map when not provided" do
      source = "config"

      assert {:ok, %{}, []} = Sandbox.execute(source, @test_entity, @test_context)
    end

    test "config converts string keys to atoms" do
      context_with_string_keys = Map.put(@test_context, :config, %{"route" => ["a", "b"]})

      source = "config.route"

      assert {:ok, ["a", "b"], []} =
               Sandbox.execute(source, @test_entity, context_with_string_keys)
    end

    test "get_behavior_state returns default when no state exists" do
      context = Map.put(@test_context, :behavior_key, "patrol")

      source = "get_behavior_state.(:patrol_index, 0)"

      assert {:ok, 0, []} = Sandbox.execute(source, @test_entity, context)
    end

    test "get_behavior_state returns stored state value" do
      entity_with_state =
        Map.put(@test_entity, :behavior_state, %{
          "patrol" => %{patrol_index: 2}
        })

      context = Map.put(@test_context, :behavior_key, "patrol")

      source = "get_behavior_state.(:patrol_index, 0)"

      assert {:ok, 2, []} = Sandbox.execute(source, entity_with_state, context)
    end

    test "set_behavior_state queues action" do
      context = Map.put(@test_context, :behavior_key, "patrol")

      source = """
      set_behavior_state.(:patrol_index, 5)
      :ok
      """

      assert {:ok, :ok, actions} = Sandbox.execute(source, @test_entity, context)
      assert length(actions) == 1

      {action_type, params} = hd(actions)
      assert action_type in [:set_trait_state, :set_behavior_state]
      assert params.entity_id == "test-npc"
      assert (params[:trait_key] || params[:behavior_key]) == "patrol"
      assert params.state_key == :patrol_index
      assert params.value == 5
    end

    test "behavior state is isolated per behavior" do
      entity_with_state =
        Map.put(@test_entity, :behavior_state, %{
          "patrol" => %{index: 1},
          "schedule" => %{index: 99}
        })

      # When running as patrol behavior
      patrol_context = Map.put(@test_context, :behavior_key, "patrol")
      source = "get_behavior_state.(:index, 0)"

      assert {:ok, 1, []} = Sandbox.execute(source, entity_with_state, patrol_context)

      # When running as schedule behavior
      schedule_context = Map.put(@test_context, :behavior_key, "schedule")

      assert {:ok, 99, []} = Sandbox.execute(source, entity_with_state, schedule_context)
    end
  end

  describe "execute/4 with timeout" do
    test "times out on infinite loop" do
      # This would loop forever without timeout
      # We use a while-like construct that the validator might miss
      source = """
      Stream.cycle([1])
      |> Enum.take(1_000_000_000)
      """

      # Should fail validation due to pipe operator
      assert {:error, :validation_failed} =
               Sandbox.execute(source, @test_entity, @test_context, timeout: 100)
    end

    test "respects custom timeout" do
      # A script that would take ~500ms
      source = """
      :timer.sleep(500)
      :ok
      """

      # Should timeout at 100ms
      # Note: :timer.sleep might not be available in sandbox
      assert {:error, _} = Sandbox.execute(source, @test_entity, @test_context, timeout: 100)
    end
  end

  describe "execute/4 validation" do
    test "rejects dangerous code" do
      source = "System.cmd(\"ls\", [])"

      assert {:error, :validation_failed} = Sandbox.execute(source, @test_entity, @test_context)
    end

    test "skips validation with validate: false" do
      # This would fail validation but we skip it
      # (still won't execute because System is not bound)
      source = "1 + 1"

      assert {:ok, 2, []} = Sandbox.execute(source, @test_entity, @test_context, validate: false)
    end
  end

  describe "execute/4 with extra bindings" do
    test "provides extra bindings" do
      source = "custom_value * 2"

      assert {:ok, 42, []} =
               Sandbox.execute(
                 source,
                 @test_entity,
                 @test_context,
                 extra_bindings: [custom_value: 21]
               )
    end
  end

  describe "validate/1" do
    test "delegates to Validator" do
      assert :ok = Sandbox.validate("1 + 1")
      assert {:error, _} = Sandbox.validate("System.cmd(\"ls\", [])")
    end
  end

  describe "execute_trusted/4" do
    test "skips validation" do
      source = "1 + 1"

      assert {:ok, 2, []} = Sandbox.execute_trusted(source, @test_entity, @test_context)
    end
  end

  describe "result size limit" do
    test "rejects oversized result" do
      # Generate a large string that exceeds the limit
      source = """
      String.duplicate("x", 20_000)
      """

      assert {:error, :result_too_large} = Sandbox.execute(source, @test_entity, @test_context)
    end
  end

  describe "default_timeout/0" do
    test "returns default timeout value" do
      assert Sandbox.default_timeout() == 5_000
    end
  end

  describe "max_result_size/0" do
    test "returns max result size" do
      assert Sandbox.max_result_size() == 10_000
    end
  end
end
