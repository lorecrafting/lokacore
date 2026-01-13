defmodule LokaWeb.AdminLive.WorldBuilder.HierarchyPanel do
  @moduledoc """
  Left panel component showing entity hierarchy and templates.

  Displays:
  - Room hierarchy tree
  - Template library with search
  - Entity selection
  """
  use Phoenix.Component
  import LokaWeb.CoreComponents

  attr :rooms, :list, required: true
  attr :templates, :list, required: true
  attr :selected_room, :string, default: nil
  attr :template_search, :string, default: ""
  attr :active_tab, :atom, default: :rooms
  attr :class, :string, default: ""

  def hierarchy_panel(assigns) do
    ~H"""
    <div class={"world-builder-panel world-builder-hierarchy #{@class}"}>
      <div class="panel-header">
        <h3 class="panel-title">Library</h3>
      </div>
      
    <!-- Tabs for Rooms and Templates -->
      <div class="hierarchy-tabs">
        <button
          class={["hierarchy-tab", @active_tab == :rooms && "active"]}
          phx-click="switch_hierarchy_tab"
          phx-value-tab="rooms"
        >
          Rooms ({length(@rooms)})
        </button>
        <button
          class={["hierarchy-tab", @active_tab == :templates && "active"]}
          phx-click="switch_hierarchy_tab"
          phx-value-tab="templates"
        >
          Templates ({length(@templates)})
        </button>
      </div>
      
    <!-- Search bar -->
      <div class="hierarchy-search">
        <.icon name="hero-magnifying-glass" class="size-3" style="color: #606060;" />
        <input
          type="text"
          placeholder="Search templates..."
          phx-change="search_templates"
          name="query"
          value={@template_search}
        />
      </div>

      <div class="panel-content">
        <!-- Room Hierarchy -->
        <div class="hierarchy-tree" style={if @active_tab != :rooms, do: "display: none;", else: ""}>
          <%= for room <- @rooms do %>
            <div
              class={[
                "hierarchy-item",
                @selected_room == room.key && "hierarchy-item-selected"
              ]}
              phx-click="select_room"
              phx-value-key={room.key}
            >
              <.icon name="hero-cube" class="hierarchy-icon" />
              <span>{room.name}</span>
            </div>
          <% end %>
        </div>
        
    <!-- Template Library -->
        <div
          class="template-library"
          style={if @active_tab != :templates, do: "display: none;", else: ""}
        >
          <%= for template <- @templates do %>
            <div class="template-item">
              <div class="template-icon">
                <.icon name="hero-document-duplicate" class="size-5" />
              </div>
              <div class="template-info">
                <div class="template-name">{template.name}</div>
                <div class="template-tags">
                  <%= for tag <- template.tags do %>
                    <span class="template-tag">{tag}</span>
                  <% end %>
                </div>
              </div>
              <button
                class="btn-icon-small"
                phx-click="create_from_template"
                phx-value-template_key={template.template_key}
                phx-value-x="0"
                phx-value-y="0"
                phx-value-z="0"
                title="Create from template"
              >
                <.icon name="hero-plus" class="size-3" />
              </button>
            </div>
          <% end %>
        </div>
      </div>
    </div>
    """
  end
end
