defmodule Exmud.Engine.WorldGraph.LayoutManager do
  @moduledoc """
  Automatically maintains room coordinates based on exit connections.

  Coordinates are derived from the exit graph, not manually set. When exits
  are created or deleted, this module automatically re-computes coordinates
  for affected rooms.

  ## Design Philosophy

  - Coordinates are computed, not stored as primary data
  - Single source of truth: exits define the spatial relationship
  - Auto-layout runs on world load and when exits change
  - Debounces rapid changes to avoid excessive computation
  """

  use GenServer
  require Logger

  alias Exmud.Engine.{WorldGraph, Entities, Hooks}

  @debounce_ms 500

  # =============================================================================
  # Client API
  # =============================================================================

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Registers hooks to automatically update layout when exits change.
  Call this after the Hooks GenServer is started.
  """
  def register_hooks do
    Hooks.register(:at_entity_creation, __MODULE__, :on_entity_created, priority: 50)
    Hooks.register(:at_entity_delete, __MODULE__, :on_entity_deleted, priority: 50)
    Logger.info("[LayoutManager] Registered hooks for automatic coordinate updates")
    :ok
  end

  @doc """
  Triggers a full layout refresh for all rooms.
  """
  def refresh_all do
    GenServer.cast(__MODULE__, :refresh_all)
  end

  @doc """
  Triggers layout refresh starting from a specific room.
  """
  def refresh_from(room_id) when is_binary(room_id) do
    GenServer.cast(__MODULE__, {:refresh_from, room_id})
  end

  # =============================================================================
  # Hook Callbacks (called by Hooks GenServer)
  # =============================================================================

  @doc false
  def on_entity_created(entity, _context \\ %{}) do
    if entity.type == :exit do
      Logger.debug("[LayoutManager] Exit created: #{entity.key}, scheduling layout refresh")
      schedule_refresh(entity.location_id)
    end

    :ok
  end

  @doc false
  def on_entity_deleted(entity, _context \\ %{}) do
    if entity.type == :exit do
      Logger.debug("[LayoutManager] Exit deleted: #{entity.key}, scheduling layout refresh")
      schedule_refresh(entity.location_id)
    end

    :ok
  end

  defp schedule_refresh(room_id) when is_binary(room_id) do
    GenServer.cast(__MODULE__, {:schedule_refresh, room_id})
  end

  defp schedule_refresh(_), do: :ok

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(_opts) do
    # Register hooks on startup
    register_hooks()

    state = %{
      pending_refresh: nil,
      debounce_timer: nil
    }

    {:ok, state}
  end

  @impl true
  def handle_cast(:refresh_all, state) do
    state = cancel_pending_timer(state)
    do_refresh_all()
    {:noreply, %{state | pending_refresh: nil}}
  end

  @impl true
  def handle_cast({:refresh_from, room_id}, state) do
    state = cancel_pending_timer(state)
    do_refresh_from(room_id)
    {:noreply, %{state | pending_refresh: nil}}
  end

  @impl true
  def handle_cast({:schedule_refresh, room_id}, state) do
    # Cancel existing timer if any
    state = cancel_pending_timer(state)

    # Schedule debounced refresh
    timer = Process.send_after(self(), {:do_refresh, room_id}, @debounce_ms)

    {:noreply, %{state | pending_refresh: room_id, debounce_timer: timer}}
  end

  @impl true
  def handle_info({:do_refresh, room_id}, state) do
    do_refresh_from(room_id)
    {:noreply, %{state | pending_refresh: nil, debounce_timer: nil}}
  end

  @impl true
  def handle_info(_msg, state), do: {:noreply, state}

  # =============================================================================
  # Private Functions
  # =============================================================================

  defp cancel_pending_timer(%{debounce_timer: nil} = state), do: state

  defp cancel_pending_timer(%{debounce_timer: timer} = state) do
    Process.cancel_timer(timer)
    %{state | debounce_timer: nil}
  end

  defp do_refresh_all do
    # Find a room to start from (prefer rooms that already have coordinates at origin)
    case find_starting_room() do
      nil ->
        Logger.debug("[LayoutManager] No rooms found to layout")
        :ok

      room ->
        Logger.info("[LayoutManager] Running full layout from #{room.key}")
        run_layout(room.id)
    end
  end

  defp do_refresh_from(room_id) do
    # Verify room exists
    case Entities.get_entity(room_id) do
      nil ->
        # Room was deleted, try to find another starting point
        do_refresh_all()

      room_schema ->
        room = Entities.to_entity(room_schema)
        Logger.debug("[LayoutManager] Running layout from #{room.key}")
        run_layout(room.id)
    end
  end

  defp find_starting_room do
    rooms = Entities.list_by_type(:room)

    # Prefer room at origin, or first room with coordinates, or just first room
    rooms
    |> Enum.map(&Entities.to_entity/1)
    |> Enum.sort_by(fn room ->
      case WorldGraph.get_coordinates(room) do
        {0, 0, 0} -> 0
        {_, _, _} -> 1
        nil -> 2
      end
    end)
    |> List.first()
  end

  defp run_layout(starting_room_id) do
    case WorldGraph.auto_layout(starting_room_id) do
      {:ok, count} ->
        Logger.info("[LayoutManager] Laid out #{count} rooms with coordinates")
        {:ok, count}

      {:error, reason} ->
        Logger.warning("[LayoutManager] Layout failed: #{inspect(reason)}")
        {:error, reason}
    end
  end
end
