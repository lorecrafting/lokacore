defmodule LokaWeb.Channels.BuilderCommands.Map do
  @moduledoc """
  Map commands: full zone ASCII map and compact minimap.

  The `map` command (admin-only) renders a full zone map with numbered nodes
  and a clickable legend. The minimap (all players) shows a compact 2-hop
  neighborhood after each room change.

  ## Layout Algorithm

  BFS from current room, placing neighbors by exit direction offsets.
  Collisions are resolved by skipping occupied cells.
  """

  alias Loka.WorldBuilder.RoomManager
  alias Loka.Content
  alias LokaWeb.Channels.RoomHelpers

  @direction_offsets %{
    "north" => {0, -1},
    "south" => {0, 1},
    "east" => {1, 0},
    "west" => {-1, 0},
    "up" => {0, -1},
    "down" => {0, 1},
    "northeast" => {1, -1},
    "northwest" => {-1, -1},
    "southeast" => {1, 1},
    "southwest" => {-1, 1}
  }

  # ============================================================================
  # Public API
  # ============================================================================

  @doc """
  Execute the `map` command. Shows full zone map with numbered nodes and legend.
  """
  def execute(:map, params, socket) do
    character = socket.assigns.character
    {current_room, _} = RoomHelpers.load_room_for_character(character)
    rooms_index = build_rooms_index()

    current_key = current_room.key

    zone_key =
      case Map.get(params, :zone_key) do
        nil -> zone_for_room(current_key)
        key -> key
      end

    case zone_key do
      nil ->
        # No zone — show local map from current room
        text = full_map_text(current_key, rooms_index, nil)
        {:ok, text, socket}

      zone_key ->
        zone_rooms = Content.Zone.rooms_in_zone(zone_key)

        if zone_rooms == [] do
          {:error, "Zone '#{zone_key}' not found or has no rooms.", socket}
        else
          text = full_map_text(current_key, rooms_index, MapSet.new(zone_rooms))
          {:ok, text, socket}
        end
    end
  end

  @doc """
  Generate compact minimap text for inline display after room changes.

  Uses lazy room lookups (only fetches rooms discovered by BFS) to avoid
  loading all rooms on every navigation.

  Returns `nil` if the room has no exits (nothing to show).
  """
  @spec minimap_text(String.t()) :: String.t() | nil
  def minimap_text(room_key) do
    case fetch_room(room_key) do
      nil -> nil
      room -> render_minimap_lazy(room_key, %{room_key => room})
    end
  end

  # ============================================================================
  # Room Index
  # ============================================================================

  # Full index — used by `map` command (admin-only, infrequent)
  defp build_rooms_index do
    RoomManager.list_rooms()
    |> Enum.reduce(%{}, fn room, acc ->
      Map.put(acc, room.key, %{
        key: room.key,
        name: room.name,
        id: room[:id],
        exits: room.exits || %{},
        x: room[:x] || 0,
        y: room[:y] || 0,
        z: room[:z] || 0
      })
    end)
  end

  # Single room lookup — used by minimap (every navigation, must be fast)
  defp fetch_room(key) do
    case RoomManager.get_room(key) do
      {:ok, room} ->
        %{
          key: room.key,
          name: room.name,
          id: room[:id],
          exits: room.exits || %{},
          x: room[:x] || 0,
          y: room[:y] || 0,
          z: room[:z] || 0
        }

      {:error, _} ->
        nil
    end
  end

  defp zone_for_room(nil), do: nil

  defp zone_for_room(room_key) do
    case Content.Zone.zone_for_room(room_key) do
      {:ok, zone_key} -> zone_key
      {:error, :not_found} -> nil
    end
  end

  # ============================================================================
  # BFS Layout
  # ============================================================================

  @doc false
  def layout_bfs(start_key, rooms_index, room_keys, max_depth) do
    case Map.get(rooms_index, start_key) do
      nil ->
        %{}

      _room ->
        # BFS from start, placing nodes on a grid
        initial_state = %{
          grid: %{{0, 0} => start_key},
          placed: %{start_key => {0, 0}},
          queue: :queue.from_list([{start_key, 0}])
        }

        do_bfs(initial_state, rooms_index, room_keys, max_depth)
    end
  end

  defp do_bfs(state, rooms_index, room_keys, max_depth) do
    case :queue.out(state.queue) do
      {:empty, _} ->
        state.grid

      {{:value, {current_key, depth}}, rest_queue} ->
        state = %{state | queue: rest_queue}

        if depth >= max_depth do
          do_bfs(state, rooms_index, room_keys, max_depth)
        else
          room = Map.get(rooms_index, current_key, %{exits: %{}})
          {cx, cy} = Map.get(state.placed, current_key, {0, 0})

          state =
            Enum.reduce(room.exits, state, fn {dir, dest_key}, acc ->
              # Skip rooms not in scope (if room_keys filter is set)
              in_scope = room_keys == nil or MapSet.member?(room_keys, dest_key)
              already_placed = Map.has_key?(acc.placed, dest_key)

              if not in_scope or already_placed do
                acc
              else
                case place_neighbor(acc.grid, cx, cy, dir) do
                  nil ->
                    acc

                  {nx, ny} ->
                    %{
                      acc
                      | grid: Map.put(acc.grid, {nx, ny}, dest_key),
                        placed: Map.put(acc.placed, dest_key, {nx, ny}),
                        queue: :queue.in({dest_key, depth + 1}, acc.queue)
                    }
                end
              end
            end)

          do_bfs(state, rooms_index, room_keys, max_depth)
        end
    end
  end

  defp place_neighbor(grid, cx, cy, dir) do
    case Map.get(@direction_offsets, dir) do
      {dx, dy} ->
        target = {cx + dx, cy + dy}

        if Map.has_key?(grid, target) do
          # Cell occupied — try adjacent cells
          find_free_adjacent(grid, cx, cy)
        else
          target
        end

      nil ->
        # Non-standard exit (portal, enter, etc.) — find any free adjacent cell
        find_free_adjacent(grid, cx, cy)
    end
  end

  defp find_free_adjacent(grid, cx, cy) do
    [{1, 0}, {-1, 0}, {0, 1}, {0, -1}, {1, 1}, {-1, -1}, {1, -1}, {-1, 1}]
    |> Enum.map(fn {dx, dy} -> {cx + dx, cy + dy} end)
    |> Enum.find(fn pos -> not Map.has_key?(grid, pos) end)
  end

  # ============================================================================
  # Full Map Rendering
  # ============================================================================

  defp full_map_text(current_key, rooms_index, room_keys) do
    # Determine zone name for header
    zone_name = get_zone_name(current_key)
    max_depth = 100

    grid = layout_bfs(current_key, rooms_index, room_keys, max_depth)

    if map_size(grid) == 0 do
      "No rooms to map."
    else
      render_full_map(grid, rooms_index, current_key, zone_name)
    end
  end

  defp get_zone_name(nil), do: nil

  defp get_zone_name(room_key) do
    case zone_for_room(room_key) do
      nil -> nil
      zone_key -> zone_key |> String.replace("_", " ") |> title_case()
    end
  end

  defp title_case(str) do
    str
    |> String.split(" ")
    |> Enum.map(fn word ->
      case word do
        "" -> ""
        w -> String.upcase(String.first(w)) <> String.slice(w, 1..-1//1)
      end
    end)
    |> Enum.join(" ")
  end

  defp render_full_map(grid, rooms_index, current_key, zone_name) do
    # Assign numbers to rooms in grid order (top-left to bottom-right)
    sorted_positions =
      grid
      |> Map.keys()
      |> Enum.sort(fn {x1, y1}, {x2, y2} ->
        if y1 == y2, do: x1 < x2, else: y1 < y2
      end)

    room_numbers =
      sorted_positions
      |> Enum.with_index(1)
      |> Enum.reduce(%{}, fn {{x, y}, num}, acc ->
        room_key = Map.get(grid, {x, y})
        Map.put(acc, room_key, num)
      end)

    # Find grid bounds
    {min_x, max_x, min_y, max_y} = grid_bounds(grid)

    # Build the ASCII grid with connectors
    map_lines =
      render_grid_lines(grid, rooms_index, current_key, room_numbers, min_x, max_x, min_y, max_y)

    # Build legend
    legend =
      room_numbers
      |> Enum.sort_by(fn {_key, num} -> num end)
      |> Enum.map(fn {key, num} ->
        pad = if num < 10, do: " ", else: ""
        current_marker = if key == current_key, do: "  *", else: ""
        cmd = "{{cmd:goto #{key}}}#{key}{{/cmd}}"
        "#{pad}#{num}. #{cmd}#{current_marker}"
      end)
      |> Enum.join("\n")

    # Assemble
    header = if zone_name, do: "── #{zone_name} ──\n\n", else: ""
    "#{header}#{map_lines}\n\n#{legend}"
  end

  defp grid_bounds(grid) do
    positions = Map.keys(grid)
    xs = Enum.map(positions, fn {x, _} -> x end)
    ys = Enum.map(positions, fn {_, y} -> y end)
    {Enum.min(xs), Enum.max(xs), Enum.min(ys), Enum.max(ys)}
  end

  defp render_grid_lines(grid, rooms_index, current_key, room_numbers, min_x, max_x, min_y, max_y) do
    # Each cell is 6 chars wide (e.g. ">>[1]<<" = 7 for current, "[1]" = 3 + padding)
    # Between cells horizontally: " -- " (4 chars) or "    " (4 chars)
    # Between rows vertically: connector line with "|" or " "

    rows =
      for y <- min_y..max_y do
        # Room line
        room_line =
          render_room_line(grid, rooms_index, current_key, room_numbers, min_x, max_x, y)

        # Connector line (vertical connections to y+1)
        connector_line =
          if y < max_y do
            render_vertical_connectors(grid, rooms_index, min_x, max_x, y)
          else
            nil
          end

        [room_line, connector_line]
      end

    rows
    |> List.flatten()
    |> Enum.reject(&is_nil/1)
    |> Enum.join("\n")
  end

  defp render_room_line(grid, rooms_index, current_key, room_numbers, min_x, max_x, y) do
    cells =
      for x <- min_x..max_x do
        case Map.get(grid, {x, y}) do
          nil ->
            "      "

          key ->
            num = Map.get(room_numbers, key, 0)
            num_str = Integer.to_string(num)
            pad = if num < 10, do: " ", else: ""

            if key == current_key do
              ">>[#{pad}#{num_str}]<<"
            else
              "  [#{pad}#{num_str}]  "
            end
        end
      end

    # Insert horizontal connectors between cells
    result =
      cells
      |> Enum.with_index()
      |> Enum.flat_map(fn {cell, idx} ->
        x = min_x + idx

        if idx < length(cells) - 1 do
          connector = horizontal_connector(grid, rooms_index, {x, y}, {x + 1, y})
          [cell, connector]
        else
          [cell]
        end
      end)
      |> Enum.join("")

    String.trim_trailing(result)
  end

  defp horizontal_connector(grid, rooms_index, {x1, y}, {x2, y}) do
    left_key = Map.get(grid, {x1, y})
    right_key = Map.get(grid, {x2, y})

    connected =
      left_key != nil and right_key != nil and
        rooms_connected?(rooms_index, left_key, right_key, :horizontal)

    if connected, do: " -- ", else: "    "
  end

  defp render_vertical_connectors(grid, rooms_index, min_x, max_x, y) do
    cells =
      for x <- min_x..max_x do
        top_key = Map.get(grid, {x, y})
        bottom_key = Map.get(grid, {x, y + 1})

        connected =
          top_key != nil and bottom_key != nil and
            rooms_connected?(rooms_index, top_key, bottom_key, :vertical)

        if connected do
          "   |   "
        else
          "       "
        end
      end

    line = cells |> Enum.join("    ") |> String.trim_trailing()

    if String.trim(line) == "" do
      nil
    else
      line
    end
  end

  defp rooms_connected?(rooms_index, key_a, key_b, direction_type) do
    room_a = Map.get(rooms_index, key_a, %{exits: %{}})
    room_b = Map.get(rooms_index, key_b, %{exits: %{}})

    dirs =
      case direction_type do
        :horizontal -> ["east", "west", "northeast", "northwest", "southeast", "southwest"]
        :vertical -> ["north", "south", "up", "down"]
      end

    # Check if A has an exit to B or B has an exit to A in the given directions
    a_to_b = Enum.any?(dirs, fn d -> Map.get(room_a.exits, d) == key_b end)
    b_to_a = Enum.any?(dirs, fn d -> Map.get(room_b.exits, d) == key_a end)

    a_to_b or b_to_a
  end

  # ============================================================================
  # Minimap Rendering
  # ============================================================================

  # Lazy minimap: fetches rooms on-demand during BFS (avoids loading all rooms)
  defp render_minimap_lazy(room_key, cache) do
    {grid, cache} = layout_bfs_lazy(room_key, cache, 2)

    if map_size(grid) <= 1 do
      nil
    else
      render_minimap_grid(grid, cache, room_key)
    end
  end

  defp layout_bfs_lazy(start_key, cache, max_depth) do
    initial_state = %{
      grid: %{{0, 0} => start_key},
      placed: %{start_key => {0, 0}},
      queue: :queue.from_list([{start_key, 0}]),
      cache: cache
    }

    state = do_bfs_lazy(initial_state, max_depth)
    {state.grid, state.cache}
  end

  defp do_bfs_lazy(state, max_depth) do
    case :queue.out(state.queue) do
      {:empty, _} ->
        state

      {{:value, {current_key, depth}}, rest_queue} ->
        state = %{state | queue: rest_queue}

        if depth >= max_depth do
          do_bfs_lazy(state, max_depth)
        else
          room = Map.get(state.cache, current_key, %{exits: %{}})
          {cx, cy} = Map.get(state.placed, current_key, {0, 0})

          state =
            Enum.reduce(room.exits, state, fn {dir, dest_key}, acc ->
              already_placed = Map.has_key?(acc.placed, dest_key)

              if already_placed do
                acc
              else
                # Lazy fetch: only load room data when we first encounter it
                acc = ensure_cached(acc, dest_key)

                case place_neighbor(acc.grid, cx, cy, dir) do
                  nil ->
                    acc

                  {nx, ny} ->
                    %{
                      acc
                      | grid: Map.put(acc.grid, {nx, ny}, dest_key),
                        placed: Map.put(acc.placed, dest_key, {nx, ny}),
                        queue: :queue.in({dest_key, depth + 1}, acc.queue)
                    }
                end
              end
            end)

          do_bfs_lazy(state, max_depth)
        end
    end
  end

  defp ensure_cached(state, key) do
    if Map.has_key?(state.cache, key) do
      state
    else
      case fetch_room(key) do
        nil -> state
        room -> %{state | cache: Map.put(state.cache, key, room)}
      end
    end
  end

  defp render_minimap_grid(grid, rooms_index, current_key) do
    {min_x, max_x, min_y, max_y} = grid_bounds(grid)

    rows =
      for y <- min_y..max_y do
        room_line = render_minimap_room_line(grid, rooms_index, current_key, min_x, max_x, y)

        connector_line =
          if y < max_y do
            render_minimap_vertical(grid, rooms_index, min_x, max_x, y)
          else
            nil
          end

        [room_line, connector_line]
      end

    rows
    |> List.flatten()
    |> Enum.reject(&is_nil/1)
    |> Enum.join("\n")
  end

  defp render_minimap_room_line(grid, rooms_index, current_key, min_x, max_x, y) do
    cells =
      for x <- min_x..max_x do
        case Map.get(grid, {x, y}) do
          nil ->
            " "

          key ->
            if key == current_key do
              "*"
            else
              "{{cmd:goto #{key}}}o{{/cmd}}"
            end
        end
      end

    result =
      cells
      |> Enum.with_index()
      |> Enum.flat_map(fn {cell, idx} ->
        x = min_x + idx

        if idx < length(cells) - 1 do
          connector = mini_h_connector(grid, rooms_index, {x, y}, {x + 1, y})
          [cell, connector]
        else
          [cell]
        end
      end)
      |> Enum.join("")

    String.trim_trailing(result)
  end

  defp mini_h_connector(grid, rooms_index, {x1, y}, {x2, y}) do
    left_key = Map.get(grid, {x1, y})
    right_key = Map.get(grid, {x2, y})

    connected =
      left_key != nil and right_key != nil and
        rooms_connected?(rooms_index, left_key, right_key, :horizontal)

    if connected, do: "-", else: " "
  end

  defp render_minimap_vertical(grid, rooms_index, min_x, max_x, y) do
    cells =
      for x <- min_x..max_x do
        top_key = Map.get(grid, {x, y})
        bottom_key = Map.get(grid, {x, y + 1})

        connected =
          top_key != nil and bottom_key != nil and
            rooms_connected?(rooms_index, top_key, bottom_key, :vertical)

        if connected, do: "|", else: " "
      end

    line = cells |> Enum.join(" ") |> String.trim_trailing()

    if String.trim(line) == "" do
      nil
    else
      line
    end
  end
end
