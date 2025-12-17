defmodule ExmudWeb.AdminLive do
  @moduledoc """
  LiveView admin dashboard for ExMUD.

  Provides tools for game administrators to manage:
  - Players and accounts
  - Rooms and world building
  - NPCs and entities
  - Scripts and behaviors
  - System monitoring
  """
  use ExmudWeb, :live_view

  @example_script """
  -- Example NPC script
  function on_enter(player)
    say("Welcome, " .. player.name .. "!")
  end

  function on_attack(attacker, target)
    if target.health < 20 then
      flee()
    end
  end
  """

  @impl true
  def mount(_params, _session, socket) do
    {:ok,
     socket
     |> assign(:active_tab, :dashboard)
     |> assign(:stats, load_stats())
     |> assign(:example_script, @example_script)}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <div class="min-h-screen">
      <div class="navbar bg-base-200 mb-6">
        <div class="flex-1">
          <span class="text-xl font-bold text-primary">ExMUD Admin</span>
        </div>
        <div class="flex-none">
          <a href={~p"/game"} class="btn btn-ghost btn-sm">
            <.icon name="hero-play" class="size-4" /> Play Game
          </a>
        </div>
      </div>

      <div class="flex gap-6 px-4">
        <aside class="w-64 flex-none">
          <ul class="menu bg-base-200 rounded-lg">
            <li>
              <button
                phx-click="switch_tab"
                phx-value-tab="dashboard"
                class={if @active_tab == :dashboard, do: "active", else: ""}
              >
                <.icon name="hero-chart-bar" class="size-4" /> Dashboard
              </button>
            </li>
            <li>
              <button
                phx-click="switch_tab"
                phx-value-tab="players"
                class={if @active_tab == :players, do: "active", else: ""}
              >
                <.icon name="hero-users" class="size-4" /> Players
              </button>
            </li>
            <li>
              <button
                phx-click="switch_tab"
                phx-value-tab="rooms"
                class={if @active_tab == :rooms, do: "active", else: ""}
              >
                <.icon name="hero-map" class="size-4" /> Rooms
              </button>
            </li>
            <li>
              <button
                phx-click="switch_tab"
                phx-value-tab="entities"
                class={if @active_tab == :entities, do: "active", else: ""}
              >
                <.icon name="hero-cube" class="size-4" /> Entities
              </button>
            </li>
            <li>
              <button
                phx-click="switch_tab"
                phx-value-tab="scripts"
                class={if @active_tab == :scripts, do: "active", else: ""}
              >
                <.icon name="hero-code-bracket" class="size-4" /> Scripts
              </button>
            </li>
            <li>
              <button
                phx-click="switch_tab"
                phx-value-tab="system"
                class={if @active_tab == :system, do: "active", else: ""}
              >
                <.icon name="hero-cog-6-tooth" class="size-4" /> System
              </button>
            </li>
          </ul>
        </aside>

        <main class="flex-1">
          <.tab_content tab={@active_tab} stats={@stats} example_script={@example_script} />
        </main>
      </div>
    </div>
    """
  end

  attr :tab, :atom, required: true
  attr :stats, :map, required: true
  attr :example_script, :string, required: true

  defp tab_content(%{tab: :dashboard} = assigns) do
    ~H"""
    <div class="space-y-6">
      <h2 class="text-2xl font-bold">Dashboard</h2>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <.stat_card title="Players Online" value={@stats.players_online} icon="hero-users" />
        <.stat_card title="Total Rooms" value={@stats.total_rooms} icon="hero-map" />
        <.stat_card title="Active Entities" value={@stats.active_entities} icon="hero-cube" />
        <.stat_card title="Scripts Loaded" value={@stats.scripts_loaded} icon="hero-code-bracket" />
      </div>

      <div class="card bg-base-200">
        <div class="card-body">
          <h3 class="card-title">Recent Activity</h3>
          <p class="text-base-content/70">No recent activity to display.</p>
        </div>
      </div>
    </div>
    """
  end

  defp tab_content(%{tab: :players} = assigns) do
    ~H"""
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-2xl font-bold">Players</h2>
        <button class="btn btn-primary btn-sm">
          <.icon name="hero-plus" class="size-4" /> Add Player
        </button>
      </div>

      <div class="card bg-base-200">
        <div class="card-body">
          <p class="text-base-content/70">No players registered yet.</p>
        </div>
      </div>
    </div>
    """
  end

  defp tab_content(%{tab: :rooms} = assigns) do
    ~H"""
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-2xl font-bold">Rooms</h2>
        <button class="btn btn-primary btn-sm">
          <.icon name="hero-plus" class="size-4" /> Create Room
        </button>
      </div>

      <div class="card bg-base-200">
        <div class="card-body">
          <p class="text-base-content/70">
            No rooms created yet. Use the button above to create your first room.
          </p>
        </div>
      </div>
    </div>
    """
  end

  defp tab_content(%{tab: :entities} = assigns) do
    ~H"""
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-2xl font-bold">Entities</h2>
        <button class="btn btn-primary btn-sm">
          <.icon name="hero-plus" class="size-4" /> Create Entity
        </button>
      </div>

      <div class="card bg-base-200">
        <div class="card-body">
          <p class="text-base-content/70">
            Entities include NPCs, items, and other game objects.
          </p>
        </div>
      </div>
    </div>
    """
  end

  defp tab_content(%{tab: :scripts} = assigns) do
    ~H"""
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-2xl font-bold">Lua Scripts</h2>
        <button class="btn btn-primary btn-sm">
          <.icon name="hero-plus" class="size-4" /> New Script
        </button>
      </div>

      <div class="card bg-base-200">
        <div class="card-body">
          <p class="text-base-content/70">
            Scripts allow you to customize NPC behavior, quests, and game mechanics using Lua.
          </p>
          <pre class="bg-base-300 p-4 rounded-lg text-sm font-mono mt-4"><code><%= @example_script %></code></pre>
        </div>
      </div>
    </div>
    """
  end

  defp tab_content(%{tab: :system} = assigns) do
    ~H"""
    <div class="space-y-6">
      <h2 class="text-2xl font-bold">System</h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="card bg-base-200">
          <div class="card-body">
            <h3 class="card-title">Server Info</h3>
            <dl class="space-y-2 text-sm">
              <div class="flex justify-between">
                <dt class="text-base-content/70">Elixir Version</dt>
                <dd><%= System.version() %></dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-base-content/70">OTP Version</dt>
                <dd><%= :erlang.system_info(:otp_release) %></dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-base-content/70">Phoenix Version</dt>
                <dd><%= Application.spec(:phoenix, :vsn) %></dd>
              </div>
            </dl>
          </div>
        </div>

        <div class="card bg-base-200">
          <div class="card-body">
            <h3 class="card-title">Actions</h3>
            <div class="space-y-2">
              <button class="btn btn-outline btn-sm w-full">
                <.icon name="hero-arrow-path" class="size-4" /> Reload Scripts
              </button>
              <button class="btn btn-outline btn-sm w-full">
                <.icon name="hero-arrow-down-tray" class="size-4" /> Export World
              </button>
              <button class="btn btn-outline btn-sm w-full">
                <.icon name="hero-arrow-up-tray" class="size-4" /> Import World
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    """
  end

  defp tab_content(assigns) do
    ~H"""
    <div class="alert alert-warning">
      <.icon name="hero-exclamation-triangle" class="size-4" />
      <span>Unknown tab selected.</span>
    </div>
    """
  end

  attr :title, :string, required: true
  attr :value, :any, required: true
  attr :icon, :string, required: true

  defp stat_card(assigns) do
    ~H"""
    <div class="card bg-base-200">
      <div class="card-body">
        <div class="flex items-center gap-4">
          <div class="bg-primary/10 p-3 rounded-lg">
            <.icon name={@icon} class="size-6 text-primary" />
          </div>
          <div>
            <p class="text-2xl font-bold"><%= @value %></p>
            <p class="text-sm text-base-content/70"><%= @title %></p>
          </div>
        </div>
      </div>
    </div>
    """
  end

  @impl true
  def handle_event("switch_tab", %{"tab" => tab}, socket) do
    {:noreply, assign(socket, :active_tab, String.to_existing_atom(tab))}
  end

  defp load_stats do
    # TODO: Load actual stats from engine
    %{
      players_online: 0,
      total_rooms: 0,
      active_entities: 0,
      scripts_loaded: 0
    }
  end
end
