defmodule LokaWeb.AdminLive.WorldBuilder.DialogueEditor do
  @moduledoc """
  Visual dialogue tree editor for World Builder.

  Features:
  - Tree view of dialogue nodes
  - Node editor (text, speaker, choices)
  - Choice editor (text, next node, conditions, actions)
  - Entry node selector
  - Validation for orphan nodes
  - Preview mode
  """
  use Phoenix.Component
  import LokaWeb.CoreComponents

  # Allowed action types for choices
  @allowed_actions ~w(
    offer_quest accept_quest complete_quest
    give_item take_item
    set_flag clear_flag
    learn_skill give_xp give_gold
    heal teleport start_combat open_shop trigger_event
  )

  attr :dialogue_tree, :map, default: %{}
  attr :npc_key, :string, default: nil
  attr :selected_node, :string, default: nil
  attr :show_preview, :boolean, default: false
  attr :mock_state, :map, default: %{}
  attr :on_close, :any, default: nil

  def dialogue_editor(assigns) do
    assigns =
      assigns
      |> assign_new(:validation, fn ->
        validate_dialogue_tree(assigns.dialogue_tree)
      end)
      |> assign_new(:node_count, fn ->
        map_size(assigns.dialogue_tree || %{})
      end)

    ~H"""
    <div class="dialogue-editor">
      <!-- Header -->
      <div class="dialogue-editor-header">
        <div class="dialogue-editor-title">
          <.icon name="hero-chat-bubble-left-right" class="size-5" />
          <span>Dialogue Editor</span>
          <%= if @npc_key do %>
            <span class="dialogue-npc-name">- {@npc_key}</span>
          <% end %>
        </div>
        <div class="dialogue-editor-stats">
          <span class="stat-badge">{@node_count} nodes</span>
          <%= if @validation.errors != [] do %>
            <span class="stat-badge stat-error">{length(@validation.errors)} errors</span>
          <% end %>
          <%= if @validation.warnings != [] do %>
            <span class="stat-badge stat-warning">{length(@validation.warnings)} warnings</span>
          <% end %>
        </div>
        <div class="dialogue-editor-actions">
          <button
            type="button"
            class="btn btn-sm"
            phx-click="dialogue_add_node"
            title="Add Node"
          >
            <.icon name="hero-plus" class="size-4" /> Add Node
          </button>
          <button
            type="button"
            class={["btn btn-sm", @show_preview && "active"]}
            phx-click="dialogue_toggle_preview"
            title="Preview"
          >
            <.icon name="hero-play" class="size-4" /> Preview
          </button>
        </div>
      </div>

      <div class="dialogue-editor-body">
        <!-- Left: Tree View -->
        <div class="dialogue-tree-panel">
          <div class="panel-section-header">
            <span>Nodes</span>
          </div>
          <div class="dialogue-tree">
            <%= if @node_count > 0 do %>
              <%= for {node_key, node} <- @dialogue_tree || %{} do %>
                <.tree_node
                  node_key={node_key}
                  node={node}
                  selected={@selected_node == node_key}
                  is_entry={node_key == "start" || node_key == "greeting"}
                  has_error={has_node_error?(@validation, node_key)}
                />
              <% end %>
            <% else %>
              <div class="dialogue-tree-empty">
                <p>No dialogue nodes yet.</p>
                <button
                  type="button"
                  class="btn btn-sm btn-primary"
                  phx-click="dialogue_add_node"
                  phx-value-key="start"
                >
                  <.icon name="hero-plus" class="size-4" /> Create Start Node
                </button>
              </div>
            <% end %>
          </div>
        </div>
        
    <!-- Right: Node Editor or Preview -->
        <div class="dialogue-node-panel">
          <%= if @show_preview do %>
            <.dialogue_preview
              dialogue_tree={@dialogue_tree}
              current_node={@selected_node || "start"}
              mock_state={@mock_state}
            />
          <% else %>
            <%= if @selected_node && @dialogue_tree[@selected_node] do %>
              <.node_editor
                node_key={@selected_node}
                node={@dialogue_tree[@selected_node]}
                all_nodes={@dialogue_tree}
              />
            <% else %>
              <div class="dialogue-node-empty">
                <.icon name="hero-cursor-arrow-rays" class="size-10" />
                <p>Select a node to edit</p>
              </div>
            <% end %>
          <% end %>
        </div>
      </div>
      
    <!-- Validation Errors -->
      <%= if @validation.errors != [] do %>
        <div class="dialogue-validation-errors">
          <div class="validation-header">
            <.icon name="hero-exclamation-triangle" class="size-4" />
            <span>Validation Issues</span>
          </div>
          <ul class="validation-list">
            <%= for error <- @validation.errors do %>
              <li class="validation-error">{error}</li>
            <% end %>
            <%= for warning <- @validation.warnings do %>
              <li class="validation-warning">{warning}</li>
            <% end %>
          </ul>
        </div>
      <% end %>
    </div>
    """
  end

  # Tree node component
  attr :node_key, :string, required: true
  attr :node, :map, required: true
  attr :selected, :boolean, default: false
  attr :is_entry, :boolean, default: false
  attr :has_error, :boolean, default: false

  defp tree_node(assigns) do
    choice_count = length(Map.get(assigns.node, "choices", []))

    assigns = assign(assigns, :choice_count, choice_count)

    ~H"""
    <div
      class={[
        "dialogue-tree-node",
        @selected && "selected",
        @is_entry && "entry-node",
        @has_error && "has-error"
      ]}
      phx-click="dialogue_select_node"
      phx-value-key={@node_key}
    >
      <div class="node-icon">
        <%= if @is_entry do %>
          <.icon name="hero-play-circle" class="size-4" />
        <% else %>
          <.icon name="hero-chat-bubble-left" class="size-4" />
        <% end %>
      </div>
      <div class="node-info">
        <span class="node-key">{@node_key}</span>
        <span class="node-text">{truncate_text(@node["text"] || "No text", 40)}</span>
      </div>
      <div class="node-meta">
        <%= if @choice_count > 0 do %>
          <span class="choice-count" title="{@choice_count} choices">{@choice_count}</span>
        <% end %>
      </div>
    </div>
    """
  end

  # Node editor component
  attr :node_key, :string, required: true
  attr :node, :map, required: true
  attr :all_nodes, :map, required: true

  defp node_editor(assigns) do
    choices = Map.get(assigns.node, "choices", [])
    assigns = assign(assigns, :choices, choices)

    ~H"""
    <div class="node-editor">
      <div class="panel-section-header">
        <span>Edit Node: {@node_key}</span>
        <button
          type="button"
          class="btn-icon-small btn-danger"
          phx-click="dialogue_delete_node"
          phx-value-key={@node_key}
          title="Delete Node"
        >
          <.icon name="hero-trash" class="size-4" />
        </button>
      </div>

      <form phx-change="dialogue_update_node" phx-submit="dialogue_update_node">
        <input type="hidden" name="node_key" value={@node_key} />
        
    <!-- Node Key (read-only for now) -->
        <div class="form-group">
          <label>Node Key</label>
          <input type="text" class="input" value={@node_key} readonly />
          <small>Unique identifier for this node</small>
        </div>
        
    <!-- Speaker (optional) -->
        <div class="form-group">
          <label>Speaker (optional)</label>
          <input
            type="text"
            name="speaker"
            class="input"
            value={@node["speaker"] || ""}
            placeholder="Leave empty for NPC name"
            phx-debounce="500"
          />
        </div>
        
    <!-- Node Text -->
        <div class="form-group">
          <label>Text</label>
          <textarea
            name="text"
            class="textarea"
            rows="3"
            placeholder="What the NPC says..."
            phx-debounce="500"
          ><%= @node["text"] || "" %></textarea>
        </div>
        
    <!-- Choices Section -->
        <div class="choices-section">
          <div class="section-header">
            <span>Choices ({length(@choices)})</span>
            <button
              type="button"
              class="btn btn-sm"
              phx-click="dialogue_add_choice"
              phx-value-node_key={@node_key}
            >
              <.icon name="hero-plus" class="size-3" /> Add Choice
            </button>
          </div>

          <%= if @choices == [] do %>
            <div class="no-choices">
              <p>No choices - dialogue ends here.</p>
            </div>
          <% else %>
            <div class="choices-list">
              <%= for {choice, index} <- Enum.with_index(@choices) do %>
                <.choice_editor
                  choice={choice}
                  index={index}
                  node_key={@node_key}
                  all_nodes={@all_nodes}
                />
              <% end %>
            </div>
          <% end %>
        </div>
      </form>
    </div>
    """
  end

  # Choice editor component
  attr :choice, :map, required: true
  attr :index, :integer, required: true
  attr :node_key, :string, required: true
  attr :all_nodes, :map, required: true

  defp choice_editor(assigns) do
    ~H"""
    <div class="choice-editor">
      <div class="choice-header">
        <span class="choice-number">{@index + 1}</span>
        <button
          type="button"
          class="btn-icon-small"
          phx-click="dialogue_delete_choice"
          phx-value-node_key={@node_key}
          phx-value-index={@index}
          title="Delete Choice"
        >
          <.icon name="hero-x-mark" class="size-3" />
        </button>
      </div>

      <div class="choice-fields">
        <!-- Choice Text -->
        <div class="form-group">
          <label>Response Text</label>
          <input
            type="text"
            name={"choice_#{@index}_text"}
            class="input"
            value={@choice["text"] || ""}
            placeholder="Player's response..."
            phx-debounce="500"
          />
        </div>
        
    <!-- Next Node -->
        <div class="form-group">
          <label>Next Node</label>
          <select name={"choice_#{@index}_next"} class="input">
            <option value="">End Dialogue</option>
            <%= for {key, _} <- @all_nodes do %>
              <option value={key} selected={@choice["next"] == key}>{key}</option>
            <% end %>
          </select>
        </div>
        
    <!-- Condition (simplified) -->
        <div class="form-group">
          <label>Show If (optional)</label>
          <div class="condition-row">
            <select name={"choice_#{@index}_condition_type"} class="input" style="flex: 1;">
              <option value="">Always show</option>
              <option value="quest_active" selected={condition_type(@choice) == "quest_active"}>
                Quest Active
              </option>
              <option value="quest_completed" selected={condition_type(@choice) == "quest_completed"}>
                Quest Completed
              </option>
              <option
                value="quest_not_active"
                selected={condition_type(@choice) == "quest_not_active"}
              >
                Quest Not Active
              </option>
              <option value="has_item" selected={condition_type(@choice) == "has_item"}>
                Has Item
              </option>
            </select>
            <input
              type="text"
              name={"choice_#{@index}_condition_value"}
              class="input"
              style="flex: 1;"
              placeholder="quest_id or item_key"
              value={condition_value(@choice)}
            />
          </div>
        </div>
        
    <!-- Action (simplified) -->
        <div class="form-group">
          <label>Action (optional)</label>
          <div class="action-row">
            <select name={"choice_#{@index}_action_type"} class="input" style="flex: 1;">
              <option value="">No action</option>
              <option value="offer_quest" selected={action_type(@choice) == "offer_quest"}>
                Offer Quest
              </option>
              <option value="accept_quest" selected={action_type(@choice) == "accept_quest"}>
                Accept Quest
              </option>
              <option value="complete_quest" selected={action_type(@choice) == "complete_quest"}>
                Complete Quest
              </option>
              <option value="give_item" selected={action_type(@choice) == "give_item"}>
                Give Item
              </option>
              <option value="take_item" selected={action_type(@choice) == "take_item"}>
                Take Item
              </option>
              <option value="set_flag" selected={action_type(@choice) == "set_flag"}>Set Flag</option>
              <option value="clear_flag" selected={action_type(@choice) == "clear_flag"}>
                Clear Flag
              </option>
              <option value="give_xp" selected={action_type(@choice) == "give_xp"}>Give XP</option>
              <option value="give_gold" selected={action_type(@choice) == "give_gold"}>
                Give Gold
              </option>
            </select>
            <input
              type="text"
              name={"choice_#{@index}_action_value"}
              class="input"
              style="flex: 1;"
              placeholder="quest_id, item_key, or amount"
              value={action_value(@choice)}
            />
          </div>
        </div>
      </div>
    </div>
    """
  end

  # Preview component with mock state testing
  attr :dialogue_tree, :map, required: true
  attr :current_node, :string, required: true
  attr :mock_state, :map, default: %{}

  defp dialogue_preview(assigns) do
    node = Map.get(assigns.dialogue_tree || %{}, assigns.current_node)
    mock_state = assigns.mock_state || %{}

    # Filter choices based on mock state conditions
    visible_choices =
      if node do
        (node["choices"] || [])
        |> Enum.with_index()
        |> Enum.filter(fn {choice, _idx} ->
          evaluate_condition(choice, mock_state)
        end)
      else
        []
      end

    assigns =
      assigns
      |> assign(:node, node)
      |> assign(:visible_choices, visible_choices)

    ~H"""
    <div class="dialogue-preview-container">
      <!-- Mock State Panel -->
      <div class="mock-state-panel">
        <div class="panel-section-header">
          <span>Test State</span>
          <button
            type="button"
            class="btn btn-sm"
            phx-click="dialogue_mock_reset"
            title="Clear all mock state"
          >
            <.icon name="hero-trash" class="size-3" />
          </button>
        </div>

        <div class="mock-state-section">
          <label>Active Quests</label>
          <div class="mock-tags">
            <%= for quest <- Map.get(@mock_state, :active_quests, []) do %>
              <span class="mock-tag">
                {quest}
                <button
                  type="button"
                  phx-click="dialogue_mock_remove"
                  phx-value-type="active_quests"
                  phx-value-value={quest}
                >
                  &times;
                </button>
              </span>
            <% end %>
          </div>
          <div class="mock-add-row">
            <input
              type="text"
              placeholder="quest_key"
              id="mock-active-quest"
              phx-keydown="dialogue_mock_add_keydown"
              phx-value-type="active_quests"
            />
            <button
              type="button"
              phx-click="dialogue_mock_add"
              phx-value-type="active_quests"
            >
              Add
            </button>
          </div>
        </div>

        <div class="mock-state-section">
          <label>Completed Quests</label>
          <div class="mock-tags">
            <%= for quest <- Map.get(@mock_state, :completed_quests, []) do %>
              <span class="mock-tag mock-tag-completed">
                {quest}
                <button
                  type="button"
                  phx-click="dialogue_mock_remove"
                  phx-value-type="completed_quests"
                  phx-value-value={quest}
                >
                  &times;
                </button>
              </span>
            <% end %>
          </div>
          <div class="mock-add-row">
            <input
              type="text"
              placeholder="quest_key"
              id="mock-completed-quest"
              phx-keydown="dialogue_mock_add_keydown"
              phx-value-type="completed_quests"
            />
            <button
              type="button"
              phx-click="dialogue_mock_add"
              phx-value-type="completed_quests"
            >
              Add
            </button>
          </div>
        </div>

        <div class="mock-state-section">
          <label>Inventory Items</label>
          <div class="mock-tags">
            <%= for item <- Map.get(@mock_state, :items, []) do %>
              <span class="mock-tag mock-tag-item">
                {item}
                <button
                  type="button"
                  phx-click="dialogue_mock_remove"
                  phx-value-type="items"
                  phx-value-value={item}
                >
                  &times;
                </button>
              </span>
            <% end %>
          </div>
          <div class="mock-add-row">
            <input
              type="text"
              placeholder="item_key"
              id="mock-item"
              phx-keydown="dialogue_mock_add_keydown"
              phx-value-type="items"
            />
            <button type="button" phx-click="dialogue_mock_add" phx-value-type="items">
              Add
            </button>
          </div>
        </div>

        <div class="mock-state-section">
          <label>Flags</label>
          <div class="mock-tags">
            <%= for flag <- Map.get(@mock_state, :flags, []) do %>
              <span class="mock-tag mock-tag-flag">
                {flag}
                <button
                  type="button"
                  phx-click="dialogue_mock_remove"
                  phx-value-type="flags"
                  phx-value-value={flag}
                >
                  &times;
                </button>
              </span>
            <% end %>
          </div>
          <div class="mock-add-row">
            <input
              type="text"
              placeholder="flag_name"
              id="mock-flag"
              phx-keydown="dialogue_mock_add_keydown"
              phx-value-type="flags"
            />
            <button type="button" phx-click="dialogue_mock_add" phx-value-type="flags">
              Add
            </button>
          </div>
        </div>
      </div>
      
    <!-- Preview -->
      <div class="dialogue-preview">
        <div class="panel-section-header">
          <span>Preview</span>
          <button
            type="button"
            class="btn btn-sm"
            phx-click="dialogue_preview_reset"
            title="Reset to start"
          >
            <.icon name="hero-arrow-path" class="size-3" /> Reset
          </button>
        </div>

        <%= if @node do %>
          <div class="preview-content">
            <div class="preview-speaker">
              {@node["speaker"] || "NPC"}
            </div>
            <div class="preview-text">
              {@node["text"] || "..."}
            </div>

            <div class="preview-choices">
              <%= for {choice, index} <- @visible_choices do %>
                <button
                  type="button"
                  class="preview-choice"
                  phx-click="dialogue_preview_choice"
                  phx-value-index={index}
                  phx-value-next={choice["next"]}
                >
                  {choice["text"] || "Continue"}
                  <%= if has_condition?(choice) do %>
                    <span class="choice-condition-badge" title="Has condition">
                      <.icon name="hero-funnel" class="size-3" />
                    </span>
                  <% end %>
                </button>
              <% end %>

              <%= if @visible_choices == [] and (@node["choices"] || []) != [] do %>
                <div class="preview-filtered">
                  <.icon name="hero-funnel" class="size-4" />
                  <em>
                    All {length(@node["choices"])} choices hidden by conditions
                  </em>
                </div>
              <% end %>

              <%= if (@node["choices"] || []) == [] do %>
                <div class="preview-end">
                  <em>End of dialogue</em>
                </div>
              <% end %>
            </div>
          </div>
        <% else %>
          <div class="preview-error">
            <p>Node "{@current_node}" not found</p>
          </div>
        <% end %>
      </div>
    </div>
    """
  end

  # Evaluate if a choice should be visible based on its condition and mock state
  defp evaluate_condition(choice, mock_state) do
    show_if = Map.get(choice, "show_if", %{})

    if map_size(show_if) == 0 do
      # No condition - always show
      true
    else
      active_quests = Map.get(mock_state, :active_quests, [])
      completed_quests = Map.get(mock_state, :completed_quests, [])
      items = Map.get(mock_state, :items, [])
      flags = Map.get(mock_state, :flags, [])

      cond do
        Map.has_key?(show_if, "quest_active") ->
          show_if["quest_active"] in active_quests

        Map.has_key?(show_if, "quest_completed") ->
          show_if["quest_completed"] in completed_quests

        Map.has_key?(show_if, "quest_not_active") ->
          show_if["quest_not_active"] not in active_quests

        Map.has_key?(show_if, "has_item") ->
          show_if["has_item"] in items

        Map.has_key?(show_if, "has_flag") ->
          show_if["has_flag"] in flags

        true ->
          # Unknown condition type - show by default
          true
      end
    end
  end

  defp has_condition?(choice) do
    show_if = Map.get(choice, "show_if", %{})
    map_size(show_if) > 0
  end

  # Helper functions

  defp truncate_text(text, max_length) when is_binary(text) do
    if String.length(text) > max_length do
      String.slice(text, 0, max_length) <> "..."
    else
      text
    end
  end

  defp truncate_text(_, _), do: ""

  defp condition_type(choice) do
    show_if = Map.get(choice, "show_if", %{})

    cond do
      Map.has_key?(show_if, "quest_active") -> "quest_active"
      Map.has_key?(show_if, "quest_completed") -> "quest_completed"
      Map.has_key?(show_if, "quest_not_active") -> "quest_not_active"
      Map.has_key?(show_if, "has_item") -> "has_item"
      true -> ""
    end
  end

  defp condition_value(choice) do
    show_if = Map.get(choice, "show_if", %{})

    cond do
      Map.has_key?(show_if, "quest_active") -> show_if["quest_active"]
      Map.has_key?(show_if, "quest_completed") -> show_if["quest_completed"]
      Map.has_key?(show_if, "quest_not_active") -> show_if["quest_not_active"]
      Map.has_key?(show_if, "has_item") -> show_if["has_item"]
      true -> ""
    end
  end

  defp action_type(choice) do
    case Map.get(choice, "action") do
      [type | _] when type in @allowed_actions -> type
      _ -> ""
    end
  end

  defp action_value(choice) do
    case Map.get(choice, "action") do
      [_, value | _] -> to_string(value)
      _ -> ""
    end
  end

  defp validate_dialogue_tree(nil), do: %{errors: [], warnings: []}
  defp validate_dialogue_tree(tree) when map_size(tree) == 0, do: %{errors: [], warnings: []}

  defp validate_dialogue_tree(tree) do
    errors = []
    warnings = []

    # Check for entry node
    errors =
      if not (Map.has_key?(tree, "start") or Map.has_key?(tree, "greeting")) do
        ["No entry node found (need 'start' or 'greeting')" | errors]
      else
        errors
      end

    # Check for orphan references
    all_keys = Map.keys(tree)

    {errors, warnings} =
      Enum.reduce(tree, {errors, warnings}, fn {node_key, node}, {errs, warns} ->
        choices = Map.get(node, "choices", [])

        Enum.reduce(choices, {errs, warns}, fn choice, {e, w} ->
          next = Map.get(choice, "next")

          cond do
            next == nil or next == "" ->
              # End dialogue - valid
              {e, w}

            next not in all_keys ->
              {["Node '#{node_key}': choice points to non-existent node '#{next}'" | e], w}

            true ->
              {e, w}
          end
        end)
      end)

    # Check for unreachable nodes
    reachable = find_reachable_nodes(tree)
    unreachable = MapSet.difference(MapSet.new(all_keys), reachable)

    warnings =
      if MapSet.size(unreachable) > 0 do
        unreachable_list = MapSet.to_list(unreachable) |> Enum.join(", ")
        ["Unreachable nodes: #{unreachable_list}" | warnings]
      else
        warnings
      end

    %{errors: Enum.reverse(errors), warnings: Enum.reverse(warnings)}
  end

  defp find_reachable_nodes(tree) do
    # Start from entry nodes
    entry_nodes =
      cond do
        Map.has_key?(tree, "start") -> ["start"]
        Map.has_key?(tree, "greeting") -> ["greeting"]
        true -> []
      end

    # Also check for start_* variants
    entry_nodes = entry_nodes ++ Enum.filter(Map.keys(tree), &String.starts_with?(&1, "start_"))

    do_find_reachable(tree, MapSet.new(entry_nodes), entry_nodes)
  end

  defp do_find_reachable(_tree, visited, []), do: visited

  defp do_find_reachable(tree, visited, [node_key | rest]) do
    node = Map.get(tree, node_key, %{})
    choices = Map.get(node, "choices", [])

    next_nodes =
      choices
      |> Enum.map(&Map.get(&1, "next"))
      |> Enum.filter(fn next -> next && next != "" && next not in visited end)

    new_visited = Enum.reduce(next_nodes, visited, &MapSet.put(&2, &1))

    do_find_reachable(tree, new_visited, rest ++ next_nodes)
  end

  defp has_node_error?(validation, node_key) do
    Enum.any?(validation.errors, &String.contains?(&1, "'#{node_key}'"))
  end
end
