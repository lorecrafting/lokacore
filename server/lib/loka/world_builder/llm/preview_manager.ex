defmodule Loka.WorldBuilder.LLM.PreviewManager do
  @moduledoc """
  Manages preview of LLM-generated content before committing to DB.

  Generated content renders as translucent in 3D until accepted.

  ## Lifecycle

  1. LLM generates content
  2. `add_preview/3` creates a pending preview
  3. User reviews in UI (translucent rendering)
  4. `accept_preview/1` commits to database, or `reject_preview/1` discards

  ## Cleanup

  Previews are automatically cleaned up:
  - After 30 minutes of inactivity
  - When a user exceeds 50 previews (oldest removed first)
  """

  use GenServer
  require Logger

  alias Loka.WorldBuilder.RoomManager
  alias Loka.WorldBuilder.EntityManager

  # Configuration
  @preview_ttl_minutes 30
  @max_previews_per_user 50
  @cleanup_interval_minutes 5

  # Client API

  @doc """
  Starts the PreviewManager GenServer.
  """
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @doc """
  Adds a new preview for LLM-generated content.

  The preview is created in :pending status and must be explicitly
  accepted or rejected by the user.

  ## Parameters

    * `user_id` - ID of the user who owns this preview
    * `content_type` - Type of content (:room, :exit, :npc)
    * `content_data` - Map containing the content data

  ## Returns

    * `{:ok, preview_id}` - Preview created successfully
    * `{:error, reason}` - Failed to create preview
  """
  @spec add_preview(term(), atom(), map()) :: {:ok, String.t()} | {:error, term()}
  def add_preview(user_id, content_type, content_data) do
    GenServer.call(__MODULE__, {:add_preview, user_id, content_type, content_data})
  end

  @doc """
  Gets all pending previews for a user.

  ## Returns

  List of preview maps with keys: :id, :user_id, :type, :data, :created_at, :status
  """
  @spec get_previews(term()) :: [map()]
  def get_previews(user_id) do
    GenServer.call(__MODULE__, {:get_previews, user_id})
  end

  @doc """
  Accepts a preview and commits it to the database.

  ## Returns

    * `{:ok, result}` - Content committed successfully
    * `{:error, :not_found}` - Preview doesn't exist
    * `{:error, reason}` - Failed to commit content
  """
  @spec accept_preview(String.t()) :: {:ok, term()} | {:error, term()}
  def accept_preview(preview_id) do
    GenServer.call(__MODULE__, {:accept_preview, preview_id})
  end

  @doc """
  Rejects and deletes a preview.

  ## Returns

    * `:ok` - Preview deleted
    * `{:error, :not_found}` - Preview doesn't exist
  """
  @spec reject_preview(String.t()) :: :ok | {:error, :not_found}
  def reject_preview(preview_id) do
    GenServer.call(__MODULE__, {:reject_preview, preview_id})
  end

  @doc """
  Clears all previews for a user.
  """
  @spec clear_previews(term()) :: :ok
  def clear_previews(user_id) do
    GenServer.call(__MODULE__, {:clear_previews, user_id})
  end

  # Server Callbacks

  @impl true
  def init(_opts) do
    schedule_cleanup()
    {:ok, %{previews: %{}, counter: 0}}
  end

  @impl true
  def handle_call({:add_preview, user_id, content_type, content_data}, _from, state) do
    # Generate ID inside GenServer to ensure atomicity
    preview_id = generate_preview_id(state.counter)

    preview = %{
      id: preview_id,
      user_id: user_id,
      type: content_type,
      data: content_data,
      created_at: DateTime.utc_now(),
      status: :pending
    }

    new_previews = Map.put(state.previews, preview_id, preview)
    new_state = %{state | previews: new_previews, counter: state.counter + 1}

    {:reply, {:ok, preview_id}, new_state}
  end

  @impl true
  def handle_call({:get_previews, user_id}, _from, state) do
    user_previews =
      state.previews
      |> Map.values()
      |> Enum.filter(&(&1.user_id == user_id && &1.status == :pending))

    {:reply, user_previews, state}
  end

  @impl true
  def handle_call({:accept_preview, preview_id}, _from, state) do
    case Map.get(state.previews, preview_id) do
      nil ->
        {:reply, {:error, :not_found}, state}

      preview ->
        result = commit_preview(preview)
        new_previews = Map.put(state.previews, preview_id, %{preview | status: :accepted})
        {:reply, result, %{state | previews: new_previews}}
    end
  end

  @impl true
  def handle_call({:reject_preview, preview_id}, _from, state) do
    case Map.get(state.previews, preview_id) do
      nil ->
        {:reply, {:error, :not_found}, state}

      _preview ->
        new_previews = Map.delete(state.previews, preview_id)
        {:reply, :ok, %{state | previews: new_previews}}
    end
  end

  @impl true
  def handle_call({:clear_previews, user_id}, _from, state) do
    new_previews =
      state.previews
      |> Enum.reject(fn {_id, preview} -> preview.user_id == user_id end)
      |> Map.new()

    {:reply, :ok, %{state | previews: new_previews}}
  end

  @impl true
  def handle_info(:cleanup_old_previews, state) do
    cutoff = DateTime.add(DateTime.utc_now(), -@preview_ttl_minutes, :minute)

    # First, apply TTL cleanup
    after_ttl =
      state.previews
      |> Enum.reject(fn {_id, preview} ->
        DateTime.compare(preview.created_at, cutoff) == :lt
      end)
      |> Map.new()

    # Then, enforce per-user limits (keep newest @max_previews_per_user)
    new_previews = enforce_user_limits(after_ttl)

    removed_count = map_size(state.previews) - map_size(new_previews)

    if removed_count > 0 do
      Logger.info(
        "[PreviewManager] Cleaned up #{removed_count} old previews (#{map_size(new_previews)} remaining)"
      )
    end

    schedule_cleanup()
    {:noreply, %{state | previews: new_previews}}
  end

  # Private Helpers

  defp enforce_user_limits(previews) do
    # Group by user, sort by created_at desc, keep newest @max_previews_per_user
    previews
    |> Map.values()
    |> Enum.group_by(& &1.user_id)
    |> Enum.flat_map(fn {_user_id, user_previews} ->
      user_previews
      |> Enum.sort_by(& &1.created_at, {:desc, DateTime})
      |> Enum.take(@max_previews_per_user)
    end)
    |> Map.new(&{&1.id, &1})
  end

  defp commit_preview(%{type: :room, data: room_data}) do
    RoomManager.create_room(room_data)
  end

  defp commit_preview(%{type: :exit, data: exit_data}) do
    RoomManager.add_exit(exit_data.from, exit_data.direction, exit_data.to)
  end

  defp commit_preview(%{type: :npc, data: npc_data}) do
    EntityManager.create_entity(:npc, npc_data)
  end

  defp commit_preview(%{type: type}) do
    {:error, {:unknown_type, type}}
  end

  defp schedule_cleanup do
    Process.send_after(self(), :cleanup_old_previews, :timer.minutes(@cleanup_interval_minutes))
  end

  defp generate_preview_id(counter) do
    "preview_#{counter}_#{:erlang.unique_integer([:positive])}"
  end
end
