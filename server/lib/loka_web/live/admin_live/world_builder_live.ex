defmodule LokaWeb.AdminLive.WorldBuilderLive do
  @moduledoc """
  World Builder LiveView - Unity-style world editor

  Pure LiveView architecture for building game worlds:
  - LiveView handles auth, real-time updates, validation, and all editors
  - Canvas2DViewport (JS hook) handles 2D map visualization
  - CodeMirror 6 (bundled JS) handles script code editing
  - Unity-style 4-panel docking layout (Hierarchy | Viewport | Inspector | Console)

  ## Architecture

  - LiveView: Auth, persistence, validation, real-time sync, all editors
  - JS Hooks: Canvas2DViewport (map), CodeMirrorEditor (scripts)
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
    NPCPathExtractor,
    Projects,
    AuditLog
  }

  alias Loka.Content.Zone

  alias LokaWeb.AdminLive.WorldBuilder.{
    Toolbar,
    HierarchyPanel,
    ViewportContainer,
    InspectorPanel,
    ChatPanel,
    TerminalPanel,
    InputValidator,
    SettingsModal,
    ScriptTemplatePicker,
    ScriptTemplateConfig,
    CommitModal,
    ValidationPanel,
    ConfirmationModal,
    CutsceneEventHandler,
    DialogueEventHandler,
    EntityEventHandler,
    GitEventHandler,
    ScriptTemplateEventHandler,
    KeyboardHelpModal,
    QuestFlowModal,
    DocumentViewer,
    AuditLogPanel
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
    scripts = ScriptManager.list_scripts()

    # Load zones and build room -> spawns mapping
    zones = Zone.all()
    room_spawns = build_room_spawns_map(zones)
    zone_colors = build_zone_color_map(zones)
    room_zone_map = build_room_zone_map(zones)

    # Extract NPC patrol paths for visualization
    npc_paths = NPCPathExtractor.extract_paths(npcs)

    # Run validation on rooms
    validation = ValidationManager.validation_summary(rooms)

    {:ok,
     socket
     |> assign(:rooms, rooms)
     |> assign(:selected_room, nil)
     |> assign(:selected_keys, [])
     |> assign(:templates, templates)
     |> assign(:template_search, "")
     |> assign(:zone_filter, nil)
     |> assign(:tag_filter, nil)
     |> assign(:zones, zones)
     |> assign(:active_tab, :templates)
     |> assign(:npcs, npcs)
     |> assign(:items, items)
     |> assign(:entity_list, build_entity_list(rooms, npcs, items))
     |> assign(:selected_entity, nil)
     |> assign(:quests, quests)
     |> assign(:cutscenes, cutscenes)
     |> assign(:scripts, scripts)
     |> assign(:zone_colors, zone_colors)
     |> assign(:room_zone_map, room_zone_map)
     |> assign(:show_zone_colors, true)
     |> assign(:npc_paths, npc_paths)
     |> assign(:show_npc_paths, true)
     |> assign(:room_spawns, room_spawns)
     |> assign(:show_npc_editor, false)
     |> assign(:show_item_editor, false)
     |> assign(:editing_mode, :map)
     |> assign(:show_quest_editor, false)
     |> assign(:show_cutscene_editor, false)
     |> assign(:quest_data, default_quest_data())
     |> assign(:cutscene_data, default_cutscene_data())
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
     |> assign(:dialogue_mock_state, %{
       active_quests: [],
       completed_quests: [],
       items: [],
       flags: []
     })
     |> assign(:console_messages, [
       %{timestamp: DateTime.utc_now(), level: :info, text: "World Builder ready"}
     ])
     |> assign(:console_filter, "")
     |> assign(:level_filter, "all")
     |> assign(:show_create_modal, false)
     |> assign(:validation, validation)
     |> assign(:show_validation_panel, false)
     |> assign(:show_settings, false)
     |> assign(:show_keyboard_help, false)
     |> assign(:show_quest_flow, false)
     |> assign(:selected_quest_flow, nil)
     |> assign(:quest_flow_filter, "all")
     |> assign(:highlighted_npc_path, nil)
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
       chat: false,
       terminal: true
     })
     |> assign(:panel_sizes, %{
       hierarchy: 240,
       inspector: 260,
       chat: 320,
       console: 150,
       terminal: 320
     })
     # Terminal panel token (JWT for GameChannel connection)
     |> assign(:terminal_token, generate_terminal_token(socket))
     # Projects panel state
     |> assign(:projects, Projects.list_projects())
     |> assign(:current_project, nil)
     |> assign(:project_docs, %{})
     |> assign(:expanded_projects, %{})
     |> assign(:selected_document, nil)
     |> assign(:document_content, nil)
     |> assign(:document_loading, false)
     |> assign(:document_error, nil)
     # Chat panel state
     |> assign(:chat_messages, [])
     |> assign(:chat_streaming, false)
     |> assign(:chat_current_response, "")
     |> assign(:chat_error, nil)
     |> assign(:pending_tool_results, [])
     |> assign(:chat_queued_messages, [])
     |> assign(:chat_current_tool, nil)
     |> assign(:chat_tool_step, 0)
     |> assign(:chat_total_steps, 0)
     |> assign(:chat_mode, :design)
     |> assign(:pending_validation, nil)
     # Audit log state
     |> assign(:show_audit_log, false)
     |> assign(:audit_entries, [])
     |> assign(:audit_loading, false)
     |> assign(:audit_filter, "all")
     |> assign(:camera_view, "perspective")
     |> assign(:undo_state, %{can_undo: false, can_redo: false, undo_count: 0, redo_count: 0})
     # Confirmation modal state (replaces browser-native confirm dialogs)
     |> assign(:confirm_modal, nil)
     # Initialize audit context for tracking admin actions
     |> Audit.init_context(socket.assigns[:current_player])
     |> push_event("init_world_builder", %{
       rooms: rooms,
       validation: validation.results,
       zone_colors: zone_colors,
       room_zone_map: room_zone_map,
       show_zone_colors: true,
       npc_paths: npc_paths,
       show_npc_paths: true
     })}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <div class="world-builder" phx-window-keydown="keyboard_shortcut">
      <Toolbar.toolbar
        undo_state={@undo_state}
        show_zone_colors={@show_zone_colors}
        show_npc_paths={@show_npc_paths}
        terminal_active={not @collapsed_panels.terminal}
      />
      
    <!-- Main panel layout with resize handles -->
      <div
        id="world-builder-panels"
        class={panel_container_classes(@collapsed_panels)}
        phx-hook="PanelResize"
        style={panel_sizes_style(@panel_sizes, @collapsed_panels)}
      >
        <HierarchyPanel.hierarchy_panel
          rooms={@rooms}
          npcs={@npcs}
          items={@items}
          templates={@templates}
          scripts={@scripts}
          cutscenes={@cutscenes}
          quests={@quests}
          zones={@zones}
          selected_room={@selected_room}
          selected_entity={@selected_entity}
          template_search={@template_search}
          zone_filter={@zone_filter}
          tag_filter={@tag_filter}
          active_tab={@active_tab}
          collapsed={@collapsed_panels.hierarchy}
        />

        <div class="panel-resize-handle" data-resize="hierarchy"></div>

        <ViewportContainer.viewport_container
          rooms={@rooms}
          selected_room={@selected_room}
          npc_paths={@npc_paths}
          show_npc_paths={@show_npc_paths}
          console_messages={@console_messages}
          console_filter={@console_filter}
          level_filter={@level_filter}
          console_collapsed={@collapsed_panels.console}
          console_height={@panel_sizes.console}
          editing_mode={@editing_mode}
          editing_script={@editing_script}
          editing_dialogue_tree={@editing_dialogue_tree}
          editing_dialogue_npc={@editing_dialogue_npc}
          dialogue_selected_node={@dialogue_selected_node}
          dialogue_preview_mode={@dialogue_preview_mode}
          dialogue_mock_state={@dialogue_mock_state}
          npcs={@npcs}
          entities_for_editor={@entity_list}
          quest_data={@quest_data}
          cutscene_data={@cutscene_data}
        />

        <div class="panel-resize-handle" data-resize="inspector"></div>

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

        <div class="panel-resize-handle" data-resize="terminal"></div>

        <TerminalPanel.terminal_panel
          token={@terminal_token}
          collapsed={@collapsed_panels.terminal}
        />

        <div class="panel-resize-handle" data-resize="chat"></div>

        <ChatPanel.chat_panel
          messages={@chat_messages}
          streaming={@chat_streaming}
          current_response={@chat_current_response}
          current_project={@current_project}
          projects={@projects}
          error={@chat_error}
          collapsed={@collapsed_panels.chat}
          queued_messages={@chat_queued_messages}
          current_tool={@chat_current_tool}
          tool_step={@chat_tool_step}
          total_steps={@chat_total_steps}
          chat_mode={@chat_mode}
          selected_room={@selected_room}
          selected_entity={@selected_entity}
        />
      </div>

      <div :if={@show_create_modal} class="modal-overlay">
        <div class="modal-content" phx-click-away="close_create_modal">
          <div class="flex items-center justify-between p-4 border-b border-wb-border">
            <h3 class="m-0 text-wb-text-bright text-base font-semibold">Create New Room</h3>
            <button
              phx-click="close_create_modal"
              class="bg-transparent border-0 text-wb-text-muted text-2xl cursor-pointer p-0 w-8 h-8 flex items-center justify-center rounded-wb-sm transition-all hover:bg-wb-border hover:text-wb-text-bright"
            >
              &times;
            </button>
          </div>
          <form phx-submit="submit_create_room">
            <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
              <label>Room Name</label>
              <input
                type="text"
                name="name"
                class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
                placeholder="e.g., Main Tavern"
                required
              />
            </div>

            <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
              <label>Description</label>
              <textarea
                name="description"
                class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] resize-y min-h-16 focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
                rows="3"
                placeholder="What the player sees when entering..."
              ></textarea>
            </div>

            <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
              <label>Position</label>
              <div class="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  name="x"
                  class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
                  placeholder="X"
                  value="0"
                />
                <input
                  type="number"
                  name="y"
                  class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
                  placeholder="Y"
                  value="0"
                />
                <input
                  type="number"
                  name="z"
                  class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
                  placeholder="Z"
                  value="0"
                />
              </div>
            </div>

            <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
              <label>
                Room Key <span class="text-base-content/50 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                name="key"
                class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
                placeholder="Auto-generated from name if empty"
              />
              <small class="text-base-content/50">
                Unique identifier - leave blank to auto-generate
              </small>
            </div>

            <div class="flex gap-2 justify-end pt-4 border-t border-wb-border mt-4">
              <button
                type="button"
                phx-click="close_create_modal"
                class="px-4 py-2 border-none rounded-wb-sm text-wb-base cursor-pointer transition-all duration-100 bg-wb-border text-wb-text hover:bg-wb-border-light hover:text-wb-text-bright"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="px-4 py-2 border-none rounded-wb-sm text-wb-base cursor-pointer transition-all duration-100 bg-wb-accent text-white hover:bg-wb-accent-hover"
              >
                Create Room
              </button>
            </div>
          </form>
        </div>
      </div>

      <%!-- NPC Editor Modal --%>
      <div :if={@show_npc_editor} class="modal-overlay">
        <div class="modal-content" phx-click-away="close_npc_editor">
          <div class="flex items-center justify-between p-4 border-b border-wb-border">
            <h3 class="m-0 text-wb-text-bright text-base font-semibold">Create New NPC</h3>
            <button
              phx-click="close_npc_editor"
              class="bg-transparent border-0 text-wb-text-muted text-2xl cursor-pointer p-0 w-8 h-8 flex items-center justify-center rounded-wb-sm transition-all hover:bg-wb-border hover:text-wb-text-bright"
            >
              &times;
            </button>
          </div>
          <form phx-submit="create_npc">
            <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
              <label>NPC Name</label>
              <input
                type="text"
                name="name"
                class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
                placeholder="e.g., Captain Reeves"
                required
              />
            </div>

            <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
              <label>Description</label>
              <textarea
                name="description"
                class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] resize-y min-h-16 focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
                rows="3"
                placeholder="What the player sees when looking..."
              ></textarea>
            </div>

            <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
              <label>Level</label>
              <input
                type="number"
                name="level"
                class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
                value="1"
                min="1"
              />
            </div>

            <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
              <label>
                NPC Key <span class="text-base-content/50 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                name="key"
                class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
                placeholder="Auto-generated from name if empty"
              />
              <small class="text-base-content/50">
                Unique identifier - leave blank to auto-generate
              </small>
            </div>

            <div class="flex gap-2 justify-end pt-4 border-t border-wb-border mt-4">
              <button
                type="button"
                phx-click="close_npc_editor"
                class="px-4 py-2 border-none rounded-wb-sm text-wb-base cursor-pointer transition-all duration-100 bg-wb-border text-wb-text hover:bg-wb-border-light hover:text-wb-text-bright"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="px-4 py-2 border-none rounded-wb-sm text-wb-base cursor-pointer transition-all duration-100 bg-wb-accent text-white hover:bg-wb-accent-hover"
              >
                Create NPC
              </button>
            </div>
          </form>
        </div>
      </div>

      <%!-- Item Editor Modal --%>
      <div :if={@show_item_editor} class="modal-overlay">
        <div class="modal-content" phx-click-away="close_item_editor">
          <div class="flex items-center justify-between p-4 border-b border-wb-border">
            <h3 class="m-0 text-wb-text-bright text-base font-semibold">Create New Item</h3>
            <button
              phx-click="close_item_editor"
              class="bg-transparent border-0 text-wb-text-muted text-2xl cursor-pointer p-0 w-8 h-8 flex items-center justify-center rounded-wb-sm transition-all hover:bg-wb-border hover:text-wb-text-bright"
            >
              &times;
            </button>
          </div>
          <form phx-submit="create_item">
            <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
              <label>Item Name</label>
              <input
                type="text"
                name="name"
                class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
                placeholder="e.g., Iron Sword"
                required
              />
            </div>

            <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
              <label>Item Type</label>
              <select
                name="item_type"
                class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
              >
                <option value="misc">Miscellaneous</option>
                <option value="weapon">Weapon</option>
                <option value="armor">Armor</option>
                <option value="consumable">Consumable</option>
                <option value="quest_item">Quest Item</option>
              </select>
            </div>

            <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
              <label>Description</label>
              <textarea
                name="description"
                class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] resize-y min-h-16 focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
                rows="3"
                placeholder="What the player sees when examining..."
              ></textarea>
            </div>

            <div class="grid grid-cols-[40%_1fr] items-center gap-2 mb-2">
              <label>
                Item Key <span class="text-base-content/50 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                name="key"
                class="w-full bg-wb-panel border border-wb-border rounded-wb-sm p-2 text-wb-text-bright text-wb-base font-[inherit] focus:outline-none focus:border-wb-accent focus:bg-wb-panel-alt"
                placeholder="Auto-generated from name if empty"
              />
              <small class="text-base-content/50">
                Unique identifier - leave blank to auto-generate
              </small>
            </div>

            <div class="flex gap-2 justify-end pt-4 border-t border-wb-border mt-4">
              <button
                type="button"
                phx-click="close_item_editor"
                class="px-4 py-2 border-none rounded-wb-sm text-wb-base cursor-pointer transition-all duration-100 bg-wb-border text-wb-text hover:bg-wb-border-light hover:text-wb-text-bright"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="px-4 py-2 border-none rounded-wb-sm text-wb-base cursor-pointer transition-all duration-100 bg-wb-accent text-white hover:bg-wb-accent-hover"
              >
                Create Item
              </button>
            </div>
          </form>
        </div>
      </div>

      <%!-- Quest/Cutscene editors now render inline in viewport_container --%>

      <%!-- Dialogue/Script editors now render inline in viewport_container --%>

      <%!-- Template Picker Modal --%>
      <ScriptTemplatePicker.script_template_picker
        :if={@show_template_picker}
        search={@template_search}
        selected_category={@template_category}
      />

      <%!-- Template Config Modal --%>
      <ScriptTemplateConfig.script_template_config
        :if={@show_template_config && @selected_template}
        template={@selected_template}
        config={@template_config}
        preview_code={@template_preview_code}
        validation_errors={@template_validation_errors}
      />

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

      <%!-- Keyboard Help Modal --%>
      <KeyboardHelpModal.keyboard_help_modal show={@show_keyboard_help} />

      <%!-- Audit Log Panel --%>
      <AuditLogPanel.audit_log_panel
        show={@show_audit_log}
        entries={@audit_entries}
        loading={@audit_loading}
        filter={@audit_filter}
      />

      <%!-- Quest Flow Modal --%>
      <QuestFlowModal.quest_flow_modal
        show={@show_quest_flow}
        quests={@quests}
        selected_quest={@selected_quest_flow}
        filter_type={@quest_flow_filter}
      />

      <%!-- Validation Panel --%>
      <ValidationPanel.validation_panel :if={@show_validation_panel} validation_results={@validation} />

      <%!-- Document Viewer Modal --%>
      <div
        :if={@selected_document}
        class="fixed top-[60px] right-[340px] bottom-5 w-[500px] z-[100] bg-wb-panel border border-wb-border rounded-wb-lg shadow-lg flex flex-col overflow-hidden"
      >
        <DocumentViewer.document_viewer
          document={@selected_document}
          content={@document_content}
          loading={@document_loading}
          error={@document_error}
        />
      </div>

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

  @impl true
  def handle_event("show_keyboard_help", _params, socket) do
    {:noreply, assign(socket, :show_keyboard_help, true)}
  end

  @impl true
  def handle_event("close_keyboard_help", _params, socket) do
    {:noreply, assign(socket, :show_keyboard_help, false)}
  end

  @impl true
  def handle_event("show_quest_flow", _params, socket) do
    {:noreply, assign(socket, :show_quest_flow, true)}
  end

  @impl true
  def handle_event("close_quest_flow", _params, socket) do
    {:noreply, assign(socket, :show_quest_flow, false)}
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

    if panel_atom in [:projects, :hierarchy, :inspector, :console, :chat, :terminal] do
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

  # Panel resize handler (called once on mouseup, not during drag)
  @impl true
  def handle_event("resize_panel", %{"panel" => panel, "size" => size}, socket) do
    panel_atom = String.to_existing_atom(panel)

    if panel_atom in [:hierarchy, :inspector, :chat, :console, :terminal] do
      sizes = socket.assigns.panel_sizes
      new_sizes = Map.put(sizes, panel_atom, size)
      {:noreply, assign(socket, :panel_sizes, new_sizes)}
    else
      {:noreply, socket}
    end
  end

  # Batched restore of all panel sizes from localStorage (single event on mount)
  @impl true
  def handle_event("restore_panel_sizes", %{"sizes" => sizes}, socket) do
    valid_panels = [:hierarchy, :inspector, :chat, :console, :terminal]

    new_sizes =
      Enum.reduce(sizes, socket.assigns.panel_sizes, fn {panel, size}, acc ->
        panel_atom = String.to_existing_atom(panel)

        if panel_atom in valid_panels do
          Map.put(acc, panel_atom, size)
        else
          acc
        end
      end)

    {:noreply, assign(socket, :panel_sizes, new_sizes)}
  end

  # Zone visualization toggle
  @impl true
  def handle_event("toggle_zone_colors", _params, socket) do
    new_value = !socket.assigns.show_zone_colors

    {:noreply,
     socket
     |> assign(:show_zone_colors, new_value)
     |> push_event("zone_colors_changed", %{
       enabled: new_value,
       zone_colors: socket.assigns.zone_colors,
       room_zone_map: socket.assigns.room_zone_map
     })}
  end

  # NPC paths visualization toggle
  @impl true
  def handle_event("toggle_npc_paths", _params, socket) do
    new_value = !socket.assigns.show_npc_paths

    {:noreply,
     socket
     |> assign(:show_npc_paths, new_value)
     |> push_event("npc_paths_changed", %{
       enabled: new_value,
       npc_paths: socket.assigns.npc_paths
     })}
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
    # Global keyboard shortcuts
    case key do
      # Panel toggles
      "1" ->
        toggle_panel(socket, :hierarchy)

      "2" ->
        toggle_panel(socket, :inspector)

      "3" ->
        toggle_panel(socket, :console)

      "4" ->
        toggle_panel(socket, :chat)

      "5" ->
        toggle_panel(socket, :terminal)

      # Escape cancels streaming or closes modals
      "Escape" ->
        cond do
          socket.assigns.chat_streaming ->
            {:noreply, Loka.WorldBuilder.Chat.cancel_streaming(socket)}

          socket.assigns.show_audit_log ->
            {:noreply, assign(socket, :show_audit_log, false)}

          socket.assigns.show_keyboard_help ->
            {:noreply, assign(socket, :show_keyboard_help, false)}

          true ->
            {:noreply, socket}
        end

      _ ->
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
    type_atom =
      case type do
        nil -> nil
        "" -> nil
        t -> String.to_existing_atom(t)
      end

    {:noreply,
     socket
     |> assign(:selected_entity, if(type_atom, do: %{type: type_atom, key: key}, else: nil))
     |> assign(:selected_room, nil)
     |> assign(:selected_keys, [])
     |> log_console(
       :info,
       if(type_atom, do: "Selected #{type}: #{key}", else: "Deselected entity")
     )
     |> push_event("select_entity", %{type: type, key: key})}
  end

  def handle_event("switch_hierarchy_tab", %{"tab" => tab}, socket) do
    # Allow npcs, items tabs in addition to rooms, templates
    tab_atom =
      case tab do
        "rooms" -> :rooms
        "npcs" -> :npcs
        "items" -> :items
        "templates" -> :templates
        "scripts" -> :scripts
        "cutscenes" -> :cutscenes
        "quests" -> :quests
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

  def handle_event("move_room", %{"key" => key, "x" => x, "y" => y}, socket) do
    new_x = parse_integer(x, 0)
    new_y = parse_integer(y, 0)

    # Get current room state for undo recording
    before_state =
      case RoomManager.get_room(key) do
        {:ok, room} -> %{x: room.x, y: room.y}
        _ -> nil
      end

    case RoomManager.update_room(key, %{"x" => new_x, "y" => new_y}) do
      {:ok, room} ->
        {:noreply,
         socket
         |> assign(:rooms, RoomManager.list_rooms())
         |> push_event("room_updated", %{room: room})
         |> push_event("record_operation", %{
           type: "move_room",
           beforeState: before_state,
           afterState: %{x: new_x, y: new_y},
           metadata: %{key: key, entity_type: :room}
         })}

      {:error, reason} ->
        {:noreply,
         log_console(
           socket,
           :error,
           "Move failed: #{sanitize_error(reason, "move_room")}"
         )}
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

  def handle_event("duplicate_room", %{"key" => key}, socket) do
    case Loka.WorldBuilder.BatchOperations.duplicate_room(key) do
      {:ok, new_room} ->
        {:noreply,
         socket
         |> assign(:rooms, RoomManager.list_rooms())
         |> update_entity_list()
         |> assign(:selected_room, new_room.key)
         |> log_console(:info, "Duplicated room: #{key} -> #{new_room.key}")
         |> push_event("room_created", %{room: new_room})}

      {:error, reason} ->
        {:noreply,
         log_console(socket, :error, "Failed to duplicate room: #{sanitize_error(reason, "")}")}
    end
  end

  def handle_event("duplicate_entity", %{"type" => type, "key" => key}, socket) do
    type_atom = String.to_existing_atom(type)

    case Loka.WorldBuilder.EntityManager.duplicate_entity(type_atom, key) do
      {:ok, new_entity} ->
        # Refresh the appropriate entity list
        socket =
          case type_atom do
            :npc -> assign(socket, :npcs, EntityManager.list_entities(:npc))
            :item -> assign(socket, :items, EntityManager.list_entities(:item))
            _ -> socket
          end

        {:noreply,
         socket
         |> update_entity_list()
         |> assign(:selected_entity, %{type: type_atom, key: new_entity.key})
         |> log_console(:info, "Duplicated #{type}: #{key} -> #{new_entity.key}")}

      {:error, reason} ->
        {:noreply,
         log_console(socket, :error, "Failed to duplicate #{type}: #{sanitize_error(reason, "")}")}
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
  def handle_event("search_entities", params, socket) do
    query = Map.get(params, "query", socket.assigns.template_search)
    zone_filter = Map.get(params, "zone_filter", socket.assigns.zone_filter)
    tag_filter = Map.get(params, "tag_filter", socket.assigns.tag_filter)

    # Normalize empty strings to nil
    zone_filter = if zone_filter == "", do: nil, else: zone_filter
    tag_filter = if tag_filter == "", do: nil, else: tag_filter

    {:noreply,
     socket
     |> assign(:template_search, query)
     |> assign(:zone_filter, zone_filter)
     |> assign(:tag_filter, tag_filter)}
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
        %{"entity_type" => _type, "entity_key" => key} = params,
        socket
      ) do
    # Open script editor with entity pre-selected
    {:noreply,
     socket
     |> assign(:show_script_editor, true)
     |> assign(:editing_script, %{
       key: "",
       name: "",
       description: "",
       hook: "on_talk",
       source: "",
       tags: [],
       entity_key: key,
       entity_type: params["entity_type"]
     })
     |> assign(:editing_mode, :script)
     |> log_console(:info, "Opening script editor for #{params["entity_type"]}: #{key}")}
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
     |> assign(:editing_mode, :dialogue)
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

  def handle_event("show_quest_editor", params, socket) do
    quest_data =
      case params do
        %{"key" => key} when key != "" ->
          case Enum.find(socket.assigns.quests, &(&1.key == key)) do
            nil -> default_quest_data()
            quest -> quest_to_editor_format(quest)
          end

        _ ->
          default_quest_data()
      end

    {:noreply,
     socket
     |> assign(:show_quest_editor, true)
     |> assign(:quest_data, quest_data)
     |> assign(:editing_mode, :quest)}
  end

  def handle_event("close_quest_editor", _params, socket) do
    {:noreply,
     socket
     |> assign(:show_quest_editor, false)
     |> assign(:editing_mode, :map)}
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
             |> assign(:editing_mode, :map)
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
    {:noreply,
     socket
     |> assign(:show_cutscene_editor, true)
     |> assign(:cutscene_data, default_cutscene_data())
     |> assign(:editing_mode, :cutscene)}
  end

  def handle_event("close_cutscene_editor", _params, socket) do
    {:noreply,
     socket
     |> assign(:show_cutscene_editor, false)
     |> assign(:editing_mode, :map)}
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
                _editing: true
              }

            {:error, _} ->
              %{key: "", name: "", description: "", hook: "on_talk", source: "", tags: []}
          end

        _ ->
          %{key: "", name: "", description: "", hook: "on_talk", source: "", tags: []}
      end

    {:noreply,
     socket
     |> assign(:show_script_editor, true)
     |> assign(:editing_script, editing_script)
     |> assign(:editing_mode, :script)}
  end

  def handle_event("close_script_editor", _params, socket) do
    {:noreply,
     socket
     |> assign(:show_script_editor, false)
     |> assign(:editing_script, nil)
     |> assign(:editing_mode, :map)}
  end

  def handle_event("save_script", _params, socket) do
    script = socket.assigns.editing_script || %{}

    tags =
      case script[:tags] do
        t when is_binary(t) ->
          t |> String.split(",") |> Enum.map(&String.trim/1) |> Enum.reject(&(&1 == ""))

        t when is_list(t) ->
          t

        _ ->
          []
      end

    attrs = %{
      key: script[:key] || "",
      name: script[:name] || script[:key] || "",
      description: script[:description] || "",
      hook: script[:hook] || "on_talk",
      source: script[:source] || "",
      tags: tags,
      entity_key: script[:entity_key]
    }

    # Determine if editing existing or creating new
    is_editing = script[:key] && script[:key] != "" && script[:_editing]

    result =
      if is_editing do
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
         |> assign(:editing_mode, :map)
         |> log_console(:info, "Saved script: #{script.key}")}

      {:error, errors} when is_list(errors) ->
        {:noreply,
         log_console(socket, :error, "Failed to save script: #{Enum.join(errors, ", ")}")}

      {:error, reason} ->
        {:noreply, log_console(socket, :error, "Failed to save script: #{inspect(reason)}")}
    end
  end

  # =============================================================================
  # Quest Editor LiveView Event Handlers
  # =============================================================================

  def handle_event("quest_update_field", %{"field" => field, "value" => value}, socket) do
    quest_data = Map.put(socket.assigns.quest_data, String.to_existing_atom(field), value)
    {:noreply, assign(socket, :quest_data, quest_data)}
  end

  def handle_event("quest_add_objective", _params, socket) do
    objectives =
      socket.assigns.quest_data.objectives ++
        [%{type: "kill", target: "", count: 1, description: ""}]

    quest_data = %{socket.assigns.quest_data | objectives: objectives}
    {:noreply, assign(socket, :quest_data, quest_data)}
  end

  def handle_event("quest_remove_objective", %{"idx" => idx}, socket) do
    idx = String.to_integer(idx)
    objectives = List.delete_at(socket.assigns.quest_data.objectives, idx)
    quest_data = %{socket.assigns.quest_data | objectives: objectives}
    {:noreply, assign(socket, :quest_data, quest_data)}
  end

  def handle_event(
        "quest_update_objective",
        %{"idx" => idx, "field" => field, "value" => value},
        socket
      ) do
    idx = String.to_integer(idx)

    objectives =
      List.update_at(socket.assigns.quest_data.objectives, idx, fn obj ->
        Map.put(obj, String.to_existing_atom(field), value)
      end)

    quest_data = %{socket.assigns.quest_data | objectives: objectives}
    {:noreply, assign(socket, :quest_data, quest_data)}
  end

  def handle_event("quest_add_prerequisite", _params, socket) do
    prerequisites =
      socket.assigns.quest_data.prerequisites ++ [%{type: "quest", value: ""}]

    quest_data = %{socket.assigns.quest_data | prerequisites: prerequisites}
    {:noreply, assign(socket, :quest_data, quest_data)}
  end

  def handle_event("quest_remove_prerequisite", %{"idx" => idx}, socket) do
    idx = String.to_integer(idx)
    prerequisites = List.delete_at(socket.assigns.quest_data.prerequisites, idx)
    quest_data = %{socket.assigns.quest_data | prerequisites: prerequisites}
    {:noreply, assign(socket, :quest_data, quest_data)}
  end

  def handle_event(
        "quest_update_prerequisite",
        %{"idx" => idx, "field" => field, "value" => value},
        socket
      ) do
    idx = String.to_integer(idx)

    prerequisites =
      List.update_at(socket.assigns.quest_data.prerequisites, idx, fn prereq ->
        Map.put(prereq, String.to_existing_atom(field), value)
      end)

    quest_data = %{socket.assigns.quest_data | prerequisites: prerequisites}
    {:noreply, assign(socket, :quest_data, quest_data)}
  end

  def handle_event("quest_save", _params, socket) do
    data = socket.assigns.quest_data

    quest_params = %{
      "key" => data.key,
      "name" => data.name,
      "quest_type" => data.quest_type,
      "giver_key" => data.giver_key,
      "objectives" => Enum.map(data.objectives, &Map.new(&1, fn {k, v} -> {to_string(k), v} end)),
      "rewards" => %{
        "xp" => data.xp,
        "gold" => data.gold,
        "items" =>
          data.reward_items
          |> String.split(",")
          |> Enum.map(&String.trim/1)
          |> Enum.reject(&(&1 == ""))
      }
    }

    handle_event("create_quest", quest_params, socket)
  end

  # =============================================================================
  # Cutscene Editor LiveView Event Handlers
  # =============================================================================

  # Cutscene editing events (delegated to CutsceneEventHandler)
  def handle_event("cutscene_update_field" = e, p, s),
    do: CutsceneEventHandler.handle_event(e, p, s)

  def handle_event("cutscene_update_trigger" = e, p, s),
    do: CutsceneEventHandler.handle_event(e, p, s)

  def handle_event("cutscene_add_step" = e, p, s), do: CutsceneEventHandler.handle_event(e, p, s)

  def handle_event("cutscene_remove_step" = e, p, s),
    do: CutsceneEventHandler.handle_event(e, p, s)

  def handle_event("cutscene_update_step" = e, p, s),
    do: CutsceneEventHandler.handle_event(e, p, s)

  def handle_event("cutscene_move_step_up" = e, p, s),
    do: CutsceneEventHandler.handle_event(e, p, s)

  def handle_event("cutscene_move_step_down" = e, p, s),
    do: CutsceneEventHandler.handle_event(e, p, s)

  def handle_event("cutscene_add_effect" = e, p, s),
    do: CutsceneEventHandler.handle_event(e, p, s)

  def handle_event("cutscene_remove_effect" = e, p, s),
    do: CutsceneEventHandler.handle_event(e, p, s)

  def handle_event("cutscene_update_effect" = e, p, s),
    do: CutsceneEventHandler.handle_event(e, p, s)

  def handle_event("cutscene_save" = e, p, s), do: CutsceneEventHandler.handle_event(e, p, s)

  # =============================================================================
  # Script Editor LiveView Event Handlers
  # =============================================================================

  def handle_event("script_update_field", %{"field" => field, "value" => value}, socket) do
    editing_script = socket.assigns.editing_script || %{}
    editing_script = Map.put(editing_script, String.to_existing_atom(field), value)
    {:noreply, assign(socket, :editing_script, editing_script)}
  end

  def handle_event("script_source_changed", %{"source" => source}, socket) do
    editing_script = socket.assigns.editing_script || %{}
    editing_script = Map.put(editing_script, :source, source)
    {:noreply, assign(socket, :editing_script, editing_script)}
  end

  # =============================================================================
  # Template Picker Event Handlers (delegated to ScriptTemplateEventHandler)
  # =============================================================================

  def handle_event("show_template_picker" = e, p, s),
    do: ScriptTemplateEventHandler.handle_event(e, p, s)

  def handle_event("close_template_picker" = e, p, s),
    do: ScriptTemplateEventHandler.handle_event(e, p, s)

  def handle_event("template_search" = e, p, s),
    do: ScriptTemplateEventHandler.handle_event(e, p, s)

  def handle_event("filter_category" = e, p, s),
    do: ScriptTemplateEventHandler.handle_event(e, p, s)

  def handle_event("select_template" = e, p, s),
    do: ScriptTemplateEventHandler.handle_event(e, p, s)

  def handle_event("close_template_config" = e, p, s),
    do: ScriptTemplateEventHandler.handle_event(e, p, s)

  def handle_event("back_to_picker" = e, p, s),
    do: ScriptTemplateEventHandler.handle_event(e, p, s)

  def handle_event("update_template_config" = e, p, s),
    do: ScriptTemplateEventHandler.handle_event(e, p, s)

  def handle_event("update_template_config_bool" = e, p, s),
    do: ScriptTemplateEventHandler.handle_event(e, p, s)

  def handle_event("update_template_config_select" = e, p, s),
    do: ScriptTemplateEventHandler.handle_event(e, p, s)

  def handle_event("create_script_from_template" = e, p, s),
    do: ScriptTemplateEventHandler.handle_event(e, p, s)

  # =============================================================================
  # Git Commit Modal Event Handlers (delegated to GitEventHandler)
  # =============================================================================

  def handle_event("show_commit_modal" = e, p, s), do: GitEventHandler.handle_event(e, p, s)
  def handle_event("close_commit_modal" = e, p, s), do: GitEventHandler.handle_event(e, p, s)
  def handle_event("refresh_git_status" = e, p, s), do: GitEventHandler.handle_event(e, p, s)
  def handle_event("show_file_diff" = e, p, s), do: GitEventHandler.handle_event(e, p, s)
  def handle_event("update_commit_message" = e, p, s), do: GitEventHandler.handle_event(e, p, s)
  def handle_event("stage_and_commit" = e, p, s), do: GitEventHandler.handle_event(e, p, s)
  def handle_event("push_commits" = e, p, s), do: GitEventHandler.handle_event(e, p, s)
  def handle_event("export_world_zip" = e, p, s), do: GitEventHandler.handle_event(e, p, s)

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
     |> assign(:dialogue_preview_mode, false)
     |> assign(:editing_mode, :dialogue)}
  end

  def handle_event("close_dialogue_editor", _params, socket) do
    {:noreply,
     socket
     |> assign(:show_dialogue_editor, false)
     |> assign(:editing_dialogue_npc, nil)
     |> assign(:editing_dialogue_tree, %{})
     |> assign(:dialogue_selected_node, nil)
     |> assign(:dialogue_preview_mode, false)
     |> assign(:editing_mode, :map)}
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

  # Dialogue mock state handlers for testing conditions
  def handle_event("dialogue_mock_add", %{"type" => _type}, socket) do
    # Input values are handled via keydown event
    {:noreply, socket}
  end

  def handle_event(
        "dialogue_mock_add_keydown",
        %{"key" => "Enter", "type" => type, "value" => value},
        socket
      )
      when value != "" do
    type_atom = String.to_existing_atom(type)
    current = Map.get(socket.assigns.dialogue_mock_state, type_atom, [])

    unless value in current do
      new_state = Map.put(socket.assigns.dialogue_mock_state, type_atom, current ++ [value])
      {:noreply, assign(socket, :dialogue_mock_state, new_state)}
    else
      {:noreply, socket}
    end
  end

  def handle_event("dialogue_mock_add_keydown", _params, socket), do: {:noreply, socket}

  def handle_event("dialogue_mock_remove", %{"type" => type, "value" => value}, socket) do
    type_atom = String.to_existing_atom(type)
    current = Map.get(socket.assigns.dialogue_mock_state, type_atom, [])
    new_list = List.delete(current, value)
    new_state = Map.put(socket.assigns.dialogue_mock_state, type_atom, new_list)
    {:noreply, assign(socket, :dialogue_mock_state, new_state)}
  end

  def handle_event("dialogue_mock_reset", _params, socket) do
    {:noreply,
     assign(socket, :dialogue_mock_state, %{
       active_quests: [],
       completed_quests: [],
       items: [],
       flags: [],
       level: 1,
       phase: "day",
       stats: %{},
       factions: %{}
     })}
  end

  def handle_event("dialogue_mock_set_level", %{"level" => level}, socket) do
    level_int =
      case Integer.parse(level) do
        {n, _} -> max(1, min(n, 100))
        :error -> 1
      end

    new_state = Map.put(socket.assigns.dialogue_mock_state, :level, level_int)
    {:noreply, assign(socket, :dialogue_mock_state, new_state)}
  end

  def handle_event("dialogue_mock_set_phase", %{"phase" => phase}, socket) do
    valid_phases = ~w(day night dawn dusk)
    phase = if phase in valid_phases, do: phase, else: "day"
    new_state = Map.put(socket.assigns.dialogue_mock_state, :phase, phase)
    {:noreply, assign(socket, :dialogue_mock_state, new_state)}
  end

  # Quest Flow Modal handlers
  def handle_event("quest_flow_select", %{"key" => ""}, socket) do
    {:noreply, assign(socket, :selected_quest_flow, nil)}
  end

  def handle_event("quest_flow_select", %{"key" => key}, socket) do
    {:noreply, assign(socket, :selected_quest_flow, key)}
  end

  def handle_event("quest_flow_filter", %{"type" => type}, socket) do
    {:noreply, assign(socket, :quest_flow_filter, type)}
  end

  def handle_event("quest_flow_edit_dialogue", %{"npc" => npc_key}, socket) do
    # Close quest flow and open dialogue editor for the NPC
    {:noreply,
     socket
     |> assign(:show_quest_flow, false)
     |> assign(:dialogue_editor_npc, npc_key)
     |> assign(:show_dialogue_editor, true)}
  end

  # NPC Path highlighting
  def handle_event("highlight_npc_path", %{"npc" => npc_key}, socket) do
    # Toggle highlight - if already highlighted, clear it
    current = socket.assigns[:highlighted_npc_path]

    new_highlight =
      if current == npc_key do
        nil
      else
        npc_key
      end

    socket =
      socket
      |> assign(:highlighted_npc_path, new_highlight)
      |> push_event("highlight_npc_path", %{npc_key: new_highlight})

    {:noreply, socket}
  end

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
    {:noreply,
     socket
     |> assign(:console_messages, [])
     |> assign(:console_filter, "")
     |> assign(:level_filter, "all")}
  end

  def handle_event("filter_console", %{"filter" => filter}, socket) do
    {:noreply, assign(socket, :console_filter, filter)}
  end

  def handle_event("filter_console_level", %{"level" => level}, socket) do
    {:noreply, assign(socket, :level_filter, level)}
  end

  def handle_event("export_console", _params, socket) do
    messages = socket.assigns.console_messages
    content = format_console_export(messages)
    filename = "world_builder_log_#{Date.to_string(Date.utc_today())}.txt"

    {:noreply,
     socket
     |> push_event("download_text", %{content: content, filename: filename})
     |> log_console(:info, "Exported #{length(messages)} log entries")}
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

  def handle_event("execute_tool", params, socket) do
    tool_name = params["name"]
    input = params["input"]
    project_key = params["project_key"]
    conversation_id = params["conversation_id"]

    # Execute tool via ToolExecutor with project context
    opts = [project_key: project_key, conversation_id: conversation_id]
    result = ToolExecutor.execute(tool_name, input, opts)
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
          socket
          |> assign(:npcs, EntityManager.list_entities(:npc))
          |> update_entity_list()

        "create_item" ->
          socket
          |> assign(:items, EntityManager.list_entities(:item))
          |> update_entity_list()

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
  # Project Management Events
  # =============================================================================

  # Chat panel events (for React ChatPanel)
  def handle_event("fetch_projects", _params, socket) do
    projects = Projects.list_projects()
    {:reply, %{projects: projects}, socket}
  end

  def handle_event("fetch_project_docs", %{"project_key" => project_key}, socket) do
    docs = Projects.list_docs(project_key)

    doc_list =
      Enum.map(docs, fn doc ->
        %{
          filename: doc.filename,
          doc_type: doc.doc_type,
          version: doc.version
        }
      end)

    {:reply, %{documents: doc_list}, socket}
  end

  def handle_event("fetch_document_content", params, socket) do
    project_key = params["project_key"]
    filename = params["filename"]

    case Projects.get_doc(project_key, filename) do
      {:ok, doc} ->
        {:reply, %{content: doc.content}, socket}

      {:error, :not_found} ->
        {:reply, %{error: "Document not found"}, socket}
    end
  end

  def handle_event("create_project_ui", %{"key" => key, "name" => name}, socket) do
    case Projects.create_project(key, name, "") do
      {:ok, _doc} ->
        socket =
          socket
          |> assign(:projects, Projects.list_projects())
          |> assign(:current_project, %{key: key})

        {:noreply, socket}

      {:error, changeset} ->
        {:noreply,
         assign(socket, :chat_error, "Failed to create project: #{inspect(changeset.errors)}")}
    end
  end

  def handle_event("create_project_ui", _params, socket) do
    key = "project_#{:rand.uniform(9999)}"
    name = "New Project"

    case Projects.create_project(key, name, "") do
      {:ok, _doc} ->
        socket =
          socket
          |> assign(:projects, Projects.list_projects())
          |> assign(:current_project, %{key: key})

        {:noreply, socket}

      {:error, _changeset} ->
        {:noreply, socket}
    end
  end

  # Projects Panel UI events (for LiveView ProjectsPanel)
  def handle_event("refresh_projects", _params, socket) do
    {:noreply, assign(socket, :projects, Projects.list_projects())}
  end

  def handle_event("new_project_modal", _params, socket) do
    # For now, use a simple prompt - can enhance with modal later
    {:noreply, socket}
  end

  def handle_event("select_project", %{"project_key" => project_key}, socket) do
    # Toggle expansion
    expanded = socket.assigns.expanded_projects
    is_expanded = Map.get(expanded, project_key, false)

    socket =
      socket
      |> assign(:current_project, %{key: project_key})
      |> assign(:expanded_projects, Map.put(expanded, project_key, !is_expanded))

    # Load docs if expanding and not already loaded
    socket =
      if !is_expanded && !Map.has_key?(socket.assigns.project_docs, project_key) do
        docs = Projects.list_docs(project_key)

        doc_list =
          Enum.map(docs, fn doc ->
            %{
              filename: doc.filename,
              doc_type: doc.doc_type,
              version: doc.version
            }
          end)

        assign(socket, :project_docs, Map.put(socket.assigns.project_docs, project_key, doc_list))
      else
        socket
      end

    {:noreply, socket}
  end

  def handle_event("select_document", %{"project" => project_key, "filename" => filename}, socket) do
    socket =
      socket
      |> assign(:selected_document, %{project_key: project_key, filename: filename})
      |> assign(:document_loading, true)
      |> assign(:document_error, nil)

    case Projects.get_doc(project_key, filename) do
      {:ok, doc} ->
        {:noreply,
         socket
         |> assign(:selected_document, %{
           project_key: project_key,
           filename: doc.filename,
           doc_type: doc.doc_type,
           version: doc.version
         })
         |> assign(:document_content, doc.content)
         |> assign(:document_loading, false)}

      {:error, :not_found} ->
        {:noreply,
         socket
         |> assign(:document_error, "Document not found")
         |> assign(:document_loading, false)}
    end
  end

  def handle_event("refresh_document", _params, socket) do
    case socket.assigns.selected_document do
      %{project_key: project_key, filename: filename} ->
        handle_event(
          "select_document",
          %{"project" => project_key, "filename" => filename},
          socket
        )

      _ ->
        {:noreply, socket}
    end
  end

  def handle_event("close_document", _params, socket) do
    {:noreply,
     socket
     |> assign(:selected_document, nil)
     |> assign(:document_content, nil)
     |> assign(:document_error, nil)}
  end

  # =============================================================================
  # Audit Log Events
  # =============================================================================

  def handle_event("show_audit_log", _params, socket) do
    project_key = get_in(socket.assigns, [:current_project, :key])

    socket =
      socket
      |> assign(:show_audit_log, true)
      |> assign(:audit_loading, true)

    # Load entries in background
    send(self(), {:load_audit_entries, project_key})

    {:noreply, socket}
  end

  def handle_event("close_audit_log", _params, socket) do
    {:noreply, assign(socket, :show_audit_log, false)}
  end

  def handle_event("refresh_audit_log", _params, socket) do
    project_key = get_in(socket.assigns, [:current_project, :key])
    send(self(), {:load_audit_entries, project_key})
    {:noreply, assign(socket, :audit_loading, true)}
  end

  def handle_event("audit_filter_changed", %{"filter" => filter}, socket) do
    project_key = get_in(socket.assigns, [:current_project, :key])

    socket =
      socket
      |> assign(:audit_filter, filter)
      |> assign(:audit_loading, true)

    send(self(), {:load_audit_entries, project_key})
    {:noreply, socket}
  end

  # =============================================================================
  # Chat Panel Events
  # =============================================================================

  def handle_event("send_message", %{"message" => message}, socket) do
    message = String.trim(message)

    if message != "" do
      {:noreply, Loka.WorldBuilder.Chat.send_message(socket, message)}
    else
      {:noreply, socket}
    end
  end

  # Unified handler: sends if not streaming, queues if streaming
  def handle_event("send_or_queue_message", %{"message" => message}, socket) do
    message = String.trim(message)

    if message != "" do
      if socket.assigns.chat_streaming do
        {:noreply, Loka.WorldBuilder.Chat.queue_message(socket, message)}
      else
        {:noreply, Loka.WorldBuilder.Chat.send_message(socket, message)}
      end
    else
      {:noreply, socket}
    end
  end

  def handle_event("queue_message", %{"message" => message}, socket) do
    message = String.trim(message)

    if message != "" do
      {:noreply, Loka.WorldBuilder.Chat.queue_message(socket, message)}
    else
      {:noreply, socket}
    end
  end

  def handle_event("clear_queue", _params, socket) do
    {:noreply, Loka.WorldBuilder.Chat.clear_queue(socket)}
  end

  def handle_event("quick_chat", %{"prompt" => prompt}, socket) do
    prompt = String.trim(prompt)

    if prompt != "" do
      {:noreply, Loka.WorldBuilder.Chat.send_message(socket, prompt)}
    else
      {:noreply, socket}
    end
  end

  def handle_event("textarea_keydown", %{"key" => "Enter", "ctrlKey" => true}, socket) do
    # Ctrl+Enter submits - this would need JS to capture the textarea value
    # For now, we rely on the form submit
    {:noreply, socket}
  end

  def handle_event("textarea_keydown", _params, socket) do
    {:noreply, socket}
  end

  def handle_event("clear_chat", _params, socket) do
    {:noreply, Loka.WorldBuilder.Chat.clear_chat(socket)}
  end

  def handle_event("cancel_streaming", _params, socket) do
    {:noreply, Loka.WorldBuilder.Chat.cancel_streaming(socket)}
  end

  def handle_event("toggle_chat_mode", _params, socket) do
    new_mode = if socket.assigns.chat_mode == :design, do: :assist, else: :design
    {:noreply, assign(socket, :chat_mode, new_mode)}
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

  defp restore_state("move_room", state, %{"key" => key}, socket) when is_map(state) do
    x = state["x"] || state[:x]
    y = state["y"] || state[:y]

    case RoomManager.update_room(key, %{"x" => x, "y" => y}) do
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

  defp log_console(socket, level, text) do
    message = %{timestamp: DateTime.utc_now(), level: level, text: text}

    assign(socket, :console_messages, socket.assigns.console_messages ++ [message])
  end

  defp format_console_export(messages) do
    header = """
    # World Builder Console Log
    # Exported: #{DateTime.to_string(DateTime.utc_now())}
    # Total entries: #{length(messages)}

    """

    entries =
      Enum.map_join(messages, "\n", fn msg ->
        ts =
          case msg.timestamp do
            %DateTime{} = dt -> dt |> DateTime.to_time() |> Time.to_string() |> String.slice(0, 8)
            other -> to_string(other)
          end

        "[#{ts}] [#{String.upcase(to_string(msg.level))}] #{msg[:text] || msg[:message]}"
      end)

    header <> entries
  end

  # Recalculate cached entity list from current assigns
  defp update_entity_list(socket) do
    assign(
      socket,
      :entity_list,
      build_entity_list(socket.assigns.rooms, socket.assigns.npcs, socket.assigns.items)
    )
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

  # =============================================================================
  # Handle Info - Anthropic Streaming Events
  # =============================================================================

  @impl true
  def handle_info({:anthropic_text_delta, text}, socket) do
    {:noreply, Loka.WorldBuilder.Chat.handle_text_delta(socket, text)}
  end

  @impl true
  def handle_info({:anthropic_tool_use, tool_name, tool_id, input}, socket) do
    socket = Loka.WorldBuilder.Chat.handle_tool_use(socket, tool_name, tool_id, input)

    # Refresh rooms/map when room-related tools execute
    socket =
      if room_tool?(tool_name) do
        refresh_rooms_with_validation(socket)
      else
        socket
      end

    {:noreply, socket}
  end

  @impl true
  def handle_info({:anthropic_done, response}, socket) do
    {:noreply, Loka.WorldBuilder.Chat.handle_done(socket, response)}
  end

  @impl true
  def handle_info({:anthropic_error, error}, socket) do
    {:noreply, Loka.WorldBuilder.Chat.handle_error(socket, error)}
  end

  @impl true
  def handle_info({:load_audit_entries, project_key}, socket) do
    entries =
      case socket.assigns.audit_filter do
        "error" ->
          AuditLog.list_errors(project_key: project_key, limit: 100)

        "success" ->
          if project_key do
            AuditLog.list_by_project(project_key, limit: 100)
            |> Enum.filter(&(&1.result_status == "success"))
          else
            AuditLog.list_recent(100)
            |> Enum.filter(&(&1.result_status == "success"))
          end

        _ ->
          if project_key do
            AuditLog.list_by_project(project_key, limit: 100)
          else
            AuditLog.list_recent(100)
          end
      end

    {:noreply,
     socket
     |> assign(:audit_entries, entries)
     |> assign(:audit_loading, false)}
  end

  # =============================================================================
  # Private Helper Functions
  # =============================================================================

  # Check if tool name is room-related (needs map refresh)
  defp room_tool?(name) do
    normalized = String.replace_prefix(name, "wb_", "")

    normalized in [
      "create_room",
      "update_room",
      "delete_room",
      "create_exit",
      "remove_exit",
      "batch_create_rooms"
    ]
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
        collapsed_panels.terminal && "terminal-collapsed",
        collapsed_panels.chat && "chat-collapsed"
      ]
      |> Enum.filter(& &1)
      |> Enum.join(" ")

    if classes == "", do: base, else: "#{base} #{classes}"
  end

  # Build CSS custom properties for panel sizes and grid-template-columns
  defp panel_sizes_style(panel_sizes, collapsed_panels) do
    h_col = if collapsed_panels.hierarchy, do: "40px", else: "#{panel_sizes.hierarchy}px"
    h_resize = if collapsed_panels.hierarchy, do: "0px", else: "4px"
    i_col = if collapsed_panels.inspector, do: "40px", else: "#{panel_sizes.inspector}px"
    i_resize = if collapsed_panels.inspector, do: "0px", else: "4px"
    c_col = if collapsed_panels.chat, do: "40px", else: "#{panel_sizes.chat}px"
    c_resize = if collapsed_panels.chat, do: "0px", else: "4px"

    # Terminal columns mirror other panels: 40px when collapsed
    {t_resize, t_col} =
      if collapsed_panels.terminal,
        do: {"0px", "40px"},
        else: {"4px", "#{panel_sizes.terminal}px"}

    "--grid-columns: #{h_col} #{h_resize} 1fr #{i_resize} #{i_col} #{t_resize} #{t_col} #{c_resize} #{c_col}; " <>
      "--console-height: #{panel_sizes.console}px;"
  end

  # Helper to refresh rooms and validation, then push to frontend
  defp refresh_rooms_with_validation(socket) do
    rooms = RoomManager.list_rooms()
    validation = ValidationManager.validation_summary(rooms)

    socket
    |> assign(:rooms, rooms)
    |> assign(:validation, validation)
    |> update_entity_list()
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

  # Build zone key -> color mapping for canvas visualization
  @zone_colors [
    "#4a9eff",
    "#4aff9e",
    "#ff4a9e",
    "#ffaa4a",
    "#9e4aff",
    "#4affff",
    "#ff9e4a",
    "#9eff4a"
  ]

  defp build_zone_color_map(zones) do
    zones
    |> Enum.with_index()
    |> Enum.map(fn {zone, idx} ->
      color = Enum.at(@zone_colors, rem(idx, length(@zone_colors)))
      {zone.key, color}
    end)
    |> Map.new()
  end

  # Build room_key -> zone_key mapping for canvas visualization
  defp build_room_zone_map(zones) do
    zones
    |> Enum.flat_map(fn zone ->
      rooms = Zone.rooms(zone) || []
      Enum.map(rooms, fn room_key -> {room_key, zone.key} end)
    end)
    |> Map.new()
  end

  defp default_quest_data do
    %{
      key: "",
      name: "",
      quest_type: "side",
      giver_key: "",
      description: "",
      level_min: 1,
      level_max: 99,
      objectives: [],
      prerequisites: [],
      xp: 0,
      gold: 0,
      reward_items: ""
    }
  end

  # Convert enriched quest (from QuestManager) to the flat format the editor expects
  defp quest_to_editor_format(quest) do
    rewards = quest[:rewards] || %{}
    {level_min, level_max} = quest[:level_range] || {1, 99}

    reward_items =
      case flex_get(rewards, :items) do
        items when is_list(items) -> Enum.join(items, ", ")
        _ -> ""
      end

    objectives =
      (quest[:objectives] || [])
      |> Enum.map(fn obj ->
        %{
          type: to_string(flex_get(obj, :type, "kill")),
          target: to_string(flex_get(obj, :target_id) || flex_get(obj, :target, "")),
          count: flex_get(obj, :target_count) || flex_get(obj, :count, 1),
          description: to_string(flex_get(obj, :description, ""))
        }
      end)

    %{
      key: quest.key,
      name: quest.name || "",
      quest_type: to_string(quest[:quest_type] || "side"),
      giver_key: to_string(quest[:giver_key] || ""),
      description: quest[:description] || "",
      level_min: level_min || 1,
      level_max: level_max || 99,
      objectives: objectives,
      prerequisites: quest[:prerequisites] || [],
      xp: flex_get(rewards, :xp, 0),
      gold: flex_get(rewards, :gold, 0),
      reward_items: reward_items
    }
  end

  # Get a value from a map that may have string or atom keys
  defp flex_get(map, key, default \\ nil) when is_atom(key) do
    Map.get(map, key) || Map.get(map, to_string(key)) || default
  end

  defp default_cutscene_data do
    %{
      id: "",
      name: "",
      trigger: %{type: "enter_room", location: "", condition: ""},
      sequence: [],
      effects: []
    }
  end

  # Toggle panel collapsed state (used by keyboard shortcuts)
  defp toggle_panel(socket, panel) do
    collapsed = socket.assigns.collapsed_panels
    new_collapsed = Map.update!(collapsed, panel, &(!&1))

    {:noreply,
     socket
     |> assign(:collapsed_panels, new_collapsed)
     |> push_event("panel_collapsed", %{panels: new_collapsed})}
  end

  # Generate JWT token for the terminal panel's GameChannel connection
  defp generate_terminal_token(socket) do
    player = socket.assigns[:current_scope] && socket.assigns.current_scope.player

    if player do
      case Loka.Auth.Guardian.encode_and_sign(player, %{}, token_type: "access") do
        {:ok, token, _claims} -> token
        {:error, _reason} -> ""
      end
    else
      ""
    end
  end
end
