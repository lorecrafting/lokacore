defmodule Loka.Engine.PluginTest do
  use ExUnit.Case, async: true

  alias Loka.PluginFixtures.{MinimalPlugin, FullPlugin}

  describe "Plugin behaviour" do
    test "minimal plugin has required callbacks" do
      assert MinimalPlugin.name() == :minimal_plugin
      assert MinimalPlugin.version() == "1.0.0"
      assert MinimalPlugin.description() == "A minimal test plugin"
    end

    test "minimal plugin has default values for optional callbacks" do
      assert MinimalPlugin.dependencies() == []
      assert MinimalPlugin.commands() == []
      assert MinimalPlugin.hooks() == []
      assert MinimalPlugin.validators() == []
      assert MinimalPlugin.scripting_extensions() == []
      assert MinimalPlugin.prototype_paths() == []
      assert MinimalPlugin.balance_config_path() == nil
      assert MinimalPlugin.children() == []
      assert MinimalPlugin.init() == :ok
    end

    test "full plugin can override all optional callbacks" do
      assert FullPlugin.name() == :full_plugin
      assert FullPlugin.version() == "2.0.0"
      assert FullPlugin.description() == "A fully-featured test plugin"
      assert FullPlugin.dependencies() == [:minimal_plugin]
      assert FullPlugin.commands() == []
      assert FullPlugin.hooks() == []
      assert FullPlugin.validators() == []
      assert FullPlugin.scripting_extensions() == []
      assert FullPlugin.prototype_paths() == []
      assert FullPlugin.balance_config_path() == nil
      assert FullPlugin.children() == []
    end
  end

  describe "Plugin module validation" do
    test "plugin modules export required functions" do
      # Ensure modules are loaded
      Code.ensure_loaded!(MinimalPlugin)
      Code.ensure_loaded!(FullPlugin)

      for mod <- [MinimalPlugin, FullPlugin] do
        assert function_exported?(mod, :name, 0)
        assert function_exported?(mod, :version, 0)
        assert function_exported?(mod, :description, 0)
        assert function_exported?(mod, :dependencies, 0)
        assert function_exported?(mod, :commands, 0)
        assert function_exported?(mod, :hooks, 0)
        assert function_exported?(mod, :validators, 0)
        assert function_exported?(mod, :scripting_extensions, 0)
        assert function_exported?(mod, :prototype_paths, 0)
        assert function_exported?(mod, :balance_config_path, 0)
        assert function_exported?(mod, :children, 0)
        assert function_exported?(mod, :init, 0)
      end
    end
  end
end
