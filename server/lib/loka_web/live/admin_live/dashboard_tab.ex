defmodule LokaWeb.AdminLive.DashboardTab do
  @moduledoc """
  Dashboard tab component for the admin interface.
  Displays system statistics and quick start guide.
  """
  use LokaWeb, :live_component

  import LokaWeb.AdminLive.Components, only: [stat_card: 1]

  @impl true
  def render(assigns) do
    ~H"""
    <div class="admin-section">
      <h2 class="admin-section-title">Dashboard</h2>

      <div class="admin-grid-stats">
        <.stat_card title="Total Players" value={@stats.total_players} icon="hero-users" />
        <.stat_card title="Total Rooms" value={@stats.total_rooms} icon="hero-map" />
        <.stat_card title="Total Entities" value={@stats.total_entities} icon="hero-cube" />
        <.stat_card title="Scripts Loaded" value={@stats.scripts_loaded} icon="hero-code-bracket" />
      </div>

      <div class="card bg-base-200">
        <div class="card-body">
          <h3 class="card-title">Quick Start</h3>
          <p class="admin-empty-text mb-4">
            Welcome to the Loka Admin Dashboard. Use the sidebar to navigate between sections.
          </p>
          <ul class="admin-quickstart-list">
            <li><strong>Rooms</strong> - Create and manage game locations</li>
            <li><strong>Entities</strong> - Create NPCs, items, and other objects</li>
            <li><strong>Scripts</strong> - Write Lua scripts for custom behavior</li>
            <li><strong>System</strong> - Export/import world data</li>
          </ul>
        </div>
      </div>
    </div>
    """
  end
end
