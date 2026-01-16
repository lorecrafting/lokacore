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
    ValidationManager
  }

  alias Loka.Testing.Content.DialogueQuestChainValidator

  alias LokaWeb.AdminLive.WorldBuilder.{
    Toolbar,
    HierarchyPanel,
    ViewportContainer,
    InspectorPanel,
    ConsolePanel,
    InputValidator
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
     |> assign(:console_messages, [])
     |> assign(:show_create_modal, false)
     |> assign(:validation, validation)
     |> push_event("init_world_builder", %{rooms: rooms, validation: validation.results})}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <div class="world-builder">
      <Toolbar.toolbar />
      
    <!-- Main 4-panel layout -->
      <div class="world-builder-container">
        <HierarchyPanel.hierarchy_panel
          rooms={@rooms}
          templates={@templates}
          selected_room={@selected_room}
          template_search={@template_search}
          active_tab={@active_tab}
        />

        <ViewportContainer.viewport_container rooms={@rooms} selected_room={@selected_room} />

        <InspectorPanel.inspector_panel
          rooms={@rooms}
          selected_room={@selected_room}
          selected_keys={@selected_keys}
        />

        <ConsolePanel.console_panel console_messages={@console_messages} />
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
    </div>
    """
  end

  # =============================================================================
  # Event Handlers
  # =============================================================================

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
             |> push_event("room_created", %{room: room})}

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
    case RoomManager.delete_room(room_id) do
      :ok ->
        {:noreply,
         socket
         |> assign(:rooms, RoomManager.list_rooms())
         |> assign(:selected_room, nil)
         |> log_console(:info, "Deleted room: #{room_id}")
         |> push_event("room_deleted", %{id: room_id})}

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
  defp sanitize_error(reason, context \\ "") do
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
