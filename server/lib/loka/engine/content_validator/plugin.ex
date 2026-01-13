defmodule Loka.Engine.ContentValidator.Plugin do
  @moduledoc """
  Behaviour for ContentValidator plugins.

  Each plugin provides validation for a specific domain (prototypes, quests,
  dialogue, world, etc.). Plugins are automatically discovered and run during
  application startup.

  ## Creating a Plugin

      defmodule MyApp.ContentValidator.MyPlugin do
        @behaviour Loka.Engine.ContentValidator.Plugin

        @impl true
        def name, do: :my_plugin

        @impl true
        def ready? do
          Process.whereis(MyApp.SomeRegistry) != nil
        end

        @impl true
        def validate do
          # Return validation results
          %{critical: [], warnings: []}
        end
      end

  ## Configuration

  Register plugins in config.exs:

      config :loka, :content_validator_plugins, [
        Loka.Engine.ContentValidator.PrototypePlugin,
        Loka.Engine.ContentValidator.QuestPlugin,
        MyApp.ContentValidator.MyPlugin
      ]
  """

  @doc """
  Returns the plugin name as an atom.

  This is used for logging and grouping validation results.
  """
  @callback name() :: atom()

  @doc """
  Returns whether the plugin's dependencies are ready.

  Plugins should check that any registries or services they depend on
  are started before running validation. Return `true` if ready, `false` otherwise.
  """
  @callback ready?() :: boolean()

  @doc """
  Runs validation and returns results.

  Returns a map with `:critical` and `:warnings` keys, each containing
  a list of error/warning messages (strings).
  """
  @callback validate() :: %{critical: [String.t()], warnings: [String.t()]}
end
