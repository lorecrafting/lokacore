defmodule Loka.Engine.Script.ExecutorTest do
  use Loka.DataCase, async: false

  alias Loka.Engine.Script.Executor
  alias Loka.Engine.Entities

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

  # Helper to create a script entity in the DB (V2 pattern)
  defp create_script(key, hook, source) do
    {:ok, _entity} =
      Entities.create_entity(%{
        type: "script",
        key: key,
        is_prototype: true,
        components: %{"data" => %{"hook" => hook, "source" => source}}
      })
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
      create_script("test_npc_look_script", "on_look", "say.(\"Looking good!\")\n:handled")

      assert {:ok, :handled} = Executor.run_hook(:on_look, @test_entity, @test_context)
    end

    test "runs script by convention key" do
      create_script("test_npc_on_enter", "on_enter", ":allow")

      entity = %{id: "e1", key: "test_npc", type: :npc}

      assert {:ok, :allow} = Executor.run_hook(:on_enter, entity, @test_context)
    end
  end

  describe "run_by_key/4" do
    test "runs script by explicit key" do
      create_script("my_custom_script", "custom", "{:append, \"Custom text\"}")

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
      create_script("default_script", "on_look", ":default")

      assert {:ok, :default} = Executor.run_by_key("default_script", @test_entity, @test_context)
    end

    test "normalizes :handled" do
      create_script("handled_script", "on_look", ":handled")

      assert {:ok, :handled} = Executor.run_by_key("handled_script", @test_entity, @test_context)
    end

    test "normalizes :deny" do
      create_script("deny_script", "on_enter", ":deny")

      assert {:ok, :deny} = Executor.run_by_key("deny_script", @test_entity, @test_context)
    end

    test "normalizes {:deny, reason}" do
      create_script("deny_reason_script", "on_enter", "{:deny, \"Too low level\"}")

      assert {:ok, {:deny, "Too low level"}} =
               Executor.run_by_key(
                 "deny_reason_script",
                 @test_entity,
                 @test_context
               )
    end

    test "normalizes {:append, text}" do
      create_script("append_script", "on_look", "{:append, \"Extra description\"}")

      assert {:ok, {:append, "Extra description"}} =
               Executor.run_by_key(
                 "append_script",
                 @test_entity,
                 @test_context
               )
    end

    test "normalizes {:replace, text}" do
      create_script("replace_script", "on_look", "{:replace, \"Completely new description\"}")

      assert {:ok, {:replace, "Completely new description"}} =
               Executor.run_by_key(
                 "replace_script",
                 @test_entity,
                 @test_context
               )
    end

    test "normalizes true to :allow" do
      create_script("true_script", "on_enter", "true")

      assert {:ok, :allow} = Executor.run_by_key("true_script", @test_entity, @test_context)
    end

    test "normalizes false to :deny" do
      create_script("false_script", "on_enter", "false")

      assert {:ok, :deny} = Executor.run_by_key("false_script", @test_entity, @test_context)
    end

    test "normalizes nil to :default" do
      create_script("nil_script", "on_look", "nil")

      assert {:ok, :default} = Executor.run_by_key("nil_script", @test_entity, @test_context)
    end

    test "normalizes unknown to :continue" do
      create_script("unknown_script", "on_look", "42")

      assert {:ok, :continue} = Executor.run_by_key("unknown_script", @test_entity, @test_context)
    end
  end

  describe "complex scripts" do
    test "runs conditional script based on quest state" do
      context = put_in(@test_context, [:game_state, :quests, :active], %{"main_quest" => %{}})

      create_script("quest_check_script", "on_look", """
      if quest_active?.("main_quest") do
        {:append, "The elder watches you with interest."}
      else
        :default
      end
      """)

      assert {:ok, {:append, "The elder watches you with interest."}} =
               Executor.run_by_key(
                 "quest_check_script",
                 @test_entity,
                 context
               )
    end

    test "runs script with multiple actions" do
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
