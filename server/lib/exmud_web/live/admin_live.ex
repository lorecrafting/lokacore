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

  alias Exmud.Accounts
  alias Exmud.Engine.{Entities, Scripts}
  alias Exmud.Engine.Schema.{EntitySchema, ScriptSchema}

  @impl true
  def mount(_params, _session, socket) do
    {:ok,
     socket
     |> assign(:active_tab, :dashboard)
     |> assign(:form, nil)
     |> assign(:editing, nil)
     |> load_tab_data(:dashboard)}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.app flash={@flash} current_scope={@current_scope}>
      <div class="admin-layout">
        <div class="admin-header">
          <div class="flex-1">
            <span class="admin-header-title">ExMUD Admin</span>
          </div>
          <div class="flex-none">
            <a href={~p"/game"} class="admin-btn--ghost">
              <.icon name="hero-play" class="size-4" /> Play Game
            </a>
          </div>
        </div>

        <div class="admin-content">
          <aside class="admin-sidebar">
            <ul class="admin-nav">
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

          <main class="admin-main">
            <.tab_content
              tab={@active_tab}
              stats={assigns[:stats]}
              players={assigns[:players]}
              rooms={assigns[:rooms]}
              entities={assigns[:entities]}
              scripts={assigns[:scripts]}
              system_info={assigns[:system_info]}
              form={@form}
              editing={@editing}
            />
          </main>
        </div>
      </div>
    </Layouts.app>
    """
  end

  # =============================================================================
  # Tab Content Components
  # =============================================================================

  attr :tab, :atom, required: true
  attr :stats, :map, default: nil
  attr :players, :list, default: nil
  attr :rooms, :list, default: nil
  attr :entities, :list, default: nil
  attr :scripts, :list, default: nil
  attr :system_info, :map, default: nil
  attr :form, :any, default: nil
  attr :editing, :any, default: nil

  defp tab_content(%{tab: :dashboard} = assigns) do
    ~H"""
    <div class="admin-section">
      <h2 class="admin-section-title">Dashboard</h2>

      <div class="admin-grid-stats">
        <.stat_card title="Total Players" value={@stats.total_players} icon="hero-users" />
        <.stat_card title="Total Rooms" value={@stats.total_rooms} icon="hero-map" />
        <.stat_card title="Total Entities" value={@stats.total_entities} icon="hero-cube" />
        <.stat_card title="Scripts Loaded" value={@stats.scripts_loaded} icon="hero-code-bracket" />
      </div>

      <div class="admin-card">
        <div class="admin-card-body">
          <h3 class="admin-card-title">Quick Start</h3>
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

  defp tab_content(%{tab: :players} = assigns) do
    ~H"""
    <div class="admin-section">
      <div class="admin-section-header">
        <h2 class="admin-section-title">Players ({length(@players || [])})</h2>
      </div>

      <div :if={@players && length(@players) > 0} class="admin-table-wrapper">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Admin</th>
              <th>Confirmed</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr :for={player <- @players} class="admin-table-row">
              <td>{player.email}</td>
              <td>
                <span class={[
                  "admin-badge",
                  if(player.is_admin, do: "admin-badge--primary", else: "admin-badge--ghost")
                ]}>
                  {if player.is_admin, do: "Admin", else: "Player"}
                </span>
              </td>
              <td>
                <span class={[
                  "admin-badge",
                  if(player.confirmed_at, do: "admin-badge--success", else: "admin-badge--warning")
                ]}>
                  {if player.confirmed_at, do: "Yes", else: "No"}
                </span>
              </td>
              <td>{Calendar.strftime(player.inserted_at, "%Y-%m-%d")}</td>
              <td class="admin-table-actions">
                <button
                  phx-click="toggle_admin"
                  phx-value-id={player.id}
                  class="admin-btn--ghost-xs"
                >
                  {if player.is_admin, do: "Revoke Admin", else: "Make Admin"}
                </button>
                <button
                  phx-click="delete_player"
                  phx-value-id={player.id}
                  data-confirm="Are you sure you want to delete this player?"
                  class="admin-btn--danger"
                >
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div :if={@players == [] or @players == nil} class="admin-empty">
        <div class="admin-card-body">
          <p class="admin-empty-text">No players registered yet.</p>
        </div>
      </div>
    </div>
    """
  end

  defp tab_content(%{tab: :rooms, form: nil} = assigns) do
    ~H"""
    <div class="admin-section">
      <div class="admin-section-header">
        <h2 class="admin-section-title">Rooms ({length(@rooms || [])})</h2>
        <button phx-click="new_room" class="admin-btn--primary">
          <.icon name="hero-plus" class="size-4" /> Create Room
        </button>
      </div>

      <div :if={@rooms && length(@rooms) > 0} class="admin-table-wrapper">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Name</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr :for={room <- @rooms} class="admin-table-row">
              <td class="admin-table-cell-mono">{room.key}</td>
              <td>{room.name || "(unnamed)"}</td>
              <td class="admin-table-cell-truncate">{room.description || "(no description)"}</td>
              <td class="admin-table-actions">
                <button phx-click="edit_room" phx-value-id={room.id} class="admin-btn--ghost-xs">
                  Edit
                </button>
                <button
                  phx-click="delete_room"
                  phx-value-id={room.id}
                  data-confirm="Are you sure you want to delete this room?"
                  class="admin-btn--danger"
                >
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div :if={@rooms == [] or @rooms == nil} class="admin-empty">
        <div class="admin-card-body">
          <p class="admin-empty-text">
            No rooms created yet. Click "Create Room" to add your first location.
          </p>
        </div>
      </div>
    </div>
    """
  end

  defp tab_content(%{tab: :rooms, form: form} = assigns) when not is_nil(form) do
    ~H"""
    <div class="admin-section">
      <div class="admin-section-header">
        <h2 class="admin-section-title">{if @editing, do: "Edit Room", else: "Create Room"}</h2>
        <button phx-click="cancel_form" class="admin-btn--ghost">
          <.icon name="hero-x-mark" class="size-4" /> Cancel
        </button>
      </div>

      <div class="admin-card">
        <div class="admin-card-body">
          <.form for={@form} phx-submit="save_room" class="admin-form">
            <.input field={@form[:key]} type="text" label="Key (unique identifier)" required />
            <.input field={@form[:name]} type="text" label="Name" />
            <.input field={@form[:description]} type="textarea" label="Description" rows="4" />
            <div class="admin-form-actions">
              <button type="button" phx-click="cancel_form" class="btn btn-ghost">Cancel</button>
              <button type="submit" class="btn btn-primary">
                {if @editing, do: "Update Room", else: "Create Room"}
              </button>
            </div>
          </.form>
        </div>
      </div>
    </div>
    """
  end

  defp tab_content(%{tab: :entities, form: nil} = assigns) do
    ~H"""
    <div class="admin-section">
      <div class="admin-section-header">
        <h2 class="admin-section-title">Entities ({length(@entities || [])})</h2>
        <button phx-click="new_entity" class="admin-btn--primary">
          <.icon name="hero-plus" class="size-4" /> Create Entity
        </button>
      </div>

      <div :if={@entities && length(@entities) > 0} class="admin-table-wrapper">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Key</th>
              <th>Name</th>
              <th>Location</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr :for={entity <- @entities} class="admin-table-row">
              <td>
                <span class={["admin-badge", entity_type_badge(entity.type)]}>
                  {entity.type}
                </span>
              </td>
              <td class="admin-table-cell-mono">{entity.key}</td>
              <td>{entity.name || "(unnamed)"}</td>
              <td class="admin-table-cell-mono-xs">{entity.location_id || "(none)"}</td>
              <td class="admin-table-actions">
                <button phx-click="edit_entity" phx-value-id={entity.id} class="admin-btn--ghost-xs">
                  Edit
                </button>
                <button
                  phx-click="delete_entity"
                  phx-value-id={entity.id}
                  data-confirm="Are you sure you want to delete this entity?"
                  class="admin-btn--danger"
                >
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div :if={@entities == [] or @entities == nil} class="admin-empty">
        <div class="admin-card-body">
          <p class="admin-empty-text">
            No entities created yet. Entities include NPCs, items, and other game objects.
          </p>
        </div>
      </div>
    </div>
    """
  end

  defp tab_content(%{tab: :entities, form: form} = assigns) when not is_nil(form) do
    ~H"""
    <div class="admin-section">
      <div class="admin-section-header">
        <h2 class="admin-section-title">{if @editing, do: "Edit Entity", else: "Create Entity"}</h2>
        <button phx-click="cancel_form" class="admin-btn--ghost">
          <.icon name="hero-x-mark" class="size-4" /> Cancel
        </button>
      </div>

      <div class="admin-card">
        <div class="admin-card-body">
          <.form for={@form} phx-submit="save_entity" class="admin-form">
            <.input
              field={@form[:type]}
              type="select"
              label="Type"
              options={[{"NPC", :npc}, {"Item", :item}, {"Exit", :exit}]}
              required
            />
            <.input field={@form[:key]} type="text" label="Key (unique identifier)" required />
            <.input field={@form[:name]} type="text" label="Name" />
            <.input field={@form[:description]} type="textarea" label="Description" rows="3" />
            <.input field={@form[:location_id]} type="text" label="Location ID (room UUID)" />
            <div class="admin-form-actions">
              <button type="button" phx-click="cancel_form" class="btn btn-ghost">Cancel</button>
              <button type="submit" class="btn btn-primary">
                {if @editing, do: "Update Entity", else: "Create Entity"}
              </button>
            </div>
          </.form>
        </div>
      </div>
    </div>
    """
  end

  defp tab_content(%{tab: :scripts, form: nil} = assigns) do
    ~H"""
    <div class="admin-section">
      <div class="admin-section-header">
        <h2 class="admin-section-title">Scripts ({length(@scripts || [])})</h2>
        <button phx-click="new_script" class="admin-btn--primary">
          <.icon name="hero-plus" class="size-4" /> New Script
        </button>
      </div>

      <div :if={@scripts && length(@scripts) > 0} class="admin-table-wrapper">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Hook</th>
              <th>Enabled</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr :for={script <- @scripts} class="admin-table-row">
              <td class="font-semibold">{script.name}</td>
              <td>
                <span class="admin-badge admin-badge--outline">{script.hook || "custom"}</span>
              </td>
              <td>
                <input
                  type="checkbox"
                  class="admin-toggle"
                  checked={script.enabled}
                  phx-click="toggle_script"
                  phx-value-id={script.id}
                />
              </td>
              <td>{Calendar.strftime(script.updated_at, "%Y-%m-%d %H:%M")}</td>
              <td class="admin-table-actions">
                <button phx-click="edit_script" phx-value-id={script.id} class="admin-btn--ghost-xs">
                  Edit
                </button>
                <button phx-click="test_script" phx-value-id={script.id} class="admin-btn--ghost-xs">
                  Test
                </button>
                <button
                  phx-click="delete_script"
                  phx-value-id={script.id}
                  data-confirm="Are you sure you want to delete this script?"
                  class="admin-btn--danger"
                >
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div :if={@scripts == [] or @scripts == nil} class="admin-empty">
        <div class="admin-card-body">
          <p class="admin-empty-text mb-4">
            No scripts created yet. Scripts allow you to customize NPC behavior using Lua.
          </p>
          <pre class="admin-code"><code>{example_lua_script()}</code></pre>
        </div>
      </div>
    </div>
    """
  end

  defp tab_content(%{tab: :scripts, form: form} = assigns) when not is_nil(form) do
    ~H"""
    <div class="admin-section">
      <div class="admin-section-header">
        <h2 class="admin-section-title">{if @editing, do: "Edit Script", else: "Create Script"}</h2>
        <button phx-click="cancel_form" class="admin-btn--ghost">
          <.icon name="hero-x-mark" class="size-4" /> Cancel
        </button>
      </div>

      <div class="admin-card">
        <div class="admin-card-body">
          <.form for={@form} phx-submit="save_script" class="admin-form">
            <.input field={@form[:name]} type="text" label="Script Name" required />
            <.input field={@form[:description]} type="text" label="Description" />
            <.input
              field={@form[:hook]}
              type="select"
              label="Hook"
              options={[
                {"Custom", "custom"},
                {"On Enter", "on_enter"},
                {"On Leave", "on_leave"},
                {"On Look", "on_look"},
                {"On Attack", "on_attack"},
                {"On Tick", "on_tick"},
                {"On Say", "on_say"},
                {"On Give", "on_give"},
                {"On Use", "on_use"}
              ]}
            />
            <.input
              field={@form[:source]}
              type="textarea"
              label="Lua Source Code"
              rows="12"
              class="font-mono text-sm"
              placeholder="-- Enter your Lua script here"
            />
            <.input field={@form[:enabled]} type="checkbox" label="Enabled" />
            <div class="admin-form-actions">
              <button type="button" phx-click="cancel_form" class="btn btn-ghost">Cancel</button>
              <button type="submit" class="btn btn-primary">
                {if @editing, do: "Update Script", else: "Create Script"}
              </button>
            </div>
          </.form>
        </div>
      </div>
    </div>
    """
  end

  defp tab_content(%{tab: :system} = assigns) do
    ~H"""
    <div class="admin-section">
      <h2 class="admin-section-title">System</h2>

      <div class="admin-grid-system">
        <div class="admin-card">
          <div class="admin-card-body">
            <h3 class="admin-card-title">Server Info</h3>
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

        <div class="admin-card">
          <div class="admin-card-body">
            <h3 class="admin-card-title">Actions</h3>
            <div class="space-y-2">
              <button phx-click="reload_scripts" class="admin-btn--outline">
                <.icon name="hero-arrow-path" class="size-4" /> Reload Scripts
              </button>
              <button phx-click="export_world" class="admin-btn--outline">
                <.icon name="hero-arrow-down-tray" class="size-4" /> Export World
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
    <div class="admin-alert admin-alert--warning">
      <.icon name="hero-exclamation-triangle" class="size-4" />
      <span>Unknown tab selected.</span>
    </div>
    """
  end

  # =============================================================================
  # Helper Components
  # =============================================================================

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

  # =============================================================================
  # Event Handlers
  # =============================================================================

  @impl true
  def handle_event("switch_tab", %{"tab" => tab}, socket) do
    tab = String.to_existing_atom(tab)

    {:noreply,
     socket
     |> assign(:active_tab, tab)
     |> assign(:form, nil)
     |> assign(:editing, nil)
     |> load_tab_data(tab)}
  end

  def handle_event("cancel_form", _, socket) do
    {:noreply,
     socket
     |> assign(:form, nil)
     |> assign(:editing, nil)}
  end

  # Player events
  def handle_event("toggle_admin", %{"id" => id}, socket) do
    player = Accounts.get_player!(id)
    {:ok, _} = Accounts.toggle_admin(player)
    {:noreply, load_tab_data(socket, :players)}
  end

  def handle_event("delete_player", %{"id" => id}, socket) do
    player = Accounts.get_player!(id)
    {:ok, _} = Accounts.delete_player(player)

    {:noreply,
     socket
     |> put_flash(:info, "Player deleted successfully")
     |> load_tab_data(:players)}
  end

  # Room events
  def handle_event("new_room", _, socket) do
    changeset = Entities.change_entity(%EntitySchema{type: :room})

    {:noreply,
     socket
     |> assign(:form, to_form(changeset))
     |> assign(:editing, nil)}
  end

  def handle_event("edit_room", %{"id" => id}, socket) do
    entity = Entities.get_entity!(id)
    changeset = Entities.change_entity(entity)

    {:noreply,
     socket
     |> assign(:form, to_form(changeset))
     |> assign(:editing, entity)}
  end

  def handle_event("save_room", %{"entity_schema" => params}, socket) do
    params = Map.put(params, "type", :room)

    result =
      case socket.assigns.editing do
        nil -> Entities.create_entity(params)
        entity -> Entities.update_entity(entity, params)
      end

    case result do
      {:ok, _} ->
        {:noreply,
         socket
         |> put_flash(:info, "Room saved successfully")
         |> assign(:form, nil)
         |> assign(:editing, nil)
         |> load_tab_data(:rooms)}

      {:error, changeset} ->
        {:noreply, assign(socket, :form, to_form(changeset))}
    end
  end

  def handle_event("delete_room", %{"id" => id}, socket) do
    entity = Entities.get_entity!(id)
    {:ok, _} = Entities.delete_entity(entity)

    {:noreply,
     socket
     |> put_flash(:info, "Room deleted successfully")
     |> load_tab_data(:rooms)}
  end

  # Entity events
  def handle_event("new_entity", _, socket) do
    changeset = Entities.change_entity(%EntitySchema{type: :npc})

    {:noreply,
     socket
     |> assign(:form, to_form(changeset))
     |> assign(:editing, nil)}
  end

  def handle_event("edit_entity", %{"id" => id}, socket) do
    entity = Entities.get_entity!(id)
    changeset = Entities.change_entity(entity)

    {:noreply,
     socket
     |> assign(:form, to_form(changeset))
     |> assign(:editing, entity)}
  end

  def handle_event("save_entity", %{"entity_schema" => params}, socket) do
    result =
      case socket.assigns.editing do
        nil -> Entities.create_entity(params)
        entity -> Entities.update_entity(entity, params)
      end

    case result do
      {:ok, _} ->
        {:noreply,
         socket
         |> put_flash(:info, "Entity saved successfully")
         |> assign(:form, nil)
         |> assign(:editing, nil)
         |> load_tab_data(:entities)}

      {:error, changeset} ->
        {:noreply, assign(socket, :form, to_form(changeset))}
    end
  end

  def handle_event("delete_entity", %{"id" => id}, socket) do
    entity = Entities.get_entity!(id)
    {:ok, _} = Entities.delete_entity(entity)

    {:noreply,
     socket
     |> put_flash(:info, "Entity deleted successfully")
     |> load_tab_data(:entities)}
  end

  # Script events
  def handle_event("new_script", _, socket) do
    changeset = Scripts.change_script(%ScriptSchema{enabled: true})

    {:noreply,
     socket
     |> assign(:form, to_form(changeset))
     |> assign(:editing, nil)}
  end

  def handle_event("edit_script", %{"id" => id}, socket) do
    script = Scripts.get_script!(id)
    changeset = Scripts.change_script(script)

    {:noreply,
     socket
     |> assign(:form, to_form(changeset))
     |> assign(:editing, script)}
  end

  def handle_event("save_script", %{"script_schema" => params}, socket) do
    result =
      case socket.assigns.editing do
        nil -> Scripts.create_script(params)
        script -> Scripts.update_script(script, params)
      end

    case result do
      {:ok, _} ->
        {:noreply,
         socket
         |> put_flash(:info, "Script saved successfully")
         |> assign(:form, nil)
         |> assign(:editing, nil)
         |> load_tab_data(:scripts)}

      {:error, changeset} ->
        {:noreply, assign(socket, :form, to_form(changeset))}
    end
  end

  def handle_event("toggle_script", %{"id" => id}, socket) do
    script = Scripts.get_script!(id)
    {:ok, _} = Scripts.toggle_script(script)
    {:noreply, load_tab_data(socket, :scripts)}
  end

  def handle_event("test_script", %{"id" => id}, socket) do
    script = Scripts.get_script!(id)

    case Scripts.test_script(script) do
      {:ok, result} ->
        {:noreply, put_flash(socket, :info, "Script executed successfully: #{inspect(result)}")}

      {:error, reason} ->
        {:noreply, put_flash(socket, :error, "Script error: #{inspect(reason)}")}
    end
  end

  def handle_event("delete_script", %{"id" => id}, socket) do
    script = Scripts.get_script!(id)
    {:ok, _} = Scripts.delete_script(script)

    {:noreply,
     socket
     |> put_flash(:info, "Script deleted successfully")
     |> load_tab_data(:scripts)}
  end

  # System events
  def handle_event("reload_scripts", _, socket) do
    count = Scripts.count_enabled_scripts()
    {:noreply, put_flash(socket, :info, "Reloaded #{count} scripts")}
  end

  def handle_event("export_world", _, socket) do
    data = %{
      entities: Entities.list_entities(),
      scripts: Scripts.list_scripts(),
      exported_at: DateTime.utc_now()
    }

    json = Jason.encode!(data, pretty: true)

    {:noreply,
     socket
     |> push_event("download", %{
       filename: "exmud_world_#{Date.utc_today()}.json",
       content: json,
       content_type: "application/json"
     })}
  end

  # =============================================================================
  # Private Functions
  # =============================================================================

  defp load_tab_data(socket, :dashboard) do
    assign(socket, :stats, %{
      total_players: Accounts.count_players(),
      total_rooms: Entities.count_by_type(:room),
      total_entities: Entities.count_all(),
      scripts_loaded: Scripts.count_scripts()
    })
  end

  defp load_tab_data(socket, :players) do
    assign(socket, :players, Accounts.list_players())
  end

  defp load_tab_data(socket, :rooms) do
    assign(socket, :rooms, Entities.list_entities(type: :room))
  end

  defp load_tab_data(socket, :entities) do
    assign(socket, :entities, Entities.list_entities(type: [:npc, :item, :exit]))
  end

  defp load_tab_data(socket, :scripts) do
    assign(socket, :scripts, Scripts.list_scripts())
  end

  defp load_tab_data(socket, :system) do
    assign(socket, :system_info, %{
      elixir_version: System.version(),
      otp_version: to_string(:erlang.system_info(:otp_release)),
      phoenix_version: to_string(Application.spec(:phoenix, :vsn)),
      memory_usage: :erlang.memory(:total),
      process_count: :erlang.system_info(:process_count)
    })
  end

  defp load_tab_data(socket, _), do: socket

  defp entity_type_badge(:npc), do: "admin-badge--npc"
  defp entity_type_badge(:item), do: "admin-badge--item"
  defp entity_type_badge(:exit), do: "admin-badge--exit"
  defp entity_type_badge(_), do: "admin-badge--ghost"

  defp format_bytes(bytes) when bytes < 1024, do: "#{bytes} B"
  defp format_bytes(bytes) when bytes < 1_048_576, do: "#{Float.round(bytes / 1024, 1)} KB"
  defp format_bytes(bytes), do: "#{Float.round(bytes / 1_048_576, 1)} MB"

  defp example_lua_script do
    """
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
  end
end
