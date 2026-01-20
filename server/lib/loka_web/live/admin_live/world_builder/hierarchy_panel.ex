defmodule LokaWeb.AdminLive.WorldBuilder.HierarchyPanel do
  @moduledoc """
  Left panel component showing entity hierarchy and templates.

  Displays:
  - Room hierarchy tree
  - Template library with search
  - Entity selection

  Supports collapse mode (icons-only 40px width).
  """
  use Phoenix.Component
  import LokaWeb.CoreComponents

  attr :rooms, :list, required: true
  attr :npcs, :list, default: []
  attr :items, :list, default: []
  attr :templates, :list, required: true
  attr :selected_room, :string, default: nil
  attr :selected_entity, :map, default: nil
  attr :template_search, :string, default: ""
  attr :active_tab, :atom, default: :rooms
  attr :collapsed, :boolean, default: false
  attr :class, :string, default: ""

  def hierarchy_panel(assigns) do
    # Filter entities based on search query
    search = String.downcase(assigns.template_search || "")

    filtered_rooms =
      if search == "" do
        assigns.rooms
      else
        Enum.filter(assigns.rooms, fn room ->
          String.contains?(String.downcase(room.name || ""), search) ||
            String.contains?(String.downcase(room.key || ""), search)
        end)
      end

    filtered_npcs =
      if search == "" do
        assigns.npcs
      else
        Enum.filter(assigns.npcs, fn npc ->
          name = npc[:name] || npc[:short_desc] || npc.key || ""

          String.contains?(String.downcase(name), search) ||
            String.contains?(String.downcase(npc.key || ""), search)
        end)
      end

    filtered_items =
      if search == "" do
        assigns.items
      else
        Enum.filter(assigns.items, fn item ->
          name = item[:name] || item[:short_desc] || item.key || ""

          String.contains?(String.downcase(name), search) ||
            String.contains?(String.downcase(item.key || ""), search)
        end)
      end

    filtered_templates =
      if search == "" do
        assigns.templates
      else
        Enum.filter(assigns.templates, fn template ->
          String.contains?(String.downcase(template.name || ""), search) ||
            String.contains?(String.downcase(template.template_key || ""), search) ||
            Enum.any?(template.tags || [], fn tag ->
              String.contains?(String.downcase(tag), search)
            end)
        end)
      end

    assigns =
      assigns
      |> assign(:filtered_rooms, filtered_rooms)
      |> assign(:filtered_npcs, filtered_npcs)
      |> assign(:filtered_items, filtered_items)
      |> assign(:filtered_templates, filtered_templates)

    ~H"""
    <div class={[
      "world-builder-panel world-builder-hierarchy",
      @collapsed && "panel-collapsed",
      @class
    ]}>
      <div class="panel-header">
        <h3 class="panel-title" style={if @collapsed, do: "display: none;", else: ""}>Library</h3>
        <button
          class="panel-collapse-btn"
          phx-click="toggle_panel"
          phx-value-panel="hierarchy"
          title={if @collapsed, do: "Expand (1)", else: "Collapse (1)"}
        >
          <.icon
            name={if @collapsed, do: "hero-chevron-right", else: "hero-chevron-left"}
            class="size-4"
          />
        </button>
      </div>

      <%= if @collapsed do %>
        <!-- Collapsed view: icons only -->
        <div class="panel-collapsed-content">
          <button
            class={["collapsed-icon-btn", @active_tab == :rooms && "active"]}
            phx-click="switch_hierarchy_tab"
            phx-value-tab="rooms"
            title="Rooms ({length(@rooms)})"
          >
            <.icon name="hero-cube" class="size-5" />
          </button>
          <button
            class={["collapsed-icon-btn", @active_tab == :npcs && "active"]}
            phx-click="switch_hierarchy_tab"
            phx-value-tab="npcs"
            title="NPCs ({length(@npcs)})"
          >
            <.icon name="hero-user" class="size-5" />
          </button>
          <button
            class={["collapsed-icon-btn", @active_tab == :items && "active"]}
            phx-click="switch_hierarchy_tab"
            phx-value-tab="items"
            title="Items ({length(@items)})"
          >
            <.icon name="hero-cube-transparent" class="size-5" />
          </button>
          <button
            class={["collapsed-icon-btn", @active_tab == :templates && "active"]}
            phx-click="switch_hierarchy_tab"
            phx-value-tab="templates"
            title="Templates ({length(@templates)})"
          >
            <.icon name="hero-document-duplicate" class="size-5" />
          </button>
        </div>
      <% else %>
        <!-- Expanded view: full content -->
        <!-- Tabs for Rooms, NPCs, Items, and Templates -->
        <div class="hierarchy-tabs">
          <button
            class={["hierarchy-tab", @active_tab == :rooms && "active"]}
            phx-click="switch_hierarchy_tab"
            phx-value-tab="rooms"
            title="Rooms"
          >
            <.icon name="hero-cube" class="size-3" />
            <span>{length(@rooms)}</span>
          </button>
          <button
            class={["hierarchy-tab", @active_tab == :npcs && "active"]}
            phx-click="switch_hierarchy_tab"
            phx-value-tab="npcs"
            title="NPCs"
          >
            <.icon name="hero-user" class="size-3" />
            <span>{length(@npcs)}</span>
          </button>
          <button
            class={["hierarchy-tab", @active_tab == :items && "active"]}
            phx-click="switch_hierarchy_tab"
            phx-value-tab="items"
            title="Items"
          >
            <.icon name="hero-cube-transparent" class="size-3" />
            <span>{length(@items)}</span>
          </button>
          <button
            class={["hierarchy-tab", @active_tab == :templates && "active"]}
            phx-click="switch_hierarchy_tab"
            phx-value-tab="templates"
            title="Templates"
          >
            <.icon name="hero-document-duplicate" class="size-3" />
            <span>{length(@templates)}</span>
          </button>
        </div>
        
    <!-- Search bar -->
        <form phx-change="search_entities" class="hierarchy-search">
          <.icon name="hero-magnifying-glass" class="size-3" />
          <input
            type="text"
            placeholder={search_placeholder(@active_tab)}
            phx-debounce="100"
            name="query"
            value={@template_search}
          />
        </form>

        <div class="panel-content">
          <!-- Room Hierarchy -->
          <div class="hierarchy-tree" style={if @active_tab != :rooms, do: "display: none;", else: ""}>
            <%= for room <- @filtered_rooms do %>
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
          
    <!-- NPC List -->
          <div class="hierarchy-tree" style={if @active_tab != :npcs, do: "display: none;", else: ""}>
            <%= if @filtered_npcs == [] do %>
              <p class="text-muted" style="padding: 1rem; color: #666;">
                {if @template_search != "",
                  do: "No matching NPCs.",
                  else: "No NPCs. Click + NPC in toolbar."}
              </p>
            <% else %>
              <%= for npc <- @filtered_npcs do %>
                <div
                  class={[
                    "hierarchy-item",
                    @selected_entity && @selected_entity.type == :npc &&
                      @selected_entity.key == npc.key && "hierarchy-item-selected"
                  ]}
                  phx-click="select_entity"
                  phx-value-type="npc"
                  phx-value-key={npc.key}
                >
                  <.icon name="hero-user" class="hierarchy-icon" />
                  <span>{npc[:name] || npc[:short_desc] || npc.key}</span>
                </div>
              <% end %>
            <% end %>
          </div>
          
    <!-- Item List -->
          <div class="hierarchy-tree" style={if @active_tab != :items, do: "display: none;", else: ""}>
            <%= if @filtered_items == [] do %>
              <p class="text-muted" style="padding: 1rem; color: #666;">
                {if @template_search != "",
                  do: "No matching items.",
                  else: "No items. Click + Item in toolbar."}
              </p>
            <% else %>
              <%= for item <- @filtered_items do %>
                <div
                  class={[
                    "hierarchy-item",
                    @selected_entity && @selected_entity.type == :item &&
                      @selected_entity.key == item.key && "hierarchy-item-selected"
                  ]}
                  phx-click="select_entity"
                  phx-value-type="item"
                  phx-value-key={item.key}
                >
                  <.icon name="hero-cube-transparent" class="hierarchy-icon" />
                  <span>{item[:name] || item[:short_desc] || item.key}</span>
                </div>
              <% end %>
            <% end %>
          </div>
          
    <!-- Template Library -->
          <div
            class="template-library"
            style={if @active_tab != :templates, do: "display: none;", else: ""}
          >
            <%= for template <- @filtered_templates do %>
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
      <% end %>
    </div>
    """
  end

  defp search_placeholder(:rooms), do: "Search rooms..."
  defp search_placeholder(:npcs), do: "Search NPCs..."
  defp search_placeholder(:items), do: "Search items..."
  defp search_placeholder(:templates), do: "Search templates..."
  defp search_placeholder(_), do: "Search..."
end
