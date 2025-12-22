defmodule Exmud.Engine.HooksTest do
  use ExUnit.Case, async: false

  alias Exmud.Engine.Hooks

  # Test helper module
  defmodule TestHooks do
    def simple_hook(_arg), do: :ok
    def another_hook(_arg), do: :ok
    def halt_hook(_arg), do: {:halt, :blocked}
    def pass_hook(_arg), do: :continue
    def error_hook(_arg), do: raise("intentional error")

    def collecting_hook(arg) do
      Agent.update(:hook_collector, fn list -> [arg | list] end)
      :ok
    end
  end

  setup do
    # Start a fresh hooks server for each test
    name = :"hooks_#{System.unique_integer([:positive])}"

    {:ok, pid} = Hooks.start_link(name: name)

    on_exit(fn ->
      if Process.alive?(pid), do: GenServer.stop(pid)
    end)

    {:ok, server: name}
  end

  describe "start_link/1" do
    test "starts the hooks server", %{server: server} do
      assert Process.whereis(server) != nil
    end
  end

  describe "register/4" do
    test "registers a hook", %{server: server} do
      assert :ok = Hooks.register(:at_entity_creation, TestHooks, :simple_hook, server: server)

      hooks = Hooks.list_hooks(:at_entity_creation, server: server)
      assert length(hooks) == 1
      assert {100, {TestHooks, :simple_hook}} in hooks
    end

    test "registers with custom priority", %{server: server} do
      :ok = Hooks.register(:at_entity_creation, TestHooks, :simple_hook, server: server, priority: 50)

      hooks = Hooks.list_hooks(:at_entity_creation, server: server)
      assert [{50, {TestHooks, :simple_hook}}] = hooks
    end

    test "maintains priority order", %{server: server} do
      :ok = Hooks.register(:at_entity_creation, TestHooks, :simple_hook, server: server, priority: 100)
      :ok = Hooks.register(:at_entity_creation, TestHooks, :another_hook, server: server, priority: 10)

      hooks = Hooks.list_hooks(:at_entity_creation, server: server)

      assert [
               {10, {TestHooks, :another_hook}},
               {100, {TestHooks, :simple_hook}}
             ] = hooks
    end

    test "rejects invalid hook types", %{server: server} do
      assert {:error, {:invalid_hook_type, :invalid_type, _}} =
               Hooks.register(:invalid_type, TestHooks, :simple_hook, server: server)
    end

    test "ignores duplicate registrations", %{server: server} do
      :ok = Hooks.register(:at_entity_creation, TestHooks, :simple_hook, server: server)
      :ok = Hooks.register(:at_entity_creation, TestHooks, :simple_hook, server: server)

      hooks = Hooks.list_hooks(:at_entity_creation, server: server)
      assert length(hooks) == 1
    end
  end

  describe "unregister/4" do
    test "removes a registered hook", %{server: server} do
      :ok = Hooks.register(:at_entity_creation, TestHooks, :simple_hook, server: server)
      :ok = Hooks.unregister(:at_entity_creation, TestHooks, :simple_hook, server: server)

      hooks = Hooks.list_hooks(:at_entity_creation, server: server)
      assert hooks == []
    end

    test "no error when unregistering non-existent hook", %{server: server} do
      assert :ok = Hooks.unregister(:at_entity_creation, TestHooks, :nonexistent, server: server)
    end
  end

  describe "run/3" do
    test "executes all registered hooks", %{server: server} do
      {:ok, agent} = Agent.start_link(fn -> [] end, name: :hook_collector)

      :ok = Hooks.register(:at_entity_creation, TestHooks, :collecting_hook, server: server)
      :ok = Hooks.run(:at_entity_creation, [:test_arg], server: server)

      collected = Agent.get(:hook_collector, & &1)
      assert :test_arg in collected

      Agent.stop(agent)
    end

    test "executes hooks in priority order", %{server: server} do
      {:ok, agent} = Agent.start_link(fn -> [] end, name: :hook_collector)

      # Register in reverse order
      :ok =
        Hooks.register(:at_entity_creation, TestHooks, :collecting_hook,
          server: server,
          priority: 100
        )

      :ok =
        Hooks.register(:at_after_move, TestHooks, :collecting_hook, server: server, priority: 10)

      # Different hook types, so order is per-type
      :ok = Hooks.run(:at_entity_creation, [:first], server: server)
      :ok = Hooks.run(:at_after_move, [:second], server: server)

      collected = Agent.get(:hook_collector, & &1)
      assert [:second, :first] = collected

      Agent.stop(agent)
    end

    test "returns :ok even if no hooks registered", %{server: server} do
      assert :ok = Hooks.run(:at_entity_creation, [:arg], server: server)
    end

    test "continues execution even when hook raises", %{server: server} do
      {:ok, agent} = Agent.start_link(fn -> [] end, name: :hook_collector)

      :ok = Hooks.register(:at_entity_creation, TestHooks, :error_hook, server: server, priority: 10)
      :ok = Hooks.register(:at_entity_creation, TestHooks, :collecting_hook, server: server, priority: 20)

      # Should not raise, and should continue to next hook
      assert :ok = Hooks.run(:at_entity_creation, [:test], server: server)

      collected = Agent.get(:hook_collector, & &1)
      assert :test in collected

      Agent.stop(agent)
    end
  end

  describe "run_until_halt/3" do
    test "returns :ok when no hook halts", %{server: server} do
      :ok = Hooks.register(:at_before_move, TestHooks, :pass_hook, server: server)
      :ok = Hooks.register(:at_before_move, TestHooks, :simple_hook, server: server)

      assert :ok = Hooks.run_until_halt(:at_before_move, [:arg], server: server)
    end

    test "returns {:halt, reason} when hook halts", %{server: server} do
      :ok = Hooks.register(:at_before_move, TestHooks, :halt_hook, server: server)

      assert {:halt, :blocked} = Hooks.run_until_halt(:at_before_move, [:arg], server: server)
    end

    test "stops execution after first halt", %{server: server} do
      {:ok, agent} = Agent.start_link(fn -> [] end, name: :hook_collector)

      :ok = Hooks.register(:at_before_move, TestHooks, :halt_hook, server: server, priority: 10)

      :ok =
        Hooks.register(:at_before_move, TestHooks, :collecting_hook, server: server, priority: 20)

      assert {:halt, :blocked} = Hooks.run_until_halt(:at_before_move, [:test], server: server)

      # The collecting hook should NOT have been called
      collected = Agent.get(:hook_collector, & &1)
      assert collected == []

      Agent.stop(agent)
    end

    test "returns :ok when no hooks registered", %{server: server} do
      assert :ok = Hooks.run_until_halt(:at_before_move, [:arg], server: server)
    end

    test "continues on error and returns :ok", %{server: server} do
      :ok = Hooks.register(:at_before_move, TestHooks, :error_hook, server: server)

      # Should not raise, should continue
      assert :ok = Hooks.run_until_halt(:at_before_move, [:arg], server: server)
    end
  end

  describe "list_hooks/2" do
    test "returns empty list for unregistered hook type", %{server: server} do
      assert [] = Hooks.list_hooks(:at_entity_creation, server: server)
    end

    test "returns all registered hooks in order", %{server: server} do
      :ok = Hooks.register(:at_entity_creation, TestHooks, :simple_hook, server: server, priority: 50)
      :ok = Hooks.register(:at_entity_creation, TestHooks, :another_hook, server: server, priority: 10)

      hooks = Hooks.list_hooks(:at_entity_creation, server: server)

      assert [
               {10, {TestHooks, :another_hook}},
               {50, {TestHooks, :simple_hook}}
             ] = hooks
    end
  end

  describe "clear_all/1" do
    test "removes all hooks", %{server: server} do
      :ok = Hooks.register(:at_entity_creation, TestHooks, :simple_hook, server: server)
      :ok = Hooks.register(:at_before_move, TestHooks, :another_hook, server: server)

      :ok = Hooks.clear_all(server: server)

      assert [] = Hooks.list_hooks(:at_entity_creation, server: server)
      assert [] = Hooks.list_hooks(:at_before_move, server: server)
    end
  end

  describe "hook_types/0" do
    test "returns all valid hook types" do
      types = Hooks.hook_types()

      assert :at_entity_creation in types
      assert :at_before_move in types
      assert :at_death in types
      assert length(types) > 10
    end
  end

  describe "valid_hook_type?/1" do
    test "returns true for valid types" do
      assert Hooks.valid_hook_type?(:at_entity_creation)
      assert Hooks.valid_hook_type?(:at_before_move)
    end

    test "returns false for invalid types" do
      refute Hooks.valid_hook_type?(:invalid_type)
      refute Hooks.valid_hook_type?(:at_random_thing)
    end
  end
end
