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

  alias ExmudWeb.AdminLive.{
    DashboardTab,
    PlayersTab,
    RoomsTab,
    EntitiesTab,
    ScriptsTab,
    SystemTab
  }

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
        <div class="navbar bg-base-200 mb-6">
          <div class="flex-1">
            <span class="admin-header-title text-primary">ExMUD Admin</span>
          </div>
          <div class="flex-none">
            <a href={~p"/game"} class="btn btn-ghost btn-sm">
              <.icon name="hero-play" class="size-4" /> Play Game
            </a>
          </div>
        </div>

        <div class="admin-content">
          <aside class="admin-sidebar">
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
  # Tab Content Routing
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
    <.live_component module={DashboardTab} id="dashboard-tab" stats={@stats} />
    """
  end

  defp tab_content(%{tab: :players} = assigns) do
    ~H"""
    <.live_component module={PlayersTab} id="players-tab" players={@players} />
    """
  end

  defp tab_content(%{tab: :rooms} = assigns) do
    ~H"""
    <.live_component module={RoomsTab} id="rooms-tab" rooms={@rooms} form={@form} editing={@editing} />
    """
  end

  defp tab_content(%{tab: :entities} = assigns) do
    ~H"""
    <.live_component
      module={EntitiesTab}
      id="entities-tab"
      entities={@entities}
      form={@form}
      editing={@editing}
    />
    """
  end

  defp tab_content(%{tab: :scripts} = assigns) do
    ~H"""
    <.live_component
      module={ScriptsTab}
      id="scripts-tab"
      scripts={@scripts}
      form={@form}
      editing={@editing}
    />
    """
  end

  defp tab_content(%{tab: :system} = assigns) do
    ~H"""
    <.live_component module={SystemTab} id="system-tab" system_info={@system_info} />
    """
  end

  defp tab_content(assigns) do
    ~H"""
    <div role="alert" class="alert alert-warning">
      <.icon name="hero-exclamation-triangle" class="size-4" />
      <span>Unknown tab selected.</span>
    </div>
    """
  end

  # =============================================================================
  # Event Handlers
  # =============================================================================

  @admin_tabs %{
    "dashboard" => :dashboard,
    "players" => :players,
    "rooms" => :rooms,
    "entities" => :entities,
    "scripts" => :scripts,
    "system" => :system
  }

  @impl true
  def handle_event("switch_tab", %{"tab" => tab_string}, socket) do
    tab = Map.get(@admin_tabs, tab_string, :dashboard)

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
end
