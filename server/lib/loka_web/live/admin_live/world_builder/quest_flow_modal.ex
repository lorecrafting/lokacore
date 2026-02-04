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
        class="modal-content quest-flow-modal"
        phx-click-away="close_quest_flow"
        style="max-width: 900px; max-height: 85vh; overflow: hidden; display: flex; flex-direction: column;"
      >
        <div
          class="modal-header"
          style="border-bottom: 1px solid var(--wb-border); padding: 12px 16px;"
        >
          <h3 id="quest-flow-title" style="display: flex; align-items: center; gap: 8px; margin: 0;">
            <.icon name="hero-arrow-trending-up" class="size-5" /> Quest Flow
          </h3>
          
    <!-- Filter buttons -->
          <div style="display: flex; gap: 4px; margin-left: 16px;">
            <button
              phx-click="quest_flow_filter"
              phx-value-type="all"
              class={"quest-filter-btn #{if @filter_type == "all", do: "active", else: ""}"}
              style={"padding: 4px 8px; font-size: 11px; border-radius: 4px; border: 1px solid var(--wb-border); cursor: pointer; #{if @filter_type == "all", do: "background: var(--wb-accent); color: white;", else: "background: var(--wb-surface); color: var(--wb-text-muted);"}"}
            >
              All
            </button>
            <button
              phx-click="quest_flow_filter"
              phx-value-type="main"
              class={"quest-filter-btn #{if @filter_type == "main", do: "active", else: ""}"}
              style={"padding: 4px 8px; font-size: 11px; border-radius: 4px; border: 1px solid var(--wb-border); cursor: pointer; #{if @filter_type == "main", do: "background: var(--wb-accent); color: white;", else: "background: var(--wb-surface); color: var(--wb-text-muted);"}"}
            >
              Main
            </button>
            <button
              phx-click="quest_flow_filter"
              phx-value-type="side"
              class={"quest-filter-btn #{if @filter_type == "side", do: "active", else: ""}"}
              style={"padding: 4px 8px; font-size: 11px; border-radius: 4px; border: 1px solid var(--wb-border); cursor: pointer; #{if @filter_type == "side", do: "background: var(--wb-quest-pass); color: var(--wb-panel);", else: "background: var(--wb-surface); color: var(--wb-text-muted);"}"}
            >
              Side
            </button>
            <button
              phx-click="quest_flow_filter"
              phx-value-type="tutorial"
              class={"quest-filter-btn #{if @filter_type == "tutorial", do: "active", else: ""}"}
              style={"padding: 4px 8px; font-size: 11px; border-radius: 4px; border: 1px solid var(--wb-border); cursor: pointer; #{if @filter_type == "tutorial", do: "background: var(--wb-quest-pass-alt); color: var(--wb-panel);", else: "background: var(--wb-surface); color: var(--wb-text-muted);"}"}
            >
              Tutorial
            </button>
          </div>

          <span style="color: var(--wb-text-muted); font-size: 12px; margin-left: auto;">
            {length(@quests)} quests
          </span>
          <button
            phx-click="close_quest_flow"
            class="modal-close"
            style="position: absolute; right: 16px; top: 12px; background: none; border: none; color: var(--wb-text-muted); font-size: 24px; cursor: pointer;"
          >
            &times;
          </button>
        </div>

        <div class="modal-body quest-flow-body" style="flex: 1; overflow: auto; padding: 0;">
          <div
            :if={@graph.nodes == []}
            style="padding: 40px; text-align: center; color: var(--wb-text-muted);"
          >
            <.icon name="hero-map" class="size-12" />
            <p>No quests found</p>
          </div>
          <div
            :if={@graph.nodes != []}
            class="quest-graph-container"
            id="quest-graph"
            phx-hook="QuestFlowGraph"
            phx-update="ignore"
            data-nodes={Jason.encode!(@graph.nodes)}
            data-edges={Jason.encode!(@graph.edges)}
          >
            <!-- Quest Graph Legend -->
            <div class="quest-graph-legend">
              <div class="legend-item">
                <span class="legend-color" style="background: var(--wb-accent);"></span> Main Quest
              </div>
              <div class="legend-item">
                <span class="legend-color" style="background: var(--wb-quest-pass);"></span>
                Side Quest
              </div>
              <div class="legend-item">
                <span class="legend-color" style="background: var(--wb-quest-pass-alt);"></span>
                Tutorial
              </div>
              <div class="legend-arrow">→ Requires/Unlocks</div>
            </div>
            
    <!-- SVG for edges -->
            <svg class="quest-graph-edges"></svg>
            
    <!-- Quest nodes -->
            <div class="quest-graph-nodes">
              <%= for node <- @graph.nodes do %>
                <% hidden = @filter_type != "all" and node.type != @filter_type %>
                <div
                  class={"quest-node quest-type-#{node.type} #{if @selected_quest == node.id, do: "selected", else: ""} #{if hidden, do: "filtered-out", else: ""}"}
                  id={"quest-node-#{node.id}"}
                  data-node-id={node.id}
                  phx-click="quest_flow_select"
                  phx-value-key={node.id}
                  style={"left: #{node.x}px; top: #{node.y}px; #{if hidden, do: "opacity: 0.2; pointer-events: none;", else: ""}"}
                  title={node.name}
                >
                  <div class="quest-node-act">Act {node.act || "?"}</div>
                  <div class="quest-node-name">{node.name}</div>
                  <div class="quest-node-id">{node.id}</div>
                </div>
              <% end %>
            </div>
            
    <!-- Selected quest details panel -->
            <.quest_details_panel :if={@selected_quest_data} quest={@selected_quest_data} />
          </div>
        </div>

        <div
          class="modal-footer"
          style="border-top: 1px solid var(--wb-border); padding: 12px 16px; display: flex; justify-content: flex-end;"
        >
          <button
            phx-click="close_quest_flow"
            class="btn btn-primary"
            style="background: var(--wb-accent); color: white; border: none; padding: 8px 20px; border-radius: 4px; cursor: pointer;"
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
    <div
      class="quest-details-panel"
      style="position: absolute; right: 16px; top: 60px; width: 280px; background: var(--wb-surface); border: 1px solid var(--wb-border); border-radius: 8px; padding: 12px; box-shadow: var(--wb-shadow-md);"
    >
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <h4 style="margin: 0; color: var(--wb-text-bright); font-size: 14px;">
          {@quest.name || @quest.key}
        </h4>
        <button
          phx-click="quest_flow_select"
          phx-value-key=""
          style="background: none; border: none; color: var(--wb-text-muted); cursor: pointer; font-size: 16px;"
        >
          &times;
        </button>
      </div>

      <div style="font-size: 11px; color: var(--wb-text-muted); margin-bottom: 12px;">
        <span style="background: var(--wb-border); padding: 2px 6px; border-radius: 3px;">
          {@quest.key}
        </span>
      </div>
      
    <!-- Description -->
      <div
        :if={@description}
        style="color: var(--wb-text); font-size: 12px; margin-bottom: 12px; line-height: 1.4;"
      >
        {@description}
      </div>
      
    <!-- Giver -->
      <div style="margin-bottom: 8px;">
        <span style="color: var(--wb-text-muted); font-size: 11px;">Quest Giver:</span>
        <span style="color: var(--wb-quest-pass); font-size: 12px; margin-left: 4px;">{@giver}</span>
        <button
          phx-click="quest_flow_edit_dialogue"
          phx-value-npc={@giver}
          style="background: var(--wb-border); border: none; color: var(--wb-accent); font-size: 10px; padding: 2px 6px; border-radius: 3px; margin-left: 8px; cursor: pointer;"
          title="Edit NPC dialogue"
        >
          Edit Dialogue
        </button>
      </div>
      
    <!-- Requirements -->
      <div :if={@requires} style="margin-bottom: 8px;">
        <span style="color: var(--wb-text-muted); font-size: 11px;">Requires:</span>
        <span style="color: var(--wb-quest-pass-alt); font-size: 12px; margin-left: 4px;">
          {@requires}
        </span>
      </div>
      
    <!-- Objectives -->
      <div :if={@objectives != []} style="margin-bottom: 12px;">
        <div style="color: var(--wb-text-muted); font-size: 11px; margin-bottom: 4px;">
          Objectives ({length(@objectives)}):
        </div>
        <ul style="margin: 0; padding-left: 16px; color: var(--wb-text); font-size: 11px;">
          <%= for obj <- @objectives do %>
            <li style="margin-bottom: 2px;">
              {obj["description"] || obj["type"]}
              <span style="color: var(--wb-text-muted);">({obj["type"]})</span>
            </li>
          <% end %>
        </ul>
      </div>
      
    <!-- Rewards -->
      <div :if={map_size(@rewards) > 0} style="margin-bottom: 8px;">
        <div style="color: var(--wb-text-muted); font-size: 11px; margin-bottom: 4px;">Rewards:</div>
        <div style="display: flex; flex-wrap: wrap; gap: 4px;">
          <span
            :if={@reward_xp}
            style="background: #2a3a4e; color: var(--wb-quest-pass); padding: 2px 6px; border-radius: 3px; font-size: 10px;"
          >
            +{@reward_xp} XP
          </span>
          <span
            :if={@reward_gold}
            style="background: #4a3a2e; color: var(--wb-warning); padding: 2px 6px; border-radius: 3px; font-size: 10px;"
          >
            +{@reward_gold} Gold
          </span>
          <%= for item <- (@rewards["items"] || @rewards[:items] || []) do %>
            <span style="background: #3a2a4e; color: var(--wb-indigo-text); padding: 2px 6px; border-radius: 3px; font-size: 10px;">
              {item}
            </span>
          <% end %>
        </div>
      </div>
    </div>
    """
  end
end
