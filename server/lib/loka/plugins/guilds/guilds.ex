defmodule Loka.Plugins.Guilds.Guilds do
  @moduledoc """
  Public API for the guild system.

  Provides high-level functions for guild operations that handle
  validation, balance config, and integration with other systems.
  """

  alias Loka.Plugins.Guilds.GuildRegistry
  alias Loka.Config.Balance

  @doc """
  Creates a new guild.

  ## Options
  - `:cost` - Override creation cost (default from balance config)

  Returns `{:ok, guild}` or `{:error, reason}`.
  """
  def create(player, guild_name, opts \\ []) do
    cost = Keyword.get(opts, :cost, creation_cost())

    with :ok <- validate_guild_name(guild_name),
         :ok <- validate_not_in_guild(player),
         :ok <- validate_can_afford(player, cost) do
      # Deduct cost would happen here in full implementation
      GuildRegistry.create_guild(guild_name, player.id)
    end
  end

  @doc """
  Joins an existing guild.

  Returns `{:ok, guild}` or `{:error, reason}`.
  """
  def join(player, guild_name) do
    with :ok <- validate_not_in_guild(player),
         {:ok, guild} <- GuildRegistry.get_guild(guild_name),
         :ok <- validate_guild_not_full(guild) do
      GuildRegistry.add_member(guild_name, player.id)
    end
  end

  @doc """
  Leaves current guild.

  Returns `:ok` or `{:error, reason}`.
  """
  def leave(player) do
    case GuildRegistry.get_guild_by_member(player.id) do
      {:ok, guild} ->
        case GuildRegistry.remove_member(guild.name, player.id) do
          {:ok, :disbanded} -> :ok
          {:ok, _} -> :ok
          error -> error
        end

      {:error, :not_found} ->
        {:error, :not_in_guild}
    end
  end

  @doc """
  Gets guild info for a player or by name.

  Returns `{:ok, guild}` or `{:error, reason}`.
  """
  def info(player_or_name) when is_binary(player_or_name) do
    GuildRegistry.get_guild(player_or_name)
  end

  def info(%{id: player_id}) do
    GuildRegistry.get_guild_by_member(player_id)
  end

  @doc """
  Donates gold to guild treasury.

  Returns `{:ok, guild}` or `{:error, reason}`.
  """
  def donate(player, amount) when is_integer(amount) and amount > 0 do
    with {:ok, guild} <- GuildRegistry.get_guild_by_member(player.id),
         :ok <- validate_can_afford(player, amount) do
      # Deduct gold would happen here in full implementation
      GuildRegistry.donate(guild.name, amount)
    end
  end

  def donate(_player, _amount), do: {:error, :invalid_amount}

  @doc """
  Gets the player's current guild, if any.

  Returns `{:ok, guild}` or `{:error, :not_in_guild}`.
  """
  def get_player_guild(player) do
    case GuildRegistry.get_guild_by_member(player.id) do
      {:ok, guild} -> {:ok, guild}
      {:error, :not_found} -> {:error, :not_in_guild}
    end
  end

  @doc """
  Checks if a player is in a guild.
  """
  def in_guild?(player) do
    case GuildRegistry.get_guild_by_member(player.id) do
      {:ok, _} -> true
      {:error, _} -> false
    end
  end

  # =============================================================================
  # Balance Config Helpers
  # =============================================================================

  defp creation_cost do
    Balance.get([:guilds, :creation_cost], 1000)
  end

  defp max_members(guild) do
    base = Balance.get([:guilds, :max_members_base], 20)
    per_level = Balance.get([:guilds, :max_members_per_level], 5)
    base + (guild.level - 1) * per_level
  end

  # =============================================================================
  # Validation Helpers
  # =============================================================================

  defp validate_guild_name(name) when is_binary(name) do
    cond do
      String.length(name) < 3 ->
        {:error, :name_too_short}

      String.length(name) > 24 ->
        {:error, :name_too_long}

      not Regex.match?(~r/^[a-zA-Z0-9\s]+$/, name) ->
        {:error, :invalid_characters}

      true ->
        :ok
    end
  end

  defp validate_guild_name(_), do: {:error, :invalid_name}

  defp validate_not_in_guild(player) do
    if in_guild?(player) do
      {:error, :already_in_guild}
    else
      :ok
    end
  end

  defp validate_guild_not_full(guild) do
    if length(guild.members) >= max_members(guild) do
      {:error, :guild_full}
    else
      :ok
    end
  end

  defp validate_can_afford(_player, _cost) do
    # In full implementation, check player's gold
    # For now, always succeed
    :ok
  end
end
