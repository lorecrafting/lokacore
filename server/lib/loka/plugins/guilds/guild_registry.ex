defmodule Loka.Plugins.Guilds.GuildRegistry do
  @moduledoc """
  In-memory registry for guild data.

  Manages guild storage with ETS for fast lookups.
  In production, this would be backed by a database.
  """

  use GenServer
  require Logger

  alias Loka.Config.Balance

  @ets_table :guild_registry

  defstruct [:table]

  # =============================================================================
  # Client API
  # =============================================================================

  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Creates a new guild.

  Returns `{:ok, guild}` on success, `{:error, reason}` on failure.
  """
  def create_guild(name, founder_id, opts \\ []) do
    GenServer.call(__MODULE__, {:create, name, founder_id, opts})
  end

  @doc """
  Gets a guild by name.

  Returns `{:ok, guild}` or `{:error, :not_found}`.
  """
  def get_guild(name) do
    case :ets.lookup(@ets_table, normalize_name(name)) do
      [{_key, guild}] -> {:ok, guild}
      [] -> {:error, :not_found}
    end
  rescue
    ArgumentError -> {:error, :not_found}
  end

  @doc """
  Gets a guild by member ID.

  Returns `{:ok, guild}` or `{:error, :not_found}`.
  """
  def get_guild_by_member(member_id) do
    GenServer.call(__MODULE__, {:get_by_member, member_id})
  end

  @doc """
  Adds a member to a guild.
  """
  def add_member(guild_name, member_id) do
    GenServer.call(__MODULE__, {:add_member, guild_name, member_id})
  end

  @doc """
  Removes a member from a guild.
  """
  def remove_member(guild_name, member_id) do
    GenServer.call(__MODULE__, {:remove_member, guild_name, member_id})
  end

  @doc """
  Donates gold to guild treasury.
  """
  def donate(guild_name, amount) when is_integer(amount) and amount > 0 do
    GenServer.call(__MODULE__, {:donate, guild_name, amount})
  end

  def donate(_guild_name, _amount), do: {:error, :invalid_amount}

  @doc """
  Adds XP to a guild.
  """
  def add_xp(guild_name, amount) when is_integer(amount) and amount > 0 do
    GenServer.call(__MODULE__, {:add_xp, guild_name, amount})
  end

  def add_xp(_guild_name, _amount), do: {:error, :invalid_amount}

  @doc """
  Lists all guilds.
  """
  def list_guilds do
    :ets.tab2list(@ets_table)
    |> Enum.map(fn {_key, guild} -> guild end)
  rescue
    ArgumentError -> []
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(_opts) do
    table =
      if :ets.whereis(@ets_table) == :undefined do
        :ets.new(@ets_table, [:set, :public, :named_table, read_concurrency: true])
      else
        @ets_table
      end

    Logger.info("[GuildRegistry] Started")
    {:ok, %__MODULE__{table: table}}
  end

  @impl true
  def terminate(_reason, state) do
    # Clean up ETS table on shutdown
    try do
      :ets.delete(state.table)
    rescue
      ArgumentError -> :ok
    end

    :ok
  end

  @impl true
  def handle_call({:create, name, founder_id, opts}, _from, state) do
    normalized = normalize_name(name)

    case :ets.lookup(state.table, normalized) do
      [{^normalized, _}] ->
        {:reply, {:error, :already_exists}, state}

      [] ->
        guild = %{
          id: generate_id(),
          name: name,
          normalized_name: normalized,
          founder_id: founder_id,
          leader_id: founder_id,
          members: [founder_id],
          treasury: Keyword.get(opts, :treasury, 0),
          xp: 0,
          level: 1,
          created_at: DateTime.utc_now()
        }

        :ets.insert(state.table, {normalized, guild})
        Logger.info("[GuildRegistry] Created guild '#{name}' by #{founder_id}")
        {:reply, {:ok, guild}, state}
    end
  end

  @impl true
  def handle_call({:get_by_member, member_id}, _from, state) do
    result =
      :ets.tab2list(state.table)
      |> Enum.find(fn {_key, guild} -> member_id in guild.members end)

    case result do
      {_key, guild} -> {:reply, {:ok, guild}, state}
      nil -> {:reply, {:error, :not_found}, state}
    end
  end

  @impl true
  def handle_call({:add_member, guild_name, member_id}, _from, state) do
    normalized = normalize_name(guild_name)

    case :ets.lookup(state.table, normalized) do
      [{^normalized, guild}] ->
        if member_id in guild.members do
          {:reply, {:error, :already_member}, state}
        else
          updated = %{guild | members: [member_id | guild.members]}
          :ets.insert(state.table, {normalized, updated})
          {:reply, {:ok, updated}, state}
        end

      [] ->
        {:reply, {:error, :not_found}, state}
    end
  end

  @impl true
  def handle_call({:remove_member, guild_name, member_id}, _from, state) do
    normalized = normalize_name(guild_name)

    case :ets.lookup(state.table, normalized) do
      [{^normalized, guild}] ->
        if member_id not in guild.members do
          {:reply, {:error, :not_member}, state}
        else
          updated = %{guild | members: List.delete(guild.members, member_id)}

          if Enum.empty?(updated.members) do
            # Disband guild if no members left
            :ets.delete(state.table, normalized)
            Logger.info("[GuildRegistry] Guild '#{guild.name}' disbanded (no members)")
            {:reply, {:ok, :disbanded}, state}
          else
            # Transfer leadership if leader left
            updated =
              if member_id == updated.leader_id do
                %{updated | leader_id: hd(updated.members)}
              else
                updated
              end

            :ets.insert(state.table, {normalized, updated})
            {:reply, {:ok, updated}, state}
          end
        end

      [] ->
        {:reply, {:error, :not_found}, state}
    end
  end

  @impl true
  def handle_call({:donate, guild_name, amount}, _from, state) do
    normalized = normalize_name(guild_name)

    case :ets.lookup(state.table, normalized) do
      [{^normalized, guild}] ->
        updated = %{guild | treasury: guild.treasury + amount}
        :ets.insert(state.table, {normalized, updated})
        {:reply, {:ok, updated}, state}

      [] ->
        {:reply, {:error, :not_found}, state}
    end
  end

  @impl true
  def handle_call({:add_xp, guild_name, amount}, _from, state) do
    normalized = normalize_name(guild_name)

    case :ets.lookup(state.table, normalized) do
      [{^normalized, guild}] ->
        new_xp = guild.xp + amount
        new_level = calculate_level(new_xp)
        updated = %{guild | xp: new_xp, level: new_level}
        :ets.insert(state.table, {normalized, updated})
        {:reply, {:ok, updated}, state}

      [] ->
        {:reply, {:error, :not_found}, state}
    end
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp normalize_name(name) when is_binary(name) do
    name |> String.downcase() |> String.trim()
  end

  defp normalize_name(name) when is_atom(name) do
    name |> Atom.to_string() |> normalize_name()
  end

  defp generate_id do
    :crypto.strong_rand_bytes(8) |> Base.encode16(case: :lower)
  end

  defp calculate_level(xp) do
    # Level formula: level = (xp / base_xp)^(1/exponent) + 1
    base_xp = Balance.get([:guilds, :xp_base], 1000)
    exponent = Balance.get([:guilds, :xp_exponent], 1.5)

    level = :math.pow(xp / base_xp, 1 / exponent) |> floor()
    max(1, level + 1)
  end
end
