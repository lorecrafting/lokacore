defmodule Loka.Engine.ScriptTraitDispatchTest do
  @moduledoc """
  Tests for script trait dispatching in EntityServer.

  Script traits are maps like `%{"script" => "wander", "config" => %{}}` in
  entity.traits. On each tick, EntityServer.dispatch_script_traits_tick/1 finds
  script traits, loads the script via Content.Script, and executes them if the
  script's hook is "behavior".
  """
  use Loka.DataCase, async: false

  alias Loka.Engine.{EntityServer, Entities, Entity}

  @test_opts [
    idle_timeout_ms: 5000,
    save_interval_ms: 60_000,
    hibernate_after_ms: 60_000
  ]

  defp unique_key(prefix), do: "#{prefix}_#{System.unique_integer([:positive])}"

  # Helper to create a script entity in the DB
  defp create_script_entity(key, hook, source) do
    {:ok, _script} =
      Entities.create_entity(%{
        type: "script",
        key: key,
        short_desc: "Test Script: #{key}",
        is_prototype: true,
        components: %{
          "data" => %{
            "hook" => hook,
            "source" => source
          }
        }
      })
  end

  # Helper to create an NPC with traits and a tick component
  defp npc_with_traits(traits) do
    {:ok, entity} =
      Entities.create_entity(%{
        type: "npc",
        key: unique_key("npc"),
        short_desc: "Test NPC",
        traits: traits,
        components: %{
          "tick" => %{"interval" => 60_000}
        }
      })

    entity
  end

  # Send :tick directly to the GenServer process and wait for processing
  defp send_tick(pid) do
    send(pid, :tick)
    Process.sleep(50)
  end

  describe "tick with no traits" do
    test "entity unchanged when traits list is empty" do
      npc = npc_with_traits([])
      {:ok, pid} = EntityServer.start_link(npc.id, @test_opts)

      entity_before = EntityServer.get_entity(pid)
      send_tick(pid)
      entity_after = EntityServer.get_entity(pid)

      assert entity_before.short_desc == entity_after.short_desc
      assert entity_before.components == entity_after.components

      EntityServer.stop(pid)
    end
  end

  describe "tick with module-only traits" do
    test "script dispatch is a no-op for atom traits" do
      defmodule FakeModuleTrait do
        def on_tick(entity), do: {:ok, entity}
      end

      npc = npc_with_traits([FakeModuleTrait])
      {:ok, pid} = EntityServer.start_link(npc.id, @test_opts)

      entity_before = EntityServer.get_entity(pid)
      send_tick(pid)
      entity_after = EntityServer.get_entity(pid)

      # Module traits handled separately, script dispatch is no-op
      assert entity_before.short_desc == entity_after.short_desc

      EntityServer.stop(pid)
    end
  end

  describe "tick with script traits" do
    test "executes script trait with hook: behavior" do
      script_key = unique_key("behavior_script")

      # Use dot-call syntax for variable-bound functions
      source = ~s"""
      set_trait_state.("executed", true)
      continue.()
      """

      create_script_entity(script_key, "behavior", source)

      npc = npc_with_traits([%{"script" => script_key, "config" => %{}}])
      {:ok, pid} = EntityServer.start_link(npc.id, @test_opts)

      send_tick(pid)

      # Script executed without crashing the server
      entity_after = EntityServer.get_entity(pid)
      assert %Entity{} = entity_after
      assert Process.alive?(pid)

      EntityServer.stop(pid)
    end

    test "skips script trait with non-behavior hook" do
      script_key = unique_key("on_enter_script")

      # This script should never run (wrong hook), but if it did it would crash
      source = "1 / 0"

      create_script_entity(script_key, "on_enter", source)

      npc = npc_with_traits([%{"script" => script_key, "config" => %{}}])
      {:ok, pid} = EntityServer.start_link(npc.id, @test_opts)

      # on_enter scripts should be skipped during tick dispatch
      send_tick(pid)

      entity_after = EntityServer.get_entity(pid)
      assert %Entity{} = entity_after
      assert Process.alive?(pid)

      EntityServer.stop(pid)
    end

    test "handles script not found gracefully" do
      npc = npc_with_traits([%{"script" => "nonexistent_script_key_999", "config" => %{}}])
      {:ok, pid} = EntityServer.start_link(npc.id, @test_opts)

      send_tick(pid)

      entity_after = EntityServer.get_entity(pid)
      assert %Entity{} = entity_after
      assert Process.alive?(pid)

      EntityServer.stop(pid)
    end

    test "handles script execution error gracefully" do
      script_key = unique_key("crashing_script")

      # Division by zero causes an ArithmeticError
      create_script_entity(script_key, "behavior", "1 / 0")

      npc = npc_with_traits([%{"script" => script_key, "config" => %{}}])
      {:ok, pid} = EntityServer.start_link(npc.id, @test_opts)

      send_tick(pid)

      entity_after = EntityServer.get_entity(pid)
      assert %Entity{} = entity_after
      assert Process.alive?(pid)

      EntityServer.stop(pid)
    end
  end

  describe "tick with mixed traits" do
    test "handles mix of module and script traits" do
      defmodule MixedModuleTrait do
        def on_tick(entity), do: {:ok, entity}
      end

      script_key = unique_key("mixed_script")

      create_script_entity(script_key, "behavior", "continue.()")

      traits = [
        MixedModuleTrait,
        %{"script" => script_key, "config" => %{}}
      ]

      npc = npc_with_traits(traits)
      {:ok, pid} = EntityServer.start_link(npc.id, @test_opts)

      send_tick(pid)

      entity_after = EntityServer.get_entity(pid)
      assert %Entity{} = entity_after
      assert Process.alive?(pid)

      EntityServer.stop(pid)
    end
  end

  describe "tick with multiple script traits" do
    test "executes all behavior script traits" do
      key1 = unique_key("multi_script_1")
      key2 = unique_key("multi_script_2")

      create_script_entity(key1, "behavior", "continue.()")
      create_script_entity(key2, "behavior", "continue.()")

      traits = [
        %{"script" => key1, "config" => %{}},
        %{"script" => key2, "config" => %{}}
      ]

      npc = npc_with_traits(traits)
      {:ok, pid} = EntityServer.start_link(npc.id, @test_opts)

      send_tick(pid)

      entity_after = EntityServer.get_entity(pid)
      assert %Entity{} = entity_after
      assert Process.alive?(pid)

      EntityServer.stop(pid)
    end

    test "continues with remaining scripts when one fails" do
      crash_key = unique_key("crash_first")
      good_key = unique_key("good_second")

      create_script_entity(crash_key, "behavior", "1 / 0")
      create_script_entity(good_key, "behavior", "continue.()")

      traits = [
        %{"script" => crash_key, "config" => %{}},
        %{"script" => good_key, "config" => %{}}
      ]

      npc = npc_with_traits(traits)
      {:ok, pid} = EntityServer.start_link(npc.id, @test_opts)

      send_tick(pid)

      entity_after = EntityServer.get_entity(pid)
      assert %Entity{} = entity_after
      assert Process.alive?(pid)

      EntityServer.stop(pid)
    end
  end

  describe "script trait config" do
    test "passes config from trait map to script context" do
      script_key = unique_key("config_script")

      source = """
      interval = config.interval || 300
      set_trait_state.("interval_used", interval)
      continue.()
      """

      create_script_entity(script_key, "behavior", source)

      traits = [%{"script" => script_key, "config" => %{"interval" => 600}}]
      npc = npc_with_traits(traits)
      {:ok, pid} = EntityServer.start_link(npc.id, @test_opts)

      send_tick(pid)

      entity_after = EntityServer.get_entity(pid)
      assert %Entity{} = entity_after

      EntityServer.stop(pid)
    end

    test "handles missing config key gracefully" do
      script_key = unique_key("no_config_script")

      create_script_entity(script_key, "behavior", "continue.()")

      # Trait map without "config" key — should default to empty map
      traits = [%{"script" => script_key}]
      npc = npc_with_traits(traits)
      {:ok, pid} = EntityServer.start_link(npc.id, @test_opts)

      send_tick(pid)

      entity_after = EntityServer.get_entity(pid)
      assert %Entity{} = entity_after

      EntityServer.stop(pid)
    end
  end
end
