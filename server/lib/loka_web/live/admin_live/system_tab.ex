defmodule LokaWeb.AdminLive.SystemTab do
  @moduledoc """
  System tab component for the admin interface.
  Displays server info and system actions.
  """
  use LokaWeb, :live_component

  @impl true
  def render(assigns) do
    ~H"""
    <div class="admin-section">
      <h2 class="admin-section-title">System</h2>

      <div class="admin-grid-system">
        <div class="card bg-base-200">
          <div class="card-body">
            <h3 class="card-title">Server Info</h3>
            <dl class="admin-dl">
              <div class="admin-dl-row">
                <dt class="admin-dl-term">Elixir Version</dt>
                <dd>{@system_info.elixir_version}</dd>
              </div>
              <div class="admin-dl-row">
                <dt class="admin-dl-term">OTP Version</dt>
                <dd>{@system_info.otp_version}</dd>
              </div>
              <div class="admin-dl-row">
                <dt class="admin-dl-term">Phoenix Version</dt>
                <dd>{@system_info.phoenix_version}</dd>
              </div>
              <div class="admin-dl-row">
                <dt class="admin-dl-term">Memory Usage</dt>
                <dd>{format_bytes(@system_info.memory_usage)}</dd>
              </div>
              <div class="admin-dl-row">
                <dt class="admin-dl-term">Process Count</dt>
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
