defmodule LokaWeb.AdminLive.WorldDesigner.QuestComponents do
  @moduledoc """
  Quest diagram components for the World Designer.

  Renders the quest flow diagram showing storylines, acts, and quest dependencies.
  """
  use Phoenix.Component

  import LokaWeb.CoreComponents, only: [icon: 1]

  # =============================================================================
  # Quest Diagram Panel Component
  # =============================================================================

  attr :quests, :list, required: true
  attr :storylines, :list, required: true
  attr :selected_storyline, :any, required: true
  attr :selected, :any, required: true
  attr :selected_type, :atom, required: true
  attr :player_progress, :any, required: true
  attr :myself, :any, required: true

  def quest_diagram_panel(assigns) do
    # Filter quests by storyline
    storyline = Enum.find(assigns.storylines, &(&1.key == assigns.selected_storyline))

    filtered_quests =
      if storyline do
        storyline_quest_ids = get_storyline_quest_ids(storyline)
        Enum.filter(assigns.quests, &(&1.id in storyline_quest_ids))
      else
        assigns.quests
      end

    assigns =
      assigns
      |> assign(:filtered_quests, filtered_quests)
      |> assign(:current_storyline, storyline)

    ~H"""
    <div class="card bg-base-200 h-full">
      <div class="card-body p-4 flex flex-col">
        <div class="flex justify-between items-center flex-none">
          <h3 class="card-title text-sm">Quest Flow</h3>
          <select
            class="select select-bordered select-xs"
            phx-change="select_storyline"
            phx-target={@myself}
          >
            <option value="">All Quests</option>
            <option
              :for={storyline <- @storylines}
              value={storyline.key}
              selected={@selected_storyline == storyline.key}
            >
              {storyline.name}
            </option>
          </select>
        </div>

        <div
          class="overflow-auto bg-base-300 rounded-lg p-2 flex-1"
          style="min-height: 500px;"
        >
          <%= if @current_storyline do %>
            <.storyline_diagram
              storyline={@current_storyline}
              quests={@filtered_quests}
              selected={@selected}
              selected_type={@selected_type}
              player_progress={@player_progress}
              myself={@myself}
            />
          <% else %>
            <.all_quests_list
              quests={@quests}
              selected={@selected}
              selected_type={@selected_type}
              myself={@myself}
            />
          <% end %>
        </div>
      </div>
    </div>
    """
  end

  # =============================================================================
  # Storyline Diagram Component
  # =============================================================================

  attr :storyline, :map, required: true
  attr :quests, :list, required: true
  attr :selected, :any, required: true
  attr :selected_type, :atom, required: true
  attr :player_progress, :any, default: nil
  attr :myself, :any, required: true

  defp storyline_diagram(assigns) do
    # Build quest positions for arrow drawing
    # Layout: each act is a row, quests flow left-to-right with arrows between
    quest_positions = build_quest_positions(assigns.storyline, assigns.quests)

    # Build player progress map for quick lookup
    player_quest_map = build_player_quest_map(assigns.player_progress)
    assigns = assign(assigns, :player_quest_map, player_quest_map)

    assigns =
      assigns
      |> assign(:quest_positions, quest_positions)

    ~H"""
    <div class="relative">
      <%!-- SVG layer for prerequisite arrows --%>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="absolute inset-0 pointer-events-none w-full h-full"
        style="min-height: 400px;"
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#666666" />
          </marker>
        </defs>
        <%= for {from_id, to_id} <- get_prerequisite_edges(@quests) do %>
          <.quest_arrow
            from_pos={Map.get(@quest_positions, from_id)}
            to_pos={Map.get(@quest_positions, to_id)}
          />
        <% end %>
      </svg>

      <%!-- Quest nodes layer --%>
      <div class="space-y-6">
        <%= for {act, act_idx} <- Enum.with_index(@storyline.acts) do %>
          <div class="relative">
            <div class="text-xs font-semibold text-primary mb-2 flex items-center gap-2">
              <span class="badge badge-primary badge-xs">Act {act_idx + 1}</span>
              {act.name}
            </div>
            <div class="flex items-center gap-4 flex-wrap">
              <%= for {quest_id, q_idx} <- Enum.with_index(act.quests) do %>
                <% quest = Enum.find(@quests, &(&1.id == quest_id)) %>
                <%= if quest do %>
                  <div class="flex items-center gap-2">
                    <.quest_node_enhanced
                      quest={quest}
                      selected={@selected == quest.id and @selected_type == :quest}
                      myself={@myself}
                      position={Map.get(@quest_positions, quest_id)}
                      player_quest={Map.get(@player_quest_map, quest_id)}
                    />
                    <%= if q_idx < length(act.quests) - 1 do %>
                      <.icon name="hero-arrow-right" class="size-4 opacity-30" />
                    <% end %>
                  </div>
                <% else %>
                  <div class="badge badge-error badge-sm">Missing: {quest_id}</div>
                <% end %>
              <% end %>
            </div>
          </div>
        <% end %>

        <%= if length(@storyline.side_quests || []) > 0 do %>
          <div class="border-t border-base-content/10 pt-4">
            <div class="text-xs font-semibold text-secondary mb-2 flex items-center gap-2">
              <span class="badge badge-secondary badge-xs">Side</span> Optional Quests
            </div>
            <div class="flex flex-wrap gap-3">
              <%= for quest_id <- @storyline.side_quests do %>
                <% quest = Enum.find(@quests, &(&1.id == quest_id)) %>
                <%= if quest do %>
                  <.quest_node_enhanced
                    quest={quest}
                    selected={@selected == quest.id and @selected_type == :quest}
                    myself={@myself}
                    position={Map.get(@quest_positions, quest_id)}
                    player_quest={Map.get(@player_quest_map, quest_id)}
                  />
                <% end %>
              <% end %>
            </div>
          </div>
        <% end %>
      </div>
    </div>
    """
  end

  # =============================================================================
  # Quest Node Components
  # =============================================================================

  attr :quest, :map, required: true
  attr :selected, :boolean, required: true
  attr :myself, :any, required: true
  attr :position, :map, default: nil
  attr :player_quest, :map, default: nil

  defp quest_node_enhanced(assigns) do
    has_warnings = length(assigns.quest.validation_warnings) > 0
    has_prereqs = length(assigns.quest.prerequisites) > 0
    objective_count = length(assigns.quest.objectives)

    # Player progress info
    player_status = if assigns.player_quest, do: assigns.player_quest[:status], else: nil

    completed_objectives =
      if assigns.player_quest, do: assigns.player_quest[:completed_objectives], else: 0

    total_objectives =
      if assigns.player_quest, do: assigns.player_quest[:total_objectives], else: 0

    progress_pct =
      if total_objectives > 0, do: round(completed_objectives / total_objectives * 100), else: 0

    assigns =
      assigns
      |> assign(:has_warnings, has_warnings)
      |> assign(:has_prereqs, has_prereqs)
      |> assign(:objective_count, objective_count)
      |> assign(:player_status, player_status)
      |> assign(:progress_pct, progress_pct)
      |> assign(:completed_objectives, completed_objectives)
      |> assign(:total_objectives, total_objectives)

    ~H"""
    <div
      class={[
        "relative px-3 py-2 rounded-lg border-2 cursor-pointer transition-all hover:scale-105",
        "min-w-[140px]",
        player_status_bg(@player_status),
        if(@selected,
          do: "border-primary ring-2 ring-primary/50",
          else: player_status_border(@player_status)
        ),
        if(@has_warnings and @player_status == nil, do: "border-warning")
      ]}
      phx-click="select_quest"
      phx-value-id={@quest.id}
      phx-target={@myself}
      title={@quest.name}
    >
      <%!-- Progress bar overlay --%>
      <div
        :if={@player_status == :in_progress and @progress_pct > 0}
        class="absolute inset-0 bg-success/10 rounded-lg"
        style={"width: #{@progress_pct}%;"}
      />

      <div class="relative flex items-start justify-between gap-2">
        <div class="flex-1 min-w-0">
          <div class="font-medium text-sm truncate flex items-center gap-1">
            <span :if={@player_status == :completed} class="text-success">✓</span>
            <span :if={@player_status == :ready_to_turn_in} class="text-warning">★</span>
            {@quest.name}
          </div>
          <div class="text-xs opacity-60 mt-0.5">
            {if @quest.giver, do: "📍 #{@quest.giver}", else: "No giver"}
          </div>
        </div>
        <div class="flex flex-col items-end gap-0.5">
          <span :if={@has_warnings and @player_status == nil} title="Has warnings">⚠️</span>
          <%= if @player_status do %>
            <span class="badge badge-xs" title="Player progress">
              {@completed_objectives}/{@total_objectives}
            </span>
          <% else %>
            <span class="badge badge-xs">{@objective_count} obj</span>
          <% end %>
        </div>
      </div>
      <div
        :if={@has_prereqs and @player_status == nil}
        class="relative text-xs opacity-50 mt-1 truncate"
      >
        Requires: {Enum.join(@quest.prerequisites, ", ")}
      </div>
      <div :if={@player_status == :in_progress} class="relative text-xs mt-1">
        <span class="text-info">{@progress_pct}% complete</span>
      </div>
    </div>
    """
  end

  attr :quest, :map, required: true
  attr :selected, :boolean, required: true
  attr :myself, :any, required: true

  defp quest_node(assigns) do
    has_warnings = length(assigns.quest.validation_warnings) > 0

    assigns = assign(assigns, :has_warnings, has_warnings)

    ~H"""
    <div
      class={[
        "px-2 py-1 rounded border cursor-pointer transition-all hover:scale-105 text-xs",
        "bg-base-100",
        if(@selected, do: "border-primary ring-2 ring-primary/50", else: "border-base-content/20"),
        if(@has_warnings, do: "border-warning")
      ]}
      phx-click="select_quest"
      phx-value-id={@quest.id}
      phx-target={@myself}
      title={@quest.name}
    >
      <div class="flex items-center gap-1">
        <span :if={@has_warnings}>⚠️</span>
        <span :if={@quest.giver}>🟢</span>
        <span class="truncate max-w-24">{@quest.name}</span>
      </div>
    </div>
    """
  end

  # =============================================================================
  # All Quests List Component
  # =============================================================================

  attr :quests, :list, required: true
  attr :selected, :any, required: true
  attr :selected_type, :atom, required: true
  attr :myself, :any, required: true

  defp all_quests_list(assigns) do
    # Group by type
    main_quests = Enum.filter(assigns.quests, &(&1.type == "main"))
    side_quests = Enum.filter(assigns.quests, &(&1.type != "main"))

    assigns =
      assigns
      |> assign(:main_quests, main_quests)
      |> assign(:side_quests, side_quests)

    ~H"""
    <div class="space-y-4">
      <%= if length(@main_quests) > 0 do %>
        <div>
          <div class="text-xs font-semibold text-primary mb-2">
            Main Quests ({length(@main_quests)})
          </div>
          <div class="flex flex-wrap gap-2">
            <.quest_node
              :for={quest <- @main_quests}
              quest={quest}
              selected={@selected == quest.id and @selected_type == :quest}
              myself={@myself}
            />
          </div>
        </div>
      <% end %>

      <%= if length(@side_quests) > 0 do %>
        <div>
          <div class="text-xs font-semibold text-secondary mb-2">
            Side Quests ({length(@side_quests)})
          </div>
          <div class="flex flex-wrap gap-2">
            <.quest_node
              :for={quest <- @side_quests}
              quest={quest}
              selected={@selected == quest.id and @selected_type == :quest}
              myself={@myself}
            />
          </div>
        </div>
      <% end %>
    </div>
    """
  end

  # =============================================================================
  # Quest Arrow Component
  # =============================================================================

  attr :from_pos, :map, default: nil
  attr :to_pos, :map, default: nil

  defp quest_arrow(%{from_pos: nil} = assigns), do: ~H""
  defp quest_arrow(%{to_pos: nil} = assigns), do: ~H""

  defp quest_arrow(assigns) do
    # Draw curved arrow from right edge of from_quest to left edge of to_quest
    from_x = assigns.from_pos.x + 70
    from_y = assigns.from_pos.y + 15
    to_x = assigns.to_pos.x - 10
    to_y = assigns.to_pos.y + 15

    # Control points for bezier curve
    mid_x = (from_x + to_x) / 2

    assigns =
      assigns
      |> assign(
        :path,
        "M #{from_x} #{from_y} C #{mid_x} #{from_y}, #{mid_x} #{to_y}, #{to_x} #{to_y}"
      )

    ~H"""
    <path
      d={@path}
      fill="none"
      stroke="#888888"
      stroke-width="1.5"
      stroke-dasharray="4,2"
      marker-end="url(#arrowhead)"
      opacity="0.6"
    />
    """
  end

  # =============================================================================
  # Helper Functions
  # =============================================================================

  defp get_storyline_quest_ids(storyline) do
    act_quests = Enum.flat_map(storyline.acts || [], & &1.quests)
    side_quests = storyline.side_quests || []
    act_quests ++ side_quests
  end

  # Build map of quest_id -> player quest progress
  defp build_player_quest_map(nil), do: %{}

  defp build_player_quest_map(player_progress) do
    active = player_progress[:active_quests] || player_progress["active_quests"] || []
    completed = player_progress[:completed_quests] || player_progress["completed_quests"] || []

    active_map =
      Enum.reduce(active, %{}, fn quest, acc ->
        quest_id = quest[:quest_id] || quest["quest_id"]
        is_complete = quest[:is_complete] || quest["is_complete"] || false

        objectives = quest[:objectives] || quest["objectives"] || []
        completed_count = Enum.count(objectives, fn o -> o[:completed] || o["completed"] end)
        total_count = length(objectives)

        Map.put(acc, quest_id, %{
          status: if(is_complete, do: :ready_to_turn_in, else: :in_progress),
          completed_objectives: completed_count,
          total_objectives: total_count
        })
      end)

    completed_map =
      Enum.reduce(completed, %{}, fn quest, acc ->
        quest_id = quest[:quest_id] || quest["quest_id"]

        Map.put(acc, quest_id, %{status: :completed, completed_objectives: 0, total_objectives: 0})
      end)

    Map.merge(active_map, completed_map)
  end

  # Build quest ID -> position map for arrow drawing
  defp build_quest_positions(storyline, _quests) do
    # Main quests: positioned by act and index within act
    main_positions =
      storyline.acts
      |> Enum.with_index()
      |> Enum.flat_map(fn {act, act_idx} ->
        act.quests
        |> Enum.with_index()
        |> Enum.map(fn {quest_id, q_idx} ->
          # x = horizontal position (quest index * spacing)
          # y = vertical position (act index * spacing)
          {quest_id, %{x: q_idx * 180 + 100, y: act_idx * 80 + 40}}
        end)
      end)
      |> Map.new()

    # Side quests: positioned in a row below main quests
    side_positions =
      (storyline.side_quests || [])
      |> Enum.with_index()
      |> Enum.map(fn {quest_id, idx} ->
        act_count = length(storyline.acts)
        {quest_id, %{x: idx * 180 + 100, y: act_count * 80 + 100}}
      end)
      |> Map.new()

    Map.merge(main_positions, side_positions)
  end

  # Get list of prerequisite edges {from_quest_id, to_quest_id}
  defp get_prerequisite_edges(quests) do
    quests
    |> Enum.flat_map(fn quest ->
      quest.prerequisites
      |> Enum.map(fn prereq_id ->
        {prereq_id, quest.id}
      end)
    end)
  end

  defp player_status_bg(:completed), do: "bg-success/20"
  defp player_status_bg(:ready_to_turn_in), do: "bg-warning/20"
  defp player_status_bg(:in_progress), do: "bg-info/10"
  defp player_status_bg(_), do: "bg-base-100"

  defp player_status_border(:completed), do: "border-success"
  defp player_status_border(:ready_to_turn_in), do: "border-warning"
  defp player_status_border(:in_progress), do: "border-info"
  defp player_status_border(_), do: "border-base-content/20"
end
