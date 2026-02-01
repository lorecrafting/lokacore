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

  def quest_flow_modal(assigns) do
    # Build graph data from quests
    graph = build_quest_graph(assigns.quests)
    assigns = assign(assigns, :graph, graph)

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
                    <div
                      class={"quest-node quest-type-#{node.type}"}
                      id={"quest-node-#{node.id}"}
                      data-node-id={node.id}
                      style={"left: #{node.x}px; top: #{node.y}px;"}
                    >
                      <div class="quest-node-act">Act {node.act || "?"}</div>
                      <div class="quest-node-name">{node.name}</div>
                      <div class="quest-node-id">{node.id}</div>
                    </div>
                  <% end %>
                </div>
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
end
