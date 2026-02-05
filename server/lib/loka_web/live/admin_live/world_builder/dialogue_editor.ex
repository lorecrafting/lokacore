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
    <div class="flex flex-col h-full bg-wb-panel">
      <!-- Header -->
      <div class="flex items-center gap-4 py-3 px-4 bg-wb-panel-alt border-b border-wb-bg">
        <div class="flex items-center gap-2 font-semibold text-wb-text">
          <.icon name="hero-chat-bubble-left-right" class="size-5" />
          <span>Dialogue Editor</span>
          <span :if={@npc_key} class="text-wb-text-dim font-normal">- {@npc_key}</span>
        </div>
        <div class="flex gap-2">
          <span class="py-[0.2rem] px-2 bg-wb-border rounded-wb-sm text-[0.7rem] text-wb-text-muted">
            {@node_count} nodes
          </span>
          <span
            :if={@validation.errors != []}
            class="py-[0.2rem] px-2 bg-wb-danger-surface-hover rounded-wb-sm text-[0.7rem] text-wb-danger-text"
          >
            {length(@validation.errors)} errors
          </span>
          <span
            :if={@validation.warnings != []}
            class="py-[0.2rem] px-2 bg-wb-warning-surface rounded-wb-sm text-[0.7rem] text-wb-warning"
          >
            {length(@validation.warnings)} warnings
          </span>
        </div>
        <div class="ml-auto flex gap-2">
          <button
            type="button"
            class="px-3 py-1.5 text-wb-sm border-none rounded-wb-md cursor-pointer font-medium flex items-center justify-center gap-[0.35rem] transition-all duration-150 hover:-translate-y-px"
            phx-click="dialogue_add_node"
            title="Add Node"
          >
            <.icon name="hero-plus" class="size-4" /> Add Node
          </button>
          <button
            type="button"
            class={[
              "px-3 py-1.5 text-wb-sm border-none rounded-wb-md cursor-pointer font-medium flex items-center justify-center gap-[0.35rem] transition-all duration-150 hover:-translate-y-px",
              @show_preview && "active"
            ]}
            phx-click="dialogue_toggle_preview"
            title="Preview"
          >
            <.icon name="hero-play" class="size-4" /> Preview
          </button>
        </div>
      </div>

      <div class="grid grid-cols-[250px_1fr] flex-1 overflow-hidden">
        <!-- Left: Tree View -->
        <div class="bg-wb-panel-header border-r border-wb-bg flex flex-col overflow-hidden">
          <div class="flex justify-between items-center py-2 px-3 bg-wb-panel-alt text-wb-xs font-semibold text-wb-text-muted border-b border-wb-bg">
            <span>Nodes</span>
          </div>
          <div class="flex-1 overflow-y-auto p-2">
            <div :if={@node_count > 0} class="contents">
              <%= for {node_key, node} <- @dialogue_tree || %{} do %>
                <.tree_node
                  node_key={node_key}
                  node={node}
                  selected={@selected_node == node_key}
                  is_entry={node_key == "start" || node_key == "greeting"}
                  has_error={has_node_error?(@validation, node_key)}
                />
              <% end %>
            </div>
            <div
              :if={@node_count == 0}
              class="flex flex-col items-center justify-center p-8 text-wb-text-dim text-center"
            >
              <p>No dialogue nodes yet.</p>
              <button
                type="button"
                class="px-3 py-1.5 text-wb-sm border-none rounded-wb-md cursor-pointer font-medium flex items-center justify-center gap-[0.35rem] transition-all duration-150 hover:-translate-y-px bg-wb-accent text-white hover:bg-wb-accent-hover"
                phx-click="dialogue_add_node"
                phx-value-key="start"
              >
                <.icon name="hero-plus" class="size-4" /> Create Start Node
              </button>
            </div>
          </div>
        </div>
        
    <!-- Right: Node Editor or Preview -->
        <div class="bg-wb-panel overflow-y-auto">
          <.dialogue_preview
            :if={@show_preview}
            dialogue_tree={@dialogue_tree}
            current_node={@selected_node || "start"}
            mock_state={@mock_state}
          />
          <.node_editor
            :if={!@show_preview && @selected_node && @dialogue_tree[@selected_node]}
            node_key={@selected_node}
            node={@dialogue_tree[@selected_node]}
            all_nodes={@dialogue_tree}
          />
          <div
            :if={!@show_preview && !(@selected_node && @dialogue_tree[@selected_node])}
            class="flex flex-col items-center justify-center h-full text-wb-text-faint text-center"
          >
            <.icon name="hero-cursor-arrow-rays" class="size-12 mb-4 opacity-30" />
            <p>Select a node to edit</p>
          </div>
        </div>
      </div>
      
    <!-- Validation Errors -->
      <div
        :if={@validation.errors != []}
        class="bg-wb-danger-surface border-t border-wb-danger-border p-3"
      >
        <div class="flex items-center gap-2 text-wb-danger-text font-semibold mb-2">
          <.icon name="hero-exclamation-triangle" class="size-4" />
          <span>Validation Issues</span>
        </div>
        <ul class="m-0 pl-6 text-[0.8rem]">
          <%= for error <- @validation.errors do %>
            <li class="text-wb-danger-text mb-1">{error}</li>
          <% end %>
          <%= for warning <- @validation.warnings do %>
            <li class="text-wb-warning mb-1">{warning}</li>
          <% end %>
        </ul>
      </div>
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
        "flex items-center gap-2 p-2 rounded-wb-sm cursor-pointer mb-[2px] transition-[background] duration-150 hover:bg-wb-border",
        @selected && "bg-wb-accent-hover text-wb-text-bright",
        @has_error && "border-l-2 border-wb-danger-text"
      ]}
      phx-click="dialogue_select_node"
      phx-value-key={@node_key}
    >
      <div class={["shrink-0", @is_entry && "text-wb-success", !@is_entry && "text-wb-text-dim"]}>
        <.icon :if={@is_entry} name="hero-play-circle" class="size-4" />
        <.icon :if={!@is_entry} name="hero-chat-bubble-left" class="size-4" />
      </div>
      <div class="flex-1 min-w-0 flex flex-col">
        <span class="text-[0.75rem] font-semibold">{@node_key}</span>
        <span class={[
          "text-[0.7rem] whitespace-nowrap overflow-hidden text-ellipsis",
          @selected && "text-white/70",
          !@selected && "text-wb-text-muted"
        ]}>
          {truncate_text(@node["text"] || "No text", 40)}
        </span>
      </div>
      <div class="shrink-0">
        <span
          :if={@choice_count > 0}
          class={[
            "py-[0.1rem] px-[0.4rem] rounded-[10px] text-[0.65rem]",
            @selected && "bg-white/20 text-wb-text-bright",
            !@selected && "bg-wb-border text-wb-text-muted"
          ]}
          title="{@choice_count} choices"
        >
          {@choice_count}
        </span>
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
    <div class="p-4">
      <div class="flex justify-between items-center py-2 px-3 bg-wb-panel-alt text-wb-xs font-semibold text-wb-text-muted border-b border-wb-bg -mx-4 -mt-4 mb-4">
        <span>Edit Node: {@node_key}</span>
        <button
          type="button"
          class="bg-transparent border-0 text-wb-text-muted cursor-pointer p-1 rounded-wb-sm transition-all flex items-center justify-center shrink-0 hover:bg-wb-border hover:text-wb-error"
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
        <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
          <label>Node Key</label>
          <input
            type="text"
            class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
            value={@node_key}
            readonly
          />
          <small>Unique identifier for this node</small>
        </div>
        
    <!-- Speaker (optional) -->
        <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
          <label>Speaker (optional)</label>
          <input
            type="text"
            name="speaker"
            class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
            value={@node["speaker"] || ""}
            placeholder="Leave empty for NPC name"
            phx-debounce="500"
          />
        </div>
        
    <!-- Node Text -->
        <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
          <label>Text</label>
          <textarea
            name="text"
            class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] resize-y min-h-16 focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
            rows="3"
            placeholder="What the NPC says..."
            phx-debounce="500"
          ><%= @node["text"] || "" %></textarea>
        </div>
        
    <!-- Choices Section -->
        <div class="mt-6 border border-wb-border rounded-wb-md overflow-hidden">
          <div class="flex justify-between items-center py-2 px-3 bg-wb-panel-alt text-wb-xs font-semibold text-wb-text-muted">
            <span>Choices ({length(@choices)})</span>
            <button
              type="button"
              class="px-3 py-1.5 text-wb-sm border-none rounded-wb-md cursor-pointer font-medium flex items-center justify-center gap-[0.35rem] transition-all duration-150 hover:-translate-y-px"
              phx-click="dialogue_add_choice"
              phx-value-node_key={@node_key}
            >
              <.icon name="hero-plus" class="size-3" /> Add Choice
            </button>
          </div>

          <div :if={@choices == []} class="p-4 text-center text-wb-text-dim text-[0.8rem]">
            <p>No choices - dialogue ends here.</p>
          </div>
          <div :if={@choices != []} class="flex flex-col">
            <%= for {choice, index} <- Enum.with_index(@choices) do %>
              <.choice_editor
                choice={choice}
                index={index}
                node_key={@node_key}
                all_nodes={@all_nodes}
              />
            <% end %>
          </div>
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
    <div class="border-b border-wb-border p-3 last:border-b-0">
      <div class="flex justify-between items-center mb-2">
        <span class="w-6 h-6 flex items-center justify-center bg-wb-accent-hover text-wb-text-bright rounded-full text-[0.7rem] font-semibold">
          {@index + 1}
        </span>
        <button
          type="button"
          class="bg-transparent border-0 text-wb-text-muted cursor-pointer p-1 rounded-wb-sm transition-all flex items-center justify-center shrink-0 hover:bg-wb-border hover:text-wb-error"
          phx-click="dialogue_delete_choice"
          phx-value-node_key={@node_key}
          phx-value-index={@index}
          title="Delete Choice"
        >
          <.icon name="hero-x-mark" class="size-3" />
        </button>
      </div>

      <div class="[&_.form-group]:mb-2 [&_.form-group:last-child]:mb-0">
        <!-- Choice Text -->
        <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
          <label>Response Text</label>
          <input
            type="text"
            name={"choice_#{@index}_text"}
            class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
            value={@choice["text"] || ""}
            placeholder="Player's response..."
            phx-debounce="500"
          />
        </div>
        
    <!-- Next Node -->
        <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
          <label>Next Node</label>
          <select
            name={"choice_#{@index}_next"}
            class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
          >
            <option value="">End Dialogue</option>
            <%= for {key, _} <- @all_nodes do %>
              <option value={key} selected={@choice["next"] == key}>{key}</option>
            <% end %>
          </select>
        </div>
        
    <!-- Condition (expanded) -->
        <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
          <label>Show If (optional)</label>
          <div class="flex gap-2">
            <select
              name={"choice_#{@index}_condition_type"}
              class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt flex-1"
            >
              <option value="">Always show</option>
              <optgroup label="Quests">
                <option value="quest_active" selected={condition_type(@choice) == "quest_active"}>
                  Quest Active
                </option>
                <option
                  value="quest_completed"
                  selected={condition_type(@choice) == "quest_completed"}
                >
                  Quest Completed
                </option>
                <option
                  value="quest_not_active"
                  selected={condition_type(@choice) == "quest_not_active"}
                >
                  Quest Not Active
                </option>
              </optgroup>
              <optgroup label="Items">
                <option value="has_item" selected={condition_type(@choice) == "has_item"}>
                  Has Item
                </option>
                <option value="not_has_item" selected={condition_type(@choice) == "not_has_item"}>
                  Does NOT Have Item
                </option>
              </optgroup>
              <optgroup label="Player State">
                <option value="has_flag" selected={condition_type(@choice) == "has_flag"}>
                  Has Flag
                </option>
                <option value="level_gte" selected={condition_type(@choice) == "level_gte"}>
                  Level >= (number)
                </option>
                <option value="stat_gte" selected={condition_type(@choice) == "stat_gte"}>
                  Stat >= (stat:value)
                </option>
              </optgroup>
              <optgroup label="World State">
                <option value="phase" selected={condition_type(@choice) == "phase"}>
                  Time of Day (day/night/dawn/dusk)
                </option>
                <option value="faction_gte" selected={condition_type(@choice) == "faction_gte"}>
                  Faction Rep >= (faction:value)
                </option>
              </optgroup>
            </select>
            <input
              type="text"
              name={"choice_#{@index}_condition_value"}
              class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt flex-1"
              placeholder={condition_placeholder(condition_type(@choice))}
              value={condition_value(@choice)}
            />
          </div>
        </div>
        
    <!-- Action (simplified) -->
        <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
          <label>Action (optional)</label>
          <div class="flex gap-2">
            <select
              name={"choice_#{@index}_action_type"}
              class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt flex-1"
            >
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
              class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt flex-1"
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
    <div class="flex h-full gap-4">
      <!-- Mock State Panel -->
      <div class="w-[220px] shrink-0 bg-wb-panel-alt rounded-wb-md flex flex-col overflow-hidden">
        <div class="flex justify-between items-center py-2 px-3 bg-wb-panel-header border-b border-wb-border text-wb-xs font-semibold text-wb-text-muted">
          <span>Test State</span>
          <button
            type="button"
            class="px-3 py-1.5 text-wb-sm border-none rounded-wb-md cursor-pointer font-medium flex items-center justify-center gap-[0.35rem] transition-all duration-150 hover:-translate-y-px"
            phx-click="dialogue_mock_reset"
            title="Clear all mock state"
          >
            <.icon name="hero-trash" class="size-3" />
          </button>
        </div>

        <div class="py-2 px-[10px] border-b border-wb-border">
          <label class="block text-[10px] uppercase text-wb-text-muted mb-[6px]">
            Active Quests
          </label>
          <div class="flex flex-wrap gap-1 mb-[6px] min-h-[22px]">
            <%= for quest <- Map.get(@mock_state, :active_quests, []) do %>
              <span class="inline-flex items-center gap-[3px] bg-wb-mock-tag-active text-wb-text-bright py-[2px] px-[6px] rounded-wb-sm text-[11px]">
                {quest}
                <button
                  type="button"
                  class="bg-none border-none text-wb-text-muted cursor-pointer p-0 text-[14px] leading-none hover:text-wb-danger-text"
                  phx-click="dialogue_mock_remove"
                  phx-value-type="active_quests"
                  phx-value-value={quest}
                >
                  &times;
                </button>
              </span>
            <% end %>
          </div>
          <div class="flex gap-1">
            <input
              type="text"
              placeholder="quest_key"
              id="mock-active-quest"
              class="flex-1 py-1 px-[6px] bg-wb-border-dark border border-wb-border rounded-wb-sm text-wb-text text-[11px]"
              phx-keydown="dialogue_mock_add_keydown"
              phx-value-type="active_quests"
            />
            <button
              type="button"
              class="py-1 px-2 bg-wb-border border-none rounded-wb-sm text-wb-text cursor-pointer text-[11px] hover:bg-wb-border-light"
              phx-click="dialogue_mock_add"
              phx-value-type="active_quests"
            >
              Add
            </button>
          </div>
        </div>

        <div class="py-2 px-[10px] border-b border-wb-border">
          <label class="block text-[10px] uppercase text-wb-text-muted mb-[6px]">
            Completed Quests
          </label>
          <div class="flex flex-wrap gap-1 mb-[6px] min-h-[22px]">
            <%= for quest <- Map.get(@mock_state, :completed_quests, []) do %>
              <span class="inline-flex items-center gap-[3px] bg-wb-mock-tag-completed text-wb-text-bright py-[2px] px-[6px] rounded-wb-sm text-[11px]">
                {quest}
                <button
                  type="button"
                  class="bg-none border-none text-wb-text-muted cursor-pointer p-0 text-[14px] leading-none hover:text-wb-danger-text"
                  phx-click="dialogue_mock_remove"
                  phx-value-type="completed_quests"
                  phx-value-value={quest}
                >
                  &times;
                </button>
              </span>
            <% end %>
          </div>
          <div class="flex gap-1">
            <input
              type="text"
              placeholder="quest_key"
              id="mock-completed-quest"
              class="flex-1 py-1 px-[6px] bg-wb-border-dark border border-wb-border rounded-wb-sm text-wb-text text-[11px]"
              phx-keydown="dialogue_mock_add_keydown"
              phx-value-type="completed_quests"
            />
            <button
              type="button"
              class="py-1 px-2 bg-wb-border border-none rounded-wb-sm text-wb-text cursor-pointer text-[11px] hover:bg-wb-border-light"
              phx-click="dialogue_mock_add"
              phx-value-type="completed_quests"
            >
              Add
            </button>
          </div>
        </div>

        <div class="py-2 px-[10px] border-b border-wb-border">
          <label class="block text-[10px] uppercase text-wb-text-muted mb-[6px]">
            Inventory Items
          </label>
          <div class="flex flex-wrap gap-1 mb-[6px] min-h-[22px]">
            <%= for item <- Map.get(@mock_state, :items, []) do %>
              <span class="inline-flex items-center gap-[3px] bg-wb-mock-tag-item text-wb-text-bright py-[2px] px-[6px] rounded-wb-sm text-[11px]">
                {item}
                <button
                  type="button"
                  class="bg-none border-none text-wb-text-muted cursor-pointer p-0 text-[14px] leading-none hover:text-wb-danger-text"
                  phx-click="dialogue_mock_remove"
                  phx-value-type="items"
                  phx-value-value={item}
                >
                  &times;
                </button>
              </span>
            <% end %>
          </div>
          <div class="flex gap-1">
            <input
              type="text"
              placeholder="item_key"
              id="mock-item"
              class="flex-1 py-1 px-[6px] bg-wb-border-dark border border-wb-border rounded-wb-sm text-wb-text text-[11px]"
              phx-keydown="dialogue_mock_add_keydown"
              phx-value-type="items"
            />
            <button
              type="button"
              class="py-1 px-2 bg-wb-border border-none rounded-wb-sm text-wb-text cursor-pointer text-[11px] hover:bg-wb-border-light"
              phx-click="dialogue_mock_add"
              phx-value-type="items"
            >
              Add
            </button>
          </div>
        </div>

        <div class="py-2 px-[10px] border-b border-wb-border">
          <label class="block text-[10px] uppercase text-wb-text-muted mb-[6px]">Flags</label>
          <div class="flex flex-wrap gap-1 mb-[6px] min-h-[22px]">
            <%= for flag <- Map.get(@mock_state, :flags, []) do %>
              <span class="inline-flex items-center gap-[3px] bg-wb-mock-tag-flag text-wb-text-bright py-[2px] px-[6px] rounded-wb-sm text-[11px]">
                {flag}
                <button
                  type="button"
                  class="bg-none border-none text-wb-text-muted cursor-pointer p-0 text-[14px] leading-none hover:text-wb-danger-text"
                  phx-click="dialogue_mock_remove"
                  phx-value-type="flags"
                  phx-value-value={flag}
                >
                  &times;
                </button>
              </span>
            <% end %>
          </div>
          <div class="flex gap-1">
            <input
              type="text"
              placeholder="flag_name"
              id="mock-flag"
              class="flex-1 py-1 px-[6px] bg-wb-border-dark border border-wb-border rounded-wb-sm text-wb-text text-[11px]"
              phx-keydown="dialogue_mock_add_keydown"
              phx-value-type="flags"
            />
            <button
              type="button"
              class="py-1 px-2 bg-wb-border border-none rounded-wb-sm text-wb-text cursor-pointer text-[11px] hover:bg-wb-border-light"
              phx-click="dialogue_mock_add"
              phx-value-type="flags"
            >
              Add
            </button>
          </div>
        </div>
        
    <!-- Level and Phase (compact row) -->
        <div class="py-2 px-[10px] border-b border-wb-border flex gap-3">
          <div class="flex-1">
            <label class="block text-[10px] uppercase text-wb-text-muted mb-[6px]">Level</label>
            <input
              type="number"
              min="1"
              max="100"
              value={Map.get(@mock_state, :level, 1)}
              phx-change="dialogue_mock_set_level"
              name="level"
              class="w-full py-1 px-[6px] bg-wb-surface border border-wb-border rounded text-wb-text"
            />
          </div>
          <div class="flex-1">
            <label class="block text-[10px] uppercase text-wb-text-muted mb-[6px]">
              Time of Day
            </label>
            <select
              phx-change="dialogue_mock_set_phase"
              name="phase"
              class="w-full py-1 px-[6px] bg-wb-surface border border-wb-border rounded text-wb-text"
            >
              <option value="day" selected={Map.get(@mock_state, :phase, "day") == "day"}>
                Day
              </option>
              <option value="night" selected={Map.get(@mock_state, :phase) == "night"}>
                Night
              </option>
              <option value="dawn" selected={Map.get(@mock_state, :phase) == "dawn"}>
                Dawn
              </option>
              <option value="dusk" selected={Map.get(@mock_state, :phase) == "dusk"}>
                Dusk
              </option>
            </select>
          </div>
        </div>
      </div>
      
    <!-- Preview -->
      <div class="h-full flex flex-col flex-1">
        <div class="flex justify-between items-center py-2 px-3 bg-wb-panel-alt text-wb-xs font-semibold text-wb-text-muted border-b border-wb-bg">
          <span>Preview</span>
          <button
            type="button"
            class="px-3 py-1.5 text-wb-sm border-none rounded-wb-md cursor-pointer font-medium flex items-center justify-center gap-[0.35rem] transition-all duration-150 hover:-translate-y-px"
            phx-click="dialogue_preview_reset"
            title="Reset to start"
          >
            <.icon name="hero-arrow-path" class="size-3" /> Reset
          </button>
        </div>

        <div :if={@node} class="flex-1 p-6 flex flex-col">
          <div class="font-semibold text-wb-success mb-2">
            {@node["speaker"] || "NPC"}
          </div>
          <div class="bg-wb-panel-alt p-4 rounded-wb-md mb-4 leading-relaxed border-l-[3px] border-wb-success">
            {@node["text"] || "..."}
          </div>

          <div class="flex flex-col gap-2 mt-auto">
            <%= for {choice, index} <- @visible_choices do %>
              <button
                type="button"
                class="block w-full text-left py-3 px-4 bg-wb-panel-header border border-wb-border text-wb-text rounded-wb-md cursor-pointer transition-all duration-150 hover:bg-wb-accent-hover hover:border-wb-accent-hover hover:text-wb-text-bright"
                phx-click="dialogue_preview_choice"
                phx-value-index={index}
                phx-value-next={choice["next"]}
              >
                {choice["text"] || "Continue"}
                <span
                  :if={has_condition?(choice)}
                  class="ml-auto text-wb-text-muted"
                  title="Has condition"
                >
                  <.icon name="hero-funnel" class="size-3" />
                </span>
              </button>
            <% end %>

            <div
              :if={@visible_choices == [] and (@node["choices"] || []) != []}
              class="flex items-center justify-center gap-2 text-wb-text-muted p-4 bg-wb-panel-alt rounded-wb-md border border-dashed border-wb-border"
            >
              <.icon name="hero-funnel" class="size-4" />
              <em>
                All {length(@node["choices"])} choices hidden by conditions
              </em>
            </div>

            <div :if={(@node["choices"] || []) == []} class="text-center text-wb-text-dim p-4">
              <em>End of dialogue</em>
            </div>
          </div>
        </div>
        <div :if={!@node} class="p-8 text-center text-wb-danger-text">
          <p>Node "{@current_node}" not found</p>
        </div>
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
      level = Map.get(mock_state, :level, 1)
      stats = Map.get(mock_state, :stats, %{})
      phase = Map.get(mock_state, :phase, "day")
      factions = Map.get(mock_state, :factions, %{})

      cond do
        Map.has_key?(show_if, "quest_active") ->
          show_if["quest_active"] in active_quests

        Map.has_key?(show_if, "quest_completed") ->
          show_if["quest_completed"] in completed_quests

        Map.has_key?(show_if, "quest_not_active") ->
          show_if["quest_not_active"] not in active_quests

        Map.has_key?(show_if, "has_item") ->
          show_if["has_item"] in items

        Map.has_key?(show_if, "not_has_item") ->
          show_if["not_has_item"] not in items

        Map.has_key?(show_if, "has_flag") ->
          show_if["has_flag"] in flags

        Map.has_key?(show_if, "level_gte") ->
          required = parse_int(show_if["level_gte"], 1)
          level >= required

        Map.has_key?(show_if, "stat_gte") ->
          parse_stat_condition(show_if["stat_gte"], stats)

        Map.has_key?(show_if, "phase") ->
          show_if["phase"] == phase

        Map.has_key?(show_if, "faction_gte") ->
          parse_faction_condition(show_if["faction_gte"], factions)

        true ->
          # Unknown condition type - show by default
          true
      end
    end
  end

  defp parse_int(val, default) when is_binary(val) do
    case Integer.parse(val) do
      {n, _} -> n
      :error -> default
    end
  end

  defp parse_int(val, _default) when is_integer(val), do: val
  defp parse_int(_, default), do: default

  defp parse_stat_condition(value, stats) when is_binary(value) do
    case String.split(value, ":", parts: 2) do
      [stat, required] ->
        stat_val = Map.get(stats, stat, 0)
        stat_val >= parse_int(required, 0)

      _ ->
        true
    end
  end

  defp parse_stat_condition(_, _), do: true

  defp parse_faction_condition(value, factions) when is_binary(value) do
    case String.split(value, ":", parts: 2) do
      [faction, required] ->
        faction_val = Map.get(factions, faction, 0)
        faction_val >= parse_int(required, 0)

      _ ->
        true
    end
  end

  defp parse_faction_condition(_, _), do: true

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

  @condition_types ~w(quest_active quest_completed quest_not_active has_item not_has_item has_flag level_gte stat_gte phase faction_gte)

  defp condition_type(choice) do
    show_if = Map.get(choice, "show_if", %{})

    Enum.find(@condition_types, "", fn type ->
      Map.has_key?(show_if, type)
    end)
  end

  defp condition_value(choice) do
    show_if = Map.get(choice, "show_if", %{})
    type = condition_type(choice)

    if type != "" do
      show_if[type] |> to_string()
    else
      ""
    end
  end

  defp condition_placeholder(type) do
    case type do
      "quest_active" -> "quest_key"
      "quest_completed" -> "quest_key"
      "quest_not_active" -> "quest_key"
      "has_item" -> "item_key"
      "not_has_item" -> "item_key"
      "has_flag" -> "flag_name"
      "level_gte" -> "5"
      "stat_gte" -> "strength:10"
      "phase" -> "day, night, dawn, dusk"
      "faction_gte" -> "monks:50"
      _ -> "value"
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
