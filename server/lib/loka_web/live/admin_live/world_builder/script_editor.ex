defmodule LokaWeb.AdminLive.WorldBuilder.ScriptEditor do
  @moduledoc """
  Pure LiveView script editor component with CodeMirror 6 code editor.

  Renders form fields in LiveView and delegates only the code editing
  to a CodeMirrorEditor JS hook (bundled, no CDN).
  """
  use Phoenix.Component
  import LokaWeb.CoreComponents

  @hooks [
    {"on_enter", "On Enter", "When entity enters room"},
    {"on_exit", "On Exit", "When entity exits room"},
    {"on_look", "On Look", "When entity looks at something"},
    {"on_talk", "On Talk", "When player talks to NPC"},
    {"on_damage", "On Damage", "When entity takes damage"},
    {"on_death", "On Death", "When entity dies"},
    {"on_combat_start", "On Combat Start", "When combat begins"},
    {"on_combat_end", "On Combat End", "When combat ends"},
    {"on_item_use", "On Item Use", "When item is used"},
    {"on_item_get", "On Item Get", "When item is picked up"},
    {"on_meditate", "On Meditate", "When player meditates"},
    {"on_tick", "On Tick", "Periodic tick (use sparingly)"},
    {"at_enter_room", "At Enter Room", "Room entry hook"},
    {"at_command_pre", "At Command Pre", "Before command executes"},
    {"at_command_post", "At Command Post", "After command executes"}
  ]

  @api_functions [
    {"message(text)", "Send message to player"},
    {"say(text)", "Entity speaks aloud"},
    {"emote(text)", "Entity performs emote"},
    {"announce_room(text)", "Message to all in room"},
    {"has_item?(item_key)", "Check if player has item"},
    {"has_flag?(flag)", "Check if player has flag"},
    {"get_flag(flag)", "Get flag value"},
    {"set_flag(flag, value)", "Set flag value"},
    {"get_stat(stat)", "Get entity stat"},
    {"give_item(item_key)", "Give item to player"},
    {"remove_item(item_key)", "Remove item from player"},
    {"spawn_npc(key, room)", "Spawn NPC in room"},
    {"despawn(entity_id)", "Remove entity"},
    {"teleport(entity_id, room)", "Move entity to room"},
    {"damage(target, amount)", "Deal damage"},
    {"heal(target, amount)", "Heal entity"},
    {"apply_effect(effect, duration)", "Apply status effect"},
    {"quest_active?(quest_key)", "Check if quest active"},
    {"start_quest(quest_key)", "Start quest for player"},
    {"complete_objective(quest, obj)", "Mark objective done"},
    {"continue()", "Allow default behavior"},
    {"deny()", "Prevent default behavior"},
    {"handled()", "Mark event handled"},
    {"chance?(percentage)", "Random check (0-100)"},
    {"roll(sides)", "Roll dice"},
    {"log(message)", "Debug log"},
    {"after(seconds, script_key)", "Schedule script"},
    {"entities_in_room()", "Get all entities"},
    {"find_entity(key)", "Find entity by key"}
  ]

  attr :script, :map, default: nil
  attr :entities, :list, default: []
  attr :inline, :boolean, default: false

  def script_editor(assigns) do
    script = assigns.script || %{}

    entities_data =
      Enum.map(assigns.entities, fn e ->
        %{key: e.key, name: e[:name] || e[:short_desc] || e.key, type: e[:type] || "entity"}
      end)

    assigns =
      assigns
      |> assign(:script_data, script)
      |> assign(:entities_data, entities_data)
      |> assign(:hooks, @hooks)
      |> assign(:api_functions, @api_functions)

    if assigns.inline do
      ~H"""
      <div class="flex flex-col h-full overflow-hidden bg-wb-panel text-wb-text">
        <.script_form
          script_data={@script_data}
          entities_data={@entities_data}
          hooks={@hooks}
          api_functions={@api_functions}
        />
      </div>
      """
    else
      ~H"""
      <div
        class="modal-overlay"
        phx-click="close_script_editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="script-editor-title"
      >
        <div
          class="modal-content flex flex-col w-[95%] max-w-[1400px] h-[90vh]"
          phx-click-away="close_script_editor"
        >
          <div class="flex items-center justify-between p-4 border-b border-wb-border">
            <h3 id="script-editor-title" class="m-0 text-wb-text-bright text-base font-semibold">
              {if @script, do: "Edit Script", else: "Create Script"}
            </h3>
            <button
              phx-click="close_script_editor"
              class="bg-transparent border-0 text-wb-text-muted text-2xl cursor-pointer p-0 w-8 h-8 flex items-center justify-center rounded-wb-sm transition-all hover:bg-wb-border hover:text-wb-text-bright"
            >
              &times;
            </button>
          </div>
          <div class="flex-1 min-h-0 overflow-hidden">
            <.script_form
              script_data={@script_data}
              entities_data={@entities_data}
              hooks={@hooks}
              api_functions={@api_functions}
            />
          </div>
        </div>
      </div>
      """
    end
  end

  attr :script_data, :map, required: true
  attr :entities_data, :list, required: true
  attr :hooks, :list, required: true
  attr :api_functions, :list, required: true

  defp script_form(assigns) do
    ~H"""
    <%!-- Header with form fields --%>
    <div class="px-3 py-2 border-b border-wb-border shrink-0">
      <div class="grid grid-cols-2 gap-2 mb-1.5">
        <div class="mb-1.5">
          <label class="block text-[0.75rem] text-wb-text-dim mb-0.5">Key</label>
          <input
            type="text"
            value={@script_data[:key] || ""}
            phx-blur="script_update_field"
            phx-value-field="key"
            name="value"
            placeholder="my_script_name"
            class="w-full text-[0.8rem] bg-wb-bg border border-wb-border rounded-wb-md text-wb-text focus:border-wb-accent focus:outline-none px-2 py-[5px]"
            phx-debounce="300"
          />
        </div>
        <div class="mb-1.5">
          <label class="block text-[0.75rem] text-wb-text-dim mb-0.5">Name</label>
          <input
            type="text"
            value={@script_data[:name] || ""}
            phx-blur="script_update_field"
            phx-value-field="name"
            name="value"
            placeholder="Display Name"
            class="w-full text-[0.8rem] bg-wb-bg border border-wb-border rounded-wb-md text-wb-text focus:border-wb-accent focus:outline-none px-2 py-[5px]"
            phx-debounce="300"
          />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2 mb-1.5">
        <div class="mb-1.5">
          <label class="block text-[0.75rem] text-wb-text-dim mb-0.5">Hook</label>
          <select
            phx-change="script_update_field"
            phx-value-field="hook"
            name="value"
            class="w-full text-[0.8rem] bg-wb-bg border border-wb-border rounded-wb-md text-wb-text focus:border-wb-accent focus:outline-none px-2 py-[5px]"
          >
            <%= for {val, label, _desc} <- @hooks do %>
              <option value={val} selected={(@script_data[:hook] || "on_talk") == val}>
                {label}
              </option>
            <% end %>
          </select>
        </div>
        <div class="mb-1.5">
          <label class="block text-[0.75rem] text-wb-text-dim mb-0.5">Entity</label>
          <select
            phx-change="script_update_field"
            phx-value-field="entity_key"
            name="value"
            class="w-full text-[0.8rem] bg-wb-bg border border-wb-border rounded-wb-md text-wb-text focus:border-wb-accent focus:outline-none px-2 py-[5px]"
          >
            <option value="">None (standalone)</option>
            <%= for e <- @entities_data do %>
              <option value={e.key} selected={(@script_data[:entity_key] || "") == e.key}>
                {e.name} ({e.key})
              </option>
            <% end %>
          </select>
        </div>
      </div>
      <div class="mb-1.5">
        <label class="block text-[0.75rem] text-wb-text-dim mb-0.5">Tags (comma-separated)</label>
        <input
          type="text"
          value={format_tags(@script_data[:tags])}
          phx-blur="script_update_field"
          phx-value-field="tags"
          name="value"
          placeholder="npc, combat, greeting"
          class="w-full text-[0.8rem] bg-wb-bg border border-wb-border rounded-wb-md text-wb-text focus:border-wb-accent focus:outline-none px-2 py-[5px]"
          phx-debounce="300"
        />
      </div>
    </div>

    <%!-- Editor content area --%>
    <div class="flex flex-1 min-h-0 overflow-hidden">
      <%!-- Code editor --%>
      <div class="flex-1 min-w-0 overflow-hidden">
        <div
          id="codemirror-editor-container"
          phx-hook="CodeMirrorEditor"
          phx-update="ignore"
          data-value={@script_data[:source] || default_source()}
          data-language="elixir"
          class="w-full h-full"
        >
          <div class="flex items-center justify-center h-full text-wb-text-muted text-wb-sm">
            Loading editor...
          </div>
        </div>
      </div>

      <%!-- Sidebar --%>
      <div class="w-[220px] border-l border-wb-border overflow-y-auto shrink-0">
        <%!-- API Reference --%>
        <div class="mb-3 border border-wb-border rounded-wb-md overflow-hidden max-h-full overflow-y-auto">
          <div class="flex items-center gap-1.5 text-[0.8rem] font-semibold text-wb-text-muted uppercase px-2.5 py-2 tracking-wide">
            <.icon name="hero-book-open" class="size-4" />
            <span>API Reference</span>
          </div>
          <div class="py-1">
            <%= for {sig, desc} <- @api_functions do %>
              <div class="flex flex-col px-2.5 py-1 border-b border-wb-panel">
                <code class="text-[0.72rem] text-wb-accent">{sig}</code>
                <span class="text-[0.68rem] text-wb-text-muted">{desc}</span>
              </div>
            <% end %>
          </div>
        </div>
      </div>
    </div>

    <%!-- Footer --%>
    <div class="flex justify-end gap-2 shrink-0 border-t border-wb-border px-3 py-2">
      <button
        class="px-3 py-1.5 text-wb-sm border-none rounded-wb-md cursor-pointer font-medium flex items-center justify-center gap-[0.35rem] transition-all duration-150 hover:-translate-y-px bg-wb-border text-wb-text hover:bg-wb-border-light hover:text-wb-text-bright"
        phx-click="close_script_editor"
      >
        Cancel
      </button>
      <button
        class="px-3 py-1.5 text-wb-sm border-none rounded-wb-md cursor-pointer font-medium flex items-center justify-center gap-[0.35rem] transition-all duration-150 hover:-translate-y-px bg-wb-accent text-white hover:bg-wb-accent-hover"
        phx-click="save_script"
      >
        Save Script
      </button>
    </div>
    """
  end

  defp format_tags(nil), do: ""
  defp format_tags(tags) when is_list(tags), do: Enum.join(tags, ", ")
  defp format_tags(tags) when is_binary(tags), do: tags

  defp default_source do
    """
    # Script logic goes here
    # Available: entity, player, context

    if player do
      message("Hello!")
    end

    continue()
    """
    |> String.trim()
  end
end
