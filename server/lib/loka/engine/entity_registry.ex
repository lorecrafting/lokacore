defmodule Loka.Engine.EntityRegistry do
  @moduledoc """
  Registry for active EntityServer processes.

  Provides on-demand process management - entities only become
  processes when they're accessed. Inactive processes stop themselves.

  ## Usage

      # Get or start an entity process
      {:ok, pid} = EntityRegistry.get_or_start(entity_id)

      # Check if entity is currently active
      case EntityRegistry.lookup(entity_id) do
        {:ok, pid} -> # Process exists
        :not_found -> # Entity is not active
      end

      # Broadcast event to all entities in a room
      EntityRegistry.broadcast_to_room(room_id, event)
  """

  use GenServer

  alias Loka.Engine.{EntityServer, EntitySupervisor}

  @registry_name Loka.Engine.EntityRegistry.Registry
  @supervisor_name Loka.Engine.EntitySupervisor

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts the EntityRegistry GenServer.

  ## Options

  - `:name` - Process name (default: __MODULE__)
  - `:registry` - Registry name for process lookup (default: @registry_name)
  - `:supervisor` - DynamicSupervisor name (default: @supervisor_name)
  """
  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Gets or starts an EntityServer for the given entity ID.

  If a process already exists, returns it. Otherwise, starts a new one.
  """
  def get_or_start(entity_id, opts \\ []) do
    registry = Keyword.get(opts, :registry, @registry_name)
    supervisor = Keyword.get(opts, :supervisor, @supervisor_name)

    case lookup(entity_id, opts) do
      {:ok, pid} ->
        {:ok, pid}

      :not_found ->
        # Start new EntityServer
        case EntitySupervisor.start_child(entity_id, registry: registry, supervisor: supervisor) do
          {:ok, pid} -> {:ok, pid}
          {:error, {:already_started, pid}} -> {:ok, pid}
          error -> error
        end
    end
  end

  @doc """
  Looks up an active EntityServer by entity ID.

  Returns `{:ok, pid}` if found, or `:not_found` if no process exists.
  """
  def lookup(entity_id, opts \\ []) do
    registry = Keyword.get(opts, :registry, @registry_name)

    case Registry.lookup(registry, entity_id) do
      [{pid, _}] -> {:ok, pid}
      [] -> :not_found
    end
  end

  @doc """
  Stops an EntityServer by entity ID.
  """
  def stop(entity_id, opts \\ []) do
    registry = Keyword.get(opts, :registry, @registry_name)

    case Registry.lookup(registry, entity_id) do
      [{pid, _}] ->
        EntityServer.stop(pid)
        :ok

      [] ->
        {:error, :not_found}
    end
  end

  @doc """
  Lists all active entity IDs.
  """
  def list_active(opts \\ []) do
    registry = Keyword.get(opts, :registry, @registry_name)

    Registry.select(registry, [{{:"$1", :_, :_}, [], [:"$1"]}])
  end

  @doc """
  Counts active entity processes.
  """
  def count_active(opts \\ []) do
    registry = Keyword.get(opts, :registry, @registry_name)

    Registry.count(registry)
  end

  @doc """
  Broadcasts an event to all active entities in a room.

  Only sends to entities that currently have active processes.
  Uses in-memory room tracking instead of database queries for efficiency.
  """
  def broadcast_to_room(room_id, event, opts \\ []) do
    registry = Keyword.get(opts, :registry, @registry_name)
    server = Keyword.get(opts, :server, __MODULE__)

    # Get room occupants from in-memory tracking (no DB query)
    entity_ids = get_room_occupants(room_id, server)

    # Send to each active entity
    Enum.each(entity_ids, fn entity_id ->
      case Registry.lookup(registry, entity_id) do
        [{pid, _}] -> EntityServer.handle_event(pid, event)
        [] -> :ok
      end
    end)

    :ok
  end

  @doc """
  Broadcasts an event to a specific entity if it's active.
  """
  def broadcast_to_entity(entity_id, event, opts \\ []) do
    registry = Keyword.get(opts, :registry, @registry_name)

    case Registry.lookup(registry, entity_id) do
      [{pid, _}] ->
        EntityServer.handle_event(pid, event)
        :ok

      [] ->
        :not_active
    end
  end

  @doc """
  Registers an entity as being in a specific room.

  Used for efficient room-based broadcasts.
  """
  def register_in_room(entity_id, room_id, server \\ __MODULE__) do
    GenServer.call(server, {:register_in_room, entity_id, room_id})
  end

  @doc """
  Unregisters an entity from a room.
  """
  def unregister_from_room(entity_id, room_id, server \\ __MODULE__) do
    GenServer.call(server, {:unregister_from_room, entity_id, room_id})
  end

  @doc """
  Gets all entity IDs registered in a room.
  """
  def get_room_occupants(room_id, server \\ __MODULE__) do
    GenServer.call(server, {:get_room_occupants, room_id})
  end

  @doc """
  Finds a player by name from online players.

  Returns `{:ok, player_map}` with id and name if found, `{:error, :not_found}` otherwise.
  This searches online players registered in the session registry.
  """
  @spec find_player_by_name(String.t()) :: {:ok, map()} | {:error, :not_found}
  def find_player_by_name(name) when is_binary(name) do
    name_downcase = String.downcase(name)

    result =
      Loka.Session.Registry.get_online_players()
      |> Enum.find(fn player ->
        player_name = Map.get(player, :name, "")
        String.downcase(player_name) == name_downcase
      end)

    case result do
      nil -> {:error, :not_found}
      player -> {:ok, player}
    end
  end

  @doc """
  Gets a player by their ID.

  Returns `{:ok, player_map}` if found online, `{:error, :not_found}` otherwise.
  """
  @spec get_player(String.t()) :: {:ok, map()} | {:error, :not_found}
  def get_player(player_id) when is_binary(player_id) do
    result =
      Loka.Session.Registry.get_online_players()
      |> Enum.find(fn player -> player.id == player_id end)

    case result do
      nil -> {:error, :not_found}
      player -> {:ok, player}
    end
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(opts) do
    # Store configuration
    state = %{
      registry: Keyword.get(opts, :registry, @registry_name),
      supervisor: Keyword.get(opts, :supervisor, @supervisor_name),
      rooms: %{}
    }

    {:ok, state}
  end

  @impl true
  def handle_call({:register_in_room, entity_id, room_id}, _from, state) do
    rooms =
      Map.update(state.rooms, room_id, MapSet.new([entity_id]), &MapSet.put(&1, entity_id))

    {:reply, :ok, %{state | rooms: rooms}}
  end

  @impl true
  def handle_call({:unregister_from_room, entity_id, room_id}, _from, state) do
    rooms =
      Map.update(state.rooms, room_id, MapSet.new(), &MapSet.delete(&1, entity_id))

    # Clean up empty rooms
    rooms =
      if Map.has_key?(rooms, room_id) and MapSet.size(rooms[room_id]) == 0 do
        Map.delete(rooms, room_id)
      else
        rooms
      end

    {:reply, :ok, %{state | rooms: rooms}}
  end

  @impl true
  def handle_call({:get_room_occupants, room_id}, _from, state) do
    occupants =
      state.rooms
      |> Map.get(room_id, MapSet.new())
      |> MapSet.to_list()

    {:reply, occupants, state}
  end
end
