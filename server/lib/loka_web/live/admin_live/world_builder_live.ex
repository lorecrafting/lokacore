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
    ScriptManager,
    ScriptTemplates,
    GitManager
  }

  alias Loka.Content.Zone

  alias LokaWeb.AdminLive.WorldBuilder.{
    Toolbar,
    HierarchyPanel,
    ViewportContainer,
    InspectorPanel,
    ChatPanel,
    InputValidator,
    SettingsModal,
    DialogueEditor,
    ScriptEditor,
    ScriptTemplatePicker,
    ScriptTemplateConfig,
    CommitModal,
    ValidationPanel,
    ConfirmationModal,
    DialogueEventHandler,
    EntityEventHandler
  }

  alias Loka.Admin.Audit

  # Valid layout algorithms - prevents atom exhaustion attacks
  @valid_algorithms ~w(force_directed circular grid hierarchical)a

  # Allowed fields for mass assignment protection
  @allowed_room_fields ~w(key name description x y z zone tags attributes parent_key)

  @impl true
  def mount(_params, _session, socket) do
    # Load entities from managers
    rooms = RoomManager.list_rooms()
    templates = TemplateManager.list_templates()
    npcs = EntityManager.list_entities(:npc)
    items = EntityManager.list_entities(:item)
    quests = QuestManager.list_quests()
    cutscenes = CutsceneManager.list_cutscenes()

    # Load zones and build room -> spawns mapping
    zones = Zone.all()
    room_spawns = build_room_spawns_map(zones)

    # Run validation on rooms
    validation = ValidationManager.validation_summary(rooms)

    {:ok,
     socket
     |> assign(:rooms, rooms)
     |> assign(:selected_room, nil)
     |> assign(:selected_keys, [])
     |> assign(:templates, templates)
     |> assign(:template_search, "")
     |> assign(:active_tab, :templates)
     |> assign(:npcs, npcs)
     |> assign(:items, items)
     |> assign(:selected_entity, nil)
     |> assign(:quests, quests)
     |> assign(:cutscenes, cutscenes)
     |> assign(:zones, zones)
     |> assign(:room_spawns, room_spawns)
     |> assign(:show_npc_editor, false)
     |> assign(:show_item_editor, false)
     |> assign(:show_quest_editor, false)
     |> assign(:show_cutscene_editor, false)
     |> assign(:show_dialogue_editor, false)
     |> assign(:show_script_editor, false)
     |> assign(:editing_script, nil)
     |> assign(:show_template_picker, false)
     |> assign(:template_search, "")
     |> assign(:template_category, nil)
     |> assign(:show_template_config, false)
     |> assign(:selected_template, nil)
     |> assign(:template_config, %{})
     |> assign(:template_preview_code, "")
     |> assign(:template_validation_errors, [])
     |> assign(:show_commit_modal, false)
     |> assign(:git_status, %{modified: [], added: [], deleted: []})
     |> assign(:git_diff, "")
     |> assign(:commit_message, "")
     |> assign(:is_committing, false)
     |> assign(:is_pushing, false)
     |> assign(:commit_result, nil)
     |> assign(:editing_dialogue_npc, nil)
     |> assign(:editing_dialogue_tree, %{})
     |> assign(:dialogue_selected_node, nil)
     |> assign(:dialogue_preview_mode, false)
     |> assign(:console_messages, [])
     |> assign(:show_create_modal, false)
     |> assign(:validation, validation)
     |> assign(:show_validation_panel, false)
     |> assign(:show_settings, false)
     |> assign(:api_key_statuses, %{
       anthropic: :unconfigured,
       openai: :unconfigured,
       deepseek: :unconfigured,
       gemini: :unconfigured,
       glm: :unconfigured,
       minimax: :unconfigured
     })
     |> assign(:selected_model, "claude-opus-4-5-20251101")
     |> assign(:collapsed_panels, %{
       hierarchy: false,
       inspector: false,
       console: false,
       chat: false
     })
     |> assign(:panel_sizes, %{
       hierarchy: 200,
       inspector: 260,
       chat: 320,
       console: 150
     })
     |> assign(:camera_view, "perspective")
     |> assign(:undo_state, %{can_undo: false, can_redo: false, undo_count: 0, redo_count: 0})
     # Confirmation modal state (replaces browser-native confirm dialogs)
     |> assign(:confirm_modal, nil)
     # Initialize audit context for tracking admin actions
     |> Audit.init_context(socket.assigns[:current_player])
     |> push_event("init_world_builder", %{rooms: rooms, validation: validation.results})}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <div class="world-builder" phx-window-keydown="keyboard_shortcut">
      <Toolbar.toolbar undo_state={@undo_state} />
      
    <!-- Main 4-panel layout with resize handles -->
      <div
        id="world-builder-panels"
        class={panel_container_classes(@collapsed_panels)}
        phx-hook="PanelResize"
        style={panel_sizes_style(@panel_sizes)}
      >
        <HierarchyPanel.hierarchy_panel
          rooms={@rooms}
          npcs={@npcs}
          items={@items}
          templates={@templates}
          selected_room={@selected_room}
          selected_entity={@selected_entity}
          template_search={@template_search}
          active_tab={@active_tab}
          collapsed={@collapsed_panels.hierarchy}
        />

        <div
          class="panel-resize-handle"
          data-resize="hierarchy"
          style={if @collapsed_panels.hierarchy, do: "display: none;", else: ""}
        >
        </div>

        <ViewportContainer.viewport_container
          rooms={@rooms}
          selected_room={@selected_room}
          console_messages={@console_messages}
          console_collapsed={@collapsed_panels.console}
          console_height={@panel_sizes.console}
        />

        <div
          class="panel-resize-handle"
          data-resize="inspector"
          style={if @collapsed_panels.inspector, do: "display: none;", else: ""}
        >
        </div>

        <InspectorPanel.inspector_panel
          rooms={@rooms}
          npcs={@npcs}
          items={@items}
          room_spawns={@room_spawns}
          selected_room={@selected_room}
          selected_entity={@selected_entity}
          selected_keys={@selected_keys}
          collapsed={@collapsed_panels.inspector}
        />

        <div
          class="panel-resize-handle"
          data-resize="chat"
          style={if @collapsed_panels.chat, do: "display: none;", else: ""}
        >
        </div>

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
                <label>Room Name</label>
                <input
                  type="text"
                  name="name"
                  class="input"
                  placeholder="e.g., Main Tavern"
                  required
                />
              </div>

              <div class="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  class="textarea"
                  rows="3"
                  placeholder="What the player sees when entering..."
                ></textarea>
              </div>

              <div class="form-group">
                <label>Position</label>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem;">
                  <input type="number" name="x" class="input" placeholder="X" value="0" />
                  <input type="number" name="y" class="input" placeholder="Y" value="0" />
                  <input type="number" name="z" class="input" placeholder="Z" value="0" />
                </div>
              </div>

              <div class="form-group">
                <label>
                  Room Key <span style="color: #666; font-weight: normal;">(optional)</span>
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
                  placeholder="What the player sees when looking..."
                ></textarea>
              </div>

              <div class="form-group">
                <label>Level</label>
                <input type="number" name="level" class="input" value="1" min="1" />
              </div>

              <div class="form-group">
                <label>
                  NPC Key <span style="color: #666; font-weight: normal;">(optional)</span>
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
                <label>Item Name</label>
                <input
                  type="text"
                  name="name"
                  class="input"
                  placeholder="e.g., Iron Sword"
                  required
                />
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

              <div class="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  class="textarea"
                  rows="3"
                  placeholder="What the player sees when examining..."
                ></textarea>
              </div>

              <div class="form-group">
                <label>
                  Item Key <span style="color: #666; font-weight: normal;">(optional)</span>
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
              phx-update="ignore"
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
              phx-update="ignore"
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
              <div
                class="dialogue-entity-selector"
                style="display: flex; align-items: center; gap: 0.5rem; margin-left: 1rem;"
              >
                <label style="color: #909090; font-size: 0.875rem;">Entity:</label>
                <select
                  phx-change="dialogue_update_entity"
                  name="npc_key"
                  class="input"
                  style="width: 200px; padding: 0.25rem 0.5rem; font-size: 0.875rem;"
                >
                  <option value="">None (standalone)</option>
                  <%= for npc <- @npcs do %>
                    <option value={npc.key} selected={@editing_dialogue_npc == npc.key}>
                      {npc[:name] || npc[:short_desc] || npc.key} ({npc.key})
                    </option>
                  <% end %>
                </select>
              </div>
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
        <ScriptEditor.script_editor
          script={@editing_script}
          entities={build_entity_list(@rooms, @npcs, @items)}
        />
      <% end %>

      <%!-- Template Picker Modal --%>
      <%= if @show_template_picker do %>
        <ScriptTemplatePicker.script_template_picker
          search={@template_search}
          selected_category={@template_category}
        />
      <% end %>

      <%!-- Template Config Modal --%>
      <%= if @show_template_config && @selected_template do %>
        <ScriptTemplateConfig.script_template_config
          template={@selected_template}
          config={@template_config}
          preview_code={@template_preview_code}
          validation_errors={@template_validation_errors}
        />
      <% end %>

      <%!-- Git Commit Modal --%>
      <CommitModal.commit_modal
        show={@show_commit_modal}
        status={@git_status}
        diff={@git_diff}
        commit_message={@commit_message}
        is_committing={@is_committing}
        is_pushing={@is_pushing}
        last_result={@commit_result}
      />

      <%!-- Settings Modal --%>
      <SettingsModal.settings_modal
        show={@show_settings}
        api_key_statuses={@api_key_statuses}
        selected_model={@selected_model}
      />

      <%!-- Validation Panel --%>
      <%= if @show_validation_panel do %>
        <ValidationPanel.validation_panel validation_results={@validation} />
      <% end %>

      <%!-- Confirmation Modal (replaces browser-native confirm dialogs) --%>
      <ConfirmationModal.confirmation_modal
        modal={@confirm_modal}
        on_confirm="execute_confirm"
        on_cancel="cancel_confirm"
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

  # =============================================================================
  # Confirmation Modal Handlers
  # =============================================================================

  @impl true
  def handle_event("show_confirm", params, socket) do
    confirm_modal = %{
      title: params["title"] || "Confirm Action",
      message: params["message"] || "Are you sure?",
      warning: params["warning"],
      confirm_text: params["confirm_text"] || "Confirm",
      danger: params["danger"] == "true",
      action: params["action"],
      # Store any additional data needed for the action
      data: %{
        "id" => params["id"],
        "key" => params["key"],
        "type" => params["type"]
      }
    }

    {:noreply, assign(socket, :confirm_modal, confirm_modal)}
  end

  @impl true
  def handle_event("cancel_confirm", _params, socket) do
    {:noreply, assign(socket, :confirm_modal, nil)}
  end

  @impl true
  def handle_event("execute_confirm", _params, socket) do
    case socket.assigns.confirm_modal do
      nil ->
        {:noreply, socket}

      %{action: action, data: data} ->
        # Execute the confirmed action
        socket = assign(socket, :confirm_modal, nil)
        execute_confirmed_action(socket, action, data)
    end
  end

  # Execute the action that was confirmed
  defp execute_confirmed_action(socket, "delete_room", %{"id" => id}) do
    handle_event("delete_room_confirmed", %{"id" => id}, socket)
  end

  defp execute_confirmed_action(socket, "delete_npc", %{"key" => key}) do
    handle_event("delete_npc_confirmed", %{"key" => key}, socket)
  end

  defp execute_confirmed_action(socket, "delete_item", %{"key" => key}) do
    handle_event("delete_item_confirmed", %{"key" => key}, socket)
  end

  defp execute_confirmed_action(socket, "batch_delete", _data) do
    handle_event("batch_delete_confirmed", %{}, socket)
  end

  defp execute_confirmed_action(socket, "dialogue_delete_node_confirmed", %{"key" => key}) do
    handle_event("dialogue_delete_node_confirmed", %{"key" => key}, socket)
  end

  defp execute_confirmed_action(socket, _action, _data) do
    {:noreply, log_console(socket, :error, "Unknown confirmation action")}
  end

  @impl true
  def handle_event("api_key_validated", %{"provider" => provider, "status" => status}, socket) do
    status_atom =
      case status do
        "valid" -> :valid
        "invalid" -> :invalid
        "validating" -> :validating
        _ -> :unconfigured
      end

    provider_atom = String.to_existing_atom(provider)

    if provider_atom in [:anthropic, :openai, :deepseek, :gemini, :glm, :minimax] do
      statuses = socket.assigns.api_key_statuses
      new_statuses = Map.put(statuses, provider_atom, status_atom)
      {:noreply, assign(socket, :api_key_statuses, new_statuses)}
    else
      {:noreply, socket}
    end
  end

  # Fallback for old single-provider format (backwards compatibility)
  @impl true
  def handle_event("api_key_validated", %{"status" => status}, socket) do
    status_atom =
      case status do
        "valid" -> :valid
        "invalid" -> :invalid
        "validating" -> :validating
        _ -> :unconfigured
      end

    # Default to anthropic for backwards compatibility
    statuses = socket.assigns.api_key_statuses
    new_statuses = Map.put(statuses, :anthropic, status_atom)
    {:noreply, assign(socket, :api_key_statuses, new_statuses)}
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

  # Panel resize handler
  @impl true
  def handle_event("resize_panel", %{"panel" => panel, "size" => size}, socket) do
    panel_atom = String.to_existing_atom(panel)

    if panel_atom in [:hierarchy, :inspector, :chat, :console] do
      sizes = socket.assigns.panel_sizes
      new_sizes = Map.put(sizes, panel_atom, size)
      {:noreply, assign(socket, :panel_sizes, new_sizes)}
    else
      {:noreply, socket}
    end
  end

  # Camera view preset (Perspective, Top, Front, Side)
  @impl true
  def handle_event("set_camera_view", %{"view" => view}, socket)
      when view in ["perspective", "top", "front", "side"] do
    {:noreply,
     socket
     |> assign(:camera_view, view)
     |> push_event("set_camera_view", %{view: view})}
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

  # Validate all content (Ctrl+S shortcut)
  @impl true
  def handle_event("validate_all", _params, socket) do
    rooms = socket.assigns.rooms
    validation = ValidationManager.validation_summary(rooms)

    {:noreply,
     socket
     |> assign(:validation, validation)
     |> log_console(
       :info,
       "Validation complete: #{validation.errors} errors, #{validation.warnings} warnings"
     )
     |> push_event("validation_complete", %{results: validation.results})}
  end

  # Toggle grid visibility
  @impl true
  def handle_event("toggle_grid", _params, socket) do
    {:noreply,
     socket
     |> push_event("toggle_grid", %{})}
  end

  @impl true
  def handle_event("select_room", %{"key" => key}, socket) do
    {:noreply,
     socket
     |> assign(:selected_room, key)
     |> assign(:selected_entity, nil)
     |> assign(:selected_keys, [])
     |> log_console(:info, "Selected room: #{key}")
     |> push_event("select_room", %{key: key})}
  end

  def handle_event("select_entity", %{"type" => type, "key" => key}, socket) do
    type_atom = String.to_existing_atom(type)

    {:noreply,
     socket
     |> assign(:selected_entity, %{type: type_atom, key: key})
     |> assign(:selected_room, nil)
     |> assign(:selected_keys, [])
     |> log_console(:info, "Selected #{type}: #{key}")}
  end

  def handle_event("switch_hierarchy_tab", %{"tab" => tab}, socket) do
    # Allow npcs, items tabs in addition to rooms, templates
    tab_atom =
      case tab do
        "rooms" -> :rooms
        "npcs" -> :npcs
        "items" -> :items
        "templates" -> :templates
        _ -> :rooms
      end

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
    # Auto-generate key from name if not provided
    key =
      case params["key"] do
        nil -> slugify(params["name"])
        "" -> slugify(params["name"])
        k -> k
      end

    params_with_key = Map.put(params, "key", key)

    # Validate user input before processing
    case InputValidator.validate_room_attrs(params_with_key) do
      {:ok, _} ->
        attrs = %{
          key: key,
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
             |> Audit.log(:create, :room, room.key, nil, room)
             |> push_event("room_created", %{room: room})
             |> push_event("record_operation", %{
               type: "create_room",
               beforeState: nil,
               afterState: room,
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
    room_id = params["room_id"]
    updates = Map.drop(params, ["room_id", "_target"])

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

  # Show confirmation modal for room deletion
  def handle_event("delete_room", %{"id" => room_id}, socket) do
    room = Enum.find(socket.assigns.rooms, fn r -> r.key == room_id || r.id == room_id end)
    room_name = if room, do: room.name, else: room_id

    confirm_modal = %{
      title: "Delete Room",
      message: "Are you sure you want to delete \"#{room_name}\"?",
      warning: "This can be undone with Ctrl+Z",
      confirm_text: "Delete",
      danger: true,
      action: "delete_room",
      data: %{"id" => room_id, "key" => nil, "type" => nil}
    }

    {:noreply, assign(socket, :confirm_modal, confirm_modal)}
  end

  # Actually delete the room after confirmation
  def handle_event("delete_room_confirmed", %{"id" => room_id}, socket) do
    # Get room before deletion for undo
    room_before = Enum.find(socket.assigns.rooms, fn r -> r.key == room_id || r.id == room_id end)

    case RoomManager.delete_room(room_id) do
      {:ok, _deleted_room} ->
        {:noreply,
         socket
         |> assign(:rooms, RoomManager.list_rooms())
         |> assign(:selected_room, nil)
         |> log_console(:info, "Deleted room: #{room_id}")
         |> Audit.log(:delete, :room, room_id, room_before, nil)
         |> push_event("room_deleted", %{id: room_id})
         |> push_event("record_operation", %{
           type: "delete_room",
           beforeState: room_before,
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

  # Show confirmation modal for batch deletion
  def handle_event("batch_delete", _params, socket) do
    count = length(socket.assigns.selected_keys)

    confirm_modal = %{
      title: "Delete #{count} Rooms",
      message: "Are you sure you want to delete all #{count} selected rooms?",
      warning: "This can be undone with Ctrl+Z",
      confirm_text: "Delete All",
      danger: true,
      action: "batch_delete",
      data: %{"id" => nil, "key" => nil, "type" => nil}
    }

    {:noreply, assign(socket, :confirm_modal, confirm_modal)}
  end

  # Actually batch delete after confirmation
  def handle_event("batch_delete_confirmed", _params, socket) do
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

  # Unified search for all entity types - filtering is done in the component
  def handle_event("search_entities", %{"query" => query}, socket) do
    {:noreply, assign(socket, :template_search, query)}
  end

  # =============================================================================
  # NPC & Item Management - Delegated to EntityEventHandler
  # =============================================================================

  def handle_event("create_npc", params, socket),
    do: EntityEventHandler.handle_event("create_npc", params, socket)

  def handle_event("create_item", params, socket),
    do: EntityEventHandler.handle_event("create_item", params, socket)

  def handle_event("delete_npc", params, socket),
    do: EntityEventHandler.handle_event("delete_npc", params, socket)

  def handle_event("delete_npc_confirmed", params, socket),
    do: EntityEventHandler.handle_event("delete_npc_confirmed", params, socket)

  def handle_event("delete_item", params, socket),
    do: EntityEventHandler.handle_event("delete_item", params, socket)

  def handle_event("delete_item_confirmed", params, socket),
    do: EntityEventHandler.handle_event("delete_item_confirmed", params, socket)

  def handle_event("update_npc_field", params, socket),
    do: EntityEventHandler.handle_event("update_npc_field", params, socket)

  def handle_event("update_item_field", params, socket),
    do: EntityEventHandler.handle_event("update_item_field", params, socket)

  def handle_event(
        "show_script_editor_for_entity",
        %{"entity_type" => type, "entity_key" => key},
        socket
      ) do
    # Open script editor with entity pre-selected
    {:noreply,
     socket
     |> assign(:show_script_editor, true)
     |> assign(:editing_script, %{entity_key: key, entity_type: type})
     |> log_console(:info, "Opening script editor for #{type}: #{key}")}
  end

  def handle_event("show_dialogue_editor_for_entity", %{"entity_key" => key}, socket) do
    # Open dialogue editor with NPC pre-selected and load existing dialogue
    npc = Enum.find(socket.assigns.npcs, fn n -> n.key == key end)

    existing_tree =
      if npc do
        components = Map.get(npc, :components) || %{}
        Map.get(components, :dialogue_tree) || Map.get(components, "dialogue_tree") || %{}
      else
        %{}
      end

    {:noreply,
     socket
     |> assign(:show_dialogue_editor, true)
     |> assign(:editing_dialogue_npc, key)
     |> assign(:editing_dialogue_tree, existing_tree)
     |> log_console(:info, "Opening dialogue editor for NPC: #{key}")}
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
                tags: script.tags || []
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
  # Template Picker Event Handlers
  # =============================================================================

  def handle_event("show_template_picker", _params, socket) do
    {:noreply,
     socket
     |> assign(:show_template_picker, true)
     |> assign(:template_search, "")
     |> assign(:template_category, nil)}
  end

  def handle_event("close_template_picker", _params, socket) do
    {:noreply,
     socket
     |> assign(:show_template_picker, false)
     |> assign(:template_search, "")
     |> assign(:template_category, nil)}
  end

  def handle_event("template_search", %{"value" => search}, socket) do
    {:noreply, assign(socket, :template_search, search)}
  end

  def handle_event("filter_category", %{"category" => ""}, socket) do
    {:noreply, assign(socket, :template_category, nil)}
  end

  def handle_event("filter_category", %{"category" => category}, socket) do
    category_atom = String.to_existing_atom(category)
    {:noreply, assign(socket, :template_category, category_atom)}
  rescue
    ArgumentError -> {:noreply, socket}
  end

  def handle_event("select_template", %{"id" => template_id}, socket) do
    case ScriptTemplates.get_template(template_id) do
      {:ok, template} ->
        # Initialize config with defaults from schema
        initial_config =
          template.config_schema
          |> Enum.map(fn field ->
            {Atom.to_string(field.name), Map.get(field, :default)}
          end)
          |> Map.new()

        # Generate initial preview
        preview_code =
          case ScriptTemplates.generate_code(template_id, initial_config) do
            {:ok, code} -> code
            {:error, _} -> "# Configure required fields to see preview"
          end

        {:noreply,
         socket
         |> assign(:show_template_picker, false)
         |> assign(:show_template_config, true)
         |> assign(:selected_template, template)
         |> assign(:template_config, initial_config)
         |> assign(:template_preview_code, preview_code)
         |> assign(:template_validation_errors, [])}

      {:error, _} ->
        {:noreply, log_console(socket, :error, "Template not found: #{template_id}")}
    end
  end

  def handle_event("close_template_config", _params, socket) do
    {:noreply,
     socket
     |> assign(:show_template_config, false)
     |> assign(:selected_template, nil)
     |> assign(:template_config, %{})
     |> assign(:template_preview_code, "")
     |> assign(:template_validation_errors, [])}
  end

  def handle_event("back_to_picker", _params, socket) do
    {:noreply,
     socket
     |> assign(:show_template_config, false)
     |> assign(:show_template_picker, true)
     |> assign(:selected_template, nil)
     |> assign(:template_config, %{})
     |> assign(:template_preview_code, "")
     |> assign(:template_validation_errors, [])}
  end

  def handle_event("update_template_config", %{"field" => field, "value" => value}, socket) do
    update_template_config(socket, field, value)
  end

  def handle_event("update_template_config_bool", %{"field" => field, "value" => value}, socket) do
    bool_value = value == "true"
    update_template_config(socket, field, bool_value)
  end

  def handle_event("update_template_config_select", %{"field" => field, "value" => value}, socket) do
    update_template_config(socket, field, value)
  end

  defp update_template_config(socket, field, value) do
    template = socket.assigns.selected_template
    config = Map.put(socket.assigns.template_config, field, value)

    # Regenerate preview
    {preview_code, validation_errors} =
      case ScriptTemplates.generate_code(template.id, config) do
        {:ok, code} ->
          {code, []}

        {:error, {:validation_failed, errors}} ->
          {"# Fix validation errors to see preview", errors}

        {:error, _} ->
          {"# Configure required fields to see preview", []}
      end

    {:noreply,
     socket
     |> assign(:template_config, config)
     |> assign(:template_preview_code, preview_code)
     |> assign(:template_validation_errors, validation_errors)}
  end

  def handle_event("create_script_from_template", _params, socket) do
    template = socket.assigns.selected_template
    config = socket.assigns.template_config

    script_key = config["script_key"]
    script_name = config["script_name"] || script_key
    entity_key = config["entity_key"]

    case ScriptTemplates.generate_code(template.id, config) do
      {:ok, source_code} ->
        attrs = %{
          key: script_key,
          name: script_name,
          description: "Generated from template #{template.id}: #{template.name}",
          hook: template.hook,
          source: source_code,
          tags: [Atom.to_string(template.category), "template:#{template.id}"],
          entity_key: entity_key
        }

        case ScriptManager.create_script(attrs) do
          {:ok, script} ->
            {:noreply,
             socket
             |> assign(:show_template_config, false)
             |> assign(:selected_template, nil)
             |> assign(:template_config, %{})
             |> assign(:template_preview_code, "")
             |> assign(:template_validation_errors, [])
             |> log_console(:info, "Created script '#{script.key}' from template #{template.id}")}

          {:error, :already_exists} ->
            {:noreply,
             assign(socket, :template_validation_errors, [
               "Script key '#{script_key}' already exists"
             ])}

          {:error, errors} when is_list(errors) ->
            {:noreply, assign(socket, :template_validation_errors, errors)}

          {:error, reason} ->
            {:noreply,
             assign(socket, :template_validation_errors, [
               "Failed to create script: #{inspect(reason)}"
             ])}
        end

      {:error, {:validation_failed, errors}} ->
        {:noreply, assign(socket, :template_validation_errors, errors)}

      {:error, reason} ->
        {:noreply,
         assign(socket, :template_validation_errors, [
           "Failed to generate code: #{inspect(reason)}"
         ])}
    end
  end

  # =============================================================================
  # Git Commit Modal Event Handlers
  # =============================================================================

  def handle_event("show_commit_modal", _params, socket) do
    # Fetch git status and generate commit message
    {status, commit_msg} =
      case GitManager.status() do
        {:ok, status} ->
          msg = GitManager.generate_commit_message()
          {status, msg}

        {:error, _} ->
          {%{modified: [], added: [], deleted: []}, ""}
      end

    {:noreply,
     socket
     |> assign(:show_commit_modal, true)
     |> assign(:git_status, status)
     |> assign(:git_diff, "")
     |> assign(:commit_message, commit_msg)
     |> assign(:commit_result, nil)}
  end

  def handle_event("close_commit_modal", _params, socket) do
    {:noreply,
     socket
     |> assign(:show_commit_modal, false)
     |> assign(:git_status, %{modified: [], added: [], deleted: []})
     |> assign(:git_diff, "")
     |> assign(:commit_message, "")
     |> assign(:is_committing, false)
     |> assign(:is_pushing, false)
     |> assign(:commit_result, nil)}
  end

  def handle_event("refresh_git_status", _params, socket) do
    {status, commit_msg} =
      case GitManager.status() do
        {:ok, status} ->
          msg = GitManager.generate_commit_message()
          {status, msg}

        {:error, _} ->
          {%{modified: [], added: [], deleted: []}, ""}
      end

    {:noreply,
     socket
     |> assign(:git_status, status)
     |> assign(:commit_message, commit_msg)
     |> log_console(:info, "Git status refreshed")}
  end

  def handle_event("show_file_diff", %{"file" => file_path}, socket) do
    diff =
      case GitManager.diff(file_path) do
        {:ok, diff_output} -> diff_output
        {:error, _} -> "Failed to load diff"
      end

    {:noreply, assign(socket, :git_diff, diff)}
  end

  def handle_event("update_commit_message", %{"value" => message}, socket) do
    {:noreply, assign(socket, :commit_message, message)}
  end

  def handle_event("stage_and_commit", _params, socket) do
    message = socket.assigns.commit_message

    socket = assign(socket, :is_committing, true)

    result =
      with :ok <- GitManager.stage(:all),
           {:ok, hash} <- GitManager.commit(message) do
        {:ok, hash}
      end

    socket =
      case result do
        {:ok, hash} ->
          # Refresh status after successful commit
          {new_status, new_msg} =
            case GitManager.status() do
              {:ok, s} -> {s, GitManager.generate_commit_message()}
              {:error, _} -> {%{modified: [], added: [], deleted: []}, ""}
            end

          socket
          |> assign(:is_committing, false)
          |> assign(:git_status, new_status)
          |> assign(:commit_message, new_msg)
          |> assign(:git_diff, "")
          |> assign(:commit_result, %{status: "success", message: "Committed: #{hash}"})
          |> log_console(:info, "Committed changes: #{hash}")

        {:error, reason} ->
          socket
          |> assign(:is_committing, false)
          |> assign(:commit_result, %{status: "error", message: "#{reason}"})
          |> log_console(:error, "Commit failed: #{reason}")
      end

    {:noreply, socket}
  end

  def handle_event("push_commits", _params, socket) do
    socket = assign(socket, :is_pushing, true)

    socket =
      case GitManager.push() do
        :ok ->
          socket
          |> assign(:is_pushing, false)
          |> assign(:commit_result, %{status: "success", message: "Pushed to remote"})
          |> log_console(:info, "Pushed commits to remote")

        {:error, reason} ->
          socket
          |> assign(:is_pushing, false)
          |> assign(:commit_result, %{status: "error", message: "Push failed: #{reason}"})
          |> log_console(:error, "Push failed: #{reason}")
      end

    {:noreply, socket}
  end

  def handle_event("export_world_zip", _params, socket) do
    case GitManager.export_zip() do
      {:ok, zip_path} ->
        # Return the path to the frontend for download
        {:noreply,
         socket
         |> assign(:commit_result, %{status: "success", message: "Exported: #{zip_path}"})
         |> log_console(:info, "Exported world content to #{zip_path}")
         |> push_event("download_file", %{path: zip_path})}

      {:error, reason} ->
        {:noreply,
         socket
         |> assign(:commit_result, %{status: "error", message: "Export failed: #{reason}"})
         |> log_console(:error, "Export failed: #{reason}")}
    end
  end

  # =============================================================================
  # Dialogue Editor Event Handlers
  # =============================================================================

  # Handle dialogue editor without NPC (create new dialogue)
  def handle_event("show_dialogue_editor", _params, socket) do
    {:noreply,
     socket
     |> assign(:show_dialogue_editor, true)
     |> assign(:editing_dialogue_npc, nil)
     |> assign(:editing_dialogue_tree, %{})
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

  # =============================================================================
  # Dialogue Tree Management - Delegated to DialogueEventHandler
  # =============================================================================

  def handle_event("dialogue_update_entity", params, socket),
    do: DialogueEventHandler.handle_event("dialogue_update_entity", params, socket)

  def handle_event("dialogue_select_node", params, socket),
    do: DialogueEventHandler.handle_event("dialogue_select_node", params, socket)

  def handle_event("dialogue_toggle_preview", params, socket),
    do: DialogueEventHandler.handle_event("dialogue_toggle_preview", params, socket)

  def handle_event("dialogue_preview_reset", params, socket),
    do: DialogueEventHandler.handle_event("dialogue_preview_reset", params, socket)

  def handle_event("dialogue_preview_choice", params, socket),
    do: DialogueEventHandler.handle_event("dialogue_preview_choice", params, socket)

  def handle_event("dialogue_add_node", params, socket),
    do: DialogueEventHandler.handle_event("dialogue_add_node", params, socket)

  def handle_event("dialogue_delete_node", params, socket),
    do: DialogueEventHandler.handle_event("dialogue_delete_node", params, socket)

  def handle_event("dialogue_delete_node_confirmed", params, socket),
    do: DialogueEventHandler.handle_event("dialogue_delete_node_confirmed", params, socket)

  def handle_event("dialogue_update_node", params, socket),
    do: DialogueEventHandler.handle_event("dialogue_update_node", params, socket)

  def handle_event("dialogue_add_choice", params, socket),
    do: DialogueEventHandler.handle_event("dialogue_add_choice", params, socket)

  def handle_event("dialogue_delete_choice", params, socket),
    do: DialogueEventHandler.handle_event("dialogue_delete_choice", params, socket)

  def handle_event("validate_quest_chains", _params, socket) do
    # Run room validation first
    rooms = socket.assigns.rooms
    room_validation = ValidationManager.validation_summary(rooms)

    # Log summary to console
    socket = log_console(socket, :info, "Running validation...")

    socket =
      log_console(
        socket,
        :info,
        "Rooms: #{room_validation.error_count} errors, #{room_validation.warning_count} warnings"
      )

    # Update validation and show panel
    {:noreply,
     socket
     |> assign(:validation, room_validation)
     |> assign(:show_validation_panel, true)}
  end

  def handle_event("close_validation_panel", _params, socket) do
    {:noreply, assign(socket, :show_validation_panel, false)}
  end

  def handle_event("validation_jump_to", %{"message" => message}, socket) do
    # Try to extract room key from message like "Room 'xxx' is missing..."
    case Regex.run(~r/Room '([^']+)'/, message) do
      [_, room_key] ->
        {:noreply,
         socket
         |> assign(:selected_room, room_key)
         |> assign(:selected_entity, nil)
         |> assign(:active_tab, :rooms)
         |> assign(:show_validation_panel, false)
         |> log_console(:info, "Jumped to room: #{room_key}")
         |> push_event("select_room", %{key: room_key})}

      _ ->
        # Try to extract exit destination
        case Regex.run(~r/Exit '[^']+' points to non-existent room '([^']+)'/, message) do
          [_, dest_key] ->
            {:noreply,
             socket
             |> assign(:template_search, dest_key)
             |> assign(:show_validation_panel, false)
             |> log_console(:info, "Searching for: #{dest_key}")}

          _ ->
            {:noreply, socket}
        end
    end
  end

  def handle_event("clear_console", _params, socket) do
    {:noreply, assign(socket, :console_messages, [])}
  end

  # =============================================================================
  # LLM Tool Execution
  # =============================================================================

  # Handle tool result from client (logging/confirmation)
  def handle_event("tool_result", %{"tool" => tool, "result" => _result}, socket) do
    # Just log it, as the actual execution happened in execute_tool
    # This prevents the crash when the client bounces the result back
    {:noreply, log_console(socket, :info, "Tool #{tool} finished")}
  end

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
      {:ok, _deleted_room} ->
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

  # Build a combined list of entities (rooms, NPCs, items) for script attachment
  defp build_entity_list(rooms, npcs, items) do
    room_entities =
      Enum.map(rooms, fn r ->
        %{key: r.key, name: r.name || r.key, type: "room"}
      end)

    npc_entities =
      Enum.map(npcs, fn n ->
        %{key: n.key, name: n[:name] || n[:short_desc] || n.key, type: "npc"}
      end)

    item_entities =
      Enum.map(items, fn i ->
        %{key: i.key, name: i[:name] || i[:short_desc] || i.key, type: "item"}
      end)

    room_entities ++ npc_entities ++ item_entities
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

  # Build CSS custom properties for panel sizes
  defp panel_sizes_style(panel_sizes) do
    "--hierarchy-width: #{panel_sizes.hierarchy}px; " <>
      "--inspector-width: #{panel_sizes.inspector}px; " <>
      "--chat-width: #{panel_sizes.chat}px; " <>
      "--console-height: #{panel_sizes.console}px;"
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
  defp parse_integer(value, default) do
    case Integer.parse(value || "#{default}") do
      {int, _} -> int
      :error -> default
    end
  end

  # Generate a URL-safe key from a name
  defp slugify(nil), do: "room_#{:erlang.unique_integer([:positive])}"
  defp slugify(""), do: "room_#{:erlang.unique_integer([:positive])}"

  defp slugify(name) do
    name
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9_]/, "_")
    |> String.replace(~r/_+/, "_")
    |> String.trim("_")
    |> case do
      "" -> "room_#{:erlang.unique_integer([:positive])}"
      slug -> slug
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

  # Build a map of room_key -> list of spawn entries from zone resets
  # Each spawn entry is: %{type: :mob|:item, prototype: key, max: count, zone: zone_key}
  defp build_room_spawns_map(zones) do
    Enum.reduce(zones, %{}, fn zone, acc ->
      zone_key = zone.key
      resets = Zone.resets(zone)

      Enum.reduce(resets, acc, fn reset, room_acc ->
        # Handle both string and atom keys from YAML
        room_key = Map.get(reset, "room") || Map.get(reset, :room)
        spawn_type = Map.get(reset, "type") || Map.get(reset, :type)
        prototype = Map.get(reset, "prototype") || Map.get(reset, :prototype)
        max_count = Map.get(reset, "max") || Map.get(reset, :max, 1)

        if room_key && prototype do
          spawn_entry = %{
            type: normalize_spawn_type(spawn_type),
            prototype: prototype,
            max: max_count,
            zone: zone_key
          }

          Map.update(room_acc, room_key, [spawn_entry], fn existing ->
            [spawn_entry | existing]
          end)
        else
          room_acc
        end
      end)
    end)
  end

  defp normalize_spawn_type("mob"), do: :mob
  defp normalize_spawn_type("object"), do: :item
  defp normalize_spawn_type("item"), do: :item
  defp normalize_spawn_type(:mob), do: :mob
  defp normalize_spawn_type(:object), do: :item
  defp normalize_spawn_type(:item), do: :item
  defp normalize_spawn_type(_), do: :unknown
end
