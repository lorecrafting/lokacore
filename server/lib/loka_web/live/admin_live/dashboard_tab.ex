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
    <div class="flex flex-col gap-6">
      <h2 class="text-2xl font-bold">Dashboard</h2>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <.stat_card title="Total Players" value={@stats.total_players} icon="hero-users" />
        <.stat_card title="Total Rooms" value={@stats.total_rooms} icon="hero-map" />
        <.stat_card title="Total Entities" value={@stats.total_entities} icon="hero-cube" />
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
            <p class="opacity-70 mb-4">
              Welcome to the Loka Admin Dashboard. Use the sidebar to navigate between sections.
            </p>
            <ul class="list-disc list-inside flex flex-col gap-1 text-sm">
              <li><strong>World Builder</strong> - Create rooms, entities, quests, and dialogues</li>
              <li><strong>Quests</strong> - Debug player quest states and force completions</li>
              <li><strong>Testing</strong> - Run content validation and balance analysis</li>
              <li><strong>Audit Log</strong> - View admin action history</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    """
  end
end
