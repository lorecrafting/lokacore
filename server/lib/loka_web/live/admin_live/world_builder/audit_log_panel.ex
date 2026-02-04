defmodule LokaWeb.AdminLive.WorldBuilder.AuditLogPanel do
  @moduledoc """
  Audit log viewer component for the World Builder.

  Shows history of LLM tool calls for debugging and auditing.
  """
  use Phoenix.Component
  import LokaWeb.CoreComponents

  attr :entries, :list, default: []
  attr :loading, :boolean, default: false
  attr :show, :boolean, default: false
  attr :filter, :string, default: "all"
  attr :project_key, :string, default: nil

  def audit_log_panel(assigns) do
    ~H"""
    <div class={["audit-log-panel", !@show && "hidden"]}>
      <div class="audit-log-header">
        <div class="audit-log-title">
          <.icon name="hero-document-magnifying-glass" class="size-5" />
          <span>Audit Log</span>
          <%= if @project_key do %>
            <span class="audit-log-project">({@project_key})</span>
          <% end %>
        </div>
        <div class="audit-log-actions">
          <select
            name="filter"
            class="audit-filter-select"
            phx-change="audit_filter_changed"
          >
            <option value="all" selected={@filter == "all"}>All</option>
            <option value="success" selected={@filter == "success"}>Success</option>
            <option value="error" selected={@filter == "error"}>Errors</option>
          </select>
          <button
            class="btn btn-sm btn-ghost"
            phx-click="refresh_audit_log"
            title="Refresh"
          >
            <.icon name="hero-arrow-path" class={["size-4", @loading && "animate-spin"]} />
          </button>
          <button
            class="btn btn-sm btn-ghost"
            phx-click="close_audit_log"
            title="Close"
          >
            <.icon name="hero-x-mark" class="size-4" />
          </button>
        </div>
      </div>

      <div class="audit-log-content">
        <%= if @loading do %>
          <div class="audit-log-loading">
            <.icon name="hero-arrow-path" class="size-6 animate-spin text-gray-500" />
            <span class="text-gray-500 mt-2">Loading...</span>
          </div>
        <% else %>
          <%= if @entries == [] do %>
            <div class="audit-log-empty">
              <.icon name="hero-inbox" class="size-8 text-gray-600 mb-2" />
              <p class="text-gray-500">No audit entries found</p>
              <p class="text-gray-600 text-sm mt-1">
                Tool calls will appear here when the AI uses tools
              </p>
            </div>
          <% else %>
            <div class="audit-entries">
              <%= for entry <- @entries do %>
                <.audit_entry entry={entry} />
              <% end %>
            </div>
          <% end %>
        <% end %>
      </div>
    </div>
    """
  end

  attr :entry, :map, required: true

  defp audit_entry(assigns) do
    ~H"""
    <div class={["audit-entry", @entry.result_status]}>
      <div class="audit-entry-header">
        <div class="audit-entry-status">
          <%= if @entry.result_status == "success" do %>
            <.icon name="hero-check-circle" class="size-4 text-green-500" />
          <% else %>
            <.icon name="hero-x-circle" class="size-4 text-red-500" />
          <% end %>
        </div>
        <div class="audit-entry-tool">{format_tool_name(@entry.tool_name)}</div>
        <div class="audit-entry-time">{format_time(@entry.inserted_at)}</div>
      </div>
      <div class="audit-entry-details">
        <div class="audit-entry-args">
          <span class="audit-label">Args:</span>
          <code>{truncate_args(@entry.tool_args)}</code>
        </div>
        <%= if @entry.result_detail do %>
          <div class={["audit-entry-result", @entry.result_status == "error" && "error"]}>
            <span class="audit-label">Result:</span>
            <code>{truncate_result(@entry.result_detail)}</code>
          </div>
        <% end %>
      </div>
    </div>
    """
  end

  # Helpers

  defp format_tool_name(name) when is_binary(name) do
    name
    |> String.replace("wb_", "")
    |> String.replace("_", " ")
    |> String.split(" ")
    |> Enum.map(&String.capitalize/1)
    |> Enum.join(" ")
  end

  defp format_tool_name(_), do: "Unknown"

  defp format_time(datetime) do
    Calendar.strftime(datetime, "%H:%M:%S")
  end

  defp truncate_args(args) when is_binary(args) do
    case Jason.decode(args) do
      {:ok, decoded} ->
        text = Jason.encode!(decoded)
        if String.length(text) > 100, do: String.slice(text, 0, 100) <> "...", else: text

      _ ->
        if String.length(args) > 100, do: String.slice(args, 0, 100) <> "...", else: args
    end
  end

  defp truncate_args(_), do: "{}"

  defp truncate_result(result) when is_binary(result) do
    if String.length(result) > 200, do: String.slice(result, 0, 200) <> "...", else: result
  end

  defp truncate_result(_), do: ""
end
