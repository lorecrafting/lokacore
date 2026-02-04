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
      <div class="panel-header">
        <h3 class="panel-title" style={if @collapsed, do: "display: none;", else: ""}>Details</h3>
        <button
          class="panel-collapse-btn"
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

      <div class="panel-content" style={if @collapsed, do: "display: none;", else: "padding: 0;"}>
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
                <div class="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    name="name"
                    class="input"
                    value={room.name}
                    placeholder="Room display name..."
                    phx-debounce="500"
                  />
                </div>
                <div class="form-group">
                  <label>Description</label>
                  <textarea
                    name="description"
                    class="textarea"
                    rows="4"
                    placeholder="What the player sees when entering..."
                    phx-debounce="500"
                  ><%= room.description %></textarea>
                </div>
                <div class="form-group mt-2">
                  <label class="text-wb-xs text-wb-text-dim">Key (ID)</label>
                  <input
                    type="text"
                    class="input text-wb-base bg-wb-border-dark text-wb-text-dim"
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
                <div class="form-group">
                  <div class="grid grid-cols-3 gap-1">
                    <div>
                      <small>X</small>
                      <input
                        type="number"
                        name="x"
                        class="input"
                        value={room.x}
                        phx-debounce="500"
                      />
                    </div>
                    <div>
                      <small>Y</small>
                      <input
                        type="number"
                        name="y"
                        class="input"
                        value={room.y}
                        phx-debounce="500"
                      />
                    </div>
                    <div>
                      <small>Z</small>
                      <input
                        type="number"
                        name="z"
                        class="input"
                        value={room.z}
                        phx-debounce="500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
    <!-- 3. Exits - Connections to other rooms -->
            <div class="border-b border-wb-panel">
              <.inspector_section title="Exits" count={map_size(room.exits || %{})} />
              <div class="p-3 bg-wb-panel-header">
                <div :if={map_size(room.exits || %{}) > 0} class="exits-list">
                  <%= for {direction, dest_key} <- room.exits do %>
                    <div class="exit-item">
                      <div class="exit-info">
                        <span class="exit-direction">{direction}</span>
                        <span class="exit-arrow">→</span>
                        <span class="exit-dest">{dest_key}</span>
                      </div>
                      <button
                        type="button"
                        phx-click="remove_exit"
                        phx-value-from={room.key}
                        phx-value-direction={direction}
                        class="btn-icon-small"
                        title="Remove exit"
                      >
                        <.icon name="hero-x-mark" class="size-3" />
                      </button>
                    </div>
                  <% end %>
                </div>
                <p :if={map_size(room.exits || %{}) == 0} class="text-muted m-0 text-wb-base">
                  No exits defined
                </p>
                
    <!-- Add Exit Form -->
                <form
                  phx-submit="add_exit"
                  class="mt-3 flex flex-col gap-2"
                >
                  <input type="hidden" name="from" value={room.key} />
                  <div class="flex gap-2">
                    <select name="direction" class="input flex-1" required>
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
                      class="input flex-[2]"
                      placeholder="Destination key..."
                      required
                    />
                  </div>
                  <button type="submit" class="btn btn-sm w-full">
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
                <div :if={length(mob_spawns) > 0} class="contents-category">
                  <small class="text-wb-text-dim font-medium">NPCs</small>
                  <div class="contents-list">
                    <%= for spawn <- mob_spawns do %>
                      <div
                        class="contents-item cursor-pointer"
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
                  class={["contents-category", length(mob_spawns) > 0 && "mt-2"]}
                >
                  <small class="text-wb-text-dim font-medium">Items</small>
                  <div class="contents-list">
                    <%= for spawn <- item_spawns do %>
                      <div
                        class="contents-item cursor-pointer"
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
                  <p class="text-muted m-0 text-wb-base">
                    No spawns defined for this room
                  </p>
                  <p class="text-muted mt-2 mb-0 text-xs text-wb-text-faint">
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
                  class="btn btn-sm w-full"
                >
                  <.icon name="hero-document-duplicate" class="size-3" />
                  <span>Save as Template</span>
                </button>

                <button
                  type="button"
                  phx-click="delete_room"
                  phx-value-id={room.id || room.key}
                  class="btn btn-danger btn-sm"
                >
                  <.icon name="hero-trash" class="size-3" />
                  <span>Delete Room</span>
                </button>
              </div>
            </div>
          </form>
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
                <div class="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    name="name"
                    class="input"
                    value={npc[:name] || ""}
                    placeholder="NPC display name..."
                    phx-debounce="500"
                  />
                </div>
                <div class="form-group">
                  <label>Description</label>
                  <textarea
                    name="description"
                    class="textarea"
                    rows="3"
                    placeholder="What the player sees when looking..."
                    phx-debounce="500"
                  ><%= npc[:description] || npc[:short_desc] || "" %></textarea>
                </div>
                <div class="form-group mt-2">
                  <label class="text-wb-xs text-wb-text-dim">Key (ID)</label>
                  <input
                    type="text"
                    class="input text-wb-base bg-wb-border-dark text-wb-text-dim"
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
                <div class="form-group">
                  <label>Level</label>
                  <input
                    type="number"
                    name="level"
                    class="input"
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
                  class="btn btn-sm w-full"
                >
                  <.icon name="hero-code-bracket" class="size-3" />
                  <span>Edit Scripts</span>
                </button>
                <button
                  type="button"
                  phx-click="show_dialogue_editor_for_entity"
                  phx-value-entity_key={npc.key}
                  class="btn btn-sm w-full"
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
                  class="btn btn-danger btn-sm"
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
                <div class="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    name="name"
                    class="input"
                    value={item[:name] || ""}
                    placeholder="Item display name..."
                    phx-debounce="500"
                  />
                </div>
                <div class="form-group">
                  <label>Description</label>
                  <textarea
                    name="description"
                    class="textarea"
                    rows="3"
                    placeholder="What the player sees when examining..."
                    phx-debounce="500"
                  ><%= item[:description] || item[:short_desc] || "" %></textarea>
                </div>
                <div class="form-group mt-2">
                  <label class="text-wb-xs text-wb-text-dim">Key (ID)</label>
                  <input
                    type="text"
                    class="input text-wb-base bg-wb-border-dark text-wb-text-dim"
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
                <div class="form-group">
                  <label>Item Type</label>
                  <select name="item_type" class="input" phx-debounce="500">
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
                  class="btn btn-sm w-full"
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
                  class="btn btn-danger btn-sm"
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
                <div class="form-group">
                  <label>Offset</label>
                  <div class="grid grid-cols-3 gap-1">
                    <div>
                      <small>ΔX</small>
                      <input type="number" name="dx" class="input" value="0" />
                    </div>
                    <div>
                      <small>ΔY</small>
                      <input type="number" name="dy" class="input" value="0" />
                    </div>
                    <div>
                      <small>ΔZ</small>
                      <input type="number" name="dz" class="input" value="0" />
                    </div>
                  </div>
                </div>
                <button type="submit" class="btn btn-primary w-full">
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
                <div class="form-group">
                  <label>Clone Offset</label>
                  <div class="grid grid-cols-3 gap-1">
                    <div>
                      <small>ΔX</small>
                      <input type="number" name="dx" class="input" value="5" />
                    </div>
                    <div>
                      <small>ΔY</small>
                      <input type="number" name="dy" class="input" value="5" />
                    </div>
                    <div>
                      <small>ΔZ</small>
                      <input type="number" name="dz" class="input" value="0" />
                    </div>
                  </div>
                  <small>Clones will be created with new keys and copied tags</small>
                </div>
                <button type="submit" class="btn btn-sm w-full">
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
                class="btn btn-danger"
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
