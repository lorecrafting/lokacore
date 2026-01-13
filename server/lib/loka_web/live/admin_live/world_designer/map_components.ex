defmodule LokaWeb.AdminLive.WorldDesigner.MapComponents do
  @moduledoc """
  Map visualization components for the World Designer.

  Renders the interactive world map showing rooms, connections, and markers.
  """
  use Phoenix.Component

  import LokaWeb.CoreComponents, only: [icon: 1]

  # Room node dimensions (must match the inline styles)
  @room_width 80
  @room_height 40
  @cell_width 100
  @cell_height 70

  @doc """
  Renders the world map panel with rooms and connections.
  """
  attr :rooms, :list, required: true
  attr :selected, :any, required: true
  attr :selected_type, :atom, required: true
  attr :player_progress, :any, required: true
  attr :myself, :any, required: true

  def world_map_panel(assigns) do
    # Calculate grid bounds
    {min_x, max_x, min_y, max_y} = calculate_bounds(assigns.rooms)

    # Build room key -> coordinates map for connection drawing
    room_coords_map =
      Map.new(assigns.rooms, fn room ->
        {x, y, _z} = room.coordinates
        {room.key, {x - min_x, y - min_y}}
      end)

    # Build list of connections (from_key, to_key, direction)
    connections = build_connections(assigns.rooms, room_coords_map)

    grid_width = max(max_x - min_x + 1, 1)
    grid_height = max(max_y - min_y + 1, 1)
    canvas_width = grid_width * @cell_width + 20
    canvas_height = grid_height * @cell_height + 20

    assigns =
      assigns
      |> assign(:min_x, min_x)
      |> assign(:max_x, max_x)
      |> assign(:min_y, min_y)
      |> assign(:max_y, max_y)
      |> assign(:grid_width, grid_width)
      |> assign(:grid_height, grid_height)
      |> assign(:canvas_width, canvas_width)
      |> assign(:canvas_height, canvas_height)
      |> assign(:cell_width, @cell_width)
      |> assign(:cell_height, @cell_height)
      |> assign(:room_coords_map, room_coords_map)
      |> assign(:connections, connections)

    ~H"""
    <div class="card bg-base-200 h-full">
      <div class="card-body p-4 flex flex-col">
        <div class="flex items-center justify-between flex-none">
          <h3 class="card-title text-sm">World Map</h3>
          <div class="flex items-center gap-2">
            <span data-zoom-level class="text-xs font-mono opacity-70 min-w-[3rem] text-center">
              100%
            </span>
            <button type="button" data-reset-view class="btn btn-xs btn-ghost" title="Reset zoom">
              <.icon name="hero-arrows-pointing-out" class="size-3" />
            </button>
            <span class="text-xs opacity-50">Scroll to zoom • Drag to pan</span>
          </div>
        </div>
        <div
          class="overflow-hidden bg-base-300 rounded-lg p-2 flex-1 cursor-grab"
          id="world-map-container"
          phx-hook="WorldMap"
          style="min-height: 500px;"
        >
          <div
            class="relative"
            style={"min-width: #{@canvas_width}px; min-height: #{@canvas_height}px;"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width={@canvas_width}
              height={@canvas_height}
              class="absolute inset-0 pointer-events-none"
            >
              <%= for {from_key, to_key, direction} <- @connections do %>
                <.connection_line
                  from_coords={Map.get(@room_coords_map, from_key)}
                  to_coords={Map.get(@room_coords_map, to_key)}
                  direction={direction}
                />
              <% end %>
            </svg>

            <%= for room <- @rooms do %>
              <% {x, y, _z} = room.coordinates %>
              <% grid_x = x - @min_x %>
              <% grid_y = y - @min_y %>
              <.room_node
                room={room}
                x={grid_x * @cell_width + 10}
                y={grid_y * @cell_height + 10}
                selected={@selected == room.key and @selected_type == :room}
                myself={@myself}
              />
            <% end %>
          </div>
        </div>
        <div class="text-xs opacity-60 mt-2 flex-none">
          <span class="mr-3">🟢 Quest Giver</span>
          <span class="mr-3">📍 Objective</span>
          <span class="mr-3">⚠️ Warning</span>
        </div>
      </div>
    </div>
    """
  end

  # Build unique connections from room exits (avoid duplicates)
  defp build_connections(rooms, room_coords_map) do
    rooms
    |> Enum.flat_map(fn room ->
      room.exits
      |> Enum.filter(fn {_dir, dest_key} -> Map.has_key?(room_coords_map, dest_key) end)
      |> Enum.map(fn {direction, dest_key} ->
        # Create a sorted pair to avoid duplicate lines
        pair = Enum.sort([room.key, dest_key])
        {pair, room.key, dest_key, direction}
      end)
    end)
    |> Enum.uniq_by(fn {pair, _, _, _} -> pair end)
    |> Enum.map(fn {_pair, from, to, dir} -> {from, to, dir} end)
  end

  attr :from_coords, :any, required: true
  attr :to_coords, :any, required: true
  attr :direction, :string, required: true

  defp connection_line(%{from_coords: nil} = assigns), do: ~H""
  defp connection_line(%{to_coords: nil} = assigns), do: ~H""

  defp connection_line(assigns) do
    {from_x, from_y} = assigns.from_coords
    {to_x, to_y} = assigns.to_coords

    # Calculate center of each room node
    from_center_x = from_x * @cell_width + 10 + @room_width / 2
    from_center_y = from_y * @cell_height + 10 + @room_height / 2
    to_center_x = to_x * @cell_width + 10 + @room_width / 2
    to_center_y = to_y * @cell_height + 10 + @room_height / 2

    # Check if rooms are aligned for the given direction
    coords =
      case assigns.direction do
        "north" when from_x == to_x ->
          {from_center_x, from_y * @cell_height + 10, to_center_x,
           to_y * @cell_height + 10 + @room_height}

        "north" ->
          {from_center_x, from_y * @cell_height + 10, from_center_x,
           from_y * @cell_height + 10 - 15}

        "south" when from_x == to_x ->
          {from_center_x, from_y * @cell_height + 10 + @room_height, to_center_x,
           to_y * @cell_height + 10}

        "south" ->
          {from_center_x, from_y * @cell_height + 10 + @room_height, from_center_x,
           from_y * @cell_height + 10 + @room_height + 15}

        "east" when from_y == to_y ->
          {from_x * @cell_width + 10 + @room_width, from_center_y, to_x * @cell_width + 10,
           to_center_y}

        "east" ->
          {from_x * @cell_width + 10 + @room_width, from_center_y,
           from_x * @cell_width + 10 + @room_width + 15, from_center_y}

        "west" when from_y == to_y ->
          {from_x * @cell_width + 10, from_center_y, to_x * @cell_width + 10 + @room_width,
           to_center_y}

        "west" ->
          {from_x * @cell_width + 10, from_center_y, from_x * @cell_width + 10 - 15,
           from_center_y}

        "up" ->
          {from_center_x, from_center_y - 5, to_center_x, to_center_y + 5}

        "down" ->
          {from_center_x, from_center_y + 5, to_center_x, to_center_y - 5}

        _unknown ->
          nil
      end

    render_connection_line(coords, assigns)
  end

  defp render_connection_line(nil, assigns), do: ~H""

  defp render_connection_line({x1, y1, x2, y2}, assigns) do
    assigns =
      assigns
      |> assign(:x1, x1)
      |> assign(:y1, y1)
      |> assign(:x2, x2)
      |> assign(:y2, y2)

    ~H"""
    <line
      x1={@x1}
      y1={@y1}
      x2={@x2}
      y2={@y2}
      stroke="#666666"
      stroke-width="2"
      stroke-linecap="round"
    />
    """
  end

  attr :room, :map, required: true
  attr :x, :integer, required: true
  attr :y, :integer, required: true
  attr :selected, :boolean, required: true
  attr :myself, :any, required: true

  defp room_node(assigns) do
    has_quests = length(assigns.room.quest_markers) > 0
    has_warnings = length(assigns.room.validation_warnings) > 0
    has_npcs = length(assigns.room.npcs) > 0

    assigns =
      assigns
      |> assign(:has_quests, has_quests)
      |> assign(:has_warnings, has_warnings)
      |> assign(:has_npcs, has_npcs)

    ~H"""
    <div
      class={[
        "absolute cursor-pointer rounded border-2 p-1 text-xs transition-all hover:scale-105",
        "bg-base-100 truncate text-center",
        if(@selected, do: "border-primary ring-2 ring-primary/50", else: "border-base-content/20"),
        if(@has_warnings, do: "border-warning")
      ]}
      style={"left: #{@x}px; top: #{@y}px; width: 80px; height: 40px;"}
      phx-click="select_room"
      phx-value-key={@room.key}
      phx-target={@myself}
      title={@room.name}
    >
      <div class="truncate font-medium text-[10px] leading-tight">{short_name(@room.name)}</div>
      <div class="flex gap-0.5 justify-center mt-0.5">
        <span :if={@has_quests} title="Has quest involvement">🟢</span>
        <span :if={@has_npcs and not @has_quests} title="Has NPCs">👤</span>
        <span :if={@has_warnings} title="Has warnings">⚠️</span>
      </div>
    </div>
    """
  end

  defp short_name(name) when is_binary(name) do
    if String.length(name) > 12 do
      String.slice(name, 0, 10) <> ".."
    else
      name
    end
  end

  defp short_name(_), do: "?"

  defp calculate_bounds(rooms) do
    if rooms == [] do
      {0, 0, 0, 0}
    else
      coords = Enum.map(rooms, fn r -> r.coordinates end)
      xs = Enum.map(coords, fn {x, _, _} -> x end)
      ys = Enum.map(coords, fn {_, y, _} -> y end)

      {Enum.min(xs), Enum.max(xs), Enum.min(ys), Enum.max(ys)}
    end
  end
end
