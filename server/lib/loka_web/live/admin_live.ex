defmodule LokaWeb.AdminLive do
  @moduledoc """
  LiveView admin dashboard for Loka.

  Provides tools for game administrators to manage:
  - Players and accounts
  - Quest debugging and state management
  - Content validation and balance testing
  - Audit logs and compliance

  Content creation (rooms, entities, scripts) is handled by BuilderLive (MUD terminal).
  """
  use LokaWeb, :live_view

  alias Loka.Accounts

  alias LokaWeb.AdminLive.{
    DashboardTab,
    PlayersTab,
    TestingTab,
    QuestsTab,
    AuditLogTab
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
     |> assign(:running, nil)
     |> load_tab_data(:dashboard)}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <Layouts.admin flash={@flash}>
      <div class="flex min-h-screen">
        <.sidebar active_tab={@active_tab} collapsed={@sidebar_collapsed} />

        <main class="flex-1 px-8 py-6 overflow-x-hidden min-w-0">
          <.tab_content
            tab={@active_tab}
            stats={assigns[:stats]}
            players={assigns[:players]}
            quests_data={assigns[:quests_data]}
            testing_data={assigns[:testing_data]}
            running={@running}
          />
        </main>
      </div>
    </Layouts.admin>
    """
  end

  # Sidebar navigation component
  defp sidebar(assigns) do
    ~H"""
    <aside class={[
      "shrink-0 bg-base-100 border-r border-base-content/10 flex flex-col sticky top-0 h-screen transition-[width] duration-200 ease-in-out",
      if(@collapsed, do: "w-14", else: "w-56")
    ]}>
      <div class={[
        "border-b border-base-content/10 flex items-center gap-2",
        if(@collapsed, do: "px-3 py-4 justify-center", else: "px-5 py-4 justify-between")
      ]}>
        <span class="text-xl font-bold text-primary whitespace-nowrap overflow-hidden transition-all duration-200">
          {if @collapsed, do: "L", else: "Loka"}
        </span>
        <button
          type="button"
          phx-click="toggle_sidebar"
          class={[
            "flex items-center justify-center w-6 h-6 rounded bg-transparent border-none text-base-content/50 cursor-pointer transition-all duration-150 shrink-0 hover:bg-base-content/10 hover:text-base-content",
            @collapsed &&
              "absolute -right-3 top-4 bg-base-100 border border-base-content/10 shadow-sm"
          ]}
          title={if @collapsed, do: "Expand sidebar", else: "Collapse sidebar"}
        >
          <.icon
            name={if @collapsed, do: "hero-chevron-right", else: "hero-chevron-left"}
            class="size-4"
          />
        </button>
      </div>

      <nav class={[
        "flex-1 overflow-y-auto flex flex-col gap-0.5",
        if(@collapsed, do: "p-2 items-center", else: "p-3")
      ]}>
        <.nav_item
          tab={:dashboard}
          active={@active_tab}
          icon="hero-chart-bar"
          label="Dashboard"
          collapsed={@collapsed}
        />
        <.nav_item
          tab={:players}
          active={@active_tab}
          icon="hero-users"
          label="Players"
          collapsed={@collapsed}
        />

        <div
          :if={not @collapsed}
          class="text-[0.675rem] font-semibold uppercase tracking-wider text-base-content/50 px-3 pt-3 pb-1.5 mt-1"
        >
          Tools
        </div>
        <a
          href={~p"/admin/builder"}
          class={[
            "flex items-center gap-2.5 rounded-md text-sm text-base-content/80 transition-all duration-150 no-underline border-none bg-transparent w-full text-left cursor-pointer hover:bg-base-content/5 hover:text-base-content focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
            if(@collapsed, do: "justify-center p-2.5 w-9 h-9", else: "px-3 py-2")
          ]}
          title={if @collapsed, do: "Builder", else: nil}
        >
          <.icon name="hero-command-line" class="size-4" />
          <span :if={not @collapsed}>Builder</span>
        </a>
        <.nav_item
          tab={:quests}
          active={@active_tab}
          icon="hero-book-open"
          label="Quests"
          collapsed={@collapsed}
        />
        <.nav_item
          tab={:testing}
          active={@active_tab}
          icon="hero-beaker"
          label="Testing"
          collapsed={@collapsed}
        />
        <.nav_item
          tab={:audit_log}
          active={@active_tab}
          icon="hero-clipboard-document-list"
          label="Audit Log"
          collapsed={@collapsed}
        />
      </nav>

      <div class={[
        "border-t border-base-content/10 flex flex-col gap-2",
        if(@collapsed, do: "p-2 items-center", else: "p-3")
      ]}>
        <div class="flex justify-center pt-1">
          <Layouts.theme_toggle />
        </div>
      </div>
    </aside>
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
      class={[
        "flex items-center gap-2.5 rounded-md text-sm transition-all duration-150 no-underline border-none bg-transparent w-full text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2",
        if(@active == @tab,
          do: "bg-primary/10 text-primary font-medium",
          else: "text-base-content/80 hover:bg-base-content/5 hover:text-base-content"
        ),
        if(@collapsed, do: "justify-center p-2.5 w-9 h-9", else: "px-3 py-2")
      ]}
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
  attr :quests_data, :list, default: nil
  attr :testing_data, :map, default: nil
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

  defp tab_content(%{tab: :audit_log} = assigns) do
    ~H"""
    <.live_component module={AuditLogTab} id="audit-log-tab" />
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
    "quests" => :quests,
    "testing" => :testing,
    "audit_log" => :audit_log
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
     |> load_tab_data(tab)}
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
    alias Loka.Engine.Entities

    assign(socket, :stats, %{
      total_players: Accounts.count_players(),
      total_rooms: Entities.count_by_type(:room),
      total_entities: Entities.count_all()
    })
  end

  defp load_tab_data(socket, :players) do
    assign(socket, :players, Accounts.list_players())
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

  # Audit log tab loads data via LiveComponent
  defp load_tab_data(socket, :audit_log), do: socket

  defp load_tab_data(socket, _), do: socket
end
