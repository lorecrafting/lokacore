defmodule LokaWeb.AdminLive.QuestsTab do
  @moduledoc """
  Quests tab component for the admin interface.
  Provides quest debugging tools: view player quest state, force complete objectives,
  reset quests, and view event logs.
  """
  use LokaWeb, :live_component

  import LokaWeb.AdminLive.Components, only: [stat_card: 1]

  alias Loka.Framework.Quest.Admin, as: QuestAdmin
  alias Loka.Framework.Quest.Metrics, as: QuestMetrics

  @impl true
  def mount(socket) do
    {:ok,
     socket
     |> assign(:selected_player, nil)
     |> assign(:player_quest_state, nil)
     |> assign(:quest_events, [])
     |> assign(:show_events, false)
     |> assign(:show_metrics, false)
     |> assign(:metrics, nil)
     |> assign(:all_quests, [])}
  end

  @impl true
  def update(assigns, socket) do
    socket =
      socket
      |> assign(assigns)
      |> assign(:all_quests, QuestAdmin.list_all_quests())

    {:ok, socket}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <div class="admin-section">
      <h2 class="admin-section-title">Quest Debugging</h2>

      <div class="flex justify-between items-center mb-4">
        <div class="admin-grid-stats flex-1">
          <.stat_card
            title="Registered Quests"
            value={length(@all_quests)}
            icon="hero-book-open"
            status={:neutral}
          />
          <.stat_card
            title="Players with Quests"
            value={count_players_with_quests(@quests_data)}
            icon="hero-users"
            status={:neutral}
          />
          <.stat_card
            title="Active Quests (Total)"
            value={count_total_active(@quests_data)}
            icon="hero-play"
            status={:neutral}
          />
          <.stat_card
            title="Completion Rate"
            value={format_completion_rate(@metrics)}
            icon="hero-chart-bar"
            status={completion_status(@metrics)}
          />
        </div>
        <button
          phx-click="toggle_metrics"
          phx-target={@myself}
          class="btn btn-primary btn-sm ml-4"
        >
          {if @show_metrics, do: "Hide Metrics", else: "Show Metrics"}
        </button>
      </div>

      <%= if @show_metrics && @metrics do %>
        <.metrics_panel metrics={@metrics} />
      <% end %>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="card bg-base-200">
          <div class="card-body">
            <h3 class="card-title">Players</h3>
            <.player_list players={@quests_data} selected={@selected_player} myself={@myself} />
          </div>
        </div>

        <div class="card bg-base-200">
          <div class="card-body">
            <h3 class="card-title">Quest Actions</h3>
            <.quest_actions
              all_quests={@all_quests}
              selected_player={@selected_player}
              player_quest_state={@player_quest_state}
              myself={@myself}
            />
          </div>
        </div>
      </div>

      <%= if @selected_player && @player_quest_state do %>
        <div class="card bg-base-200 mt-6">
          <div class="card-body">
            <div class="flex justify-between items-center">
              <h3 class="card-title">Quest State Details</h3>
              <div class="flex gap-2">
                <button
                  phx-click="toggle_events"
                  phx-target={@myself}
                  class="btn btn-ghost btn-sm"
                >
                  {if @show_events, do: "Hide Events", else: "Show Events"}
                </button>
                <button
                  phx-click="reset_all_quests"
                  phx-target={@myself}
                  data-confirm="Reset ALL quests for this player? This cannot be undone."
                  class="btn btn-error btn-sm"
                >
                  Reset All
                </button>
              </div>
            </div>

            <.quest_state_details
              state={@player_quest_state}
              show_events={@show_events}
              quest_events={@quest_events}
              myself={@myself}
            />
          </div>
        </div>
      <% end %>
    </div>
    """
  end

  # =============================================================================
  # Player List Component
  # =============================================================================

  attr :players, :list, required: true
  attr :selected, :any, required: true
  attr :myself, :any, required: true

  defp player_list(assigns) do
    ~H"""
    <div class="overflow-y-auto max-h-80">
      <%= if @players && length(@players) > 0 do %>
        <table class="table table-zebra w-full table-sm">
          <thead>
            <tr>
              <th>Email</th>
              <th>Active</th>
              <th>Done</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr
              :for={player <- @players}
              class={["hover cursor-pointer", if(@selected == player.player_id, do: "bg-primary/20")]}
              phx-click="select_player"
              phx-value-player-id={player.player_id}
              phx-target={@myself}
            >
              <td class="truncate max-w-32">{player.email}</td>
              <td>
                <span class={[
                  "badge badge-sm",
                  if(player.active_count > 0, do: "badge-primary", else: "badge-ghost")
                ]}>
                  {player.active_count}
                </span>
              </td>
              <td>
                <span class="badge badge-sm badge-success">{player.completed_count}</span>
              </td>
              <td>
                <span :if={not player.has_game_state} class="badge badge-sm badge-warning">
                  No State
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      <% else %>
        <p class="admin-empty-text">No players found.</p>
      <% end %>
    </div>
    """
  end

  # =============================================================================
  # Quest Actions Component
  # =============================================================================

  attr :all_quests, :list, required: true
  attr :selected_player, :any, required: true
  attr :player_quest_state, :any, required: true
  attr :myself, :any, required: true

  defp quest_actions(assigns) do
    ~H"""
    <div class="space-y-4">
      <%= if @selected_player do %>
        <div class="form-control">
          <label class="label">
            <span class="label-text">Grant Quest</span>
          </label>
          <div class="flex gap-2">
            <select
              id="quest-select"
              class="select select-bordered flex-1"
              phx-change="select_quest_to_grant"
              phx-target={@myself}
            >
              <option value="">Select a quest...</option>
              <option :for={quest <- @all_quests} value={quest.id}>
                {quest.name} ({quest.type})
              </option>
            </select>
            <button
              phx-click="grant_quest"
              phx-target={@myself}
              class="btn btn-primary btn-sm"
            >
              Grant
            </button>
          </div>
        </div>

        <%= if @player_quest_state && length(@player_quest_state.active_quests) > 0 do %>
          <div class="divider">Active Quest Actions</div>

          <div :for={quest <- @player_quest_state.active_quests} class="mb-4">
            <div class="flex justify-between items-center mb-2">
              <span class="font-semibold">{quest.name}</span>
              <div class="flex gap-1">
                <button
                  phx-click="complete_all_objectives"
                  phx-value-quest-id={quest.quest_id}
                  phx-target={@myself}
                  class="btn btn-xs btn-success"
                >
                  Complete All
                </button>
                <button
                  phx-click="turn_in_quest"
                  phx-value-quest-id={quest.quest_id}
                  phx-target={@myself}
                  class="btn btn-xs btn-info"
                  disabled={not quest.is_complete}
                >
                  Turn In
                </button>
                <button
                  phx-click="reset_quest"
                  phx-value-quest-id={quest.quest_id}
                  phx-target={@myself}
                  class="btn btn-xs btn-error"
                >
                  Reset
                </button>
              </div>
            </div>

            <div class="pl-4 space-y-1">
              <div :for={obj <- quest.objectives} class="flex justify-between items-center text-sm">
                <span class={if obj.completed, do: "line-through opacity-50"}>
                  {obj.description}
                </span>
                <div class="flex items-center gap-2">
                  <span class="badge badge-xs">
                    {obj.progress}/{obj.target_count}
                  </span>
                  <button
                    :if={not obj.completed}
                    phx-click="complete_objective"
                    phx-value-quest-id={quest.quest_id}
                    phx-value-objective-id={obj.id}
                    phx-target={@myself}
                    class="btn btn-xs btn-ghost"
                  >
                    Complete
                  </button>
                  <span :if={obj.completed} class="badge badge-xs badge-success">Done</span>
                </div>
              </div>
            </div>
          </div>
        <% else %>
          <p class="admin-empty-text">No active quests for this player.</p>
        <% end %>
      <% else %>
        <p class="admin-empty-text">Select a player to manage their quests.</p>
      <% end %>
    </div>
    """
  end

  # =============================================================================
  # Quest State Details Component
  # =============================================================================

  attr :state, :map, required: true
  attr :show_events, :boolean, required: true
  attr :quest_events, :list, required: true
  attr :myself, :any, required: true

  defp quest_state_details(assigns) do
    ~H"""
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
      <div>
        <h4 class="font-semibold mb-2">Completed Quests ({length(@state.completed_quests)})</h4>
        <%= if length(@state.completed_quests) > 0 do %>
          <ul class="list-disc list-inside text-sm space-y-1">
            <li :for={quest_id <- @state.completed_quests}>{quest_id}</li>
          </ul>
        <% else %>
          <p class="text-sm opacity-50">No completed quests.</p>
        <% end %>
      </div>

      <%= if @show_events do %>
        <div>
          <div class="flex justify-between items-center mb-2">
            <h4 class="font-semibold">Recent Events</h4>
            <button
              phx-click="clear_events"
              phx-target={@myself}
              class="btn btn-xs btn-ghost"
            >
              Clear
            </button>
          </div>
          <%= if length(@quest_events) > 0 do %>
            <div class="overflow-y-auto max-h-60 text-xs font-mono bg-base-300 p-2 rounded">
              <div :for={event <- Enum.take(@quest_events, 20)} class="mb-1">
                <span class="opacity-50">{format_event_time(event)}</span>
                <span class={event_type_class(event.event_type)}>{event.event_type}</span>
                <span>: {inspect(event.data)}</span>
              </div>
              <div :if={length(@quest_events) > 20} class="opacity-50">
                ...and {length(@quest_events) - 20} more
              </div>
            </div>
          <% else %>
            <p class="text-sm opacity-50">No events recorded.</p>
          <% end %>
        </div>
      <% end %>
    </div>
    """
  end

  # =============================================================================
  # Event Handlers
  # =============================================================================

  @impl true
  def handle_event("select_player", %{"player-id" => player_id}, socket) do
    player_id = String.to_integer(player_id)

    case QuestAdmin.get_player_quest_state(player_id) do
      {:ok, state} ->
        events = QuestAdmin.get_quest_events(player_id, limit: 50)

        {:noreply,
         socket
         |> assign(:selected_player, player_id)
         |> assign(:player_quest_state, state)
         |> assign(:quest_events, events)}

      {:error, :no_game_state} ->
        {:noreply,
         socket
         |> assign(:selected_player, player_id)
         |> assign(:player_quest_state, %{active_quests: [], completed_quests: []})
         |> assign(:quest_events, [])}
    end
  end

  def handle_event("select_quest_to_grant", %{"value" => quest_id}, socket) do
    {:noreply, assign(socket, :quest_to_grant, quest_id)}
  end

  def handle_event("grant_quest", _, socket) do
    quest_id = socket.assigns[:quest_to_grant]
    player_id = socket.assigns.selected_player

    if quest_id && quest_id != "" && player_id do
      case QuestAdmin.force_grant_quest(player_id, quest_id) do
        {:ok, _state} ->
          {:noreply, refresh_player_state(socket, player_id, "Quest granted successfully")}

        {:error, reason} ->
          {:noreply, put_flash(socket, :error, "Failed to grant quest: #{inspect(reason)}")}
      end
    else
      {:noreply, put_flash(socket, :error, "Select a quest first")}
    end
  end

  def handle_event(
        "complete_objective",
        %{"quest-id" => quest_id, "objective-id" => obj_id},
        socket
      ) do
    player_id = socket.assigns.selected_player

    case QuestAdmin.force_complete_objective(player_id, quest_id, obj_id) do
      {:ok, _state} ->
        {:noreply, refresh_player_state(socket, player_id, "Objective completed")}

      {:error, reason} ->
        {:noreply, put_flash(socket, :error, "Failed: #{inspect(reason)}")}
    end
  end

  def handle_event("complete_all_objectives", %{"quest-id" => quest_id}, socket) do
    player_id = socket.assigns.selected_player

    case QuestAdmin.force_complete_all_objectives(player_id, quest_id) do
      {:ok, _state} ->
        {:noreply, refresh_player_state(socket, player_id, "All objectives completed")}

      {:error, reason} ->
        {:noreply, put_flash(socket, :error, "Failed: #{inspect(reason)}")}
    end
  end

  def handle_event("turn_in_quest", %{"quest-id" => quest_id}, socket) do
    player_id = socket.assigns.selected_player

    case QuestAdmin.force_turn_in_quest(player_id, quest_id) do
      {:ok, _state, rewards} ->
        {:noreply,
         refresh_player_state(socket, player_id, "Quest turned in. Rewards: #{inspect(rewards)}")}

      {:error, reason} ->
        {:noreply, put_flash(socket, :error, "Failed: #{inspect(reason)}")}
    end
  end

  def handle_event("reset_quest", %{"quest-id" => quest_id}, socket) do
    player_id = socket.assigns.selected_player

    case QuestAdmin.reset_quest(player_id, quest_id) do
      {:ok, _state} ->
        {:noreply, refresh_player_state(socket, player_id, "Quest reset")}

      {:error, reason} ->
        {:noreply, put_flash(socket, :error, "Failed: #{inspect(reason)}")}
    end
  end

  def handle_event("reset_all_quests", _, socket) do
    player_id = socket.assigns.selected_player

    case QuestAdmin.reset_all_quests(player_id) do
      {:ok, _state} ->
        {:noreply, refresh_player_state(socket, player_id, "All quests reset")}

      {:error, reason} ->
        {:noreply, put_flash(socket, :error, "Failed: #{inspect(reason)}")}
    end
  end

  def handle_event("toggle_events", _, socket) do
    {:noreply, assign(socket, :show_events, not socket.assigns.show_events)}
  end

  def handle_event("clear_events", _, socket) do
    player_id = socket.assigns.selected_player
    QuestAdmin.clear_quest_events(player_id)
    {:noreply, assign(socket, :quest_events, [])}
  end

  def handle_event("toggle_metrics", _, socket) do
    show = not socket.assigns.show_metrics

    socket =
      if show and socket.assigns.metrics == nil do
        case QuestMetrics.get_summary() do
          {:ok, metrics} -> assign(socket, :metrics, metrics)
          _ -> socket
        end
      else
        socket
      end

    {:noreply, assign(socket, :show_metrics, show)}
  end

  # =============================================================================
  # Helper Functions
  # =============================================================================

  defp refresh_player_state(socket, player_id, flash_msg) do
    case QuestAdmin.get_player_quest_state(player_id) do
      {:ok, state} ->
        events = QuestAdmin.get_quest_events(player_id, limit: 50)

        socket
        |> assign(:player_quest_state, state)
        |> assign(:quest_events, events)
        |> put_flash(:info, flash_msg)

      _ ->
        socket
        |> assign(:player_quest_state, %{active_quests: [], completed_quests: []})
        |> put_flash(:info, flash_msg)
    end
  end

  defp count_players_with_quests(nil), do: 0

  defp count_players_with_quests(players) do
    Enum.count(players, &(&1.active_count > 0 or &1.completed_count > 0))
  end

  defp count_total_active(nil), do: 0

  defp count_total_active(players) do
    Enum.sum(Enum.map(players, & &1.active_count))
  end

  defp format_event_time(%{timestamp: ts}) when is_struct(ts, DateTime) do
    Calendar.strftime(ts, "%H:%M:%S")
  end

  defp format_event_time(_), do: ""

  defp event_type_class(:quest_accepted), do: "text-success"
  defp event_type_class(:objective_completed), do: "text-info"
  defp event_type_class(:quest_completed), do: "text-primary"
  defp event_type_class(:error), do: "text-error"
  defp event_type_class(_), do: ""

  defp format_completion_rate(nil), do: "-"

  defp format_completion_rate(%{completion_rate: rate}) do
    "#{Float.round(rate * 100, 1)}%"
  end

  defp completion_status(nil), do: :neutral

  defp completion_status(%{completion_rate: rate}) do
    cond do
      rate >= 0.7 -> :success
      rate >= 0.4 -> :warning
      true -> :error
    end
  end

  # =============================================================================
  # Metrics Panel Component
  # =============================================================================

  attr :metrics, :map, required: true

  defp metrics_panel(assigns) do
    ~H"""
    <div class="card bg-base-200 mb-6">
      <div class="card-body">
        <h3 class="card-title">Quest Analytics</h3>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          <div class="bg-base-300 p-4 rounded-lg">
            <h4 class="font-semibold mb-2">Overall Stats</h4>
            <div class="space-y-1 text-sm">
              <p>Total Defined: {@metrics.total_quests_defined}</p>
              <p>Players with Quests: {@metrics.total_players_with_quests}</p>
              <p>Active Quests: {@metrics.total_active_quests}</p>
              <p>Completed: {@metrics.total_completed_quests}</p>
            </div>
          </div>

          <div class="bg-base-300 p-4 rounded-lg">
            <h4 class="font-semibold mb-2">Most Popular</h4>
            <ul class="space-y-1 text-sm">
              <li :for={quest <- @metrics.most_popular_quests} class="flex justify-between">
                <span class="truncate">{quest.name}</span>
                <span class="badge badge-sm badge-success">{quest.completions}</span>
              </li>
              <li :if={@metrics.most_popular_quests == []} class="opacity-50">
                No completions yet
              </li>
            </ul>
          </div>

          <div class="bg-base-300 p-4 rounded-lg">
            <h4 class="font-semibold mb-2">Least Completed</h4>
            <ul class="space-y-1 text-sm">
              <li :for={quest <- @metrics.least_completed_quests} class="flex justify-between">
                <span class="truncate">{quest.name}</span>
                <span class="badge badge-sm badge-ghost">{quest.completions}</span>
              </li>
            </ul>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <div class="bg-base-300 p-4 rounded-lg">
            <h4 class="font-semibold mb-2">Quests by Type</h4>
            <div class="flex flex-wrap gap-2">
              <span
                :for={{type, count} <- @metrics.quests_by_type}
                class="badge badge-outline"
              >
                {type}: {count}
              </span>
            </div>
          </div>

          <div class="bg-base-300 p-4 rounded-lg">
            <h4 class="font-semibold mb-2">Completion Rate</h4>
            <div class="flex items-center gap-4">
              <div
                class="radial-progress text-primary"
                style={"--value:#{Float.round(@metrics.completion_rate * 100, 0)}; --size:4rem;"}
                role="progressbar"
              >
                {Float.round(@metrics.completion_rate * 100, 0)}%
              </div>
              <div class="text-sm">
                <p>{@metrics.total_completed_quests} completed</p>
                <p>{@metrics.total_active_quests} in progress</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    """
  end
end
