defmodule Loka.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      LokaWeb.Telemetry,
      Loka.PromEx,
      Loka.Repo,
      {Ecto.Migrator,
       repos: Application.fetch_env!(:loka, :ecto_repos), skip: skip_migrations?()},
      {DNSCluster, query: Application.get_env(:loka, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: Loka.PubSub},

      # Session System (unified client messaging)
      # Order: Registry for lookups → Supervisor for session processes
      {Registry, keys: :unique, name: Loka.Session.PlayerRegistry},
      Loka.Session.Registry,
      Loka.Session.Supervisor,

      # Balance Config - load game formulas and constants from YAML
      Loka.Config.Balance,

      # Engine Core - New Components (order matters!)
      # Task supervisor for async hook execution
      {Task.Supervisor, name: Loka.Engine.Hooks.TaskSupervisor},
      Loka.Engine.Hooks,
      # TypedObject Loader - unified loading for all content types
      Loka.Engine.TypedObject.Loader,
      Loka.Engine.SocialLoader,
      {Registry, keys: :unique, name: Loka.Engine.EntityRegistry.Registry},
      {Loka.Engine.EntitySupervisor, name: Loka.Engine.EntitySupervisor},
      Loka.Engine.EntityRegistry,
      Loka.Engine.WorldGraph.LayoutManager,

      # Plugin System - must come after Engine core, before Framework layer
      # Plugins can add hooks, validators, children, prototypes, and balance config
      {Loka.Engine.PluginSupervisor, []},
      Loka.Engine.PluginLoader,

      # Framework layer - Social Systems
      Loka.Framework.Social.ChannelManager,
      Loka.Framework.Social.PartyManager,

      # Admin tools - GameLog for debugging/audit (replaces Quest.EventLog)
      Loka.Admin.GameLog,

      # Admin audit logging - Task supervisor for async audit log inserts
      {Task.Supervisor, name: Loka.Admin.Audit.TaskSupervisor},

      # Framework layer - Quest System
      # ObjectiveRegistry must start before QuestRegistry for validation
      Loka.Framework.Quest.ObjectiveRegistry,
      Loka.Framework.Quest.QuestRegistry,
      Loka.Framework.Quest.TimerManager,
      Loka.Framework.Quest.ChainRegistry,
      Loka.Framework.Storyline.StorylineRegistry,
      # Combat system - Registry for lookups, Supervisor for combat processes
      {Registry, keys: :unique, name: Loka.CombatRegistry},
      Loka.Framework.Combat.CombatSupervisor,
      Loka.Framework.Combat.RespawnManager,

      # Crafting and Gathering systems
      Loka.Framework.Gathering.GatheringRegistry,
      Loka.Framework.Crafting.CraftingRegistry,

      # Binary Skill system (new mechanics)
      Loka.Framework.Skills.BinarySkillRegistry,

      # Inventory systems
      Loka.Framework.Inventory.ContainerRespawn,

      # Resource system (mana, mv, stamina, etc.)
      Loka.Framework.Resources.ResourceRegistry,
      Loka.Framework.Resources.ResourcePool,
      Loka.Framework.Resources.ResourceTicker,

      # Timer system (crafting queues, offline progression)
      Loka.Timers.Server,

      # World systems (weather, day/night cycle, ambient messages)
      Loka.Framework.World.DayNight,
      Loka.Framework.World.Weather,
      Loka.Framework.World.RoomAmbient.Scheduler,
      Loka.Framework.World.NpcAmbient.Scheduler,

      # Scripting - World event handler (subscribes to time/weather events)
      Loka.Framework.Scripting.WorldEventHandler,

      # Zone system - periodic mob/item respawning
      # Order: Loader → Registry → Reset (Reset needs both Loader and Registry)
      Loka.Engine.ZoneLoader,
      Loka.Engine.ZoneRegistry,
      Loka.Engine.ZoneReset,

      # Content Validation - runs after all content is loaded
      # Will fail startup if critical content errors are found (unless mode is :warn or :skip)
      # Set LOKA_CONTENT_VALIDATION=warn to bypass during development
      Loka.Engine.ContentValidator,

      # World Builder - LLM services
      Loka.WorldBuilder.LLM.ObservabilityLogger,
      Loka.WorldBuilder.LLM.PreviewManager,
      Loka.WorldBuilder.LLM.ConversationManager,
      Loka.WorldBuilder.LLM.BulkGenerator,

      # Start to serve requests, typically the last entry
      LokaWeb.Endpoint
    ]

    # Initialize lock expression cache
    Loka.Engine.Locks.init_cache()

    # Initialize calendar system (depends on DayNight being started)
    Loka.Framework.World.Calendar.init()

    # Initialize minimap cache ETS table
    LokaWeb.Channels.RoomHelpers.init_minimap_cache()

    # Initialize rate limiter ETS table (used by LokaWeb.Plugs.RateLimiter)
    # Skip if rate limiting is disabled (e.g., in test environment)
    if Application.get_env(:loka, :rate_limiter_enabled, true) do
      LokaWeb.Plugs.RateLimiter.init_table()
    end

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Loka.Supervisor]
    result = Supervisor.start_link(children, opts)

    # Register hooks after supervisor starts
    case result do
      {:ok, _pid} ->
        Loka.Framework.Quest.Listeners.register_all()
        Loka.Framework.World.RoomEvents.register_hooks()
        Loka.Framework.Inventory.Container.register_hooks()
        Loka.Framework.Scripting.BehaviorRegistry.register_hooks()

        # Spawn the world (create room entities from prototypes)
        # Skip in test mode to avoid polluting the sandbox-isolated test database
        unless Application.get_env(:loka, :env) == :test do
          Loka.Engine.WorldLoader.spawn_world()
        end

      _ ->
        :ok
    end

    result
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    LokaWeb.Endpoint.config_change(changed, removed)
    :ok
  end

  defp skip_migrations?() do
    # By default, sqlite migrations are run when using a release
    System.get_env("RELEASE_NAME") == nil
  end
end
