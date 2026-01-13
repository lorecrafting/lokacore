defmodule LokaWeb.AdminLive.WorldDesignerTab do
  @moduledoc """
  **DEPRECATED**: This module is legacy. Use `LokaWeb.AdminLive.WorldBuilderLive` instead.

  WorldBuilderLive provides a modern Unity-style 3D editor with React Three Fiber,
  LLM-assisted content generation, and enhanced validation. This 2D SVG-based system
  is maintained for reference only.

  ---

  World Designer tab component for the admin interface.

  Provides a comprehensive "god's eye view" of the game world including:
  - Interactive world map showing rooms, NPCs, and quest markers
  - Quest flow diagram showing storylines, acts, and dependencies
  - Detail panel for inspecting selected entities
  - Player progress overlay
  - Validation warnings and errors

  See `docs/design/world-designer.md` for full design documentation.

  ## Component Architecture

  This module is the coordinator that delegates rendering to sub-modules:
  - `MapComponents` - World map panel with rooms and connections
  - `QuestComponents` - Quest flow diagram with storylines
  - `DetailComponents` - Detail panel for selected entities
  - `EditModal` - YAML editor modal
  """
  use LokaWeb, :live_component

  import LokaWeb.AdminLive.Components, only: [stat_card: 1]
  import LokaWeb.AdminLive.WorldDesigner.MapComponents, only: [world_map_panel: 1]
  import LokaWeb.AdminLive.WorldDesigner.QuestComponents, only: [quest_diagram_panel: 1]
  import LokaWeb.AdminLive.WorldDesigner.DetailComponents, only: [detail_panel: 1]
  import LokaWeb.AdminLive.WorldDesigner.EditModal, only: [edit_modal: 1]

  alias Loka.Admin.WorldDesigner.DataAggregator
  alias Loka.Content.Validator
  alias Loka.Framework.Quest.Admin, as: QuestAdmin

  @filters [:all, :quests, :npcs, :items, :combat, :warnings]

  @impl true
  def mount(socket) do
    {:ok,
     socket
     |> assign(:selected_entity, nil)
     |> assign(:selected_type, nil)
     |> assign(:active_filter, :all)
     |> assign(:selected_storyline, nil)
     |> assign(:selected_player, nil)
     |> assign(:player_progress, nil)
     |> assign(:data, nil)
     |> assign(:players, [])
     |> assign(:edit_modal_open, false)
     |> assign(:edit_yaml, nil)
     |> assign(:edit_entity_key, nil)
     |> assign(:edit_entity_type, nil)
     |> assign(:edit_error, nil)
     |> assign(:edit_saving, false)
     |> assign(:search_query, "")}
  end

  @impl true
  def update(assigns, socket) do
    socket = assign(socket, assigns)

    # Load data if not already loaded
    socket =
      if socket.assigns.data == nil do
        data = DataAggregator.aggregate_all()
        players = QuestAdmin.list_players_with_quests()

        # Set default storyline
        first_storyline =
          case data.storylines do
            [first | _] -> first.key
            _ -> nil
          end

        socket
        |> assign(:data, data)
        |> assign(:players, players)
        |> assign(:selected_storyline, first_storyline)
      else
        socket
      end

    {:ok, socket}
  end

  @impl true
  def render(assigns) do
    ~H"""
    <div class="admin-section" phx-window-keydown="keyboard_shortcut" phx-target={@myself}>
      <div class="flex justify-between items-center mb-4">
        <h2 class="admin-section-title">World Designer</h2>
        <div class="flex gap-2 items-center">
          <.player_selector players={@players} selected={@selected_player} myself={@myself} />
          <button
            phx-click="refresh_data"
            phx-target={@myself}
            class="btn btn-ghost btn-sm"
            title="Refresh data"
          >
            <.icon name="hero-arrow-path" class="size-4" />
          </button>
        </div>
      </div>

      <%= if @data do %>
        <div class="admin-grid-stats mb-4">
          <.stat_card
            title="Rooms"
            value={@data.stats.room_count}
            icon="hero-map"
            status={:neutral}
          />
          <.stat_card
            title="Quests"
            value={@data.stats.quest_count}
            icon="hero-book-open"
            status={:neutral}
          />
          <.stat_card
            title="Storylines"
            value={@data.stats.storyline_count}
            icon="hero-document-text"
            status={:neutral}
          />
          <.stat_card
            title="Warnings"
            value={@data.stats.warning_count}
            icon="hero-exclamation-triangle"
            status={if @data.stats.warning_count > 0, do: :warning, else: :success}
          />
        </div>

        <div class="flex items-center gap-4 mb-4 flex-wrap">
          <.filter_bar active={@active_filter} myself={@myself} />
          <.search_input query={@search_query} myself={@myself} />
        </div>

        <%= if @data.stats.warning_count > 0 and @active_filter == :warnings do %>
          <.validation_summary rooms={@data.rooms} quests={@data.quests} />
        <% end %>

        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
          <.world_map_panel
            rooms={@data.rooms |> filter_rooms(@active_filter) |> search_rooms(@search_query)}
            selected={@selected_entity}
            selected_type={@selected_type}
            player_progress={@player_progress}
            myself={@myself}
          />
          <.quest_diagram_panel
            quests={@data.quests}
            storylines={@data.storylines}
            selected_storyline={@selected_storyline}
            selected={@selected_entity}
            selected_type={@selected_type}
            player_progress={@player_progress}
            myself={@myself}
          />
        </div>

        <.detail_panel
          selected={@selected_entity}
          selected_type={@selected_type}
          data={@data}
          myself={@myself}
        />

        <%!-- Edit Modal --%>
        <.edit_modal
          :if={@edit_modal_open}
          yaml={@edit_yaml}
          entity_key={@edit_entity_key}
          entity_type={@edit_entity_type}
          error={@edit_error}
          saving={@edit_saving}
          myself={@myself}
        />
      <% else %>
        <div class="flex justify-center items-center h-64">
          <span class="loading loading-spinner loading-lg"></span>
        </div>
      <% end %>
    </div>
    """
  end

  # =============================================================================
  # Filter Bar Component
  # =============================================================================

  attr :active, :atom, required: true
  attr :myself, :any, required: true

  defp filter_bar(assigns) do
    assigns = assign(assigns, :filters, @filters)

    ~H"""
    <div class="flex gap-2 flex-wrap">
      <button
        :for={filter <- @filters}
        phx-click="set_filter"
        phx-value-filter={filter}
        phx-target={@myself}
        class={[
          "btn btn-sm",
          if(@active == filter, do: "btn-primary", else: "btn-ghost")
        ]}
      >
        {filter_label(filter)}
      </button>
    </div>
    """
  end

  # =============================================================================
  # Search Input Component
  # =============================================================================

  attr :query, :string, required: true
  attr :myself, :any, required: true

  defp search_input(assigns) do
    ~H"""
    <form phx-change="search" phx-target={@myself} class="flex-1 max-w-xs">
      <div class="relative">
        <input
          type="text"
          name="query"
          id="world-designer-search"
          value={@query}
          placeholder="Search rooms & quests... (/ to focus)"
          class="input input-bordered input-sm w-full pl-8"
          phx-debounce="200"
        />
        <.icon
          name="hero-magnifying-glass"
          class="size-4 absolute left-2 top-1/2 -translate-y-1/2 opacity-50"
        />
        <%= if @query != "" do %>
          <button
            type="button"
            phx-click="clear_search"
            phx-target={@myself}
            class="absolute right-2 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100"
          >
            <.icon name="hero-x-mark" class="size-4" />
          </button>
        <% end %>
      </div>
    </form>
    """
  end

  defp filter_label(:all), do: "All"
  defp filter_label(:quests), do: "Quests"
  defp filter_label(:npcs), do: "NPCs"
  defp filter_label(:items), do: "Items"
  defp filter_label(:combat), do: "Combat"
  defp filter_label(:warnings), do: "Warnings"

  # =============================================================================
  # Validation Summary Component
  # =============================================================================

  attr :rooms, :list, required: true
  attr :quests, :list, required: true

  defp validation_summary(assigns) do
    # Collect all warnings
    room_warnings =
      assigns.rooms
      |> Enum.filter(fn r -> length(r.validation_warnings) > 0 end)
      |> Enum.flat_map(fn r ->
        Enum.map(r.validation_warnings, fn w ->
          %{type: :room, key: r.key, name: r.name, message: w}
        end)
      end)

    quest_warnings =
      assigns.quests
      |> Enum.filter(fn q -> length(q.validation_warnings) > 0 end)
      |> Enum.flat_map(fn q ->
        Enum.map(q.validation_warnings, fn w ->
          %{type: :quest, key: q.id, name: q.name, message: w}
        end)
      end)

    all_warnings = room_warnings ++ quest_warnings

    assigns = assign(assigns, :warnings, all_warnings)

    ~H"""
    <div class="alert alert-warning mb-4">
      <.icon name="hero-exclamation-triangle" class="size-5" />
      <div class="flex-1">
        <h3 class="font-bold">Validation Issues ({length(@warnings)})</h3>
        <div class="max-h-32 overflow-y-auto mt-2">
          <ul class="text-sm space-y-1">
            <li :for={warning <- @warnings} class="flex items-start gap-2">
              <span class="badge badge-xs badge-ghost">
                {if warning.type == :room, do: "Room", else: "Quest"}
              </span>
              <span class="font-medium">{warning.name}:</span>
              <span class="opacity-80">{warning.message}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
    """
  end

  # =============================================================================
  # Player Selector Component
  # =============================================================================

  attr :players, :list, required: true
  attr :selected, :any, required: true
  attr :myself, :any, required: true

  defp player_selector(assigns) do
    ~H"""
    <form phx-change="select_player" phx-target={@myself} class="form-control">
      <select name="player_id" class="select select-bordered select-sm w-48">
        <option value="">All Players (God Mode)</option>
        <option
          :for={player <- @players}
          value={player.player_id}
          selected={@selected == player.player_id}
        >
          {truncate_email(player.email)} ({player.active_count} active)
        </option>
      </select>
    </form>
    """
  end

  defp truncate_email(email) do
    if String.length(email) > 20 do
      String.slice(email, 0, 17) <> "..."
    else
      email
    end
  end

  # =============================================================================
  # Event Handlers
  # =============================================================================

  @impl true
  def handle_event("set_filter", %{"filter" => filter}, socket) do
    filter_atom = String.to_existing_atom(filter)
    {:noreply, assign(socket, :active_filter, filter_atom)}
  end

  def handle_event("search", %{"query" => query}, socket) do
    {:noreply, assign(socket, :search_query, query)}
  end

  def handle_event("clear_search", _, socket) do
    {:noreply, assign(socket, :search_query, "")}
  end

  def handle_event("select_room", %{"key" => key}, socket) do
    {:noreply,
     socket
     |> assign(:selected_entity, key)
     |> assign(:selected_type, :room)}
  end

  def handle_event("select_quest", %{"id" => id}, socket) do
    {:noreply,
     socket
     |> assign(:selected_entity, id)
     |> assign(:selected_type, :quest)}
  end

  def handle_event("select_storyline", %{"value" => value}, socket) do
    storyline = if value == "", do: nil, else: value
    {:noreply, assign(socket, :selected_storyline, storyline)}
  end

  def handle_event("select_player", %{"player_id" => value}, socket) do
    if value == "" do
      {:noreply,
       socket
       |> assign(:selected_player, nil)
       |> assign(:player_progress, nil)}
    else
      player_id = String.to_integer(value)

      progress =
        case QuestAdmin.get_player_quest_state(player_id) do
          {:ok, state} -> state
          _ -> nil
        end

      {:noreply,
       socket
       |> assign(:selected_player, player_id)
       |> assign(:player_progress, progress)}
    end
  end

  def handle_event("refresh_data", _, socket) do
    data = DataAggregator.aggregate_all()
    players = QuestAdmin.list_players_with_quests()

    {:noreply,
     socket
     |> assign(:data, data)
     |> assign(:players, players)}
  end

  def handle_event("open_edit_modal", %{"key" => key, "type" => type}, socket) do
    entity_type = String.to_existing_atom(type)

    case load_yaml_content(key, entity_type) do
      {:ok, yaml} ->
        {:noreply,
         socket
         |> assign(:edit_modal_open, true)
         |> assign(:edit_yaml, yaml)
         |> assign(:edit_entity_key, key)
         |> assign(:edit_entity_type, entity_type)
         |> assign(:edit_error, nil)
         |> assign(:edit_saving, false)}

      {:error, reason} ->
        {:noreply,
         socket
         |> assign(:edit_modal_open, true)
         |> assign(:edit_yaml, "# Error loading file: #{reason}")
         |> assign(:edit_entity_key, key)
         |> assign(:edit_entity_type, entity_type)
         |> assign(:edit_error, "Could not load file: #{reason}")
         |> assign(:edit_saving, false)}
    end
  end

  def handle_event("close_edit_modal", _, socket) do
    {:noreply,
     socket
     |> assign(:edit_modal_open, false)
     |> assign(:edit_yaml, nil)
     |> assign(:edit_entity_key, nil)
     |> assign(:edit_entity_type, nil)
     |> assign(:edit_error, nil)
     |> assign(:edit_saving, false)}
  end

  def handle_event("save_yaml", %{"yaml_content" => yaml_content}, socket) do
    key = socket.assigns.edit_entity_key
    entity_type = socket.assigns.edit_entity_type

    socket = assign(socket, :edit_saving, true)

    case save_yaml_content(key, entity_type, yaml_content) do
      :ok ->
        # Reload prototypes/quests
        reload_result = reload_content(entity_type)

        # Refresh data
        data = DataAggregator.aggregate_all()
        players = QuestAdmin.list_players_with_quests()

        socket =
          socket
          |> assign(:data, data)
          |> assign(:players, players)
          |> assign(:edit_modal_open, false)
          |> assign(:edit_saving, false)
          |> assign(:edit_error, nil)

        socket =
          case reload_result do
            :ok ->
              socket

            {:error, reload_error} ->
              assign(socket, :edit_error, "Saved but reload failed: #{inspect(reload_error)}")
          end

        {:noreply, socket}

      {:error, reason} ->
        {:noreply,
         socket
         |> assign(:edit_saving, false)
         |> assign(:edit_error, "Failed to save: #{reason}")}
    end
  end

  # Keyboard shortcut: "/" to focus search (unless modal is open or already in input)
  def handle_event("keyboard_shortcut", %{"key" => "/"}, socket) do
    if socket.assigns.edit_modal_open do
      {:noreply, socket}
    else
      {:noreply, push_event(socket, "focus_search", %{})}
    end
  end

  # Escape key to clear search and deselect
  def handle_event("keyboard_shortcut", %{"key" => "Escape"}, socket) do
    if socket.assigns.edit_modal_open do
      # Let the modal's own Escape handler work
      {:noreply, socket}
    else
      {:noreply,
       socket
       |> assign(:search_query, "")
       |> assign(:selected_entity, nil)
       |> assign(:selected_type, nil)}
    end
  end

  # Ignore other keys
  def handle_event("keyboard_shortcut", _, socket), do: {:noreply, socket}

  # =============================================================================
  # Helper Functions
  # =============================================================================

  defp filter_rooms(rooms, :all), do: rooms

  defp filter_rooms(rooms, :warnings),
    do: Enum.filter(rooms, &(length(&1.validation_warnings) > 0))

  defp filter_rooms(rooms, :quests), do: Enum.filter(rooms, &(length(&1.quest_markers) > 0))
  defp filter_rooms(rooms, :npcs), do: Enum.filter(rooms, &(length(&1.npcs) > 0))
  defp filter_rooms(rooms, :items), do: Enum.filter(rooms, &(length(&1.items) > 0))
  defp filter_rooms(rooms, _), do: rooms

  defp search_rooms(rooms, ""), do: rooms
  defp search_rooms(rooms, nil), do: rooms

  defp search_rooms(rooms, query) do
    query = String.downcase(query)

    Enum.filter(rooms, fn room ->
      String.contains?(String.downcase(room.name || ""), query) or
        String.contains?(String.downcase(room.key || ""), query)
    end)
  end

  # =============================================================================
  # YAML File Operations
  # =============================================================================

  @prototype_base_path "priv/world/prototypes"
  @quest_base_path "priv/world/quests"

  # Load YAML content from file for editing
  defp load_yaml_content(key, entity_type) do
    case validate_entity_key(key) do
      :ok ->
        file_path = get_full_file_path(key, entity_type)

        case File.read(file_path) do
          {:ok, content} -> {:ok, content}
          {:error, :enoent} -> {:error, "File not found: #{file_path}"}
          {:error, reason} -> {:error, "Error reading file: #{inspect(reason)}"}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  # Validate entity key to prevent path traversal attacks
  defp validate_entity_key(key) do
    cond do
      String.contains?(key, "..") -> {:error, "Invalid key: path traversal not allowed"}
      String.contains?(key, "/") -> {:error, "Invalid key: slashes not allowed"}
      String.contains?(key, "\\") -> {:error, "Invalid key: backslashes not allowed"}
      String.trim(key) == "" -> {:error, "Invalid key: key cannot be empty"}
      true -> :ok
    end
  end

  # Save YAML content to file
  # sobelow_skip ["Traversal.FileModule"] - file path constructed from sanitized key
  defp save_yaml_content(key, entity_type, yaml_content) do
    # Validate entity key to prevent path traversal
    case validate_entity_key(key) do
      {:error, reason} ->
        {:error, reason}

      :ok ->
        save_yaml_content_validated(key, entity_type, yaml_content)
    end
  end

  defp save_yaml_content_validated(key, entity_type, yaml_content) do
    # Validate YAML syntax and content before saving
    result = Validator.validate_yaml(entity_type, yaml_content)

    if result.valid do
      file_path = get_full_file_path(key, entity_type)

      # Ensure directory exists
      dir = Path.dirname(file_path)
      File.mkdir_p(dir)

      case File.write(file_path, yaml_content) do
        :ok -> :ok
        {:error, reason} -> {:error, "Error writing file: #{inspect(reason)}"}
      end
    else
      # Format validation errors into a readable message
      error_messages =
        result.errors
        |> Enum.map(fn err ->
          field_prefix = if err.field, do: "#{err.field}: ", else: ""
          "#{field_prefix}#{err.message}"
        end)
        |> Enum.join("\n")

      {:error, error_messages}
    end
  end

  # Get full file path for an entity
  defp get_full_file_path(key, :room),
    do: Path.join([@prototype_base_path, "rooms", "#{key}.yml"])

  defp get_full_file_path(key, :quest), do: Path.join([@quest_base_path, "#{key}.yml"])
  defp get_full_file_path(key, :npc), do: Path.join([@prototype_base_path, "npcs", "#{key}.yml"])

  defp get_full_file_path(key, :item),
    do: Path.join([@prototype_base_path, "items", "#{key}.yml"])

  defp get_full_file_path(key, _), do: Path.join([@prototype_base_path, "#{key}.yml"])

  # Reload content after save
  defp reload_content(:quest) do
    # Reload quest registry
    Loka.Framework.Quest.QuestRegistry.reload()
  end

  defp reload_content(_entity_type) do
    # Reload prototype loader
    Loka.Engine.PrototypeLoader.reload()
  end
end
