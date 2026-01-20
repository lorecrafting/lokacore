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

  attr :rooms, :list, required: true
  attr :npcs, :list, default: []
  attr :items, :list, default: []
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
        >
          <.icon
            name={if @collapsed, do: "hero-chevron-left", else: "hero-chevron-right"}
            class="size-4"
          />
        </button>
      </div>

      <div class="panel-content" style={if @collapsed, do: "display: none;", else: "padding: 0;"}>
        <%= if @selected_room do %>
          <% room = get_room_data(@rooms, @selected_room) %>
          <!-- Inspector header with room icon and key -->
          <div class="inspector-header">
            <.icon name="hero-cube" class="size-5" style="color: #909090;" />
            <span class="inspector-title">{room.name || room.key}</span>
          </div>
          
    <!-- Inspector sections - ordered by typical editing workflow -->
          <form phx-change="update_room_field">
            <input type="hidden" name="room_id" value={room.id || room.key} />
            
    <!-- 1. Name & Description - Most commonly edited -->
            <div class="inspector-section">
              <div class="inspector-section-header">
                <span class="inspector-section-title">Identity</span>
                <.icon name="hero-chevron-down" class="size-3" />
              </div>
              <div class="inspector-section-content">
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
                <div class="form-group" style="margin-top: 0.5rem;">
                  <label style="font-size: 0.75rem; color: #666;">Key (ID)</label>
                  <input
                    type="text"
                    class="input"
                    value={room.key}
                    readonly
                    style="font-size: 0.85rem; background: #1a1a1a; color: #666;"
                  />
                </div>
              </div>
            </div>
            
    <!-- 2. Position - Where it goes on the map -->
            <div class="inspector-section">
              <div class="inspector-section-header">
                <span class="inspector-section-title">Position</span>
                <.icon name="hero-chevron-down" class="size-3" />
              </div>
              <div class="inspector-section-content">
                <div class="form-group">
                  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.25rem;">
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
            <div class="inspector-section">
              <div class="inspector-section-header">
                <span class="inspector-section-title">
                  Exits
                  <span style="color: #666; font-weight: normal; margin-left: 0.25rem;">
                    ({map_size(room.exits || %{})})
                  </span>
                </span>
                <.icon name="hero-chevron-down" class="size-3" />
              </div>
              <div class="inspector-section-content">
                <%= if map_size(room.exits || %{}) > 0 do %>
                  <div class="exits-list">
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
                <% else %>
                  <p class="text-muted" style="margin: 0; font-size: 0.85rem;">No exits defined</p>
                <% end %>
                
    <!-- Add Exit Form -->
                <form
                  phx-submit="add_exit"
                  style="margin-top: 0.75rem; display: flex; gap: 0.5rem; flex-direction: column;"
                >
                  <input type="hidden" name="from" value={room.key} />
                  <div style="display: flex; gap: 0.5rem;">
                    <select name="direction" class="input" style="flex: 1;" required>
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
                      class="input"
                      style="flex: 2;"
                      placeholder="Destination key..."
                      required
                    />
                  </div>
                  <button type="submit" class="btn btn-sm" style="width: 100%;">
                    <.icon name="hero-plus" class="size-3" />
                    <span>Add Exit</span>
                  </button>
                </form>
              </div>
            </div>
            
    <!-- 4. Actions - Less frequently used -->
            <div class="inspector-section">
              <div class="inspector-section-header">
                <span class="inspector-section-title">Actions</span>
                <.icon name="hero-chevron-down" class="size-3" />
              </div>
              <div
                class="inspector-section-content"
                style="display: flex; flex-direction: column; gap: 0.5rem;"
              >
                <button
                  type="button"
                  phx-click="save_as_template"
                  phx-value-room_id={room.id || room.key}
                  phx-value-template_key={room.key}
                  phx-value-template_name={room.name}
                  class="btn btn-sm"
                  style="width: 100%;"
                >
                  <.icon name="hero-document-duplicate" class="size-3" />
                  <span>Save as Template</span>
                </button>

                <button
                  type="button"
                  phx-click="delete_room"
                  phx-value-id={room.id || room.key}
                  class="btn btn-danger btn-sm"
                  data-confirm="Are you sure you want to delete this room?"
                >
                  <.icon name="hero-trash" class="size-3" />
                  <span>Delete Room</span>
                </button>
              </div>
            </div>
          </form>
        <% end %>

        <%!-- NPC Inspector --%>
        <%= if @selected_entity && @selected_entity.type == :npc do %>
          <% npc = get_npc_data(@npcs, @selected_entity.key) %>
          <div class="inspector-header">
            <.icon name="hero-user" class="size-5" style="color: #909090;" />
            <span class="inspector-title">{npc[:name] || npc.key}</span>
          </div>

          <form phx-change="update_npc_field">
            <input type="hidden" name="npc_key" value={npc.key} />
            
    <!-- 1. Identity - Name & Description first -->
            <div class="inspector-section">
              <div class="inspector-section-header">
                <span class="inspector-section-title">Identity</span>
                <.icon name="hero-chevron-down" class="size-3" />
              </div>
              <div class="inspector-section-content">
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
                <div class="form-group" style="margin-top: 0.5rem;">
                  <label style="font-size: 0.75rem; color: #666;">Key (ID)</label>
                  <input
                    type="text"
                    class="input"
                    value={npc.key}
                    readonly
                    style="font-size: 0.85rem; background: #1a1a1a; color: #666;"
                  />
                </div>
              </div>
            </div>
            
    <!-- 2. Attributes - Level and stats -->
            <div class="inspector-section">
              <div class="inspector-section-header">
                <span class="inspector-section-title">Attributes</span>
                <.icon name="hero-chevron-down" class="size-3" />
              </div>
              <div class="inspector-section-content">
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
            <div class="inspector-section">
              <div class="inspector-section-header">
                <span class="inspector-section-title">Behavior</span>
                <.icon name="hero-chevron-down" class="size-3" />
              </div>
              <div
                class="inspector-section-content"
                style="display: flex; flex-direction: column; gap: 0.5rem;"
              >
                <button
                  type="button"
                  phx-click="show_script_editor_for_entity"
                  phx-value-entity_type="npc"
                  phx-value-entity_key={npc.key}
                  class="btn btn-sm"
                  style="width: 100%;"
                >
                  <.icon name="hero-code-bracket" class="size-3" />
                  <span>Edit Scripts</span>
                </button>
                <button
                  type="button"
                  phx-click="show_dialogue_editor_for_entity"
                  phx-value-entity_key={npc.key}
                  class="btn btn-sm"
                  style="width: 100%;"
                >
                  <.icon name="hero-chat-bubble-left-right" class="size-3" />
                  <span>Edit Dialogues</span>
                </button>
              </div>
            </div>
            
    <!-- 4. Actions -->
            <div class="inspector-section">
              <div class="inspector-section-header">
                <span class="inspector-section-title">Actions</span>
                <.icon name="hero-chevron-down" class="size-3" />
              </div>
              <div
                class="inspector-section-content"
                style="display: flex; flex-direction: column; gap: 0.5rem;"
              >
                <button
                  type="button"
                  phx-click="delete_npc"
                  phx-value-key={npc.key}
                  class="btn btn-danger btn-sm"
                  data-confirm="Are you sure you want to delete this NPC?"
                >
                  <.icon name="hero-trash" class="size-3" />
                  <span>Delete NPC</span>
                </button>
              </div>
            </div>
          </form>
        <% end %>

        <%!-- Item Inspector --%>
        <%= if @selected_entity && @selected_entity.type == :item do %>
          <% item = get_item_data(@items, @selected_entity.key) %>
          <div class="inspector-header">
            <.icon name="hero-cube-transparent" class="size-5" style="color: #909090;" />
            <span class="inspector-title">{item[:name] || item.key}</span>
          </div>

          <form phx-change="update_item_field">
            <input type="hidden" name="item_key" value={item.key} />
            
    <!-- 1. Identity - Name & Description first -->
            <div class="inspector-section">
              <div class="inspector-section-header">
                <span class="inspector-section-title">Identity</span>
                <.icon name="hero-chevron-down" class="size-3" />
              </div>
              <div class="inspector-section-content">
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
                <div class="form-group" style="margin-top: 0.5rem;">
                  <label style="font-size: 0.75rem; color: #666;">Key (ID)</label>
                  <input
                    type="text"
                    class="input"
                    value={item.key}
                    readonly
                    style="font-size: 0.85rem; background: #1a1a1a; color: #666;"
                  />
                </div>
              </div>
            </div>
            
    <!-- 2. Attributes - Item Type -->
            <div class="inspector-section">
              <div class="inspector-section-header">
                <span class="inspector-section-title">Attributes</span>
                <.icon name="hero-chevron-down" class="size-3" />
              </div>
              <div class="inspector-section-content">
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
            <div class="inspector-section">
              <div class="inspector-section-header">
                <span class="inspector-section-title">Behavior</span>
                <.icon name="hero-chevron-down" class="size-3" />
              </div>
              <div class="inspector-section-content">
                <button
                  type="button"
                  phx-click="show_script_editor_for_entity"
                  phx-value-entity_type="item"
                  phx-value-entity_key={item.key}
                  class="btn btn-sm"
                  style="width: 100%;"
                >
                  <.icon name="hero-code-bracket" class="size-3" />
                  <span>Edit Scripts</span>
                </button>
              </div>
            </div>
            
    <!-- 4. Actions -->
            <div class="inspector-section">
              <div class="inspector-section-header">
                <span class="inspector-section-title">Actions</span>
                <.icon name="hero-chevron-down" class="size-3" />
              </div>
              <div
                class="inspector-section-content"
                style="display: flex; flex-direction: column; gap: 0.5rem;"
              >
                <button
                  type="button"
                  phx-click="delete_item"
                  phx-value-key={item.key}
                  class="btn btn-danger btn-sm"
                  data-confirm="Are you sure you want to delete this item?"
                >
                  <.icon name="hero-trash" class="size-3" />
                  <span>Delete Item</span>
                </button>
              </div>
            </div>
          </form>
        <% end %>

        <%= if @selected_keys != [] do %>
          <div class="inspector-header">
            <.icon name="hero-squares-2x2" class="size-5" style="color: #909090;" />
            <span class="inspector-title">Batch Operations ({length(@selected_keys)} rooms)</span>
          </div>
          
    <!-- Batch Move Section -->
          <div class="inspector-section">
            <div class="inspector-section-header">
              <span class="inspector-section-title">Move Selected</span>
              <.icon name="hero-chevron-down" class="size-3" />
            </div>
            <div class="inspector-section-content">
              <form phx-submit="batch_move">
                <div class="form-group">
                  <label>Offset</label>
                  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.25rem;">
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
                <button type="submit" class="btn btn-primary" style="width: 100%;">
                  <.icon name="hero-arrows-right-left" class="size-4" />
                  <span>Move All</span>
                </button>
              </form>
            </div>
          </div>
          
    <!-- Batch Clone Section -->
          <div class="inspector-section">
            <div class="inspector-section-header">
              <span class="inspector-section-title">Clone Selected</span>
              <.icon name="hero-chevron-down" class="size-3" />
            </div>
            <div class="inspector-section-content">
              <form phx-submit="batch_clone">
                <div class="form-group">
                  <label>Clone Offset</label>
                  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.25rem;">
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
                <button type="submit" class="btn btn-sm" style="width: 100%;">
                  <.icon name="hero-document-duplicate" class="size-3" />
                  <span>Clone All</span>
                </button>
              </form>
            </div>
          </div>
          
    <!-- Batch Delete Section -->
          <div class="inspector-section">
            <div class="inspector-section-header">
              <span class="inspector-section-title">Danger Zone</span>
              <.icon name="hero-chevron-down" class="size-3" />
            </div>
            <div class="inspector-section-content">
              <button
                type="button"
                phx-click="batch_delete"
                class="btn btn-danger"
                data-confirm="Are you sure you want to delete all {length(@selected_keys)} selected rooms?"
              >
                <.icon name="hero-trash" class="size-4" />
                <span>Delete All ({length(@selected_keys)})</span>
              </button>
            </div>
          </div>
        <% end %>

        <%= if @selected_room == nil && @selected_entity == nil && @selected_keys == [] do %>
          <div class="inspector-empty">
            <p>Select an object to view details</p>
            <p style="font-size: 0.8rem; color: #666; margin-top: 0.5rem;">
              Hold Shift to select multiple
            </p>
          </div>
        <% end %>
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
