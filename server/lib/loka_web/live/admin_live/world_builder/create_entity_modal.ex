defmodule LokaWeb.AdminLive.WorldBuilder.CreateEntityModal do
  @moduledoc """
  Generic entity creation modal for World Builder.

  Consolidates the create modals for rooms, NPCs, and items into a single
  reusable component with entity-type-specific fields.

  ## Usage

      <CreateEntityModal.create_entity_modal
        show={@show_create_modal}
        entity_type={:room}
        on_submit="submit_create_room"
        on_cancel="close_create_modal"
      />

  Supported entity types: :room, :npc, :item
  """
  use Phoenix.Component

  @entity_config %{
    room: %{
      title: "Create New Room",
      name_placeholder: "e.g., Main Tavern",
      description_placeholder: "What the player sees when entering...",
      key_label: "Room Key",
      submit_text: "Create Room",
      fields: [:name, :description, :position, :key]
    },
    npc: %{
      title: "Create New NPC",
      name_placeholder: "e.g., Captain Reeves",
      description_placeholder: "What the player sees when looking...",
      key_label: "NPC Key",
      submit_text: "Create NPC",
      fields: [:name, :description, :level, :key]
    },
    item: %{
      title: "Create New Item",
      name_placeholder: "e.g., Iron Sword",
      description_placeholder: "What the player sees when examining...",
      key_label: "Item Key",
      submit_text: "Create Item",
      fields: [:name, :item_type, :description, :key]
    }
  }

  @item_types [
    {"Miscellaneous", "misc"},
    {"Weapon", "weapon"},
    {"Armor", "armor"},
    {"Consumable", "consumable"},
    {"Quest Item", "quest_item"}
  ]

  attr :show, :boolean, default: false
  attr :entity_type, :atom, required: true
  attr :on_submit, :string, required: true
  attr :on_cancel, :string, required: true

  def create_entity_modal(assigns) do
    config = Map.get(@entity_config, assigns.entity_type, @entity_config.room)
    assigns = assign(assigns, :config, config)
    assigns = assign(assigns, :item_types, @item_types)

    ~H"""
    <%= if @show do %>
      <div class="modal-overlay" phx-click={@on_cancel}>
        <div class="modal-content" phx-click-away={@on_cancel}>
          <div class="modal-header">
            <h3>{@config.title}</h3>
            <button phx-click={@on_cancel} class="modal-close">&times;</button>
          </div>
          <form phx-submit={@on_submit}>
            <div class="form-group">
              <label>Name</label>
              <input
                type="text"
                name="name"
                class="input"
                placeholder={@config.name_placeholder}
                required
              />
            </div>

            <%= if :item_type in @config.fields do %>
              <div class="form-group">
                <label>Item Type</label>
                <select name="item_type" class="input">
                  <%= for {label, value} <- @item_types do %>
                    <option value={value}>{label}</option>
                  <% end %>
                </select>
              </div>
            <% end %>

            <div class="form-group">
              <label>Description</label>
              <textarea
                name="description"
                class="textarea"
                rows="3"
                placeholder={@config.description_placeholder}
              ></textarea>
            </div>

            <%= if :level in @config.fields do %>
              <div class="form-group">
                <label>Level</label>
                <input type="number" name="level" class="input" value="1" min="1" />
              </div>
            <% end %>

            <%= if :position in @config.fields do %>
              <div class="form-group">
                <label>Position</label>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem;">
                  <input type="number" name="x" class="input" placeholder="X" value="0" />
                  <input type="number" name="y" class="input" placeholder="Y" value="0" />
                  <input type="number" name="z" class="input" placeholder="Z" value="0" />
                </div>
              </div>
            <% end %>

            <div class="form-group">
              <label>
                {@config.key_label} <span style="color: #666; font-weight: normal;">(optional)</span>
              </label>
              <input
                type="text"
                name="key"
                class="input"
                placeholder="Auto-generated from name if empty"
              />
              <small style="color: #666;">Unique identifier - leave blank to auto-generate</small>
            </div>

            <div class="modal-footer">
              <button type="button" phx-click={@on_cancel} class="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" class="btn btn-primary">{@config.submit_text}</button>
            </div>
          </form>
        </div>
      </div>
    <% end %>
    """
  end
end
