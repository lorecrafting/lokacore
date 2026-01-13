defmodule LokaWeb.AdminLive do
  @moduledoc """
  LiveView admin dashboard for Loka.

  Provides tools for game administrators to manage:
  - Players and accounts
  - Rooms and world building
  - NPCs and entities
  - Scripts and behaviors
  - System monitoring
  """
  use LokaWeb, :live_view

  alias Loka.Accounts
  alias Loka.Engine.{Entities, Scripts}
  alias Loka.Engine.Schema.{EntitySchema, ScriptSchema}

  alias Loka.Engine.{PrototypeLoader, Spawner}

  alias LokaWeb.AdminLive.{
    DashboardTab,
    PlayersTab,
    RoomsTab,
    EntitiesTab,
    ScriptsTab,
    SystemTab,
    PrototypesTab,
    TestingTab,
    QuestsTab,
    WorldBuilderLive
  }

  alias Loka.Testing.Content.{WorldValidator, QuestValidator, PrototypeLinter}
  alias Loka.Testing.Balance.CombatSimulator
  alias Loka.Framework.Quest.Admin, as: QuestAdmin

  # Combat simulation test stats
  @combat_test_player_stats %{health: 100, attack: 12, defense: 5, level: 3}
  @combat_test_enemy_stats %{health: 50, attack: 8, defense: 3, level: 2}

  @impl true
  def mount(_params, _session, socket) do
    {:ok,
     socket
     |> assign(:active_tab, :dashboard)
     |> assign(:sidebar_collapsed, false)
     |> assign(:form, nil)
     |> assign(:editing, nil)
     |> assign(:running, nil)
     |> load_tab_data(:dashboard)}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.admin flash={@flash}>
      <div class={["admin-layout", @sidebar_collapsed && "sidebar-collapsed"]}>
        <aside class="admin-sidebar">
          <div class="admin-sidebar-header">
            <span class="admin-logo">{if @sidebar_collapsed, do: "L", else: "Loka"}</span>
            <button
              type="button"
              phx-click="toggle_sidebar"
              class="admin-sidebar-toggle"
              title={if @sidebar_collapsed, do: "Expand sidebar", else: "Collapse sidebar"}
            >
              <.icon
                name={if @sidebar_collapsed, do: "hero-chevron-right", else: "hero-chevron-left"}
                class="size-4"
              />
            </button>
          </div>

          <nav class="admin-nav">
            <.nav_item
              tab={:dashboard}
              active={@active_tab}
              icon="hero-chart-bar"
              label="Dashboard"
              collapsed={@sidebar_collapsed}
            />
            <.nav_item
              tab={:players}
              active={@active_tab}
              icon="hero-users"
              label="Players"
              collapsed={@sidebar_collapsed}
            />

            <div :if={not @sidebar_collapsed} class="admin-nav-divider">Content</div>
            <.nav_item
              tab={:rooms}
              active={@active_tab}
              icon="hero-map"
              label="Rooms"
              collapsed={@sidebar_collapsed}
            />
            <.nav_item
              tab={:entities}
              active={@active_tab}
              icon="hero-cube"
              label="Entities"
              collapsed={@sidebar_collapsed}
            />
            <.nav_item
              tab={:prototypes}
              active={@active_tab}
              icon="hero-document-duplicate"
              label="Prototypes"
              collapsed={@sidebar_collapsed}
            />
            <.nav_item
              tab={:quests}
              active={@active_tab}
              icon="hero-book-open"
              label="Quests"
              collapsed={@sidebar_collapsed}
            />

            <div :if={not @sidebar_collapsed} class="admin-nav-divider">Tools</div>
            <.nav_item
              tab={:world_designer}
              active={@active_tab}
              icon="hero-globe-alt"
              label="World Designer"
              collapsed={@sidebar_collapsed}
            />
            <.nav_item
              tab={:scripts}
              active={@active_tab}
              icon="hero-code-bracket"
              label="Scripts"
              collapsed={@sidebar_collapsed}
            />
            <.nav_item
              tab={:testing}
              active={@active_tab}
              icon="hero-beaker"
              label="Testing"
              collapsed={@sidebar_collapsed}
            />
            <.nav_item
              tab={:system}
              active={@active_tab}
              icon="hero-cog-6-tooth"
              label="System"
              collapsed={@sidebar_collapsed}
            />
          </nav>

          <div class="admin-sidebar-footer">
            <a href={~p"/admin/play"} class="admin-nav-link" title="Play Game">
              <.icon name="hero-play" class="size-4" />
              <span :if={not @sidebar_collapsed}>Play Game</span>
            </a>
            <div class="admin-theme-toggle">
              <Layouts.theme_toggle />
            </div>
          </div>
        </aside>

        <main class="admin-main">
          <.tab_content
            tab={@active_tab}
            stats={assigns[:stats]}
            players={assigns[:players]}
            rooms={assigns[:rooms]}
            entities={assigns[:entities]}
            scripts={assigns[:scripts]}
            prototypes={assigns[:prototypes]}
            quests_data={assigns[:quests_data]}
            testing_data={assigns[:testing_data]}
            system_info={assigns[:system_info]}
            form={@form}
            editing={@editing}
            running={@running}
          />
        </main>
      </div>
    </Layouts.admin>
    """
  end

  # Navigation item component
  attr :tab, :atom, required: true
  attr :active, :atom, required: true
  attr :icon, :string, required: true
  attr :label, :string, required: true
  attr :collapsed, :boolean, default: false

  defp nav_item(assigns) do
    ~H"""
    <button
      phx-click="switch_tab"
      phx-value-tab={@tab}
      class={["admin-nav-link", @active == @tab && "active", @collapsed && "collapsed"]}
      title={if @collapsed, do: @label, else: nil}
    >
      <.icon name={@icon} class="size-4" />
      <span :if={not @collapsed}>{@label}</span>
    </button>
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
  attr :prototypes, :list, default: nil
  attr :quests_data, :list, default: nil
  attr :testing_data, :map, default: nil
  attr :system_info, :map, default: nil
  attr :form, :any, default: nil
  attr :editing, :any, default: nil
  attr :running, :atom, default: nil

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

  defp tab_content(%{tab: :prototypes} = assigns) do
    ~H"""
    <.live_component module={PrototypesTab} id="prototypes-tab" prototypes={@prototypes} />
    """
  end

  defp tab_content(%{tab: :quests} = assigns) do
    ~H"""
    <.live_component module={QuestsTab} id="quests-tab" quests_data={@quests_data} />
    """
  end

  defp tab_content(%{tab: :testing} = assigns) do
    ~H"""
    <.live_component
      module={TestingTab}
      id="testing-tab"
      testing_data={@testing_data}
      running={@running}
    />
    """
  end

  defp tab_content(%{tab: :world_designer} = assigns) do
    ~H"""
    <.live_component module={WorldBuilderLive} id="world-builder-tab" />
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
    "prototypes" => :prototypes,
    "quests" => :quests,
    "world_designer" => :world_designer,
    "testing" => :testing,
    "system" => :system
  }

  @impl true
  def handle_event("toggle_sidebar", _, socket) do
    {:noreply, assign(socket, :sidebar_collapsed, not socket.assigns.sidebar_collapsed)}
  end

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
      {:ok, _saved_entity} ->
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
      {:ok, _saved_entity} ->
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
        # Truncate result to avoid exposing sensitive context data
        result_str = inspect(result) |> String.slice(0, 200)

        display =
          if String.length(inspect(result)) > 200, do: result_str <> "...", else: result_str

        {:noreply, put_flash(socket, :info, "Script executed successfully: #{display}")}

      {:error, reason} ->
        # Truncate error to avoid exposing sensitive context data
        reason_str = inspect(reason) |> String.slice(0, 200)

        display =
          if String.length(inspect(reason)) > 200, do: reason_str <> "...", else: reason_str

        {:noreply, put_flash(socket, :error, "Script error: #{display}")}
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

  # Prototype events
  def handle_event("spawn_prototype", %{"key" => key}, socket) do
    case PrototypeLoader.get(key) do
      {:ok, prototype} ->
        case Spawner.spawn(prototype) do
          {:ok, entity} ->
            {:noreply,
             socket
             |> put_flash(:info, "Spawned entity '#{entity.short_desc}' from prototype '#{key}'")}

          {:error, reason} ->
            {:noreply, put_flash(socket, :error, "Failed to spawn: #{inspect(reason)}")}
        end

      {:error, :not_found} ->
        {:noreply, put_flash(socket, :error, "Prototype '#{key}' not found")}
    end
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
       filename: "loka_world_#{Date.utc_today()}.json",
       content: json,
       content_type: "application/json"
     })}
  end

  # =============================================================================
  # Testing Tab Handlers
  # =============================================================================

  @impl true
  def handle_info({:run_testing, :validators}, socket) do
    socket = assign(socket, :running, :validators)

    # Run validators
    {:ok, world_results} = WorldValidator.validate()
    {:ok, quest_results} = QuestValidator.validate()
    {:ok, prototype_results} = PrototypeLinter.lint()

    # Format results
    validation = %{
      world: %{
        errors: length(world_results.errors),
        warnings: length(world_results.warnings),
        rooms_checked: world_results.rooms_checked,
        rooms_reachable: world_results.rooms_reachable,
        error_list: world_results.errors,
        warning_list: world_results.warnings
      },
      quest: %{
        errors: length(quest_results.errors),
        warnings: length(quest_results.warnings),
        error_list: quest_results.errors,
        warning_list: quest_results.warnings
      },
      prototype: %{
        errors: length(prototype_results.errors),
        warnings: length(prototype_results.warnings),
        error_list: prototype_results.errors,
        warning_list: prototype_results.warnings
      }
    }

    testing_data = socket.assigns.testing_data || %{}

    testing_data =
      Map.merge(testing_data, %{validation: validation, last_run: DateTime.utc_now()})

    {:noreply,
     socket
     |> assign(:testing_data, testing_data)
     |> assign(:running, nil)
     |> put_flash(:info, "Validation complete")}
  end

  def handle_info({:run_testing, :balance}, socket) do
    socket = assign(socket, :running, :balance)

    # Run balance analysis with quick settings
    results =
      CombatSimulator.simulate(@combat_test_player_stats, @combat_test_enemy_stats,
        iterations: 500
      )

    balance = %{
      win_rate: results.win_rate,
      avg_turns: results.avg_turns,
      avg_damage_dealt: results.avg_damage_dealt,
      avg_damage_taken: results.avg_damage_taken,
      iterations: results.iterations
    }

    testing_data = socket.assigns.testing_data || %{}
    testing_data = Map.merge(testing_data, %{balance: balance, last_run: DateTime.utc_now()})

    {:noreply,
     socket
     |> assign(:testing_data, testing_data)
     |> assign(:running, nil)
     |> put_flash(:info, "Balance analysis complete")}
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

  defp load_tab_data(socket, :prototypes) do
    prototypes =
      PrototypeLoader.all()
      |> Enum.sort_by(& &1.key)

    assign(socket, :prototypes, prototypes)
  end

  defp load_tab_data(socket, :quests) do
    quests_data = QuestAdmin.list_players_with_quests()
    assign(socket, :quests_data, quests_data)
  end

  defp load_tab_data(socket, :testing) do
    # Initialize with empty testing data - results populated on-demand
    testing_data =
      socket.assigns[:testing_data] ||
        %{
          validation: nil,
          balance: nil,
          last_run: nil
        }

    assign(socket, :testing_data, testing_data)
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

  # World Designer loads its own data in the component
  defp load_tab_data(socket, :world_designer), do: socket

  defp load_tab_data(socket, _), do: socket
end
