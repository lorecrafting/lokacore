defmodule Loka.Engine.Plugin do
  @moduledoc """
  Behaviour for Loka plugins/contribs.

  Plugins are self-contained game extensions that can add:
  - Hooks (via Hooks system)
  - Content validators (via ContentValidator)
  - Scripting extensions (via ScriptingExtension)
  - Balance config sections
  - Prototype paths for YAML loading
  - GenServer children to the supervision tree

  ## Creating a Plugin

      defmodule MyGame.Plugins.GuildSystem do
        use Loka.Engine.Plugin

        @impl true
        def name, do: :guild_system

        @impl true
        def version, do: "1.0.0"

        @impl true
        def description, do: "Guild management and territory control"

        @impl true
        def dependencies, do: [:faction_system]

        @impl true
        def hooks do
          [
            {:at_entity_creation, MyGame.Plugins.GuildSystem.Hooks, :on_player_create, priority: 50},
            {:at_enter_room, MyGame.Plugins.GuildSystem.Hooks, :check_territory, priority: 30}
          ]
        end

        @impl true
        def validators do
          [MyGame.Plugins.GuildSystem.GuildValidator]
        end

        @impl true
        def prototype_paths do
          ["priv/plugins/guild_system/prototypes"]
        end

        @impl true
        def balance_config_path do
          "priv/plugins/guild_system/balance.yml"
        end

        @impl true
        def children do
          [
            MyGame.Plugins.GuildSystem.GuildRegistry,
            MyGame.Plugins.GuildSystem.TerritoryManager
          ]
        end
      end

  ## Configuration

  Register plugins in config.exs:

      config :loka, :plugins, [
        MyGame.Plugins.GuildSystem,
        MyGame.Plugins.PetSystem
      ]

  ## Plugin Directory Convention

      priv/plugins/guild_system/
      ├── prototypes/
      │   ├── guilds/
      │   └── territories/
      ├── balance.yml
      └── ...
  """

  @type hook_registration :: {atom(), module(), atom(), keyword()}
  @type child_spec :: module() | {module(), keyword()} | Supervisor.child_spec()

  @doc "Returns the unique plugin name as an atom."
  @callback name() :: atom()

  @doc "Returns the plugin version string (semver recommended)."
  @callback version() :: String.t()

  @doc "Returns a human-readable description."
  @callback description() :: String.t()

  @doc """
  Returns list of plugin names this plugin depends on.
  Dependencies are loaded first during initialization.
  """
  @callback dependencies() :: [atom()]

  @doc """
  Returns list of hook registrations.
  Format: {hook_type, module, function, opts}
  where opts may include :priority (default 100).
  """
  @callback hooks() :: [hook_registration()]

  @doc """
  Returns list of ContentValidator.Plugin modules.
  """
  @callback validators() :: [module()]

  @doc """
  Returns list of ScriptingExtension modules.
  """
  @callback scripting_extensions() :: [module()]

  @doc """
  Returns list of additional prototype paths to load.
  Paths are relative to the project root.
  """
  @callback prototype_paths() :: [String.t()]

  @doc """
  Returns path to plugin's balance.yml file.
  Returns nil if no balance config.
  """
  @callback balance_config_path() :: String.t() | nil

  @doc """
  Returns list of child specs for GenServers to add to supervisor.
  These are started after core systems but before ContentValidator.
  """
  @callback children() :: [child_spec()]

  @doc """
  Optional initialization callback called after all children are started.
  Use for any post-startup setup.
  """
  @callback init() :: :ok | {:error, term()}

  @optional_callbacks [
    dependencies: 0,
    hooks: 0,
    validators: 0,
    scripting_extensions: 0,
    prototype_paths: 0,
    balance_config_path: 0,
    children: 0,
    init: 0
  ]

  defmacro __using__(_opts) do
    quote do
      @behaviour Loka.Engine.Plugin

      # Default implementations for optional callbacks
      def dependencies, do: []
      def hooks, do: []
      def validators, do: []
      def scripting_extensions, do: []
      def prototype_paths, do: []
      def balance_config_path, do: nil
      def children, do: []
      def init, do: :ok

      defoverridable dependencies: 0,
                     hooks: 0,
                     validators: 0,
                     scripting_extensions: 0,
                     prototype_paths: 0,
                     balance_config_path: 0,
                     children: 0,
                     init: 0
    end
  end
end
