defmodule Loka.Admin.Audit do
  @moduledoc """
  Audit logging for World Builder admin actions.

  Provides non-blocking, async audit logging that captures who did what, when,
  and the before/after state of changes. Uses Task.Supervisor for async logging
  to avoid slowing down admin operations.

  ## Setup

  In LiveView mount, initialize audit context:

      socket = Audit.init_context(socket, player, get_connect_info(socket))

  ## Usage

  Log actions in event handlers:

      # Create
      socket = Audit.log(socket, :create, :room, room.key, nil, room_data)

      # Update
      socket = Audit.log(socket, :update, :npc, npc.key, old_state, new_state)

      # Delete
      socket = Audit.log(socket, :delete, :item, item.key, old_state, nil)

      # Batch operations
      socket = Audit.log(socket, :batch_delete, :room, nil, nil, nil, %{count: 5, keys: keys})

  ## Synchronous Logging

  For critical operations that must be logged before returning:

      socket = Audit.log_sync(socket, :delete, :quest, quest.key, quest, nil)
  """

  alias Loka.Admin.AuditLog
  alias Loka.Repo
  require Logger

  @task_supervisor Loka.Admin.Audit.TaskSupervisor

  @doc """
  Initialize audit context in LiveView socket.

  Extracts player info and connection details for audit logging.

  ## Parameters

  - `socket` - The LiveView socket
  - `player` - The current player struct (or nil)
  - `conn_info` - Connection info from `get_connect_info/1` (optional)

  ## Returns

  Socket with `:audit_context` assign containing:
  - `:player_id` - The player's ID
  - `:ip_address` - Request IP address
  - `:user_agent` - Browser user agent

  ## Example

      def mount(_params, _session, socket) do
        conn_info = get_connect_info(socket)
        socket = Audit.init_context(socket, socket.assigns.current_player, conn_info)
        {:ok, socket}
      end
  """
  def init_context(socket, player, conn_info \\ %{}) do
    context = %{
      player_id: player && player.id,
      ip_address: extract_ip(conn_info),
      user_agent: extract_user_agent(conn_info)
    }

    Phoenix.Component.assign(socket, :audit_context, context)
  end

  @doc """
  Log an auditable action asynchronously.

  Spawns a task to insert the audit log without blocking the caller.
  Returns the socket unchanged (for easy piping).

  ## Parameters

  - `socket` - The LiveView socket with `:audit_context`
  - `action` - Action type: :create, :update, :delete, :batch_create, :batch_update, :batch_delete
  - `entity_type` - Entity type: :room, :npc, :item, :quest, :dialogue, etc.
  - `entity_key` - The entity's unique key (can be nil for batch ops)
  - `before_state` - State before the change (nil for creates)
  - `after_state` - State after the change (nil for deletes)
  - `metadata` - Optional additional context map

  ## Example

      {:noreply,
       socket
       |> Audit.log(:create, :room, room.key, nil, room)
       |> assign(:rooms, updated_rooms)}
  """
  def log(socket, action, entity_type, entity_key, before_state, after_state, metadata \\ %{}) do
    context = socket.assigns[:audit_context]

    if context do
      Task.Supervisor.start_child(@task_supervisor, fn ->
        do_log(context, action, entity_type, entity_key, before_state, after_state, metadata)
      end)
    else
      Logger.warning(
        "[Audit] No audit_context in socket, skipping log for #{action} #{entity_type}"
      )
    end

    socket
  end

  @doc """
  Log an auditable action synchronously.

  Inserts the audit log before returning. Use for critical operations
  that must be logged before the response is sent.

  ## Parameters

  Same as `log/7`.

  ## Example

      socket = Audit.log_sync(socket, :delete, :quest, quest.key, quest, nil)
  """
  def log_sync(
        socket,
        action,
        entity_type,
        entity_key,
        before_state,
        after_state,
        metadata \\ %{}
      ) do
    context = socket.assigns[:audit_context]

    if context do
      do_log(context, action, entity_type, entity_key, before_state, after_state, metadata)
    else
      Logger.warning(
        "[Audit] No audit_context in socket, skipping sync log for #{action} #{entity_type}"
      )
    end

    socket
  end

  @doc """
  Log an action without a socket (for non-LiveView contexts).

  ## Parameters

  - `player` - The player struct
  - `action` - Action type
  - `entity_type` - Entity type
  - `entity_key` - Entity key
  - `before_state` - State before change
  - `after_state` - State after change
  - `metadata` - Optional metadata
  - `opts` - Options: `:ip_address`, `:user_agent`

  ## Example

      Audit.log_direct(player, :create, :room, "tavern", nil, room_data)
  """
  def log_direct(
        player,
        action,
        entity_type,
        entity_key,
        before_state,
        after_state,
        metadata \\ %{},
        opts \\ []
      ) do
    context = %{
      player_id: player && player.id,
      ip_address: Keyword.get(opts, :ip_address),
      user_agent: Keyword.get(opts, :user_agent)
    }

    do_log(context, action, entity_type, entity_key, before_state, after_state, metadata)
  end

  # Private implementation

  defp do_log(context, action, entity_type, entity_key, before_state, after_state, metadata) do
    attrs = %{
      player_id: context.player_id,
      action: to_string(action),
      entity_type: to_string(entity_type),
      entity_key: entity_key,
      before_state: sanitize_state(before_state),
      after_state: sanitize_state(after_state),
      metadata: metadata,
      ip_address: context.ip_address,
      user_agent: context.user_agent
    }

    case %AuditLog{} |> AuditLog.changeset(attrs) |> Repo.insert() do
      {:ok, _log} ->
        :ok

      {:error, changeset} ->
        Logger.error("[Audit] Failed to insert audit log: #{inspect(changeset.errors)}")
        :error
    end
  end

  defp sanitize_state(nil), do: nil

  defp sanitize_state(state) when is_struct(state) do
    # Convert struct to map, remove Ecto metadata
    state
    |> Map.from_struct()
    |> Map.drop([:__meta__, :__struct__])
    |> sanitize_state()
  end

  defp sanitize_state(state) when is_map(state) do
    state
    |> Map.drop([:__meta__, :__struct__])
    |> Enum.reduce(%{}, fn {k, v}, acc ->
      # Skip large binary data and internal fields
      cond do
        is_binary(v) && byte_size(v) > 10_000 ->
          Map.put(acc, k, "[truncated: #{byte_size(v)} bytes]")

        is_struct(v, Ecto.Association.NotLoaded) ->
          acc

        true ->
          Map.put(acc, k, v)
      end
    end)
    |> ensure_json_serializable()
  end

  defp sanitize_state(state), do: state

  defp ensure_json_serializable(map) do
    # Ensure the map can be JSON encoded (for storage in :map field)
    case Jason.encode(map) do
      {:ok, json} -> Jason.decode!(json)
      {:error, _} -> %{error: "Could not serialize state"}
    end
  rescue
    _ -> %{error: "Could not serialize state"}
  end

  defp extract_ip(conn_info) do
    case conn_info[:peer_data] do
      %{address: {a, b, c, d}} -> "#{a}.#{b}.#{c}.#{d}"
      %{address: addr} when is_tuple(addr) -> Enum.join(Tuple.to_list(addr), ":")
      _ -> nil
    end
  end

  defp extract_user_agent(conn_info) do
    conn_info[:user_agent]
  end
end
