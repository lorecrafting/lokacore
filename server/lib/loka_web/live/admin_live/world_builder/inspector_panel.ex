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
  attr :selected_room, :string, default: nil
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
          <!-- Inspector header with room name -->
          <div class="inspector-header">
            <.icon name="hero-cube" class="size-5" style="color: #909090;" />
            <span class="inspector-title">{room.name}</span>
          </div>
          
    <!-- Inspector sections -->
          <form phx-change="update_room_field">
            <input type="hidden" name="room_id" value={room.id || room.key} />
            
    <!-- Properties Section -->
            <div class="inspector-section">
              <div class="inspector-section-header">
                <span class="inspector-section-title">Properties</span>
                <.icon name="hero-chevron-down" class="size-3" />
              </div>
              <div class="inspector-section-content">
                <div class="form-group">
                  <label>Key (ID)</label>
                  <input type="text" class="input" value={room.key} readonly />
                  <small>Unique identifier - cannot be changed</small>
                </div>
                <div class="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    name="name"
                    class="input"
                    value={room.name}
                    phx-debounce="500"
                  />
                </div>
              </div>
            </div>
            
    <!-- Transform/Position Section -->
            <div class="inspector-section">
              <div class="inspector-section-header">
                <span class="inspector-section-title">Transform</span>
                <.icon name="hero-chevron-down" class="size-3" />
              </div>
              <div class="inspector-section-content">
                <div class="form-group">
                  <label>Position</label>
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
            
    <!-- Description Section -->
            <div class="inspector-section">
              <div class="inspector-section-header">
                <span class="inspector-section-title">Description</span>
                <.icon name="hero-chevron-down" class="size-3" />
              </div>
              <div class="inspector-section-content">
                <div class="form-group">
                  <textarea
                    name="description"
                    class="textarea"
                    rows="4"
                    phx-debounce="500"
                  ><%= room.description %></textarea>
                </div>
              </div>
            </div>
            
    <!-- Exits Section -->
            <div class="inspector-section">
              <div class="inspector-section-header">
                <span class="inspector-section-title">Exits</span>
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
                  <p class="text-muted" style="margin: 0;">No exits defined</p>
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
                      placeholder="Destination room key..."
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
            
    <!-- Actions Section -->
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
                  class="btn btn-primary"
                  style="width: 100%;"
                >
                  <.icon name="hero-document-duplicate" class="size-4" />
                  <span>Save as Template</span>
                </button>

                <button
                  type="button"
                  phx-click="delete_room"
                  phx-value-id={room.id || room.key}
                  class="btn btn-danger"
                  data-confirm="Are you sure you want to delete this room?"
                >
                  <.icon name="hero-trash" class="size-4" />
                  <span>Delete Room</span>
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

        <%= if @selected_room == nil && @selected_keys == [] do %>
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
end
