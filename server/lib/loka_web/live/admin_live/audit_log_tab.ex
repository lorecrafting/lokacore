defmodule LokaWeb.AdminLive.AuditLogTab do
  @moduledoc """
  Audit log tab component for the admin interface.

  Displays a filterable, paginated list of admin actions for compliance
  and debugging purposes.
  """
  use LokaWeb, :live_component

  alias Loka.Admin.AuditLog
  alias Loka.Repo

  @per_page 25

  @impl true
  def mount(socket) do
    {:ok,
     socket
     |> assign(:logs, [])
     |> assign(:filters, %{entity_type: nil, action: nil})
     |> assign(:page, 1)
     |> assign(:total_count, 0)
     |> assign(:loading, true)}
  end

  @impl true
  def update(assigns, socket) do
    socket = assign(socket, assigns)

    # Load logs on first update or when tab becomes active
    socket =
      if socket.assigns.loading do
        load_logs(socket)
      else
        socket
      end

    {:ok, socket}
  end

  @impl true
  def handle_event("filter_changed", params, socket) do
    filters = %{
      entity_type: normalize_filter(params["entity_type"]),
      action: normalize_filter(params["action"])
    }

    {:noreply,
     socket
     |> assign(:filters, filters)
     |> assign(:page, 1)
     |> load_logs()}
  end

  @impl true
  def handle_event("next_page", _params, socket) do
    max_page = ceil(socket.assigns.total_count / @per_page)

    if socket.assigns.page < max_page do
      {:noreply,
       socket
       |> assign(:page, socket.assigns.page + 1)
       |> load_logs()}
    else
      {:noreply, socket}
    end
  end

  @impl true
  def handle_event("prev_page", _params, socket) do
    if socket.assigns.page > 1 do
      {:noreply,
       socket
       |> assign(:page, socket.assigns.page - 1)
       |> load_logs()}
    else
      {:noreply, socket}
    end
  end

  @impl true
  def handle_event("refresh", _params, socket) do
    {:noreply, load_logs(socket)}
  end

  defp load_logs(socket) do
    filters = socket.assigns.filters
    page = socket.assigns.page

    query =
      AuditLog
      |> maybe_filter_entity_type(filters.entity_type)
      |> maybe_filter_action(filters.action)

    total_count = Repo.aggregate(query, :count, :id)

    logs =
      query
      |> AuditLog.recent(@per_page * page)
      |> AuditLog.with_player()
      |> Repo.all()
      |> Enum.drop((page - 1) * @per_page)
      |> Enum.take(@per_page)

    socket
    |> assign(:logs, logs)
    |> assign(:total_count, total_count)
    |> assign(:loading, false)
  end

  defp maybe_filter_entity_type(query, nil), do: query
  defp maybe_filter_entity_type(query, type), do: AuditLog.by_entity(query, type)

  defp maybe_filter_action(query, nil), do: query
  defp maybe_filter_action(query, action), do: AuditLog.by_action(query, action)

  defp normalize_filter(""), do: nil
  defp normalize_filter(nil), do: nil
  defp normalize_filter(value), do: value

  @impl true
  def render(assigns) do
    ~H"""
    <div class="flex flex-col gap-6">
      <div class="flex justify-between items-center">
        <h2 class="text-2xl font-bold">Audit Log</h2>
        <button phx-click="refresh" phx-target={@myself} class="btn btn-sm btn-outline">
          <.icon name="hero-arrow-path" class="size-4" /> Refresh
        </button>
      </div>

      <div class="card bg-base-200 mb-4">
        <div class="card-body py-3">
          <div class="flex gap-4 items-center flex-wrap">
            <fieldset class="fieldset">
              <label class="label py-0 text-xs">Entity Type</label>
              <select
                class="select select-bordered select-sm w-40"
                phx-change="filter_changed"
                phx-target={@myself}
                name="entity_type"
              >
                <option value="">All Types</option>
                <%= for type <- AuditLog.entity_types() do %>
                  <option value={type} selected={@filters.entity_type == type}>
                    {String.capitalize(type)}
                  </option>
                <% end %>
              </select>
            </fieldset>

            <fieldset class="fieldset">
              <label class="label py-0 text-xs">Action</label>
              <select
                class="select select-bordered select-sm w-40"
                phx-change="filter_changed"
                phx-target={@myself}
                name="action"
              >
                <option value="">All Actions</option>
                <%= for action <- AuditLog.actions() do %>
                  <option value={action} selected={@filters.action == action}>
                    {format_action(action)}
                  </option>
                <% end %>
              </select>
            </fieldset>

            <div class="text-sm text-base-content/60 ml-auto">
              {if @total_count > 0, do: "#{@total_count} total entries", else: "No entries"}
            </div>
          </div>
        </div>
      </div>

      <div :if={@loading} class="flex justify-center py-8">
        <span class="loading loading-spinner loading-lg" />
      </div>

      <div :if={!@loading && @logs == []} class="card bg-base-200">
        <div class="card-body items-center text-center py-12">
          <.icon name="hero-clipboard-document-list" class="size-12 text-base-content/30 mb-2" />
          <h3 class="text-lg font-medium text-base-content/70">No audit logs yet</h3>
          <p class="text-sm text-base-content/50">
            Admin actions will appear here as they occur.
          </p>
        </div>
      </div>

      <div :if={!@loading && @logs != []} class="overflow-x-auto">
        <table class="table table-sm">
          <thead>
            <tr>
              <th>Time</th>
              <th>Admin</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Key</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            <tr :for={log <- @logs} class="hover">
              <td class="text-xs text-base-content/70 whitespace-nowrap">
                {format_timestamp(log.inserted_at)}
              </td>
              <td class="text-sm">
                {if log.player, do: log.player.email || log.player.name, else: "System"}
              </td>
              <td>
                <span class={"badge badge-sm #{action_badge_class(log.action)}"}>
                  {format_action(log.action)}
                </span>
              </td>
              <td class="text-sm">{String.capitalize(log.entity_type)}</td>
              <td class="font-mono text-xs">{log.entity_key || "-"}</td>
              <td class="text-xs">
                <span
                  :if={log.metadata && map_size(log.metadata) > 0}
                  class="tooltip"
                  data-tip={inspect(log.metadata)}
                >
                  <.icon name="hero-information-circle" class="size-4 text-base-content/50" />
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div :if={!@loading && @logs != []} class="flex justify-between items-center mt-4">
        <button
          phx-click="prev_page"
          phx-target={@myself}
          class="btn btn-sm btn-outline"
          disabled={@page <= 1}
        >
          <.icon name="hero-chevron-left" class="size-4" /> Previous
        </button>

        <span class="text-sm text-base-content/60">
          Page {@page} of {max(1, ceil(@total_count / @per_page))}
        </span>

        <button
          phx-click="next_page"
          phx-target={@myself}
          class="btn btn-sm btn-outline"
          disabled={@page >= ceil(@total_count / @per_page)}
        >
          Next <.icon name="hero-chevron-right" class="size-4" />
        </button>
      </div>
    </div>
    """
  end

  defp format_timestamp(datetime) do
    Calendar.strftime(datetime, "%Y-%m-%d %H:%M:%S")
  end

  defp format_action(action) do
    action
    |> String.replace("_", " ")
    |> String.capitalize()
  end

  defp action_badge_class(action) do
    case action do
      "create" -> "badge-success"
      "batch_create" -> "badge-success"
      "update" -> "badge-info"
      "batch_update" -> "badge-info"
      "delete" -> "badge-error"
      "batch_delete" -> "badge-error"
      _ -> "badge-ghost"
    end
  end
end
