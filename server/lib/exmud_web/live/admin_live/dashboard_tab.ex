defmodule ExmudWeb.AdminLive.DashboardTab do
  @moduledoc """
  Dashboard tab component for the admin interface.
  Displays system statistics and quick start guide.
  """
  use ExmudWeb, :live_component

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
            Welcome to the ExMUD Admin Dashboard. Use the sidebar to navigate between sections.
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

  attr :title, :string, required: true
  attr :value, :any, required: true
  attr :icon, :string, required: true

  defp stat_card(assigns) do
    ~H"""
    <div class="admin-stat-card">
      <div class="admin-stat-content">
        <div class="admin-stat-icon-wrapper">
          <div class="admin-stat-icon">
            <.icon name={@icon} class="size-6 text-primary" />
          </div>
          <div>
            <p class="admin-stat-value">{@value}</p>
            <p class="admin-stat-label">{@title}</p>
          </div>
        </div>
      </div>
    </div>
    """
  end
end
