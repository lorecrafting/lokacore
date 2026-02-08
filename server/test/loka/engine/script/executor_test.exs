defmodule Loka.Engine.Script.ExecutorTest do
  use Loka.DataCase, async: false

  alias Loka.Engine.Script.Executor
  alias Loka.Engine.TypedObject.Registry
  alias Loka.Engine.TypedObject

  @test_entity %{
    id: "test-npc",
    key: "test_npc",
    type: :npc,
    short_desc: "Test NPC",
    long_desc: "A test NPC.",
    location_id: "test_room",
    builder_scripts: %{
      "on_look" => "test_npc_look_script"
    }
  }

  @test_context %{
    player: %{
      id: "player-1",
      short_desc: "Test Player"
    },
    game_state: %{
      quests: %{active: %{}, completed: []},
      flags: %{},
      inventory: []
    },
    trigger: :on_look
  }

  setup do
    Loka.TypedObjectSandbox.checkout()
    :ok
  end

  describe "execute_source/4" do
    test "executes script source directly" do
      source = """
      cond do
        true -> :handled
      end
      """

      assert {:ok, :handled, []} = Executor.execute_source(source, @test_entity, @test_context)
    end

    test "returns queued actions" do
      source = """
      say.("Hello!")
      :handled
      """

      assert {:ok, :handled, actions} =
               Executor.execute_source(source, @test_entity, @test_context)

      assert length(actions) >= 1
    end

    test "handles script errors gracefully" do
      source = "undefined_variable"

      assert {:error, {:exception, _}} =
               Executor.execute_source(source, @test_entity, @test_context)
    end
  end

  describe "test_script/3" do
    test "executes script in test mode" do
      source = """
      say.("Test message")
      :handled
      """

      assert {:ok, :handled, actions} = Executor.test_script(source, @test_entity, @test_context)
      assert length(actions) >= 1
    end

    test "works with empty entity and context" do
      source = ":ok"

      assert {:ok, :ok, []} = Executor.test_script(source)
    end
  end

  describe "run_hook/4" do
    test "returns :no_script when entity has no script" do
      entity = %{id: "no-script", key: "no_script"}

      assert :no_script = Executor.run_hook(:on_look, entity, @test_context)
    end

    test "runs script when registered in TypedObject" do
      # Create a script TypedObject
      {:ok, script} =
        TypedObject.new(
          key: "test_npc_look_script",
          type: :script,
          data: %{
            "hook" => "on_look",
            "source" => "say.(\"Looking good!\")\n:handled"
          }
        )

      Registry.put("test_npc_look_script", script)

      assert {:ok, :handled} = Executor.run_hook(:on_look, @test_entity, @test_context)
    end

    test "runs script by convention key" do
      # Create a script using convention: {entity_key}_{hook}
      {:ok, script} =
        TypedObject.new(
          key: "test_npc_on_enter",
          type: :script,
          data: %{
            "hook" => "on_enter",
            "source" => ":allow"
          }
        )

      Registry.put("test_npc_on_enter", script)

      entity = %{id: "e1", key: "test_npc", type: :npc}

      assert {:ok, :allow} = Executor.run_hook(:on_enter, entity, @test_context)
    end
  end

  describe "run_by_key/4" do
    test "runs script by explicit key" do
      {:ok, script} =
        TypedObject.new(
          key: "my_custom_script",
          type: :script,
          data: %{
            "hook" => "custom",
            "source" => "{:append, \"Custom text\"}"
          }
        )

      Registry.put("my_custom_script", script)

      assert {:ok, {:append, "Custom text"}} =
               Executor.run_by_key(
                 "my_custom_script",
                 @test_entity,
                 @test_context
               )
    end

    test "returns error for missing script" do
      assert {:error, :script_not_found} =
               Executor.run_by_key(
                 "nonexistent_script",
                 @test_entity,
                 @test_context
               )
    end
  end

  describe "result normalization" do
    test "normalizes :default" do
      {:ok, script} =
        TypedObject.new(
          key: "default_script",
          type: :script,
          data: %{"hook" => "on_look", "source" => ":default"}
        )

      Registry.put("default_script", script)

      assert {:ok, :default} = Executor.run_by_key("default_script", @test_entity, @test_context)
    end

    test "normalizes :handled" do
      {:ok, script} =
        TypedObject.new(
          key: "handled_script",
          type: :script,
          data: %{"hook" => "on_look", "source" => ":handled"}
        )

      Registry.put("handled_script", script)

      assert {:ok, :handled} = Executor.run_by_key("handled_script", @test_entity, @test_context)
    end

    test "normalizes :deny" do
      {:ok, script} =
        TypedObject.new(
          key: "deny_script",
          type: :script,
          data: %{"hook" => "on_enter", "source" => ":deny"}
        )

      Registry.put("deny_script", script)

      assert {:ok, :deny} = Executor.run_by_key("deny_script", @test_entity, @test_context)
    end

    test "normalizes {:deny, reason}" do
      {:ok, script} =
        TypedObject.new(
          key: "deny_reason_script",
          type: :script,
          data: %{"hook" => "on_enter", "source" => "{:deny, \"Too low level\"}"}
        )

      Registry.put("deny_reason_script", script)

      assert {:ok, {:deny, "Too low level"}} =
               Executor.run_by_key(
                 "deny_reason_script",
                 @test_entity,
                 @test_context
               )
    end

    test "normalizes {:append, text}" do
      {:ok, script} =
        TypedObject.new(
          key: "append_script",
          type: :script,
          data: %{"hook" => "on_look", "source" => "{:append, \"Extra description\"}"}
        )

      Registry.put("append_script", script)

      assert {:ok, {:append, "Extra description"}} =
               Executor.run_by_key(
                 "append_script",
                 @test_entity,
                 @test_context
               )
    end

    test "normalizes {:replace, text}" do
      {:ok, script} =
        TypedObject.new(
          key: "replace_script",
          type: :script,
          data: %{"hook" => "on_look", "source" => "{:replace, \"Completely new description\"}"}
        )

      Registry.put("replace_script", script)

      assert {:ok, {:replace, "Completely new description"}} =
               Executor.run_by_key(
                 "replace_script",
                 @test_entity,
                 @test_context
               )
    end

    test "normalizes true to :allow" do
      {:ok, script} =
        TypedObject.new(
          key: "true_script",
          type: :script,
          data: %{"hook" => "on_enter", "source" => "true"}
        )

      Registry.put("true_script", script)

      assert {:ok, :allow} = Executor.run_by_key("true_script", @test_entity, @test_context)
    end

    test "normalizes false to :deny" do
      {:ok, script} =
        TypedObject.new(
          key: "false_script",
          type: :script,
          data: %{"hook" => "on_enter", "source" => "false"}
        )

      Registry.put("false_script", script)

      assert {:ok, :deny} = Executor.run_by_key("false_script", @test_entity, @test_context)
    end

    test "normalizes nil to :default" do
      {:ok, script} =
        TypedObject.new(
          key: "nil_script",
          type: :script,
          data: %{"hook" => "on_look", "source" => "nil"}
        )

      Registry.put("nil_script", script)

      assert {:ok, :default} = Executor.run_by_key("nil_script", @test_entity, @test_context)
    end

    test "normalizes unknown to :continue" do
      {:ok, script} =
        TypedObject.new(
          key: "unknown_script",
          type: :script,
          data: %{"hook" => "on_look", "source" => "42"}
        )

      Registry.put("unknown_script", script)

      assert {:ok, :continue} = Executor.run_by_key("unknown_script", @test_entity, @test_context)
    end
  end

  describe "complex scripts" do
    test "runs conditional script based on quest state" do
      context = put_in(@test_context, [:game_state, :quests, :active], %{"main_quest" => %{}})

      {:ok, script} =
        TypedObject.new(
          key: "quest_check_script",
          type: :script,
          data: %{
            "hook" => "on_look",
            "source" => """
            if quest_active?.("main_quest") do
              {:append, "The elder watches you with interest."}
            else
              :default
            end
            """
          }
        )

      Registry.put("quest_check_script", script)

      assert {:ok, {:append, "The elder watches you with interest."}} =
               Executor.run_by_key(
                 "quest_check_script",
                 @test_entity,
                 context
               )
    end

    test "runs script with multiple actions" do
      # Run in test mode to capture actions without executing them
      {:ok, :handled, actions} =
        Executor.execute_source(
          """
          say.("Greetings, traveler!")
          set_flag.("spoke_to_npc", true)
          :handled
          """,
          @test_entity,
          Map.put(@test_context, :test_mode, true)
        )

      assert length(actions) >= 2
    end
  end
end
