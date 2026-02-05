defmodule LokaWeb.AdminLive.WorldBuilder.QuestFlowModal do
  @moduledoc """
  Quest Flow Visualization Modal.

  Displays a directed graph of quest dependencies showing:
  - Prerequisites (requires_quest)
  - Unlocks (what completing this quest unlocks)
  - Quest chains and progression paths
  """
  use Phoenix.Component
  import LokaWeb.CoreComponents

  attr :show, :boolean, default: false
  attr :quests, :list, default: []
  attr :selected_quest, :string, default: nil
  attr :filter_type, :string, default: "all"

  def quest_flow_modal(assigns) do
    # Build graph data from quests
    graph = build_quest_graph(assigns.quests)

    # Get selected quest details
    selected_quest_data =
      if assigns.selected_quest do
        Enum.find(assigns.quests, fn q -> q.key == assigns.selected_quest end)
      end

    assigns =
      assigns
      |> assign(:graph, graph)
      |> assign(:selected_quest_data, selected_quest_data)

    ~H"""
    <div
      :if={@show}
      class="modal-overlay quest-flow-overlay"
      phx-click="close_quest_flow"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quest-flow-title"
    >
      <div
        class="modal-content bg-wb-panel border border-wb-border rounded-wb-lg flex flex-col overflow-hidden max-w-[900px] max-h-[85vh]"
        phx-click-away="close_quest_flow"
      >
        <div class="flex items-center justify-between px-4 py-3 border-b border-wb-border">
          <h3
            id="quest-flow-title"
            class="m-0 text-wb-text-bright text-base font-semibold flex items-center gap-2"
          >
            <.icon name="hero-arrow-trending-up" class="size-5" /> Quest Flow
          </h3>
          
    <!-- Filter buttons -->
          <div class="flex gap-1 ml-4">
            <button
              phx-click="quest_flow_filter"
              phx-value-type="all"
              class={["quest-filter-btn", @filter_type == "all" && "active"]}
            >
              All
            </button>
            <button
              phx-click="quest_flow_filter"
              phx-value-type="main"
              class={["quest-filter-btn", @filter_type == "main" && "active"]}
            >
              Main
            </button>
            <button
              phx-click="quest_flow_filter"
              phx-value-type="side"
              class={["quest-filter-btn", @filter_type == "side" && "active"]}
              data-type="side"
            >
              Side
            </button>
            <button
              phx-click="quest_flow_filter"
              phx-value-type="tutorial"
              class={["quest-filter-btn", @filter_type == "tutorial" && "active"]}
              data-type="tutorial"
            >
              Tutorial
            </button>
          </div>

          <span class="text-wb-text-muted text-xs ml-auto">
            {length(@quests)} quests
          </span>
          <button
            phx-click="close_quest_flow"
            class="bg-transparent border-0 text-wb-text-muted text-2xl cursor-pointer p-0 w-8 h-8 flex items-center justify-center rounded-wb-sm transition-all hover:bg-wb-border hover:text-wb-text-bright absolute right-4 top-3"
          >
            &times;
          </button>
        </div>

        <div class="modal-body relative bg-wb-panel-alt flex-1 overflow-auto p-0">
          <div
            :if={@graph.nodes == []}
            class="p-10 text-center text-wb-text-muted"
          >
            <.icon name="hero-map" class="size-12" />
            <p>No quests found</p>
          </div>
          <div
            :if={@graph.nodes != []}
            class="quest-graph-container relative w-full overflow-auto"
            id="quest-graph"
            phx-hook="QuestFlowGraph"
            phx-update="ignore"
            data-nodes={Jason.encode!(@graph.nodes)}
            data-edges={Jason.encode!(@graph.edges)}
            class="h-[500px]"
          >
            <!-- Quest Graph Legend -->
            <div class="absolute flex flex-col gap-1 text-[11px] text-wb-text-muted rounded-wb-md border border-wb-border z-10 top-2.5 right-2.5 bg-[rgba(30,30,30,0.95)] px-3 py-2">
              <div class="flex items-center gap-1.5">
                <span class="w-3 h-3 rounded-sm bg-wb-accent"></span> Main Quest
              </div>
              <div class="flex items-center gap-1.5">
                <span class="w-3 h-3 rounded-sm bg-wb-quest-pass"></span> Side Quest
              </div>
              <div class="flex items-center gap-1.5">
                <span class="w-3 h-3 rounded-sm bg-wb-quest-pass-alt"></span> Tutorial
              </div>
              <div class="mt-1 pt-1 border-t border-wb-border">→ Requires/Unlocks</div>
            </div>
            
    <!-- SVG for edges -->
            <svg class="quest-graph-edges absolute top-0 left-0 w-full h-full pointer-events-none">
            </svg>
            
    <!-- Quest nodes -->
            <div class="quest-graph-nodes relative w-full h-full">
              <%= for node <- @graph.nodes do %>
                <% hidden = @filter_type != "all" and node.type != @filter_type %>
                <div
                  class={[
                    "absolute w-[160px] p-2 bg-wb-panel-header border-2 border-wb-border rounded-wb-md cursor-pointer transition-all hover:scale-105 hover:z-[5]",
                    "quest-type-#{node.type}",
                    @selected_quest == node.id && "selected",
                    hidden && "filtered-out"
                  ]}
                  id={"quest-node-#{node.id}"}
                  data-node-id={node.id}
                  phx-click="quest_flow_select"
                  phx-value-key={node.id}
                  style={"left: #{node.x}px; top: #{node.y}px;"}
                  title={node.name}
                >
                  <div class="text-[9px] uppercase text-wb-text-muted mb-0.5">
                    Act {node.act || "?"}
                  </div>
                  <div class="font-semibold text-wb-text-bright text-[12px] mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                    {node.name}
                  </div>
                  <div class="text-[10px] text-wb-text-faint font-wb-mono">{node.id}</div>
                </div>
              <% end %>
            </div>
            
    <!-- Selected quest details panel -->
            <.quest_details_panel :if={@selected_quest_data} quest={@selected_quest_data} />
          </div>
        </div>

        <div class="flex gap-2 justify-end px-4 py-3 border-t border-wb-border">
          <button
            phx-click="close_quest_flow"
            class="px-5 py-2 border-none rounded cursor-pointer transition-all duration-100 bg-wb-accent text-white hover:bg-wb-accent-hover"
          >
            Close
          </button>
        </div>
      </div>
    </div>
    """
  end

  # Build graph data from quests
  defp build_quest_graph(quests) when is_list(quests) do
    # Group by act for layout
    by_act =
      quests
      |> Enum.group_by(fn q ->
        get_in(q, [:data, "act"]) || get_in(q, [:data, :act]) || 0
      end)

    # Calculate positions with simple layout
    {nodes, _} =
      by_act
      |> Enum.sort_by(fn {act, _} -> act end)
      |> Enum.flat_map_reduce(0, fn {act, act_quests}, y_offset ->
        # Position nodes within act
        nodes =
          act_quests
          |> Enum.with_index()
          |> Enum.map(fn {quest, idx} ->
            type = get_quest_type(quest)

            %{
              id: quest.key,
              name: quest.name || quest.key,
              type: type,
              act: act,
              x: 100 + idx * 200,
              y: 80 + y_offset * 120
            }
          end)

        {nodes, y_offset + 1}
      end)

    # Build edges from requires_quest and unlocks
    edges =
      quests
      |> Enum.flat_map(fn quest ->
        requires = get_requires_quest(quest)
        unlocks = get_unlocks(quest)

        # Edge from required quest to this quest
        require_edges =
          if requires do
            [%{from: requires, to: quest.key, type: :requires}]
          else
            []
          end

        # Edges from this quest to unlocked quests
        unlock_edges =
          Enum.map(unlocks, fn unlocked ->
            %{from: quest.key, to: unlocked, type: :unlocks}
          end)

        require_edges ++ unlock_edges
      end)
      |> Enum.uniq()

    %{nodes: nodes, edges: edges}
  end

  defp build_quest_graph(_), do: %{nodes: [], edges: []}

  defp get_quest_type(quest) do
    type =
      get_in(quest, [:data, "type"]) ||
        get_in(quest, [:data, :type]) ||
        "side"

    case type do
      "main" -> "main"
      "tutorial" -> "tutorial"
      "intro" -> "tutorial"
      _ -> "side"
    end
  end

  defp get_requires_quest(quest) do
    get_in(quest, [:data, "requires_quest"]) ||
      get_in(quest, [:data, :requires_quest])
  end

  defp get_unlocks(quest) do
    rewards = get_in(quest, [:data, "rewards"]) || get_in(quest, [:data, :rewards]) || %{}
    Map.get(rewards, "unlocks") || Map.get(rewards, :unlocks, [])
  end

  # Quest details panel component
  attr :quest, :map, required: true

  defp quest_details_panel(assigns) do
    objectives = get_in(assigns.quest, [:data, "objectives"]) || []
    rewards = get_in(assigns.quest, [:data, "rewards"]) || %{}
    giver = get_in(assigns.quest, [:data, "giver"]) || "Unknown"
    requires = get_requires_quest(assigns.quest)
    description = get_in(assigns.quest, [:data, "description"])
    reward_xp = rewards["xp"] || rewards[:xp]
    reward_gold = rewards["gold"] || rewards[:gold]

    assigns =
      assigns
      |> assign(:objectives, objectives)
      |> assign(:rewards, rewards)
      |> assign(:giver, giver)
      |> assign(:requires, requires)
      |> assign(:description, description)
      |> assign(:reward_xp, reward_xp)
      |> assign(:reward_gold, reward_gold)

    ~H"""
    <div class="absolute bg-wb-surface border border-wb-border rounded-wb-lg p-3 right-4 top-[60px] w-[280px] shadow-wb-md">
      <div class="flex justify-between items-center mb-2">
        <h4 class="m-0 text-wb-text-bright text-sm">
          {@quest.name || @quest.key}
        </h4>
        <button
          phx-click="quest_flow_select"
          phx-value-key=""
          class="bg-transparent border-none text-wb-text-muted cursor-pointer text-base"
        >
          &times;
        </button>
      </div>

      <div class="text-[11px] text-wb-text-muted mb-3">
        <span class="bg-wb-border py-0.5 px-1.5 rounded-wb-sm">
          {@quest.key}
        </span>
      </div>
      
    <!-- Description -->
      <div
        :if={@description}
        class="text-wb-text text-xs mb-3 leading-snug"
      >
        {@description}
      </div>
      
    <!-- Giver -->
      <div class="mb-2">
        <span class="text-wb-text-muted text-[11px]">Quest Giver:</span>
        <span class="text-wb-quest-pass text-xs ml-1">{@giver}</span>
        <button
          phx-click="quest_flow_edit_dialogue"
          phx-value-npc={@giver}
          class="bg-wb-border border-none text-wb-accent text-[10px] py-0.5 px-1.5 rounded-wb-sm ml-2 cursor-pointer"
          title="Edit NPC dialogue"
        >
          Edit Dialogue
        </button>
      </div>
      
    <!-- Requirements -->
      <div :if={@requires} class="mb-2">
        <span class="text-wb-text-muted text-[11px]">Requires:</span>
        <span class="text-wb-quest-pass-alt text-xs ml-1">
          {@requires}
        </span>
      </div>
      
    <!-- Objectives -->
      <div :if={@objectives != []} class="mb-3">
        <div class="text-wb-text-muted text-[11px] mb-1">
          Objectives ({length(@objectives)}):
        </div>
        <ul class="m-0 pl-4 text-wb-text text-[11px]">
          <%= for obj <- @objectives do %>
            <li class="mb-0.5">
              {obj["description"] || obj["type"]}
              <span class="text-wb-text-muted">({obj["type"]})</span>
            </li>
          <% end %>
        </ul>
      </div>
      
    <!-- Rewards -->
      <div :if={map_size(@rewards) > 0} class="mb-2">
        <div class="text-wb-text-muted text-[11px] mb-1">Rewards:</div>
        <div class="flex flex-wrap gap-1">
          <span
            :if={@reward_xp}
            class="bg-[#2a3a4e] text-wb-quest-pass py-0.5 px-1.5 rounded-wb-sm text-[10px]"
          >
            +{@reward_xp} XP
          </span>
          <span
            :if={@reward_gold}
            class="bg-[#4a3a2e] text-wb-warning py-0.5 px-1.5 rounded-wb-sm text-[10px]"
          >
            +{@reward_gold} Gold
          </span>
          <%= for item <- (@rewards["items"] || @rewards[:items] || []) do %>
            <span class="bg-[#3a2a4e] text-wb-indigo-text py-0.5 px-1.5 rounded-wb-sm text-[10px]">
              {item}
            </span>
          <% end %>
        </div>
      </div>
    </div>
    """
  end
end
