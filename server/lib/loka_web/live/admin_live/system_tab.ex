defmodule LokaWeb.AdminLive.SystemTab do
  @moduledoc """
  System tab component for the admin interface.
  Displays server info and system actions.
  """
  use LokaWeb, :live_component

  @impl true
  def render(assigns) do
    ~H"""
    <div class="flex flex-col gap-6">
      <h2 class="text-2xl font-bold">System</h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="card bg-base-200">
          <div class="card-body">
            <h3 class="card-title">Server Info</h3>
            <dl class="flex flex-col gap-2 text-sm">
              <div class="flex justify-between">
                <dt class="opacity-70">Elixir Version</dt>
                <dd>{@system_info.elixir_version}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="opacity-70">OTP Version</dt>
                <dd>{@system_info.otp_version}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="opacity-70">Phoenix Version</dt>
                <dd>{@system_info.phoenix_version}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="opacity-70">Memory Usage</dt>
                <dd>{format_bytes(@system_info.memory_usage)}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="opacity-70">Process Count</dt>
                <dd>{@system_info.process_count}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div class="card bg-base-200">
          <div class="card-body">
            <h3 class="card-title">Actions</h3>
            <div class="space-y-2">
              <button phx-click="reload_scripts" class="btn btn-outline btn-sm w-full">
                <.icon name="hero-arrow-path" class="size-4" /> Reload Scripts
              </button>
              <button phx-click="export_world" class="btn btn-outline btn-sm w-full">
                <.icon name="hero-arrow-down-tray" class="size-4" /> Export World
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    """
  end

  defp format_bytes(bytes) when bytes < 1024, do: "#{bytes} B"
  defp format_bytes(bytes) when bytes < 1_048_576, do: "#{Float.round(bytes / 1024, 1)} KB"
  defp format_bytes(bytes), do: "#{Float.round(bytes / 1_048_576, 1)} MB"
end
