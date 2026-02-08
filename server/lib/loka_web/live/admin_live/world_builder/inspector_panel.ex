defmodule LokaWeb.AdminLive.WorldBuilder.InspectorPanel do
  @moduledoc """
  Right panel inspector component.

  Displays and edits:
  - Room properties (name, description, position)
  - Exits
  - Batch operations for multi-selection

  Supports collapse mode (hidden).
  """
  use Phoenix.Component
  import LokaWeb.CoreComponents
  import LokaWeb.AdminLive.Components, only: [inspector_section: 1, entity_header: 1]

  attr :rooms, :list, required: true
  attr :npcs, :list, default: []
  attr :items, :list, default: []
  attr :room_spawns, :map, default: %{}
  attr :selected_room, :string, default: nil
  attr :selected_entity, :map, default: nil
  attr :selected_keys, :list, default: []
  attr :collapsed, :boolean, default: false
  attr :class, :string, default: ""

  def inspector_panel(assigns) do
    ~H"""
    <div class={[
      "world-builder-panel world-builder-inspector",
      @collapsed && "panel-collapsed",
      @class
    ]}>
      <div class="flex justify-between items-center py-[0.4rem] px-3 bg-wb-surface border-b border-wb-toolbar-border min-h-8">
        <h3
          class="text-wb-xs font-semibold text-wb-text-muted tracking-[0.02em] m-0"
          style={if @collapsed, do: "display: none;", else: ""}
        >
          Details
        </h3>
        <button
          class="flex items-center justify-center w-6 h-6 bg-transparent border-none text-wb-text-dim cursor-pointer rounded-wb-sm transition-all duration-150 hover:bg-wb-border hover:text-wb-text"
          phx-click="toggle_panel"
          phx-value-panel="inspector"
          title={if @collapsed, do: "Expand (2)", else: "Collapse (2)"}
          aria-label={if @collapsed, do: "Expand inspector panel", else: "Collapse inspector panel"}
          aria-expanded={to_string(!@collapsed)}
        >
          <.icon
            name={if @collapsed, do: "hero-chevron-left", else: "hero-chevron-right"}
            class="size-4"
          />
        </button>
      </div>

      <div
        class="panel-content flex-1 overflow-auto bg-wb-panel-alt !p-0"
        style={if @collapsed, do: "display: none;"}
      >
        <div :if={@selected_room}>
          <% room = get_room_data(@rooms, @selected_room) %>
          <.entity_header icon="hero-cube" name={room.name || room.key} />
          
    <!-- Inspector sections - ordered by typical editing workflow -->
          <form phx-change="update_room_field">
            <input type="hidden" name="room_id" value={room.id || room.key} />
            
    <!-- 1. Name & Description - Most commonly edited -->
            <div class="border-b border-wb-panel">
              <.inspector_section title="Identity" />
              <div class="p-3 bg-wb-panel-header">
                <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
                  <label>Name</label>
                  <input
                    type="text"
                    name="name"
                    class="w-full bg-wb-panel border border-wb-border text-wb-text px-2 py-[0.35rem] text-wb-xs rounded-[2px] transition-[border-color] duration-150 focus:outline-none focus:border-wb-accent-hover focus:bg-wb-panel-alt"
                    value={room.name}
                    placeholder="Room display name..."
                    phx-debounce="500"
                  />
                </div>
                <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
                  <label>Description</label>
                  <textarea
                    name="description"
                    class="w-full bg-wb-panel border border-wb-border text-wb-text px-2 py-[0.35rem] text-wb-xs rounded-[2px] transition-[border-color] duration-150 focus:outline-none focus:border-wb-accent-hover focus:bg-wb-panel-alt col-span-full mt-1"
                    rows="4"
                    placeholder="What the player sees when entering..."
                    phx-debounce="500"
                  ><%= room.description %></textarea>
                </div>
                <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2 mt-2">
                  <label class="text-wb-xs text-wb-text-dim">Key (ID)</label>
                  <input
                    type="text"
                    class="w-full bg-wb-border-dark border border-wb-border text-wb-text-dim px-2 py-[0.35rem] text-wb-base rounded-[2px] transition-[border-color] duration-150 focus:outline-none focus:border-wb-accent-hover focus:bg-wb-panel-alt"
                    value={room.key}
                    readonly
                  />
                </div>
              </div>
            </div>
            
    <!-- 2. Position - Where it goes on the map -->
            <div class="border-b border-wb-panel">
              <.inspector_section title="Position" />
              <div class="p-3 bg-wb-panel-header">
                <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
                  <div class="grid grid-cols-3 gap-1">
                    <div>
                      <small>X</small>
                      <input
                        type="number"
                        name="x"
                        class="w-full bg-wb-panel border border-wb-border text-wb-text px-2 py-[0.35rem] text-wb-xs rounded-[2px] transition-[border-color] duration-150 focus:outline-none focus:border-wb-accent-hover focus:bg-wb-panel-alt"
                        value={room.x}
                        phx-debounce="500"
                      />
                    </div>
                    <div>
                      <small>Y</small>
                      <input
                        type="number"
                        name="y"
                        class="w-full bg-wb-panel border border-wb-border text-wb-text px-2 py-[0.35rem] text-wb-xs rounded-[2px] transition-[border-color] duration-150 focus:outline-none focus:border-wb-accent-hover focus:bg-wb-panel-alt"
                        value={room.y}
                        phx-debounce="500"
                      />
                    </div>
                    <div>
                      <small>Z</small>
                      <input
                        type="number"
                        name="z"
                        class="w-full bg-wb-panel border border-wb-border text-wb-text px-2 py-[0.35rem] text-wb-xs rounded-[2px] transition-[border-color] duration-150 focus:outline-none focus:border-wb-accent-hover focus:bg-wb-panel-alt"
                        value={room.z}
                        phx-debounce="500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
          
    <!-- 3. Exits - Connections to other rooms (outside form to allow nested Add Exit form) -->
          <div class="border-b border-wb-panel">
            <.inspector_section title="Exits" count={map_size(room.exits || %{})} />
            <div class="p-3 bg-wb-panel-header">
              <div :if={map_size(room.exits || %{}) > 0} class="flex flex-col gap-2">
                <%= for {direction, dest_key} <- room.exits do %>
                  <div class="flex items-center justify-between p-2 bg-wb-input border border-wb-border rounded-wb-sm gap-2">
                    <div class="flex items-center gap-2 flex-1 text-wb-base">
                      <span class="font-semibold text-wb-accent uppercase text-wb-xs min-w-16">
                        {direction}
                      </span>
                      <span class="text-wb-text-faint">→</span>
                      <span class="text-wb-text font-wb-mono">{dest_key}</span>
                    </div>
                    <button
                      type="button"
                      phx-click="remove_exit"
                      phx-value-from={room.key}
                      phx-value-direction={direction}
                      class="bg-transparent border-0 text-wb-text-muted cursor-pointer p-1 rounded-wb-sm transition-all flex items-center justify-center shrink-0 hover:bg-wb-border hover:text-wb-error"
                      title="Remove exit"
                    >
                      <.icon name="hero-x-mark" class="size-3" />
                    </button>
                  </div>
                <% end %>
              </div>
              <p
                :if={map_size(room.exits || %{}) == 0}
                class="text-wb-text-faint text-sm italic m-0 text-wb-base"
              >
                No exits defined
              </p>
              
    <!-- Add Exit Form -->
              <form
                phx-submit="add_exit"
                class="mt-3 flex flex-col gap-2"
              >
                <input type="hidden" name="from" value={room.key} />
                <div class="flex gap-2">
                  <select
                    name="direction"
                    class="w-full bg-wb-panel border border-wb-border text-wb-text px-2 py-[0.35rem] text-wb-xs rounded-[2px] transition-[border-color] duration-150 focus:outline-none focus:border-wb-accent-hover focus:bg-wb-panel-alt flex-1"
                    required
                  >
                    <option value="">Direction...</option>
                    <option value="north">North</option>
                    <option value="south">South</option>
                    <option value="east">East</option>
                    <option value="west">West</option>
                    <option value="northeast">Northeast</option>
                    <option value="northwest">Northwest</option>
                    <option value="southeast">Southeast</option>
                    <option value="southwest">Southwest</option>
                    <option value="up">Up</option>
                    <option value="down">Down</option>
                  </select>
                  <input
                    type="text"
                    name="to"
                    class="w-full bg-wb-panel border border-wb-border text-wb-text px-2 py-[0.35rem] text-wb-xs rounded-[2px] transition-[border-color] duration-150 focus:outline-none focus:border-wb-accent-hover focus:bg-wb-panel-alt flex-[2]"
                    placeholder="Destination key..."
                    required
                  />
                </div>
                <button
                  type="submit"
                  class="px-3 py-1.5 text-wb-sm border-none rounded-wb-md cursor-pointer font-medium flex items-center justify-center gap-[0.35rem] transition-all duration-150 hover:-translate-y-px w-full"
                >
                  <.icon name="hero-plus" class="size-3" />
                  <span>Add Exit</span>
                </button>
              </form>
            </div>
          </div>
          
    <!-- 4. Spawns - What spawns in this room (from zone resets) -->
          <% spawns = Map.get(@room_spawns, room.key, []) %>
          <% mob_spawns = Enum.filter(spawns, fn s -> s.type == :mob end) %>
          <% item_spawns = Enum.filter(spawns, fn s -> s.type == :item end) %>
          <div class="border-b border-wb-panel">
            <.inspector_section title="Spawns" count={length(spawns)} />
            <div class="p-3 bg-wb-panel-header">
              <div :if={length(mob_spawns) > 0} class="mb-1">
                <small class="text-wb-text-dim font-medium">NPCs</small>
                <div class="flex flex-col gap-1 mt-1">
                  <%= for spawn <- mob_spawns do %>
                    <div
                      class="flex items-center gap-2 px-2 py-[0.35rem] bg-wb-panel-alt border border-wb-border rounded-wb-sm text-wb-base text-wb-text transition-all duration-100 hover:bg-wb-panel-header hover:border-wb-accent cursor-pointer"
                      phx-click="select_entity"
                      phx-value-type="npc"
                      phx-value-key={spawn.prototype}
                      title={"From zone: #{spawn.zone}"}
                    >
                      <.icon name="hero-user" class="size-3 text-emerald-500" />
                      <span>{spawn.prototype}</span>
                      <span :if={spawn.max > 1} class="text-wb-text-dim text-xs ml-auto">
                        ×{spawn.max}
                      </span>
                    </div>
                  <% end %>
                </div>
              </div>
              <div
                :if={length(item_spawns) > 0}
                class={["mb-1", length(mob_spawns) > 0 && "mt-2"]}
              >
                <small class="text-wb-text-dim font-medium">Items</small>
                <div class="flex flex-col gap-1 mt-1">
                  <%= for spawn <- item_spawns do %>
                    <div
                      class="flex items-center gap-2 px-2 py-[0.35rem] bg-wb-panel-alt border border-wb-border rounded-wb-sm text-wb-base text-wb-text transition-all duration-100 hover:bg-wb-panel-header hover:border-wb-accent cursor-pointer"
                      phx-click="select_entity"
                      phx-value-type="item"
                      phx-value-key={spawn.prototype}
                      title={"From zone: #{spawn.zone}"}
                    >
                      <.icon name="hero-cube-transparent" class="size-3 text-amber-500" />
                      <span>{spawn.prototype}</span>
                      <span :if={spawn.max > 1} class="text-wb-text-dim text-xs ml-auto">
                        ×{spawn.max}
                      </span>
                    </div>
                  <% end %>
                </div>
              </div>
              <div :if={length(spawns) == 0}>
                <p class="text-wb-text-faint text-sm italic m-0 text-wb-base">
                  No spawns defined for this room
                </p>
                <p class="italic mt-2 mb-0 text-xs text-wb-text-faint">
                  Add spawns in zone files (priv/world/zones/)
                </p>
              </div>
            </div>
          </div>
          
    <!-- 5. Actions - Less frequently used -->
          <div class="border-b border-wb-panel">
            <.inspector_section title="Actions" />
            <div class="p-3 bg-wb-panel-header flex flex-col gap-2">
              <button
                type="button"
                phx-click="save_as_template"
                phx-value-room_id={room.id || room.key}
                phx-value-template_key={room.key}
                phx-value-template_name={room.name}
                class="px-3 py-1.5 text-wb-sm border-none rounded-wb-md cursor-pointer font-medium flex items-center justify-center gap-[0.35rem] transition-all duration-150 hover:-translate-y-px w-full"
              >
                <.icon name="hero-document-duplicate" class="size-3" />
                <span>Save as Template</span>
              </button>

              <button
                type="button"
                phx-click="delete_room"
                phx-value-id={room.id || room.key}
                class="px-3 py-1.5 text-wb-sm border-none rounded-wb-md cursor-pointer font-medium flex items-center justify-center gap-[0.35rem] transition-all duration-150 hover:-translate-y-px bg-wb-error text-white"
              >
                <.icon name="hero-trash" class="size-3" />
                <span>Delete Room</span>
              </button>
            </div>
          </div>
        </div>

        <%!-- NPC Inspector --%>
        <div :if={@selected_entity && @selected_entity.type == :npc}>
          <% npc = get_npc_data(@npcs, @selected_entity.key) %>
          <.entity_header icon="hero-user" name={npc[:name] || npc.key} />

          <form phx-change="update_npc_field">
            <input type="hidden" name="npc_key" value={npc.key} />
            
    <!-- 1. Identity - Name & Description first -->
            <div class="border-b border-wb-panel">
              <.inspector_section title="Identity" />
              <div class="p-3 bg-wb-panel-header">
                <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
                  <label>Name</label>
                  <input
                    type="text"
                    name="name"
                    class="w-full bg-wb-panel border border-wb-border text-wb-text px-2 py-[0.35rem] text-wb-xs rounded-[2px] transition-[border-color] duration-150 focus:outline-none focus:border-wb-accent-hover focus:bg-wb-panel-alt"
                    value={npc[:name] || ""}
                    placeholder="NPC display name..."
                    phx-debounce="500"
                  />
                </div>
                <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
                  <label>Description</label>
                  <textarea
                    name="description"
                    class="w-full bg-wb-panel border border-wb-border text-wb-text px-2 py-[0.35rem] text-wb-xs rounded-[2px] transition-[border-color] duration-150 focus:outline-none focus:border-wb-accent-hover focus:bg-wb-panel-alt col-span-full mt-1"
                    rows="3"
                    placeholder="What the player sees when looking..."
                    phx-debounce="500"
                  ><%= npc[:description] || npc[:short_desc] || "" %></textarea>
                </div>
                <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2 mt-2">
                  <label class="text-wb-xs text-wb-text-dim">Key (ID)</label>
                  <input
                    type="text"
                    class="w-full bg-wb-border-dark border border-wb-border text-wb-text-dim px-2 py-[0.35rem] text-wb-base rounded-[2px] transition-[border-color] duration-150 focus:outline-none focus:border-wb-accent-hover focus:bg-wb-panel-alt"
                    value={npc.key}
                    readonly
                  />
                </div>
              </div>
            </div>
            
    <!-- 2. Attributes - Level and stats -->
            <div class="border-b border-wb-panel">
              <.inspector_section title="Attributes" />
              <div class="p-3 bg-wb-panel-header">
                <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
                  <label>Level</label>
                  <input
                    type="number"
                    name="level"
                    class="w-full bg-wb-panel border border-wb-border text-wb-text px-2 py-[0.35rem] text-wb-xs rounded-[2px] transition-[border-color] duration-150 focus:outline-none focus:border-wb-accent-hover focus:bg-wb-panel-alt"
                    value={npc[:level] || 1}
                    min="1"
                    phx-debounce="500"
                  />
                </div>
              </div>
            </div>
            
    <!-- 3. Behavior - Scripts & Dialogues -->
            <div class="border-b border-wb-panel">
              <.inspector_section title="Behavior" />
              <div class="p-3 bg-wb-panel-header flex flex-col gap-2">
                <button
                  type="button"
                  phx-click="show_script_editor_for_entity"
                  phx-value-entity_type="npc"
                  phx-value-entity_key={npc.key}
                  class="px-3 py-1.5 text-wb-sm border-none rounded-wb-md cursor-pointer font-medium flex items-center justify-center gap-[0.35rem] transition-all duration-150 hover:-translate-y-px w-full"
                >
                  <.icon name="hero-code-bracket" class="size-3" />
                  <span>Edit Scripts</span>
                </button>
                <button
                  type="button"
                  phx-click="show_dialogue_editor_for_entity"
                  phx-value-entity_key={npc.key}
                  class="px-3 py-1.5 text-wb-sm border-none rounded-wb-md cursor-pointer font-medium flex items-center justify-center gap-[0.35rem] transition-all duration-150 hover:-translate-y-px w-full"
                >
                  <.icon name="hero-chat-bubble-left-right" class="size-3" />
                  <span>Edit Dialogues</span>
                </button>
              </div>
            </div>
            
    <!-- 4. Actions -->
            <div class="border-b border-wb-panel">
              <.inspector_section title="Actions" />
              <div class="p-3 bg-wb-panel-header flex flex-col gap-2">
                <button
                  type="button"
                  phx-click="delete_npc"
                  phx-value-key={npc.key}
                  class="px-3 py-1.5 text-wb-sm border-none rounded-wb-md cursor-pointer font-medium flex items-center justify-center gap-[0.35rem] transition-all duration-150 hover:-translate-y-px bg-wb-error text-white"
                >
                  <.icon name="hero-trash" class="size-3" />
                  <span>Delete NPC</span>
                </button>
              </div>
            </div>
          </form>
        </div>

        <%!-- Item Inspector --%>
        <div :if={@selected_entity && @selected_entity.type == :item}>
          <% item = get_item_data(@items, @selected_entity.key) %>
          <.entity_header icon="hero-cube-transparent" name={item[:name] || item.key} />

          <form phx-change="update_item_field">
            <input type="hidden" name="item_key" value={item.key} />
            
    <!-- 1. Identity - Name & Description first -->
            <div class="border-b border-wb-panel">
              <.inspector_section title="Identity" />
              <div class="p-3 bg-wb-panel-header">
                <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
                  <label>Name</label>
                  <input
                    type="text"
                    name="name"
                    class="w-full bg-wb-panel border border-wb-border text-wb-text px-2 py-[0.35rem] text-wb-xs rounded-[2px] transition-[border-color] duration-150 focus:outline-none focus:border-wb-accent-hover focus:bg-wb-panel-alt"
                    value={item[:name] || ""}
                    placeholder="Item display name..."
                    phx-debounce="500"
                  />
                </div>
                <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
                  <label>Description</label>
                  <textarea
                    name="description"
                    class="w-full bg-wb-panel border border-wb-border text-wb-text px-2 py-[0.35rem] text-wb-xs rounded-[2px] transition-[border-color] duration-150 focus:outline-none focus:border-wb-accent-hover focus:bg-wb-panel-alt col-span-full mt-1"
                    rows="3"
                    placeholder="What the player sees when examining..."
                    phx-debounce="500"
                  ><%= item[:description] || item[:short_desc] || "" %></textarea>
                </div>
                <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2 mt-2">
                  <label class="text-wb-xs text-wb-text-dim">Key (ID)</label>
                  <input
                    type="text"
                    class="w-full bg-wb-border-dark border border-wb-border text-wb-text-dim px-2 py-[0.35rem] text-wb-base rounded-[2px] transition-[border-color] duration-150 focus:outline-none focus:border-wb-accent-hover focus:bg-wb-panel-alt"
                    value={item.key}
                    readonly
                  />
                </div>
              </div>
            </div>
            
    <!-- 2. Attributes - Item Type -->
            <div class="border-b border-wb-panel">
              <.inspector_section title="Attributes" />
              <div class="p-3 bg-wb-panel-header">
                <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
                  <label>Item Type</label>
                  <select
                    name="item_type"
                    class="w-full bg-wb-panel border border-wb-border text-wb-text px-2 py-[0.35rem] text-wb-xs rounded-[2px] transition-[border-color] duration-150 focus:outline-none focus:border-wb-accent-hover focus:bg-wb-panel-alt"
                    phx-debounce="500"
                  >
                    <option value="misc" selected={item[:item_type] == "misc"}>Miscellaneous</option>
                    <option value="weapon" selected={item[:item_type] == "weapon"}>Weapon</option>
                    <option value="armor" selected={item[:item_type] == "armor"}>Armor</option>
                    <option value="consumable" selected={item[:item_type] == "consumable"}>
                      Consumable
                    </option>
                    <option value="quest_item" selected={item[:item_type] == "quest_item"}>
                      Quest Item
                    </option>
                  </select>
                </div>
              </div>
            </div>
            
    <!-- 3. Behavior - Scripts -->
            <div class="border-b border-wb-panel">
              <.inspector_section title="Behavior" />
              <div class="p-3 bg-wb-panel-header">
                <button
                  type="button"
                  phx-click="show_script_editor_for_entity"
                  phx-value-entity_type="item"
                  phx-value-entity_key={item.key}
                  class="px-3 py-1.5 text-wb-sm border-none rounded-wb-md cursor-pointer font-medium flex items-center justify-center gap-[0.35rem] transition-all duration-150 hover:-translate-y-px w-full"
                >
                  <.icon name="hero-code-bracket" class="size-3" />
                  <span>Edit Scripts</span>
                </button>
              </div>
            </div>
            
    <!-- 4. Actions -->
            <div class="border-b border-wb-panel">
              <.inspector_section title="Actions" />
              <div class="p-3 bg-wb-panel-header flex flex-col gap-2">
                <button
                  type="button"
                  phx-click="delete_item"
                  phx-value-key={item.key}
                  class="px-3 py-1.5 text-wb-sm border-none rounded-wb-md cursor-pointer font-medium flex items-center justify-center gap-[0.35rem] transition-all duration-150 hover:-translate-y-px bg-wb-error text-white"
                >
                  <.icon name="hero-trash" class="size-3" />
                  <span>Delete Item</span>
                </button>
              </div>
            </div>
          </form>
        </div>

        <div :if={@selected_keys != []}>
          <.entity_header
            icon="hero-squares-2x2"
            name={"Batch Operations (#{length(@selected_keys)} rooms)"}
          />
          
    <!-- Batch Move Section -->
          <div class="border-b border-wb-panel">
            <.inspector_section title="Move Selected" />
            <div class="p-3 bg-wb-panel-header">
              <form phx-submit="batch_move">
                <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
                  <label>Offset</label>
                  <div class="grid grid-cols-3 gap-1">
                    <div>
                      <small>ΔX</small>
                      <input
                        type="number"
                        name="dx"
                        class="w-full bg-wb-panel border border-wb-border text-wb-text px-2 py-[0.35rem] text-wb-xs rounded-[2px] transition-[border-color] duration-150 focus:outline-none focus:border-wb-accent-hover focus:bg-wb-panel-alt"
                        value="0"
                      />
                    </div>
                    <div>
                      <small>ΔY</small>
                      <input
                        type="number"
                        name="dy"
                        class="w-full bg-wb-panel border border-wb-border text-wb-text px-2 py-[0.35rem] text-wb-xs rounded-[2px] transition-[border-color] duration-150 focus:outline-none focus:border-wb-accent-hover focus:bg-wb-panel-alt"
                        value="0"
                      />
                    </div>
                    <div>
                      <small>ΔZ</small>
                      <input
                        type="number"
                        name="dz"
                        class="w-full bg-wb-panel border border-wb-border text-wb-text px-2 py-[0.35rem] text-wb-xs rounded-[2px] transition-[border-color] duration-150 focus:outline-none focus:border-wb-accent-hover focus:bg-wb-panel-alt"
                        value="0"
                      />
                    </div>
                  </div>
                </div>
                <button
                  type="submit"
                  class="px-4 py-2 border-none rounded-wb-sm text-wb-base cursor-pointer transition-all duration-100 bg-wb-accent text-white hover:bg-wb-accent-hover w-full"
                >
                  <.icon name="hero-arrows-right-left" class="size-4" />
                  <span>Move All</span>
                </button>
              </form>
            </div>
          </div>
          
    <!-- Batch Clone Section -->
          <div class="border-b border-wb-panel">
            <.inspector_section title="Clone Selected" />
            <div class="p-3 bg-wb-panel-header">
              <form phx-submit="batch_clone">
                <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
                  <label>Clone Offset</label>
                  <div class="grid grid-cols-3 gap-1">
                    <div>
                      <small>ΔX</small>
                      <input
                        type="number"
                        name="dx"
                        class="w-full bg-wb-panel border border-wb-border text-wb-text px-2 py-[0.35rem] text-wb-xs rounded-[2px] transition-[border-color] duration-150 focus:outline-none focus:border-wb-accent-hover focus:bg-wb-panel-alt"
                        value="5"
                      />
                    </div>
                    <div>
                      <small>ΔY</small>
                      <input
                        type="number"
                        name="dy"
                        class="w-full bg-wb-panel border border-wb-border text-wb-text px-2 py-[0.35rem] text-wb-xs rounded-[2px] transition-[border-color] duration-150 focus:outline-none focus:border-wb-accent-hover focus:bg-wb-panel-alt"
                        value="5"
                      />
                    </div>
                    <div>
                      <small>ΔZ</small>
                      <input
                        type="number"
                        name="dz"
                        class="w-full bg-wb-panel border border-wb-border text-wb-text px-2 py-[0.35rem] text-wb-xs rounded-[2px] transition-[border-color] duration-150 focus:outline-none focus:border-wb-accent-hover focus:bg-wb-panel-alt"
                        value="0"
                      />
                    </div>
                  </div>
                  <small>Clones will be created with new keys and copied tags</small>
                </div>
                <button
                  type="submit"
                  class="px-3 py-1.5 text-wb-sm border-none rounded-wb-md cursor-pointer font-medium flex items-center justify-center gap-[0.35rem] transition-all duration-150 hover:-translate-y-px w-full"
                >
                  <.icon name="hero-document-duplicate" class="size-3" />
                  <span>Clone All</span>
                </button>
              </form>
            </div>
          </div>
          
    <!-- Batch Delete Section -->
          <div class="border-b border-wb-panel">
            <.inspector_section title="Danger Zone" />
            <div class="p-3 bg-wb-panel-header">
              <button
                type="button"
                phx-click="batch_delete"
                class="px-4 py-2 border-none rounded-wb-sm text-wb-base cursor-pointer transition-all duration-100 bg-wb-error text-white hover:bg-wb-error"
              >
                <.icon name="hero-trash" class="size-4" />
                <span>Delete All ({length(@selected_keys)})</span>
              </button>
            </div>
          </div>
        </div>

        <div
          :if={@selected_room == nil && @selected_entity == nil && @selected_keys == []}
          class="flex items-center justify-center h-full text-wb-text-faint text-[0.8rem]"
        >
          <p>Select an object to view details</p>
          <p class="text-wb-sm text-wb-text-dim mt-2">
            Hold Shift to select multiple
          </p>
        </div>
      </div>
    </div>
    """
  end

  defp get_room_data(rooms, room_key) do
    Enum.find(rooms, fn r -> r.key == room_key end) ||
      %{
        key: room_key,
        name: "Unknown",
        description: "",
        x: 0,
        y: 0,
        z: 0,
        exits: %{}
      }
  end

  defp get_npc_data(npcs, npc_key) do
    Enum.find(npcs, fn n -> n.key == npc_key end) ||
      %{
        key: npc_key,
        name: "Unknown NPC",
        description: "",
        level: 1
      }
  end

  defp get_item_data(items, item_key) do
    Enum.find(items, fn i -> i.key == item_key end) ||
      %{
        key: item_key,
        name: "Unknown Item",
        description: "",
        item_type: "misc"
      }
  end
end
