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
    <%= if @show do %>
      <div class="modal-overlay quest-flow-overlay" phx-click="close_quest_flow">
        <div
          class="modal-content quest-flow-modal"
          phx-click-away="close_quest_flow"
          style="max-width: 900px; max-height: 85vh; overflow: hidden; display: flex; flex-direction: column;"
        >
          <div class="modal-header" style="border-bottom: 1px solid #333; padding: 12px 16px;">
            <h3 style="display: flex; align-items: center; gap: 8px; margin: 0;">
              <.icon name="hero-arrow-trending-up" class="size-5" /> Quest Flow
            </h3>
            
    <!-- Filter buttons -->
            <div style="display: flex; gap: 4px; margin-left: 16px;">
              <button
                phx-click="quest_flow_filter"
                phx-value-type="all"
                class={"quest-filter-btn #{if @filter_type == "all", do: "active", else: ""}"}
                style={"padding: 4px 8px; font-size: 11px; border-radius: 4px; border: 1px solid #444; cursor: pointer; #{if @filter_type == "all", do: "background: #4a9eff; color: white;", else: "background: #2a2a3e; color: #888;"}"}
              >
                All
              </button>
              <button
                phx-click="quest_flow_filter"
                phx-value-type="main"
                class={"quest-filter-btn #{if @filter_type == "main", do: "active", else: ""}"}
                style={"padding: 4px 8px; font-size: 11px; border-radius: 4px; border: 1px solid #444; cursor: pointer; #{if @filter_type == "main", do: "background: #4a9eff; color: white;", else: "background: #2a2a3e; color: #888;"}"}
              >
                Main
              </button>
              <button
                phx-click="quest_flow_filter"
                phx-value-type="side"
                class={"quest-filter-btn #{if @filter_type == "side", do: "active", else: ""}"}
                style={"padding: 4px 8px; font-size: 11px; border-radius: 4px; border: 1px solid #444; cursor: pointer; #{if @filter_type == "side", do: "background: #4aff9e; color: #1a1a2e;", else: "background: #2a2a3e; color: #888;"}"}
              >
                Side
              </button>
              <button
                phx-click="quest_flow_filter"
                phx-value-type="tutorial"
                class={"quest-filter-btn #{if @filter_type == "tutorial", do: "active", else: ""}"}
                style={"padding: 4px 8px; font-size: 11px; border-radius: 4px; border: 1px solid #444; cursor: pointer; #{if @filter_type == "tutorial", do: "background: #ff9e4a; color: #1a1a2e;", else: "background: #2a2a3e; color: #888;"}"}
              >
                Tutorial
              </button>
            </div>

            <span style="color: #888; font-size: 12px; margin-left: auto;">
              {length(@quests)} quests
            </span>
            <button
              phx-click="close_quest_flow"
              class="modal-close"
              style="position: absolute; right: 16px; top: 12px; background: none; border: none; color: #888; font-size: 24px; cursor: pointer;"
            >
              &times;
            </button>
          </div>

          <div class="modal-body quest-flow-body" style="flex: 1; overflow: auto; padding: 0;">
            <%= if @graph.nodes == [] do %>
              <div style="padding: 40px; text-align: center; color: #888;">
                <.icon name="hero-map" class="size-12" />
                <p>No quests found</p>
              </div>
            <% else %>
              <div
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
                    <span class="legend-color" style="background: #4a9eff;"></span> Main Quest
                  </div>
                  <div class="legend-item">
                    <span class="legend-color" style="background: #4aff9e;"></span> Side Quest
                  </div>
                  <div class="legend-item">
                    <span class="legend-color" style="background: #ff9e4a;"></span> Tutorial
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
                <%= if @selected_quest_data do %>
                  <.quest_details_panel quest={@selected_quest_data} />
                <% end %>
              </div>
            <% end %>
          </div>

          <div
            class="modal-footer"
            style="border-top: 1px solid #333; padding: 12px 16px; display: flex; justify-content: flex-end;"
          >
            <button
              phx-click="close_quest_flow"
              class="btn btn-primary"
              style="background: #4a9eff; color: white; border: none; padding: 8px 20px; border-radius: 4px; cursor: pointer;"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    <% end %>
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

    assigns =
      assigns
      |> assign(:objectives, objectives)
      |> assign(:rewards, rewards)
      |> assign(:giver, giver)
      |> assign(:requires, requires)

    ~H"""
    <div
      class="quest-details-panel"
      style="position: absolute; right: 16px; top: 60px; width: 280px; background: #1a1a2e; border: 1px solid #444; border-radius: 8px; padding: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);"
    >
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <h4 style="margin: 0; color: #fff; font-size: 14px;">{@quest.name || @quest.key}</h4>
        <button
          phx-click="quest_flow_select"
          phx-value-key=""
          style="background: none; border: none; color: #888; cursor: pointer; font-size: 16px;"
        >
          &times;
        </button>
      </div>

      <div style="font-size: 11px; color: #888; margin-bottom: 12px;">
        <span style="background: #333; padding: 2px 6px; border-radius: 3px;">{@quest.key}</span>
      </div>
      
    <!-- Description -->
      <%= if desc = get_in(@quest, [:data, "description"]) do %>
        <div style="color: #ccc; font-size: 12px; margin-bottom: 12px; line-height: 1.4;">
          {desc}
        </div>
      <% end %>
      
    <!-- Giver -->
      <div style="margin-bottom: 8px;">
        <span style="color: #888; font-size: 11px;">Quest Giver:</span>
        <span style="color: #4aff9e; font-size: 12px; margin-left: 4px;">{@giver}</span>
        <button
          phx-click="quest_flow_edit_dialogue"
          phx-value-npc={@giver}
          style="background: #333; border: none; color: #4a9eff; font-size: 10px; padding: 2px 6px; border-radius: 3px; margin-left: 8px; cursor: pointer;"
          title="Edit NPC dialogue"
        >
          Edit Dialogue
        </button>
      </div>
      
    <!-- Requirements -->
      <%= if @requires do %>
        <div style="margin-bottom: 8px;">
          <span style="color: #888; font-size: 11px;">Requires:</span>
          <span style="color: #ff9e4a; font-size: 12px; margin-left: 4px;">{@requires}</span>
        </div>
      <% end %>
      
    <!-- Objectives -->
      <%= if length(@objectives) > 0 do %>
        <div style="margin-bottom: 12px;">
          <div style="color: #888; font-size: 11px; margin-bottom: 4px;">
            Objectives ({length(@objectives)}):
          </div>
          <ul style="margin: 0; padding-left: 16px; color: #ccc; font-size: 11px;">
            <%= for obj <- @objectives do %>
              <li style="margin-bottom: 2px;">
                {obj["description"] || obj["type"]}
                <span style="color: #666;">({obj["type"]})</span>
              </li>
            <% end %>
          </ul>
        </div>
      <% end %>
      
    <!-- Rewards -->
      <%= if map_size(@rewards) > 0 do %>
        <div style="margin-bottom: 8px;">
          <div style="color: #888; font-size: 11px; margin-bottom: 4px;">Rewards:</div>
          <div style="display: flex; flex-wrap: wrap; gap: 4px;">
            <%= if xp = @rewards["xp"] || @rewards[:xp] do %>
              <span style="background: #2a3a4e; color: #4aff9e; padding: 2px 6px; border-radius: 3px; font-size: 10px;">
                +{xp} XP
              </span>
            <% end %>
            <%= if gold = @rewards["gold"] || @rewards[:gold] do %>
              <span style="background: #4a3a2e; color: #ffd700; padding: 2px 6px; border-radius: 3px; font-size: 10px;">
                +{gold} Gold
              </span>
            <% end %>
            <%= for item <- (@rewards["items"] || @rewards[:items] || []) do %>
              <span style="background: #3a2a4e; color: #a29bfe; padding: 2px 6px; border-radius: 3px; font-size: 10px;">
                {item}
              </span>
            <% end %>
          </div>
        </div>
      <% end %>
    </div>
    """
  end
end
