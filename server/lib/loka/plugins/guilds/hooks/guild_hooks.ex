defmodule Loka.Plugins.Guilds.Hooks.GuildHooks do
  @moduledoc """
  Hook implementations for the guild plugin.

  Hooks:
  - `init_guild_component/2` - Called at entity creation to initialize guild data
  - `on_member_death/2` - Called when a guild member dies
  """

  require Logger

  alias Loka.Plugins.Guilds.GuildRegistry

  @doc """
  Initializes guild-related data on a new entity.

  Called via the `at_entity_creation` hook.
  Adds a `guild_member` component to track guild membership.
  """
  def init_guild_component(entity, _context) do
    # Add guild_member component if entity is a player
    if Map.get(entity, :type) == :player do
      components = Map.get(entity, :components, %{})

      updated_components =
        Map.put(components, :guild_member, %{
          guild_id: nil,
          joined_at: nil,
          contribution: 0
        })

      {:ok, Map.put(entity, :components, updated_components)}
    else
      {:ok, entity}
    end
  end

  @doc """
  Handles a guild member's death.

  Called via the `at_death` hook.
  Can be used to:
  - Notify guild members
  - Track death statistics
  - Apply death penalties to guild
  """
  def on_member_death(entity, _context) do
    player_id = Map.get(entity, :id)

    case GuildRegistry.get_guild_by_member(player_id) do
      {:ok, guild} ->
        Logger.debug("[GuildHooks] Guild member #{player_id} died (guild: #{guild.name})")

        # Could broadcast to guild members, apply penalties, etc.
        # For now, just log it
        {:ok, entity}

      {:error, :not_found} ->
        # Player not in a guild, nothing to do
        {:ok, entity}
    end
  end
end
