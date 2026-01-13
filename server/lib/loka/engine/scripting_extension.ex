defmodule Loka.Engine.ScriptingExtension do
  @moduledoc """
  Behaviour for extending the Lua scripting API.

  This allows the Framework layer to define game-specific Lua functions without
  polluting the Engine layer with domain concepts like quests, inventory, or stats.

  ## Architecture

  The Engine layer provides:
  - Sandbox execution environment
  - Core API functions (`game.message`, `game.log`)
  - Extension loading mechanism

  The Framework layer provides:
  - Game-specific API functions (`game.quest.*`, `game.player.*`)
  - Domain knowledge about game state structures

  ## Implementing an Extension

      defmodule Loka.Framework.GameScriptAPI do
        @behaviour Loka.Engine.ScriptingExtension

        @impl true
        def api_namespace, do: "game"

        @impl true
        def api_functions do
          %{
            "quest" => %{
              "is_active" => &quest_is_active/2,
              "is_complete" => &quest_is_complete/2
            },
            "player" => %{
              "has_item" => &player_has_item/2,
              "has_flag" => &player_has_flag/2
            }
          }
        end

        defp quest_is_active([quest_id], lua) do
          # Implementation...
          {[result], lua}
        end
      end

  ## Function Signature

  All Lua API functions must follow the Luerl function signature:

      (args :: list(), lua_state) :: {results :: list(), lua_state}

  - `args` - List of arguments passed from Lua
  - `lua_state` - The Luerl state (opaque, pass through)
  - Returns a tuple of `{[return_values], lua_state}`

  ## Configuration

  Extensions are configured in your application config:

      config :loka, :scripting_extensions, [
        Loka.Framework.GameScriptAPI
      ]

  Or registered at runtime:

      Loka.Engine.Scripting.register_extension(MyExtension)

  ## Security

  Extension functions execute within the sandboxed Lua environment.
  They have access to the Lua state but should:
  - Not expose file system or network access
  - Validate all input from Lua
  - Return appropriate error values for invalid input
  """

  @doc """
  Returns the top-level namespace for this extension's functions.

  Most extensions will return `"game"` to add functions under the `game.*` namespace.
  Multiple extensions can share the same namespace - their functions will be merged.

  ## Example

      def api_namespace, do: "game"  # Functions available as game.quest.*, game.player.*
      def api_namespace, do: "admin" # Functions available as admin.*
  """
  @callback api_namespace() :: String.t()

  @doc """
  Returns a nested map of function names to their implementations.

  The map structure determines the Lua API structure:
  - Top-level keys become sub-namespaces (e.g., "quest" -> `game.quest.*`)
  - Nested keys become function names (e.g., "is_active" -> `game.quest.is_active()`)
  - Values are function references with arity 2: `(args, lua_state) -> {results, lua_state}`

  ## Example

      def api_functions do
        %{
          "quest" => %{
            "is_active" => &quest_is_active/2,
            "is_complete" => &quest_is_complete/2
          },
          "player" => %{
            "has_item" => &player_has_item/2
          }
        }
      end

  This creates:
  - `game.quest.is_active(quest_id)`
  - `game.quest.is_complete(quest_id)`
  - `game.player.has_item(item_key)`
  """
  @callback api_functions() :: %{String.t() => %{String.t() => function()} | function()}

  @doc """
  Optional callback for any initialization needed before script execution.

  Called once when the extension is loaded. Can be used for setup like
  precomputing values or validating configuration.

  Default implementation does nothing.
  """
  @callback init() :: :ok | {:error, term()}

  @optional_callbacks [init: 0]
end
