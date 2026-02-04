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
  import LokaWeb.LoadingComponents, only: [empty_state: 1]

  attr :rooms, :list, required: true
  attr :npcs, :list, default: []
  attr :items, :list, default: []
  attr :templates, :list, required: true
  attr :scripts, :list, default: []
  attr :cutscenes, :list, default: []
  attr :zones, :list, default: []
  attr :selected_room, :string, default: nil
  attr :selected_entity, :map, default: nil
  attr :template_search, :string, default: ""
  attr :zone_filter, :string, default: nil
  attr :tag_filter, :string, default: nil
  attr :active_tab, :atom, default: :rooms
  attr :collapsed, :boolean, default: false
  attr :class, :string, default: ""

  def hierarchy_panel(assigns) do
    # Filter entities based on search query, zone, and tags
    search = String.downcase(assigns.template_search || "")
    zone_filter = assigns.zone_filter
    tag_filter = assigns.tag_filter

    filtered_rooms =
      assigns.rooms
      |> filter_by_text(search, fn room ->
        String.contains?(String.downcase(room.name || ""), search) ||
          String.contains?(String.downcase(room.key || ""), search)
      end)
      |> filter_by_zone(zone_filter)
      |> filter_by_tags(tag_filter)

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

    filtered_scripts =
      if search == "" do
        assigns.scripts
      else
        Enum.filter(assigns.scripts, fn script ->
          name = Map.get(script, :name) || script.key || ""

          String.contains?(String.downcase(name), search) ||
            String.contains?(String.downcase(script.key || ""), search)
        end)
      end

    filtered_cutscenes =
      if search == "" do
        assigns.cutscenes
      else
        Enum.filter(assigns.cutscenes, fn cutscene ->
          id = cutscene["id"] || ""
          String.contains?(String.downcase(id), search)
        end)
      end

    assigns =
      assigns
      |> assign(:filtered_rooms, filtered_rooms)
      |> assign(:filtered_npcs, filtered_npcs)
      |> assign(:filtered_items, filtered_items)
      |> assign(:filtered_templates, filtered_templates)
      |> assign(:filtered_scripts, filtered_scripts)
      |> assign(:filtered_cutscenes, filtered_cutscenes)

    ~H"""
    <div class={[
      "world-builder-panel world-builder-hierarchy",
      @collapsed && "panel-collapsed",
      @class
    ]}>
      <div class="panel-header">
        <h3 :if={!@collapsed} class="panel-title">Library</h3>
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
      
    <!-- Collapsed view: icons only (Templates first for discovery) -->
      <div :if={@collapsed} class="panel-collapsed-content">
        <button
          class={["collapsed-icon-btn", @active_tab == :templates && "active"]}
          phx-click="switch_hierarchy_tab"
          phx-value-tab="templates"
          title="Templates ({length(@templates)})"
        >
          <.icon name="hero-document-duplicate" class="size-5" />
        </button>
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
          class={["collapsed-icon-btn", @active_tab == :scripts && "active"]}
          phx-click="switch_hierarchy_tab"
          phx-value-tab="scripts"
          title="Scripts ({length(@scripts)})"
        >
          <.icon name="hero-code-bracket" class="size-5" />
        </button>
        <button
          class={["collapsed-icon-btn", @active_tab == :cutscenes && "active"]}
          phx-click="switch_hierarchy_tab"
          phx-value-tab="cutscenes"
          title="Cutscenes ({length(@cutscenes)})"
        >
          <.icon name="hero-film" class="size-5" />
        </button>
      </div>

      <div :if={!@collapsed} style="display: contents;">
        <!-- Expanded view: full content -->
        <div class="flex items-center gap-1 px-1.5 py-1 border-b border-wb-border shrink-0">
          <form phx-change="switch_hierarchy_tab" style="display: contents;">
            <select
              name="tab"
              class="flex-1 py-1 px-1.5 text-xs bg-wb-surface border border-wb-border rounded-wb-md text-wb-text cursor-pointer appearance-auto hover:border-wb-accent focus:outline-none focus:border-wb-accent"
            >
              <option value="templates" selected={@active_tab == :templates}>
                Templates ({length(@templates)})
              </option>
              <option value="rooms" selected={@active_tab == :rooms}>
                Rooms ({length(@rooms)})
              </option>
              <option value="npcs" selected={@active_tab == :npcs}>
                NPCs ({length(@npcs)})
              </option>
              <option value="items" selected={@active_tab == :items}>
                Items ({length(@items)})
              </option>
              <option value="scripts" selected={@active_tab == :scripts}>
                Scripts ({length(@scripts)})
              </option>
              <option value="cutscenes" selected={@active_tab == :cutscenes}>
                Cutscenes ({length(@cutscenes)})
              </option>
            </select>
          </form>
          <button
            class="btn-icon-small"
            phx-click={create_action(@active_tab)}
            title={"New #{tab_label(@active_tab)}"}
          >
            <.icon name="hero-plus" class="size-3" />
          </button>
        </div>

        <%!-- Search bar --%>
        <form
          phx-change="search_entities"
          class="flex flex-col px-2 py-1.5 bg-wb-panel border-b border-wb-bg"
        >
          <div class="flex gap-1 items-center">
            <.icon name="hero-magnifying-glass" class="size-3" />
            <input
              type="text"
              placeholder={search_placeholder(@active_tab)}
              phx-debounce="100"
              name="query"
              value={@template_search}
              class="flex-1 bg-wb-panel-alt border border-wb-border text-wb-text py-1 px-2 text-xs rounded-wb-sm focus:outline-none focus:border-wb-accent-hover"
            />
          </div>

          <div :if={@active_tab == :rooms and length(@zones) > 0} class="mt-1">
            <select
              name="zone_filter"
              class="w-full py-1 px-2 text-[11px] bg-wb-surface border border-wb-border rounded text-wb-text"
            >
              <option value="" selected={@zone_filter == nil or @zone_filter == ""}>
                All Zones
              </option>
              <%= for zone <- @zones do %>
                <option value={zone.key} selected={@zone_filter == zone.key}>
                  {zone.name || zone.key}
                </option>
              <% end %>
            </select>
          </div>

          <div :if={@active_tab in [:rooms, :templates]} class="mt-1">
            <input
              type="text"
              name="tag_filter"
              placeholder="Filter by tags..."
              phx-debounce="300"
              value={@tag_filter || ""}
              class="w-full py-1 px-2 text-[11px] bg-wb-surface border border-wb-border rounded text-wb-text"
            />
          </div>
        </form>

        <div class="panel-content">
          <%!-- Room Hierarchy --%>
          <div
            :if={@active_tab == :rooms}
            class="flex flex-col gap-px p-1"
          >
            <.empty_state
              :if={@filtered_rooms == []}
              icon="hero-map"
              title={if @template_search != "", do: "No matching rooms", else: "No rooms yet"}
              description={if @template_search == "", do: "Click + Room in toolbar to create one"}
              class="py-6"
            />
            <%= for room <- @filtered_rooms do %>
              <div
                class={hierarchy_item(@selected_room == room.key)}
                phx-click="select_room"
                phx-value-key={room.key}
              >
                <.icon name="hero-cube" class={hierarchy_icon(@selected_room == room.key)} />
                <span>{room.name}</span>
              </div>
            <% end %>
          </div>

          <%!-- NPC List --%>
          <div
            :if={@active_tab == :npcs}
            class="flex flex-col gap-px p-1"
          >
            <.empty_state
              :if={@filtered_npcs == []}
              icon="hero-user-group"
              title={if @template_search != "", do: "No matching NPCs", else: "No NPCs yet"}
              description={if @template_search == "", do: "Click + NPC in toolbar to create one"}
              class="py-6"
            />
            <%= for npc <- @filtered_npcs do %>
              <% selected =
                @selected_entity && @selected_entity.type == :npc && @selected_entity.key == npc.key %>
              <div
                class={hierarchy_item(selected)}
                phx-click="select_entity"
                phx-value-type="npc"
                phx-value-key={npc.key}
              >
                <.icon name="hero-user" class={hierarchy_icon(selected)} />
                <span>{npc[:name] || npc[:short_desc] || npc.key}</span>
              </div>
            <% end %>
          </div>

          <%!-- Item List --%>
          <div
            :if={@active_tab == :items}
            class="flex flex-col gap-px p-1"
          >
            <.empty_state
              :if={@filtered_items == []}
              icon="hero-cube-transparent"
              title={if @template_search != "", do: "No matching items", else: "No items yet"}
              description={if @template_search == "", do: "Click + Item in toolbar to create one"}
              class="py-6"
            />
            <%= for item <- @filtered_items do %>
              <% selected =
                @selected_entity && @selected_entity.type == :item &&
                  @selected_entity.key == item.key %>
              <div
                class={hierarchy_item(selected)}
                phx-click="select_entity"
                phx-value-type="item"
                phx-value-key={item.key}
              >
                <.icon name="hero-cube-transparent" class={hierarchy_icon(selected)} />
                <span>{item[:name] || item[:short_desc] || item.key}</span>
              </div>
            <% end %>
          </div>

          <%!-- Script List --%>
          <div
            :if={@active_tab == :scripts}
            class="flex flex-col gap-px p-1"
          >
            <.empty_state
              :if={@filtered_scripts == []}
              icon="hero-code-bracket"
              title={if @template_search != "", do: "No matching scripts", else: "No scripts yet"}
              description="Click + to create one"
              class="py-6"
            />
            <%= for script <- @filtered_scripts do %>
              <% selected =
                @selected_entity && @selected_entity.type == :script &&
                  @selected_entity.key == script.key %>
              <div
                class={hierarchy_item(selected)}
                phx-click="show_script_editor"
                phx-value-key={script.key}
              >
                <.icon name="hero-code-bracket" class={hierarchy_icon(selected)} />
                <span>{Map.get(script, :name) || script.key}</span>
              </div>
            <% end %>
          </div>

          <%!-- Cutscene List --%>
          <div
            :if={@active_tab == :cutscenes}
            class="flex flex-col gap-px p-1"
          >
            <.empty_state
              :if={@filtered_cutscenes == []}
              icon="hero-film"
              title={if @template_search != "", do: "No matching cutscenes", else: "No cutscenes yet"}
              description="Click + to create one"
              class="py-6"
            />
            <%= for cutscene <- @filtered_cutscenes do %>
              <div
                class={hierarchy_item(false)}
                phx-click="show_cutscene_editor"
                phx-value-id={cutscene["id"]}
              >
                <.icon name="hero-film" class={hierarchy_icon(false)} />
                <span>{cutscene["id"]}</span>
              </div>
            <% end %>
          </div>

          <%!-- Template Library --%>
          <div
            :if={@active_tab == :templates}
            class="flex flex-col gap-2 p-2"
          >
            <%= for template <- @filtered_templates do %>
              <div class="flex items-start gap-2 px-2 py-2.5 bg-wb-input border border-wb-border rounded-wb-md transition-all duration-100 hover:bg-wb-hover hover:border-wb-border-light">
                <div class="text-wb-accent shrink-0 w-5 h-5 flex items-center justify-center mt-px">
                  <.icon name="hero-document-duplicate" class="size-4" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-wb-base font-semibold text-wb-text mb-1 whitespace-nowrap overflow-hidden text-ellipsis">
                    {template.name}
                  </div>
                  <div class="flex flex-wrap gap-1">
                    <%= for tag <- template.tags do %>
                      <span class="text-[0.65rem] px-1 py-0.5 bg-wb-border text-wb-text-muted rounded-sm">
                        {tag}
                      </span>
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
    </div>
    """
  end

  @hierarchy_item_base "flex items-center gap-[0.4rem] py-1 px-2 cursor-pointer rounded-wb-sm transition-[background] duration-100 text-[0.8rem]"
  @hierarchy_item_default "#{@hierarchy_item_base} text-wb-text hover:bg-wb-border"
  @hierarchy_item_selected "#{@hierarchy_item_base} !bg-wb-accent-hover text-white"

  defp hierarchy_item(selected) do
    if selected, do: @hierarchy_item_selected, else: @hierarchy_item_default
  end

  defp hierarchy_icon(selected) do
    if selected, do: "size-4 opacity-100", else: "size-4 opacity-70"
  end

  defp create_action(:rooms), do: "create_room"
  defp create_action(:npcs), do: "show_npc_editor"
  defp create_action(:items), do: "show_item_editor"
  defp create_action(:templates), do: "create_from_template"
  defp create_action(:scripts), do: "show_script_editor"
  defp create_action(:cutscenes), do: "show_cutscene_editor"
  defp create_action(_), do: "create_room"

  defp tab_label(:rooms), do: "Room"
  defp tab_label(:npcs), do: "NPC"
  defp tab_label(:items), do: "Item"
  defp tab_label(:templates), do: "Template"
  defp tab_label(:scripts), do: "Script"
  defp tab_label(:cutscenes), do: "Cutscene"
  defp tab_label(_), do: "Entity"

  defp search_placeholder(:rooms), do: "Search rooms..."
  defp search_placeholder(:npcs), do: "Search NPCs..."
  defp search_placeholder(:items), do: "Search items..."
  defp search_placeholder(:templates), do: "Search templates..."
  defp search_placeholder(:scripts), do: "Search scripts..."
  defp search_placeholder(:cutscenes), do: "Search cutscenes..."
  defp search_placeholder(_), do: "Search..."

  # Filter helpers
  defp filter_by_text(list, "", _filter_fn), do: list

  defp filter_by_text(list, _search, filter_fn) do
    Enum.filter(list, filter_fn)
  end

  defp filter_by_zone(rooms, nil), do: rooms
  defp filter_by_zone(rooms, ""), do: rooms

  defp filter_by_zone(rooms, zone) do
    Enum.filter(rooms, fn room ->
      room_zone = room[:zone] || room.zone
      room_zone == zone
    end)
  end

  defp filter_by_tags(entities, nil), do: entities
  defp filter_by_tags(entities, ""), do: entities

  defp filter_by_tags(entities, tag_filter) do
    tags =
      tag_filter
      |> String.split(",")
      |> Enum.map(&String.trim/1)
      |> Enum.reject(&(&1 == ""))

    if tags == [] do
      entities
    else
      Enum.filter(entities, fn entity ->
        entity_tags = entity[:tags] || entity.tags || []
        Enum.any?(tags, fn t -> t in entity_tags end)
      end)
    end
  end
end
