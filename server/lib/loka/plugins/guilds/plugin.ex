defmodule Loka.Plugins.Guilds do
  @moduledoc """
  Guild system plugin for Loka.

  Provides player guilds with:
  - Guild creation, joining, and leaving
  - Guild treasury and XP leveling
  - Member management

  ## Configuration

  Add to config/config.exs:

      config :loka, :plugins, [
        Loka.Plugins.Guilds
      ]

  ## Hooks

  - `at_entity_creation` - Initializes guild_member component
  - `at_death` - Handles guild member death events
  """

  use Loka.Engine.Plugin

  require Logger

  @impl true
  def name, do: :guilds

  @impl true
  def version, do: "1.0.0"

  @impl true
  def description, do: "Player guild system with treasury and leveling"

  @impl true
  def dependencies, do: []

  @impl true
  def hooks do
    [
      {:at_entity_creation, Loka.Plugins.Guilds.Hooks.GuildHooks, :init_guild_component,
       priority: 50},
      {:at_death, Loka.Plugins.Guilds.Hooks.GuildHooks, :on_member_death, priority: 40}
    ]
  end

  @impl true
  def validators do
    [Loka.Plugins.Guilds.Validators.GuildValidator]
  end

  @impl true
  def prototype_paths do
    ["priv/plugins/guilds/prototypes"]
  end

  @impl true
  def balance_config_path do
    "priv/plugins/guilds/balance.yml"
  end

  @impl true
  def children do
    [Loka.Plugins.Guilds.GuildRegistry]
  end

  @impl true
  def init do
    Logger.info("[Guilds] Plugin initialized")
    :ok
  end
end
