defmodule LokaWeb.AdminLive.DashboardTab do
  @moduledoc """
  Dashboard tab component for the admin interface.
  Displays system statistics and quick start guide.
  """
  use LokaWeb, :live_component

  import LokaWeb.AdminLive.Components, only: [stat_card: 1]

  alias Loka.Framework.Broadcast

  @impl true
  def handle_event("send_broadcast", %{"message" => message, "type" => type}, socket) do
    type_atom = String.to_existing_atom(type)
    Broadcast.to_all(message, type_atom)

    {:noreply,
     socket
     |> put_flash(:info, "Broadcast sent to all online players")}
  end

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

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="card bg-base-200">
          <div class="card-body">
            <h3 class="card-title">Quick Broadcast</h3>
            <p class="text-sm opacity-70 mb-3">
              Send a message to all online players
            </p>
            <form phx-submit="send_broadcast" phx-target={@myself}>
              <div class="form-control mb-3">
                <textarea
                  name="message"
                  class="textarea textarea-bordered w-full"
                  placeholder="Enter your message..."
                  rows="2"
                  required
                ></textarea>
              </div>
              <div class="flex gap-2">
                <select name="type" class="select select-bordered select-sm">
                  <option value="system">System</option>
                  <option value="event">Event</option>
                  <option value="emergency">Emergency</option>
                </select>
                <button type="submit" class="btn btn-primary btn-sm flex-1">
                  <.icon name="hero-megaphone" class="size-4" /> Send Broadcast
                </button>
              </div>
            </form>
          </div>
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
    </div>
    """
  end
end
