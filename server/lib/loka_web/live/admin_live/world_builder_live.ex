defmodule LokaWeb.AdminLive.WorldBuilderLive do
  @moduledoc """
  World Builder LiveView - Unity-style 3D world editor

  Provides a hybrid LiveView + React Three Fiber architecture for building game worlds:
  - LiveView shell handles auth, real-time updates, and validation
  - React Three Fiber handles 3D visualization in the viewport
  - Unity-style 4-panel docking layout (Hierarchy | Viewport | Inspector | Console)

  ## Architecture

  - LiveView: Auth, persistence, validation, real-time sync
  - React: 3D rendering, camera controls, scene manipulation
  - TypedObject: Universal data layer for rooms, NPCs, items, etc.

  See docs/architecture/world-builder-master-plan.md for full design.
  """
  use LokaWeb, :live_view
  require Logger

  alias Loka.WorldBuilder.{
    RoomManager,
    TemplateManager,
    EntityManager,
    QuestManager,
    CutsceneManager,
    LayoutManager,
    ValidationManager,
    ToolExecutor,
    ScriptManager
  }

  alias Loka.Testing.Content.DialogueQuestChainValidator

  alias LokaWeb.AdminLive.WorldBuilder.{
    Toolbar,
    HierarchyPanel,
    ViewportContainer,
    InspectorPanel,
    ConsolePanel,
    ChatPanel,
    InputValidator,
    SettingsModal,
    DialogueEditor,
    ScriptEditor
  }

  # Valid layout algorithms - prevents atom exhaustion attacks
  @valid_algorithms ~w(force_directed circular grid hierarchical)a

  # Allowed fields for mass assignment protection
  @allowed_room_fields ~w(key name description x y z zone tags attributes parent_key)
  @allowed_npc_fields ~w(key name description level attributes tags parent_key)
  @allowed_item_fields ~w(key name description item_type attributes tags parent_key)
  @allowed_quest_fields ~w(key name description quest_type giver_key objectives rewards prerequisites level_range journal_entries tags)
  @allowed_cutscene_fields ~w(id trigger sequence effects)

  @impl true
  def mount(_params, _session, socket) do
    # Load entities from managers
    rooms = RoomManager.list_rooms()
    templates = TemplateManager.list_templates()
    npcs = EntityManager.list_entities(:npc)
    items = EntityManager.list_entities(:item)
    quests = QuestManager.list_quests()
    cutscenes = CutsceneManager.list_cutscenes()

    # Run validation on rooms
    validation = ValidationManager.validation_summary(rooms)

    {:ok,
     socket
     |> assign(:rooms, rooms)
     |> assign(:selected_room, nil)
     |> assign(:selected_keys, [])
     |> assign(:templates, templates)
     |> assign(:template_search, "")
     |> assign(:active_tab, :rooms)
     |> assign(:npcs, npcs)
     |> assign(:items, items)
     |> assign(:quests, quests)
     |> assign(:cutscenes, cutscenes)
     |> assign(:show_npc_editor, false)
     |> assign(:show_item_editor, false)
     |> assign(:show_quest_editor, false)
     |> assign(:show_cutscene_editor, false)
     |> assign(:show_dialogue_editor, false)
     |> assign(:show_script_editor, false)
     |> assign(:editing_script, nil)
     |> assign(:editing_dialogue_npc, nil)
     |> assign(:editing_dialogue_tree, %{})
     |> assign(:dialogue_selected_node, nil)
     |> assign(:dialogue_preview_mode, false)
     |> assign(:console_messages, [])
     |> assign(:show_create_modal, false)
     |> assign(:validation, validation)
     |> assign(:show_settings, false)
     |> assign(:api_key_status, :unconfigured)
     |> assign(:selected_model, "claude-opus-4-5-20251101")
     |> assign(:collapsed_panels, %{
       hierarchy: false,
       inspector: false,
       console: false,
       chat: false
     })
     |> assign(:undo_state, %{can_undo: false, can_redo: false, undo_count: 0, redo_count: 0})
     |> push_event("init_world_builder", %{rooms: rooms, validation: validation.results})}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <div class="world-builder" phx-window-keydown="keyboard_shortcut">
      <Toolbar.toolbar undo_state={@undo_state} />
      
    <!-- Main 4-panel layout -->
      <div class={panel_container_classes(@collapsed_panels)}>
        <HierarchyPanel.hierarchy_panel
          rooms={@rooms}
          templates={@templates}
          selected_room={@selected_room}
          template_search={@template_search}
          active_tab={@active_tab}
          collapsed={@collapsed_panels.hierarchy}
        />

        <ViewportContainer.viewport_container rooms={@rooms} selected_room={@selected_room} />

        <InspectorPanel.inspector_panel
          rooms={@rooms}
          selected_room={@selected_room}
          selected_keys={@selected_keys}
          collapsed={@collapsed_panels.inspector}
        />

        <ConsolePanel.console_panel
          console_messages={@console_messages}
          collapsed={@collapsed_panels.console}
        />

        <ChatPanel.chat_panel
          rooms={@rooms}
          selected_room={@selected_room}
          validation={@validation}
          collapsed={@collapsed_panels.chat}
        />
      </div>

      <%= if @show_create_modal do %>
        <div class="modal-overlay" phx-click="close_create_modal">
          <div class="modal-content" phx-click-away="close_create_modal">
            <div class="modal-header">
              <h3>Create New Room</h3>
              <button phx-click="close_create_modal" class="modal-close">&times;</button>
            </div>
            <form phx-submit="submit_create_room">
              <div class="form-group">
                <label>Room Key</label>
                <input
                  type="text"
                  name="key"
                  class="input"
                  placeholder="e.g., tavern_main"
                  required
                />
                <small>Unique identifier (no spaces)</small>
              </div>

              <div class="form-group">
                <label>Room Name</label>
                <input type="text" name="name" class="input" placeholder="e.g., Main Tavern" required />
              </div>

              <div class="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  class="textarea"
                  rows="3"
                  placeholder="Describe the room..."
                ></textarea>
              </div>

              <div class="form-group">
                <label>Coordinates</label>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem;">
                  <input type="number" name="x" class="input" placeholder="X" value="0" />
                  <input type="number" name="y" class="input" placeholder="Y" value="0" />
                  <input type="number" name="z" class="input" placeholder="Z" value="0" />
                </div>
              </div>

              <div class="modal-footer">
                <button type="button" phx-click="close_create_modal" class="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" class="btn btn-primary">Create Room</button>
              </div>
            </form>
          </div>
        </div>
      <% end %>

      <%!-- NPC Editor Modal --%>
      <%= if @show_npc_editor do %>
        <div class="modal-overlay" phx-click="close_npc_editor">
          <div class="modal-content" phx-click-away="close_npc_editor">
            <div class="modal-header">
              <h3>Create New NPC</h3>
              <button phx-click="close_npc_editor" class="modal-close">&times;</button>
            </div>
            <form phx-submit="create_npc">
              <div class="form-group">
                <label>NPC Key</label>
                <input
                  type="text"
                  name="key"
                  class="input"
                  placeholder="e.g., guard_captain"
                  required
                />
                <small>Unique identifier (no spaces)</small>
              </div>

              <div class="form-group">
                <label>NPC Name</label>
                <input
                  type="text"
                  name="name"
                  class="input"
                  placeholder="e.g., Captain Reeves"
                  required
                />
              </div>

              <div class="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  class="textarea"
                  rows="3"
                  placeholder="Describe the NPC..."
                ></textarea>
              </div>

              <div class="form-group">
                <label>Level</label>
                <input type="number" name="level" class="input" value="1" min="1" />
              </div>

              <div class="modal-footer">
                <button type="button" phx-click="close_npc_editor" class="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" class="btn btn-primary">Create NPC</button>
              </div>
            </form>
          </div>
        </div>
      <% end %>

      <%!-- Item Editor Modal --%>
      <%= if @show_item_editor do %>
        <div class="modal-overlay" phx-click="close_item_editor">
          <div class="modal-content" phx-click-away="close_item_editor">
            <div class="modal-header">
              <h3>Create New Item</h3>
              <button phx-click="close_item_editor" class="modal-close">&times;</button>
            </div>
            <form phx-submit="create_item">
              <div class="form-group">
                <label>Item Key</label>
                <input
                  type="text"
                  name="key"
                  class="input"
                  placeholder="e.g., iron_sword"
                  required
                />
                <small>Unique identifier (no spaces)</small>
              </div>

              <div class="form-group">
                <label>Item Name</label>
                <input type="text" name="name" class="input" placeholder="e.g., Iron Sword" required />
              </div>

              <div class="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  class="textarea"
                  rows="3"
                  placeholder="Describe the item..."
                ></textarea>
              </div>

              <div class="form-group">
                <label>Item Type</label>
                <select name="item_type" class="input">
                  <option value="misc">Miscellaneous</option>
                  <option value="weapon">Weapon</option>
                  <option value="armor">Armor</option>
                  <option value="consumable">Consumable</option>
                  <option value="quest_item">Quest Item</option>
                </select>
              </div>

              <div class="modal-footer">
                <button type="button" phx-click="close_item_editor" class="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" class="btn btn-primary">Create Item</button>
              </div>
            </form>
          </div>
        </div>
      <% end %>

      <%!-- Quest Editor Modal --%>
      <%= if @show_quest_editor do %>
        <div class="modal-overlay" phx-click="close_quest_editor">
          <div
            class="modal-content modal-fullscreen"
            phx-click-away="close_quest_editor"
            style="width: 95vw; height: 90vh; max-width: none;"
          >
            <div class="modal-header">
              <h3>Quest Editor</h3>
              <button phx-click="close_quest_editor" class="modal-close">&times;</button>
            </div>
            <div
              id="quest-editor-root"
              phx-hook="QuestEditor"
              style="flex: 1; overflow: hidden;"
              data-on-save="create_quest"
              data-on-cancel="close_quest_editor"
            >
            </div>
          </div>
        </div>
      <% end %>

      <%!-- Cutscene Editor Modal --%>
      <%= if @show_cutscene_editor do %>
        <div class="modal-overlay" phx-click="close_cutscene_editor">
          <div
            class="modal-content modal-fullscreen"
            phx-click-away="close_cutscene_editor"
            style="width: 95vw; height: 90vh; max-width: none;"
          >
            <div class="modal-header">
              <h3>Cutscene Timeline Editor</h3>
              <button phx-click="close_cutscene_editor" class="modal-close">&times;</button>
            </div>
            <div
              id="cutscene-editor-root"
              phx-hook="CutsceneEditor"
              style="flex: 1; overflow: hidden;"
              data-on-save="create_cutscene"
              data-on-cancel="close_cutscene_editor"
            >
            </div>
          </div>
        </div>
      <% end %>

      <%!-- Dialogue Editor Modal --%>
      <%= if @show_dialogue_editor do %>
        <div class="modal-overlay" phx-click="close_dialogue_editor">
          <div
            class="modal-content modal-fullscreen"
            phx-click-away="close_dialogue_editor"
            style="width: 95vw; height: 90vh; max-width: none;"
          >
            <div class="modal-header">
              <h3>Dialogue Tree Editor</h3>
              <button phx-click="close_dialogue_editor" class="modal-close">&times;</button>
            </div>
            <div style="flex: 1; overflow: hidden;">
              <DialogueEditor.dialogue_editor
                dialogue_tree={@editing_dialogue_tree}
                npc_key={@editing_dialogue_npc}
                selected_node={@dialogue_selected_node}
                show_preview={@dialogue_preview_mode}
              />
            </div>
          </div>
        </div>
      <% end %>

      <%!-- Script Editor Modal --%>
      <%= if @show_script_editor do %>
        <ScriptEditor.script_editor script={@editing_script} />
      <% end %>

      <%!-- Settings Modal --%>
      <SettingsModal.settings_modal
        show={@show_settings}
        api_key_status={@api_key_status}
        selected_model={@selected_model}
      />
    </div>
    """
  end

  # =============================================================================
  # Event Handlers
  # =============================================================================

  @impl true
  def handle_event("show_settings", _params, socket) do
    {:noreply, assign(socket, :show_settings, true)}
  end

  @impl true
  def handle_event("close_settings", _params, socket) do
    {:noreply, assign(socket, :show_settings, false)}
  end

  @impl true
  def handle_event("api_key_validated", %{"status" => status}, socket) do
    status_atom =
      case status do
        "valid" -> :valid
        "invalid" -> :invalid
        "validating" -> :validating
        _ -> :unconfigured
      end

    {:noreply, assign(socket, :api_key_status, status_atom)}
  end

  @impl true
  def handle_event("change_model", %{"value" => model}, socket) do
    {:noreply, assign(socket, :selected_model, model)}
  end

  # Panel collapse toggle
  @impl true
  def handle_event("toggle_panel", %{"panel" => panel}, socket) do
    panel_atom = String.to_existing_atom(panel)

    if panel_atom in [:hierarchy, :inspector, :console, :chat] do
      collapsed = socket.assigns.collapsed_panels
      new_collapsed = Map.update!(collapsed, panel_atom, &(!&1))

      {:noreply,
       socket
       |> assign(:collapsed_panels, new_collapsed)
       |> push_event("panel_collapsed", %{panels: new_collapsed})}
    else
      {:noreply, socket}
    end
  end

  # Keyboard shortcuts for panel toggle (1, 2, 3, 4)
  @impl true
  def handle_event("keyboard_shortcut", %{"key" => key}, socket) do
    # Only handle 1, 2, 3, 4 keys for panel toggle
    # Ignore if user is in an input field (handled by JS)
    panel =
      case key do
        "1" -> :hierarchy
        "2" -> :inspector
        "3" -> :console
        "4" -> :chat
        _ -> nil
      end

    if panel do
      collapsed = socket.assigns.collapsed_panels
      new_collapsed = Map.update!(collapsed, panel, &(!&1))

      {:noreply,
       socket
       |> assign(:collapsed_panels, new_collapsed)
       |> push_event("panel_collapsed", %{panels: new_collapsed})}
    else
      {:noreply, socket}
    end
  end

  @impl true
  def handle_event("select_room", %{"key" => key}, socket) do
    {:noreply,
     socket
     |> assign(:selected_room, key)
     |> assign(:selected_keys, [])
     |> log_console(:info, "Selected room: #{key}")
     |> push_event("select_room", %{key: key})}
  end

  def handle_event("switch_hierarchy_tab", %{"tab" => tab}, socket) do
    tab_atom = String.to_existing_atom(tab)
    {:noreply, assign(socket, :active_tab, tab_atom)}
  end

  def handle_event("batch_select", %{"keys" => keys}, socket) do
    {:noreply, assign(socket, :selected_keys, keys)}
  end

  def handle_event("create_room", _params, socket) do
    {:noreply, assign(socket, :show_create_modal, true)}
  end

  def handle_event("close_create_modal", _params, socket) do
    {:noreply, assign(socket, :show_create_modal, false)}
  end

  def handle_event("submit_create_room", params, socket) do
    # Validate user input before processing
    case InputValidator.validate_room_attrs(params) do
      {:ok, _} ->
        attrs = %{
          key: params["key"],
          name: params["name"],
          description: params["description"] || "",
          x: parse_integer(params["x"], 0),
          y: parse_integer(params["y"], 0),
          z: parse_integer(params["z"], 0)
        }

        case RoomManager.create_room(attrs) do
          {:ok, room} ->
            {:noreply,
             socket
             |> assign(:show_create_modal, false)
             |> assign(:rooms, RoomManager.list_rooms())
             |> log_console(:info, "Created room: #{room.key}")
             |> push_event("room_created", %{room: room})
             |> push_event("record_operation", %{
               type: "create_room",
               beforeState: nil,
               afterState: Map.from_struct(room),
               metadata: %{key: room.key, entity_type: :room}
             })}

          {:error, reason} ->
            {:noreply, log_console(socket, :error, "Failed to create room: #{reason}")}
        end

      {:error, errors} ->
        error_msg = "Validation failed: #{Enum.join(errors, ", ")}"
        {:noreply, log_console(socket, :error, error_msg)}
    end
  end

  def handle_event("update_room_field", params, socket) do
    room_id = params["id"]
    updates = Map.drop(params, ["id", "_target"])

    # Validate fields if present
    validation_result =
      cond do
        Map.has_key?(updates, "key") ->
          InputValidator.validate_key(updates["key"])

        Map.has_key?(updates, "name") ->
          InputValidator.validate_name(updates["name"])

        Map.has_key?(updates, "description") ->
          InputValidator.validate_description(updates["description"])

        true ->
          {:ok, nil}
      end

    case validation_result do
      {:ok, _} ->
        # Convert string numbers to integers for coordinates
        updates =
          updates
          |> Map.update("x", nil, fn v ->
            if v, do: parse_integer(v, 0), else: nil
          end)
          |> Map.update("y", nil, fn v ->
            if v, do: parse_integer(v, 0), else: nil
          end)
          |> Map.update("z", nil, fn v ->
            if v, do: parse_integer(v, 0), else: nil
          end)
          |> Enum.reject(fn {_k, v} -> is_nil(v) end)
          |> Map.new()

        case RoomManager.update_room(room_id, updates) do
          {:ok, room} ->
            {:noreply,
             socket
             |> assign(:rooms, RoomManager.list_rooms())
             |> log_console(:info, "Updated #{room.key}")
             |> push_event("room_updated", %{room: room})}

          {:error, reason} ->
            {:noreply,
             log_console(
               socket,
               :error,
               "Update failed: #{sanitize_error(reason, "update_room_field")}"
             )}
        end

      {:error, msg} ->
        {:noreply, log_console(socket, :error, "Validation failed: #{msg}")}
    end
  end

  def handle_event("update_room", %{"id" => room_id} = params, socket) do
    # Whitelist allowed fields to prevent mass assignment attacks
    updates =
      params
      |> Map.drop(["id"])
      |> Map.take(@allowed_room_fields)

    case RoomManager.update_room(room_id, updates) do
      {:ok, room} ->
        {:noreply,
         socket
         |> assign(:rooms, RoomManager.list_rooms())
         |> log_console(:info, "Updated room: #{room.key}")
         |> push_event("room_updated", %{room: room})}

      {:error, reason} ->
        {:noreply,
         log_console(
           socket,
           :error,
           "Failed to update room: #{sanitize_error(reason, "update_room")}"
         )}
    end
  end

  def handle_event("delete_room", %{"id" => room_id}, socket) do
    # Get room before deletion for undo
    room_before = Enum.find(socket.assigns.rooms, fn r -> r.key == room_id || r.id == room_id end)

    case RoomManager.delete_room(room_id) do
      :ok ->
        {:noreply,
         socket
         |> assign(:rooms, RoomManager.list_rooms())
         |> assign(:selected_room, nil)
         |> log_console(:info, "Deleted room: #{room_id}")
         |> push_event("room_deleted", %{id: room_id})
         |> push_event("record_operation", %{
           type: "delete_room",
           beforeState: room_before && Map.from_struct(room_before),
           afterState: nil,
           metadata: %{key: room_id, entity_type: :room}
         })}

      {:error, reason} ->
        {:noreply,
         log_console(socket, :error, "Failed to delete room: #{sanitize_error(reason, "")}")}
    end
  end

  def handle_event(
        "add_exit",
        %{"from" => from_key, "direction" => direction, "to" => to_key},
        socket
      ) do
    case RoomManager.add_exit(from_key, direction, to_key) do
      {:ok, _room} ->
        {:noreply,
         socket
         |> assign(:rooms, RoomManager.list_rooms())
         |> log_console(:info, "Added exit: #{from_key} → #{direction} → #{to_key}")}

      {:error, reason} ->
        {:noreply,
         log_console(socket, :error, "Failed to add exit: #{sanitize_error(reason, "")}")}
    end
  end

  def handle_event("remove_exit", %{"from" => from_key, "direction" => direction}, socket) do
    case RoomManager.remove_exit(from_key, direction) do
      {:ok, _room} ->
        {:noreply,
         socket
         |> assign(:rooms, RoomManager.list_rooms())
         |> log_console(:info, "Removed exit: #{from_key} → #{direction}")}

      {:error, reason} ->
        {:noreply,
         log_console(socket, :error, "Failed to remove exit: #{sanitize_error(reason, "")}")}
    end
  end

  def handle_event("batch_move", %{"dx" => dx, "dy" => dy, "dz" => dz}, socket) do
    keys = socket.assigns.selected_keys
    offset = %{dx: parse_integer(dx, 0), dy: parse_integer(dy, 0), dz: parse_integer(dz, 0)}

    case Loka.WorldBuilder.BatchOperations.batch_move(keys, offset) do
      {:ok, _rooms} ->
        {:noreply,
         socket
         |> assign(:rooms, RoomManager.list_rooms())
         |> log_console(:info, "Moved #{length(keys)} rooms by offset (#{dx}, #{dy}, #{dz})")}

      {:error, reason} ->
        {:noreply,
         log_console(socket, :error, "Batch move failed: #{sanitize_error(reason, "")}")}
    end
  end

  def handle_event("batch_delete", _params, socket) do
    keys = socket.assigns.selected_keys

    case Loka.WorldBuilder.BatchOperations.batch_delete(keys) do
      :ok ->
        {:noreply,
         socket
         |> assign(:rooms, RoomManager.list_rooms())
         |> assign(:selected_keys, [])
         |> log_console(:info, "Deleted #{length(keys)} rooms")}

      {:error, reason} ->
        {:noreply,
         log_console(socket, :error, "Batch delete failed: #{sanitize_error(reason, "")}")}
    end
  end

  def handle_event("batch_clone", params, socket) do
    keys = socket.assigns.selected_keys
    dx = parse_integer(Map.get(params, "dx"), 5)
    dy = parse_integer(Map.get(params, "dy"), 5)
    dz = parse_integer(Map.get(params, "dz"), 0)
    offset = %{dx: dx, dy: dy, dz: dz}

    case Loka.WorldBuilder.BatchOperations.batch_clone(keys, offset) do
      {:ok, _new_rooms} ->
        {:noreply,
         socket
         |> assign(:rooms, RoomManager.list_rooms())
         |> log_console(:info, "Cloned #{length(keys)} rooms with offset (#{dx}, #{dy}, #{dz})")}

      {:error, reason} ->
        {:noreply,
         log_console(socket, :error, "Batch clone failed: #{sanitize_error(reason, "")}")}
    end
  end

  def handle_event(
        "save_as_template",
        %{"template_key" => template_key, "room_id" => room_id} = params,
        socket
      ) do
    metadata = %{
      name: Map.get(params, "template_name", "Custom Template"),
      description: Map.get(params, "description", ""),
      tags:
        String.split(Map.get(params, "tags", ""), ",")
        |> Enum.map(&String.trim/1)
        |> Enum.reject(&(&1 == ""))
    }

    case TemplateManager.save_as_template(room_id, template_key, metadata) do
      {:ok, _path} ->
        {:noreply,
         socket
         |> assign(:templates, TemplateManager.list_templates())
         |> log_console(:info, "Saved template: #{template_key}")}

      {:error, reason} ->
        {:noreply,
         log_console(socket, :error, "Failed to save template: #{sanitize_error(reason, "")}")}
    end
  end

  def handle_event("create_from_template", %{"template_key" => template_key} = params, socket) do
    # Validate template_key
    case InputValidator.validate_key(template_key) do
      {:ok, _} ->
        x = parse_integer(Map.get(params, "x"), 0)
        y = parse_integer(Map.get(params, "y"), 0)
        z = parse_integer(Map.get(params, "z"), 0)
        overrides = %{x: x, y: y, z: z}

        case TemplateManager.create_from_template(template_key, overrides) do
          {:ok, room} ->
            {:noreply,
             socket
             |> assign(:rooms, RoomManager.list_rooms())
             |> assign(:selected_room, room.key)
             |> log_console(:info, "Created room from template: #{template_key}")
             |> push_event("room_created", %{room: room})}

          {:error, reason} ->
            {:noreply,
             log_console(
               socket,
               :error,
               "Failed to create from template: #{sanitize_error(reason, "")}"
             )}
        end

      {:error, msg} ->
        {:noreply, log_console(socket, :error, "Invalid template key: #{msg}")}
    end
  end

  def handle_event("search_templates", %{"query" => query}, socket) do
    templates =
      if query == "" do
        TemplateManager.list_templates()
      else
        TemplateManager.search(query)
      end

    {:noreply, assign(socket, :templates, templates) |> assign(:template_search, query)}
  end

  # NPC & Item Management (using EntityManager)
  def handle_event("create_npc", params, socket) do
    # Validate key and name
    with {:ok, _} <- InputValidator.validate_key(params["key"] || ""),
         {:ok, _} <- InputValidator.validate_name(params["name"] || ""),
         {:ok, _} <- InputValidator.validate_description(params["description"]) do
      attrs = %{
        key: params["key"],
        name: params["name"],
        description: params["description"] || "",
        level: parse_integer(params["level"], 1)
      }

      case EntityManager.create_entity(:npc, attrs) do
        {:ok, npc} ->
          {:noreply,
           socket
           |> assign(:npcs, EntityManager.list_entities(:npc))
           |> assign(:show_npc_editor, false)
           |> log_console(:info, "Created NPC: #{npc.name}")}

        {:error, reason} ->
          {:noreply,
           log_console(socket, :error, "Failed to create NPC: #{sanitize_error(reason, "")}")}
      end
    else
      {:error, msg} ->
        {:noreply, log_console(socket, :error, "Validation failed: #{msg}")}
    end
  end

  def handle_event("create_item", params, socket) do
    # Validate key and name
    with {:ok, _} <- InputValidator.validate_key(params["key"] || ""),
         {:ok, _} <- InputValidator.validate_name(params["name"] || ""),
         {:ok, _} <- InputValidator.validate_description(params["description"]) do
      attrs = %{
        key: params["key"],
        name: params["name"],
        description: params["description"] || "",
        item_type: params["item_type"] || "misc"
      }

      case EntityManager.create_entity(:item, attrs) do
        {:ok, item} ->
          {:noreply,
           socket
           |> assign(:items, EntityManager.list_entities(:item))
           |> assign(:show_item_editor, false)
           |> log_console(:info, "Created Item: #{item.name}")}

        {:error, reason} ->
          {:noreply,
           log_console(socket, :error, "Failed to create item: #{sanitize_error(reason, "")}")}
      end
    else
      {:error, msg} ->
        {:noreply, log_console(socket, :error, "Validation failed: #{msg}")}
    end
  end

  def handle_event("delete_npc", %{"id" => npc_id}, socket) do
    case EntityManager.delete_entity(npc_id) do
      :ok ->
        {:noreply,
         socket
         |> assign(:npcs, EntityManager.list_entities(:npc))
         |> log_console(:info, "Deleted NPC: #{npc_id}")}

      {:error, reason} ->
        {:noreply,
         log_console(socket, :error, "Failed to delete NPC: #{sanitize_error(reason, "")}")}
    end
  end

  def handle_event("delete_item", %{"id" => item_id}, socket) do
    case EntityManager.delete_entity(item_id) do
      :ok ->
        {:noreply,
         socket
         |> assign(:items, EntityManager.list_entities(:item))
         |> log_console(:info, "Deleted Item: #{item_id}")}

      {:error, reason} ->
        {:noreply,
         log_console(socket, :error, "Failed to delete item: #{sanitize_error(reason, "")}")}
    end
  end

  def handle_event("show_npc_editor", _params, socket) do
    {:noreply, assign(socket, :show_npc_editor, true)}
  end

  def handle_event("show_item_editor", _params, socket) do
    {:noreply, assign(socket, :show_item_editor, true)}
  end

  def handle_event("close_npc_editor", _params, socket) do
    {:noreply, assign(socket, :show_npc_editor, false)}
  end

  def handle_event("close_item_editor", _params, socket) do
    {:noreply, assign(socket, :show_item_editor, false)}
  end

  # Quest & Cutscene Management
  def handle_event("create_quest", params, socket) do
    # Validate key and name
    with {:ok, _} <- InputValidator.validate_key(params["key"] || ""),
         {:ok, _} <- InputValidator.validate_name(params["name"] || "") do
      quest_data = %{
        key: params["key"],
        name: params["name"],
        quest_type: params["quest_type"] || "side",
        giver_key: params["giver_key"] || "",
        objectives: params["objectives"] || [],
        rewards: params["rewards"] || %{}
      }

      case QuestManager.create_quest(quest_data) do
        {:ok, quest} ->
          {:noreply,
           socket
           |> assign(:quests, QuestManager.list_quests())
           |> assign(:show_quest_editor, false)
           |> log_console(:info, "Created quest: #{quest.name}")}

        {:error, reason} ->
          {:noreply,
           log_console(socket, :error, "Failed to create quest: #{sanitize_error(reason, "")}")}
      end
    else
      {:error, msg} ->
        {:noreply, log_console(socket, :error, "Validation failed: #{msg}")}
    end
  end

  def handle_event("delete_quest", %{"key" => quest_key}, socket) do
    case QuestManager.delete_quest(quest_key) do
      :ok ->
        {:noreply,
         socket
         |> assign(:quests, QuestManager.list_quests())
         |> log_console(:info, "Deleted quest: #{quest_key}")}

      {:error, reason} ->
        {:noreply,
         log_console(socket, :error, "Failed to delete quest: #{sanitize_error(reason, "")}")}
    end
  end

  def handle_event("show_quest_editor", _params, socket) do
    {:noreply, assign(socket, :show_quest_editor, true)}
  end

  def handle_event("close_quest_editor", _params, socket) do
    {:noreply, assign(socket, :show_quest_editor, false)}
  end

  def handle_event("create_cutscene", params, socket) do
    # Validate id (cutscenes use "id" instead of "key")
    case InputValidator.validate_key(params["id"] || "") do
      {:ok, _} ->
        cutscene_data = %{
          id: params["id"],
          trigger: params["trigger"] || %{},
          sequence: params["sequence"] || [],
          effects: params["effects"] || []
        }

        case CutsceneManager.create_cutscene(cutscene_data) do
          {:ok, cutscene} ->
            {:noreply,
             socket
             |> assign(:cutscenes, CutsceneManager.list_cutscenes())
             |> assign(:show_cutscene_editor, false)
             |> log_console(:info, "Created cutscene: #{cutscene["id"]}")}

          {:error, reason} ->
            {:noreply,
             log_console(
               socket,
               :error,
               "Failed to create cutscene: #{sanitize_error(reason, "")}"
             )}
        end

      {:error, msg} ->
        {:noreply, log_console(socket, :error, "Validation failed: #{msg}")}
    end
  end

  def handle_event("delete_cutscene", %{"id" => cutscene_id}, socket) do
    case CutsceneManager.delete_cutscene(cutscene_id) do
      :ok ->
        {:noreply,
         socket
         |> assign(:cutscenes, CutsceneManager.list_cutscenes())
         |> log_console(:info, "Deleted cutscene: #{cutscene_id}")}

      {:error, reason} ->
        {:noreply,
         log_console(socket, :error, "Failed to delete cutscene: #{sanitize_error(reason, "")}")}
    end
  end

  def handle_event("show_cutscene_editor", _params, socket) do
    {:noreply, assign(socket, :show_cutscene_editor, true)}
  end

  def handle_event("close_cutscene_editor", _params, socket) do
    {:noreply, assign(socket, :show_cutscene_editor, false)}
  end

  # =============================================================================
  # Script Editor Event Handlers
  # =============================================================================

  def handle_event("show_script_editor", params, socket) do
    # Load existing script if editing, otherwise start fresh
    editing_script =
      case params do
        %{"key" => key} ->
          case ScriptManager.get_script(key) do
            {:ok, script} ->
              %{
                key: script.key,
                name: script.name,
                description: script.description,
                hook: Loka.Content.Script.hook(script),
                source: Loka.Content.Script.source(script),
                tags: script.tags || [],
                entity_key: Loka.Content.Script.entity_key(script)
              }

            {:error, _} ->
              nil
          end

        _ ->
          nil
      end

    {:noreply,
     socket
     |> assign(:show_script_editor, true)
     |> assign(:editing_script, editing_script)}
  end

  def handle_event("close_script_editor", _params, socket) do
    {:noreply,
     socket
     |> assign(:show_script_editor, false)
     |> assign(:editing_script, nil)}
  end

  def handle_event("save_script", params, socket) do
    # Validate and filter allowed fields
    attrs = %{
      key: params["key"],
      name: params["name"],
      description: params["description"] || "",
      hook: params["hook"],
      source: params["source"],
      tags: params["tags"] || [],
      entity_key: params["entity_key"]
    }

    result =
      if socket.assigns.editing_script do
        ScriptManager.update_script(attrs.key, attrs)
      else
        ScriptManager.create_script(attrs)
      end

    case result do
      {:ok, script} ->
        {:noreply,
         socket
         |> assign(:show_script_editor, false)
         |> assign(:editing_script, nil)
         |> log_console(:info, "Saved script: #{script.key}")}

      {:error, errors} when is_list(errors) ->
        {:noreply,
         log_console(socket, :error, "Failed to save script: #{Enum.join(errors, ", ")}")}

      {:error, reason} ->
        {:noreply, log_console(socket, :error, "Failed to save script: #{inspect(reason)}")}
    end
  end

  # =============================================================================
  # Dialogue Editor Event Handlers
  # =============================================================================

  def handle_event("show_dialogue_editor", %{"npc_key" => npc_key}, socket) do
    # Load NPC's dialogue tree
    npcs = socket.assigns.npcs
    npc = Enum.find(npcs, fn n -> n.key == npc_key end)

    dialogue_tree =
      case npc do
        nil -> %{}
        npc -> get_in(npc, [:components, :dialogue_tree]) || %{}
      end

    {:noreply,
     socket
     |> assign(:show_dialogue_editor, true)
     |> assign(:editing_dialogue_npc, npc_key)
     |> assign(:editing_dialogue_tree, dialogue_tree)
     |> assign(:dialogue_selected_node, nil)
     |> assign(:dialogue_preview_mode, false)}
  end

  def handle_event("close_dialogue_editor", _params, socket) do
    {:noreply,
     socket
     |> assign(:show_dialogue_editor, false)
     |> assign(:editing_dialogue_npc, nil)
     |> assign(:editing_dialogue_tree, %{})
     |> assign(:dialogue_selected_node, nil)
     |> assign(:dialogue_preview_mode, false)}
  end

  def handle_event("dialogue_select_node", %{"key" => node_key}, socket) do
    {:noreply, assign(socket, :dialogue_selected_node, node_key)}
  end

  def handle_event("dialogue_toggle_preview", _params, socket) do
    {:noreply, assign(socket, :dialogue_preview_mode, !socket.assigns.dialogue_preview_mode)}
  end

  def handle_event("dialogue_preview_reset", _params, socket) do
    {:noreply,
     socket
     |> assign(:dialogue_selected_node, "start")
     |> assign(:dialogue_preview_mode, true)}
  end

  def handle_event("dialogue_preview_choice", %{"next" => next}, socket) do
    if next && next != "" do
      {:noreply, assign(socket, :dialogue_selected_node, next)}
    else
      {:noreply, socket}
    end
  end

  def handle_event("dialogue_add_node", params, socket) do
    key = params["key"] || "node_#{:erlang.unique_integer([:positive])}"
    tree = socket.assigns.editing_dialogue_tree

    new_node = %{
      "text" => "Enter dialogue text...",
      "choices" => []
    }

    updated_tree = Map.put(tree, key, new_node)

    {:noreply,
     socket
     |> assign(:editing_dialogue_tree, updated_tree)
     |> assign(:dialogue_selected_node, key)
     |> save_dialogue_tree(updated_tree)}
  end

  def handle_event("dialogue_delete_node", %{"key" => node_key}, socket) do
    tree = socket.assigns.editing_dialogue_tree
    updated_tree = Map.delete(tree, node_key)

    selected =
      if socket.assigns.dialogue_selected_node == node_key do
        nil
      else
        socket.assigns.dialogue_selected_node
      end

    {:noreply,
     socket
     |> assign(:editing_dialogue_tree, updated_tree)
     |> assign(:dialogue_selected_node, selected)
     |> save_dialogue_tree(updated_tree)}
  end

  def handle_event("dialogue_update_node", params, socket) do
    node_key = params["node_key"]
    tree = socket.assigns.editing_dialogue_tree
    node = tree[node_key] || %{}

    # Update basic fields
    updated_node =
      node
      |> maybe_update("text", params["text"])
      |> maybe_update("speaker", params["speaker"])

    # Update choices from form params
    updated_node = update_node_choices(updated_node, params)

    updated_tree = Map.put(tree, node_key, updated_node)

    {:noreply,
     socket
     |> assign(:editing_dialogue_tree, updated_tree)
     |> save_dialogue_tree(updated_tree)}
  end

  def handle_event("dialogue_add_choice", %{"node_key" => node_key}, socket) do
    tree = socket.assigns.editing_dialogue_tree
    node = tree[node_key] || %{}
    choices = Map.get(node, "choices", [])

    new_choice = %{
      "text" => "Response option...",
      "next" => nil
    }

    updated_node = Map.put(node, "choices", choices ++ [new_choice])
    updated_tree = Map.put(tree, node_key, updated_node)

    {:noreply,
     socket
     |> assign(:editing_dialogue_tree, updated_tree)
     |> save_dialogue_tree(updated_tree)}
  end

  def handle_event("dialogue_delete_choice", %{"node_key" => node_key, "index" => index}, socket) do
    index = String.to_integer(index)
    tree = socket.assigns.editing_dialogue_tree
    node = tree[node_key] || %{}
    choices = Map.get(node, "choices", [])

    updated_choices = List.delete_at(choices, index)
    updated_node = Map.put(node, "choices", updated_choices)
    updated_tree = Map.put(tree, node_key, updated_node)

    {:noreply,
     socket
     |> assign(:editing_dialogue_tree, updated_tree)
     |> save_dialogue_tree(updated_tree)}
  end

  def handle_event("validate_quest_chains", _params, socket) do
    socket = log_console(socket, :info, "Running quest chain validation...")

    case DialogueQuestChainValidator.validate_all() do
      {:ok, results} ->
        socket = log_console(socket, :info, "Total checks: #{results.total_checks}")
        socket = log_console(socket, :info, "Passed: #{results.passed}")

        socket =
          if length(results.errors) > 0 do
            socket = log_console(socket, :error, "Found #{length(results.errors)} error(s):")

            Enum.reduce(results.errors, socket, fn {:error, error}, acc ->
              log_console(acc, :error, format_validation_error(error))
            end)
          else
            log_console(socket, :info, "No errors found!")
          end

        socket =
          if length(results.warnings) > 0 do
            socket =
              log_console(socket, :warning, "Found #{length(results.warnings)} warning(s):")

            Enum.reduce(results.warnings, socket, fn {:warning, warning}, acc ->
              log_console(acc, :warning, format_validation_warning(warning))
            end)
          else
            socket
          end

        {:noreply, socket}

      {:error, :no_storylines} ->
        {:noreply, log_console(socket, :error, "No storylines found to validate")}
    end
  end

  def handle_event("clear_console", _params, socket) do
    {:noreply, assign(socket, :console_messages, [])}
  end

  # =============================================================================
  # LLM Tool Execution
  # =============================================================================

  def handle_event("execute_tool", %{"name" => tool_name, "input" => input}, socket) do
    # Execute tool via ToolExecutor
    result = ToolExecutor.execute(tool_name, input)
    formatted = ToolExecutor.format_result(result)

    # Log to console
    socket =
      case result do
        {:ok, _} ->
          log_console(socket, :info, "[Tool] #{tool_name}: #{formatted.message}")

        {:error, _} ->
          log_console(socket, :error, "[Tool] #{tool_name}: #{formatted.message}")
      end

    # Refresh rooms if a room-related tool was executed
    socket =
      if tool_name in [
           "create_room",
           "update_room",
           "delete_room",
           "create_exit",
           "remove_exit",
           "batch_create_rooms"
         ] do
        refresh_rooms_with_validation(socket)
      else
        socket
      end

    # Refresh NPCs/items if entity tools were used
    socket =
      case tool_name do
        "create_npc" ->
          assign(socket, :npcs, EntityManager.list_entities(:npc))

        "create_item" ->
          assign(socket, :items, EntityManager.list_entities(:item))

        _ ->
          socket
      end

    # Send tool result back to ChatPanel
    {:noreply,
     socket
     |> push_event("tool_result", %{
       tool: tool_name,
       result: formatted
     })}
  end

  # =============================================================================
  # Undo/Redo System
  # =============================================================================

  def handle_event("undo_state_changed", params, socket) do
    undo_state = %{
      can_undo: params["canUndo"] || false,
      can_redo: params["canRedo"] || false,
      undo_count: params["undoCount"] || 0,
      redo_count: params["redoCount"] || 0
    }

    {:noreply, assign(socket, :undo_state, undo_state)}
  end

  def handle_event(
        "undo_operation",
        %{"type" => type, "state" => state, "metadata" => metadata},
        socket
      ) do
    # Handle undo by restoring previous state
    case restore_state(type, state, metadata, socket) do
      {:ok, socket} ->
        {:noreply, log_console(socket, :info, "Undo: #{type}")}

      {:error, reason} ->
        {:noreply, log_console(socket, :error, "Undo failed: #{reason}")}
    end
  end

  def handle_event(
        "redo_operation",
        %{"type" => type, "state" => state, "metadata" => metadata},
        socket
      ) do
    # Handle redo by restoring the after state
    case restore_state(type, state, metadata, socket) do
      {:ok, socket} ->
        {:noreply, log_console(socket, :info, "Redo: #{type}")}

      {:error, reason} ->
        {:noreply, log_console(socket, :error, "Redo failed: #{reason}")}
    end
  end

  # Trigger undo from toolbar button
  def handle_event("trigger_undo", _params, socket) do
    {:noreply, push_event(socket, "trigger_undo", %{})}
  end

  # Trigger redo from toolbar button
  def handle_event("trigger_redo", _params, socket) do
    {:noreply, push_event(socket, "trigger_redo", %{})}
  end

  # Restore state based on operation type
  defp restore_state("create_room", nil, %{"key" => key}, socket) do
    # Undo create = delete
    case RoomManager.delete_room(key) do
      :ok ->
        {:ok,
         socket
         |> assign(:rooms, RoomManager.list_rooms())
         |> assign(:selected_room, nil)
         |> push_event("room_deleted", %{id: key})}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp restore_state("create_room", state, _metadata, socket) when is_map(state) do
    # Redo create = create
    case RoomManager.create_room(atomize_keys(state)) do
      {:ok, room} ->
        {:ok,
         socket
         |> assign(:rooms, RoomManager.list_rooms())
         |> push_event("room_created", %{room: room})}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp restore_state("delete_room", nil, _metadata, socket) do
    # Redo delete - already deleted, nothing to do
    {:ok, socket}
  end

  defp restore_state("delete_room", state, _metadata, socket) when is_map(state) do
    # Undo delete = create
    case RoomManager.create_room(atomize_keys(state)) do
      {:ok, room} ->
        {:ok,
         socket
         |> assign(:rooms, RoomManager.list_rooms())
         |> push_event("room_created", %{room: room})}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp restore_state("update_room", state, %{"key" => key}, socket) when is_map(state) do
    # Restore room to previous state
    case RoomManager.update_room(key, atomize_keys(state)) do
      {:ok, room} ->
        {:ok,
         socket
         |> assign(:rooms, RoomManager.list_rooms())
         |> push_event("room_updated", %{room: room})}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp restore_state(_type, _state, _metadata, socket) do
    # Unknown operation type, log and continue
    {:ok, socket}
  end

  # Convert string keys to atom keys for room operations
  defp atomize_keys(map) when is_map(map) do
    Map.new(map, fn
      {k, v} when is_binary(k) -> {String.to_existing_atom(k), v}
      {k, v} -> {k, v}
    end)
  rescue
    # If atom doesn't exist, try to create it (only for allowed keys)
    ArgumentError ->
      Map.new(map, fn
        {k, v} when is_binary(k) and k in @allowed_room_fields -> {String.to_atom(k), v}
        {k, v} when is_binary(k) -> {k, v}
        {k, v} -> {k, v}
      end)
  end

  # Auto-Layout Algorithms
  def handle_event("apply_layout", %{"algorithm" => algorithm, "keys" => keys}, socket) do
    case parse_algorithm(algorithm) do
      {:ok, algorithm_atom} ->
        case LayoutManager.apply_layout(keys, algorithm_atom, %{}) do
          {:ok, updated_rooms} ->
            {:noreply,
             socket
             |> assign(:rooms, RoomManager.list_rooms())
             |> log_console(
               :info,
               "Applied #{algorithm} layout to #{length(updated_rooms)} rooms"
             )
             |> push_event("room_updated", %{rooms: updated_rooms})}

          {:error, reason} ->
            {:noreply,
             log_console(socket, :error, "Layout failed: #{sanitize_error(reason, "")}")}
        end

      {:error, :invalid_algorithm} ->
        {:noreply, log_console(socket, :error, "Invalid algorithm: #{algorithm}")}
    end
  end

  # =============================================================================
  # Helper Functions
  # =============================================================================

  defp log_console(socket, level, text) do
    timestamp = DateTime.utc_now() |> DateTime.to_time() |> Time.to_string()
    message = %{timestamp: timestamp, level: level, text: text}

    assign(socket, :console_messages, socket.assigns.console_messages ++ [message])
  end

  # Safely parse algorithm string to atom, preventing atom exhaustion attacks
  defp parse_algorithm(str) when is_binary(str) do
    try do
      atom = String.to_existing_atom(str)

      if atom in @valid_algorithms do
        {:ok, atom}
      else
        {:error, :invalid_algorithm}
      end
    rescue
      ArgumentError -> {:error, :invalid_algorithm}
    end
  end

  defp parse_algorithm(_), do: {:error, :invalid_algorithm}

  # Dialogue editor helper functions

  defp maybe_update(map, _key, nil), do: map
  defp maybe_update(map, _key, ""), do: Map.delete(map, "speaker")
  defp maybe_update(map, key, value), do: Map.put(map, key, value)

  defp update_node_choices(node, params) do
    # Extract choice fields from params (choice_0_text, choice_0_next, etc.)
    choice_params =
      params
      |> Enum.filter(fn {k, _v} -> String.starts_with?(k, "choice_") end)
      |> Enum.group_by(fn {k, _v} ->
        # Extract index: "choice_0_text" -> 0
        k
        |> String.split("_")
        |> Enum.at(1)
        |> String.to_integer()
      end)

    choices = Map.get(node, "choices", [])

    updated_choices =
      Enum.with_index(choices)
      |> Enum.map(fn {choice, index} ->
        choice_updates = Map.get(choice_params, index, [])

        choice
        |> update_choice_field(choice_updates, index, "text")
        |> update_choice_field(choice_updates, index, "next")
        |> update_choice_condition(choice_updates, index)
        |> update_choice_action(choice_updates, index)
      end)

    Map.put(node, "choices", updated_choices)
  end

  defp update_choice_field(choice, updates, index, field) do
    key = "choice_#{index}_#{field}"

    case Enum.find(updates, fn {k, _v} -> k == key end) do
      {_, ""} when field == "next" -> Map.put(choice, field, nil)
      {_, value} -> Map.put(choice, field, value)
      nil -> choice
    end
  end

  defp update_choice_condition(choice, updates, index) do
    type_key = "choice_#{index}_condition_type"
    value_key = "choice_#{index}_condition_value"

    type = get_param_value(updates, type_key)
    value = get_param_value(updates, value_key)

    if type && type != "" && value && value != "" do
      Map.put(choice, "show_if", %{type => value})
    else
      Map.delete(choice, "show_if")
    end
  end

  defp update_choice_action(choice, updates, index) do
    type_key = "choice_#{index}_action_type"
    value_key = "choice_#{index}_action_value"

    type = get_param_value(updates, type_key)
    value = get_param_value(updates, value_key)

    if type && type != "" && value && value != "" do
      Map.put(choice, "action", [type, value])
    else
      Map.delete(choice, "action")
    end
  end

  defp get_param_value(updates, key) do
    case Enum.find(updates, fn {k, _} -> k == key end) do
      {_, value} -> value
      nil -> nil
    end
  end

  defp save_dialogue_tree(socket, tree) do
    npc_key = socket.assigns.editing_dialogue_npc

    if npc_key do
      # Find NPC and update its dialogue tree
      npcs = socket.assigns.npcs
      npc = Enum.find(npcs, fn n -> n.key == npc_key end)

      if npc do
        # Update NPC's dialogue tree component
        components = Map.get(npc, :components) || %{}
        updated_components = Map.put(components, :dialogue_tree, tree)

        case EntityManager.update_entity(npc.id, %{components: updated_components}) do
          {:ok, _updated_npc} ->
            updated_npcs = EntityManager.list_entities(:npc)

            socket
            |> assign(:npcs, updated_npcs)
            |> log_console(:info, "Dialogue saved for #{npc_key}")

          {:error, _reason} ->
            log_console(socket, :error, "Failed to save dialogue")
        end
      else
        socket
      end
    else
      socket
    end
  end

  # Build CSS classes for panel container based on collapsed state
  defp panel_container_classes(collapsed_panels) do
    base = "world-builder-container"

    classes =
      [
        collapsed_panels.hierarchy && "hierarchy-collapsed",
        collapsed_panels.inspector && "inspector-collapsed",
        collapsed_panels.console && "console-collapsed",
        collapsed_panels.chat && "chat-collapsed"
      ]
      |> Enum.filter(& &1)
      |> Enum.join(" ")

    if classes == "", do: base, else: "#{base} #{classes}"
  end

  # Helper to refresh rooms and validation, then push to frontend
  defp refresh_rooms_with_validation(socket) do
    rooms = RoomManager.list_rooms()
    validation = ValidationManager.validation_summary(rooms)

    socket
    |> assign(:rooms, rooms)
    |> assign(:validation, validation)
    |> push_event("rooms_updated", %{rooms: rooms, validation: validation.results})
  end

  # Safely parse integer from string, preventing application crashes on invalid input
  defp parse_integer(value, default \\ 0) do
    case Integer.parse(value || "#{default}") do
      {int, _} -> int
      :error -> default
    end
  end

  # Sanitize error messages to prevent information disclosure
  # Logs full error details but returns generic messages to user
  defp sanitize_error(reason, context) do
    # Log full error details for debugging (server-side only)
    if context != "" do
      Logger.error("[WorldBuilder] #{context} error: #{inspect(reason)}")
    end

    # Return generic message to user based on error type
    case reason do
      :not_found -> "Resource not found"
      :invalid_data -> "Invalid data provided"
      :invalid_template -> "Invalid template"
      :permission_denied -> "Permission denied"
      :api_key_not_configured -> "Service not configured"
      msg when is_binary(msg) and byte_size(msg) < 100 -> msg
      _ -> "Operation failed"
    end
  end

  defp format_validation_error(error) do
    case error do
      {:broken_quest_chain, npc, quest_id, next_quest, message} ->
        "[#{npc}] #{quest_id} → #{next_quest}: #{message}"

      {:quest_not_offered_in_dialogue, npc, quest_id} ->
        "[#{npc}] Quest #{quest_id} is not offered in dialogue"

      {:no_dialogue_tree, npc, quest_id} ->
        "[#{npc}] No dialogue tree found (needed for quest #{quest_id})"

      {:npc_not_found, npc} ->
        "NPC not found: #{npc}"

      {:missing_quest_definition, quest_id} ->
        "Quest definition missing: #{quest_id}"

      _ ->
        "Unknown error: #{inspect(error)}"
    end
  end

  defp format_validation_warning(warning) do
    case warning do
      {:no_turnin_dialogue, npc, quest_id} ->
        "[#{npc}] Quest #{quest_id} has no turn-in dialogue"

      _ ->
        "Unknown warning: #{inspect(warning)}"
    end
  end
end
