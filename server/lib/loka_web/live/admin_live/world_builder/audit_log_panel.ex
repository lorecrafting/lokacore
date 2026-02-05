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
    <div class={[
      "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-wb-panel-header border border-wb-border rounded-wb-lg w-[600px] max-w-[90vw] max-h-[80vh] flex flex-col z-[1001] shadow-[0_20px_60px_rgba(0,0,0,0.5)] animate-[modalSlideIn_0.2s_ease-out]",
      !@show && "hidden"
    ]}>
      <div class="flex items-center justify-between py-3 px-4 border-b border-wb-border bg-wb-panel-alt rounded-t-wb-lg">
        <div class="flex items-center gap-2 font-semibold text-wb-text-bright">
          <.icon name="hero-document-magnifying-glass" class="size-5" />
          <span>Audit Log</span>
          <span :if={@project_key} class="font-normal text-wb-text-muted text-[0.85rem]">
            ({@project_key})
          </span>
        </div>
        <div class="flex items-center gap-2">
          <select
            name="filter"
            class="bg-wb-panel border border-wb-border rounded-wb-md text-wb-text py-1 px-2 text-[0.8rem]"
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

      <div class="flex-1 overflow-y-auto p-3 min-h-[200px] max-h-[60vh]">
        <div
          :if={@loading}
          class="flex flex-col items-center justify-center h-[200px] text-wb-text-dim"
        >
          <.icon name="hero-arrow-path" class="size-6 animate-spin text-gray-500" />
          <span class="text-gray-500 mt-2">Loading...</span>
        </div>
        <div
          :if={!@loading && @entries == []}
          class="flex flex-col items-center justify-center h-[200px] text-wb-text-dim"
        >
          <.icon name="hero-inbox" class="size-8 text-gray-600 mb-2" />
          <p class="text-gray-500">No audit entries found</p>
          <p class="text-gray-600 text-sm mt-1">
            Tool calls will appear here when the AI uses tools
          </p>
        </div>
        <div :if={!@loading && @entries != []} class="flex flex-col gap-2">
          <%= for entry <- @entries do %>
            <.audit_entry entry={entry} />
          <% end %>
        </div>
      </div>
    </div>
    """
  end

  attr :entry, :map, required: true

  defp audit_entry(assigns) do
    ~H"""
    <div class={[
      "bg-wb-panel-alt border border-wb-border rounded-wb-md py-2.5 px-3",
      @entry.result_status == "error" && "!border-wb-danger-border !bg-wb-danger-surface"
    ]}>
      <div class="flex items-center gap-2 mb-2">
        <div class="shrink-0">
          <.icon
            :if={@entry.result_status == "success"}
            name="hero-check-circle"
            class="size-4 text-green-500"
          />
          <.icon
            :if={@entry.result_status != "success"}
            name="hero-x-circle"
            class="size-4 text-red-500"
          />
        </div>
        <div class="font-semibold text-wb-text text-[0.9rem]">
          {format_tool_name(@entry.tool_name)}
        </div>
        <div class="ml-auto text-[0.75rem] text-wb-text-dim">{format_time(@entry.inserted_at)}</div>
      </div>
      <div class="text-[0.8rem]">
        <div class="mt-1.5">
          <span class="text-wb-text-dim font-medium">Args:</span>
          <code class="block bg-wb-border-dark py-1.5 px-2 rounded-wb-md mt-1 text-[0.75rem] text-wb-text-muted overflow-x-auto max-h-[100px] whitespace-pre-wrap break-words">
            {truncate_args(@entry.tool_args)}
          </code>
        </div>
        <div
          :if={@entry.result_detail}
          class="mt-1.5"
        >
          <span class="text-wb-text-dim font-medium">Result:</span>
          <code class={[
            "block bg-wb-border-dark py-1.5 px-2 rounded-wb-md mt-1 text-[0.75rem] text-wb-text-muted overflow-x-auto max-h-[100px] whitespace-pre-wrap break-words",
            @entry.result_status == "error" && "!text-wb-danger-text"
          ]}>
            {truncate_result(@entry.result_detail)}
          </code>
        </div>
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
