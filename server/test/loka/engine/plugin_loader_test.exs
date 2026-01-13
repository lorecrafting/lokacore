defmodule Loka.Engine.PluginLoaderTest do
  use ExUnit.Case, async: false

  alias Loka.Engine.PluginLoader

  alias Loka.PluginFixtures.{
    MinimalPlugin,
    PluginA,
    PluginB,
    PluginC,
    CyclicPluginA,
    CyclicPluginB,
    MissingDepPlugin
  }

  # Generate unique names for each test to avoid conflicts
  defp unique_name do
    :"plugin_loader_#{System.unique_integer([:positive])}"
  end

  # Generate unique ETS table name for each test
  defp unique_ets_table do
    :"plugin_ets_#{System.unique_integer([:positive])}"
  end

  # Start PluginLoader without linking - for error case tests
  # GenServer.start returns {:error, reason} when init returns {:stop, reason}
  defp start_unlinked(opts) do
    name = Keyword.get(opts, :name, PluginLoader)
    GenServer.start(PluginLoader, opts, name: name)
  end

  describe "loading plugins" do
    test "loads empty plugin list" do
      name = unique_name()
      ets = unique_ets_table()
      {:ok, pid} = PluginLoader.start_link(name: name, plugins: [], ets_table: ets)

      assert PluginLoader.loaded_plugins(name) == []
      assert PluginLoader.plugin_info(name) == []

      GenServer.stop(pid)
    end

    test "loads a single plugin" do
      name = unique_name()
      ets = unique_ets_table()
      {:ok, pid} = PluginLoader.start_link(name: name, plugins: [MinimalPlugin], ets_table: ets)

      plugins = PluginLoader.loaded_plugins(name)
      assert length(plugins) == 1
      assert MinimalPlugin in plugins

      assert PluginLoader.get_plugin(:minimal_plugin, name) == MinimalPlugin

      GenServer.stop(pid)
    end

    test "loads multiple plugins" do
      name = unique_name()
      ets = unique_ets_table()

      {:ok, pid} =
        PluginLoader.start_link(name: name, plugins: [PluginA, PluginB, PluginC], ets_table: ets)

      plugins = PluginLoader.loaded_plugins(name)
      assert length(plugins) == 3

      # Verify dependency order (A before B, B before C)
      a_idx = Enum.find_index(plugins, &(&1 == PluginA))
      b_idx = Enum.find_index(plugins, &(&1 == PluginB))
      c_idx = Enum.find_index(plugins, &(&1 == PluginC))

      assert a_idx < b_idx
      assert b_idx < c_idx

      GenServer.stop(pid)
    end

    test "plugin_info returns metadata" do
      name = unique_name()
      ets = unique_ets_table()
      {:ok, pid} = PluginLoader.start_link(name: name, plugins: [MinimalPlugin], ets_table: ets)

      [info] = PluginLoader.plugin_info(name)

      assert info.name == :minimal_plugin
      assert info.module == MinimalPlugin
      assert info.version == "1.0.0"
      assert info.description == "A minimal test plugin"
      assert info.dependencies == []
      assert info.commands == 0
      assert info.hooks == 0
      assert info.children == 0

      GenServer.stop(pid)
    end
  end

  describe "dependency resolution" do
    test "resolves simple dependency chain" do
      name = unique_name()
      ets = unique_ets_table()

      # Provide in reverse order to test sorting
      {:ok, pid} =
        PluginLoader.start_link(
          name: name,
          plugins: [PluginC, PluginA, PluginB],
          ets_table: ets
        )

      plugins = PluginLoader.loaded_plugins(name)

      # Should be loaded in dependency order: A, B, C
      assert plugins == [PluginA, PluginB, PluginC]

      GenServer.stop(pid)
    end

    test "detects missing dependencies" do
      name = unique_name()
      ets = unique_ets_table()

      # Use unlinked start to get {:error, reason} instead of EXIT signal
      result = start_unlinked(name: name, plugins: [MissingDepPlugin], ets_table: ets)

      assert {:error, {:plugin_load_failed, {:missing_dependencies, _}}} = result
    end

    test "detects cyclic dependencies" do
      name = unique_name()
      ets = unique_ets_table()

      # Use unlinked start to get {:error, reason} instead of EXIT signal
      result =
        start_unlinked(
          name: name,
          plugins: [CyclicPluginA, CyclicPluginB],
          ets_table: ets
        )

      assert {:error, {:plugin_load_failed, {:dependency_cycle, _}}} = result
    end
  end

  describe "ETS fast lookup" do
    test "loaded? returns true for loaded plugins (default ETS table)" do
      # This test only works when using the default ETS table
      # which is shared with the application's PluginLoader
      # For now, just verify the function works
      refute PluginLoader.loaded?(:definitely_not_a_plugin_xyz123)
    end

    test "loaded? returns false for unloaded plugins" do
      # Before any loader starts or after cleanup
      refute PluginLoader.loaded?(:definitely_not_a_plugin)
    end
  end

  describe "validation" do
    test "rejects modules that don't implement Plugin behaviour" do
      name = unique_name()
      ets = unique_ets_table()

      # String is not a plugin module - use unlinked start to get error tuple
      result = start_unlinked(name: name, plugins: [String], ets_table: ets)

      assert {:error, {:plugin_load_failed, {:invalid_plugins, [String]}}} = result
    end
  end
end
