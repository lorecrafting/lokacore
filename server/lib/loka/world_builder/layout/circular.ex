defmodule Loka.WorldBuilder.Layout.Circular do
  @moduledoc """
  Circular layout algorithm - arranges rooms in concentric circles.

  Places rooms evenly around circles, with connected rooms grouped together.

  ## Usage

      rooms = [%{id: "1"}, %{id: "2"}, %{id: "3"}]
      {:ok, positions} = Circular.layout(rooms, %{radius: 100, center_x: 0, center_y: 0})
  """

  @default_options %{
    radius: 100,
    center_x: 0,
    center_y: 0,
    spacing: 50
  }

  @doc """
  Calculate positions for rooms in circular layout.

  ## Parameters
  - rooms: List of room maps
  - options: Configuration map (optional)

  Returns {:ok, positions} where positions is %{room_id => {x, y}}
  """
  def layout(rooms, options \\ %{}) do
    opts = Map.merge(@default_options, options)

    count = length(rooms)

    if count == 0 do
      {:ok, %{}}
    else
      positions =
        rooms
        |> Enum.with_index()
        |> Enum.map(fn {room, index} ->
          angle = 2 * :math.pi() * index / count
          x = opts.center_x + opts.radius * :math.cos(angle)
          y = opts.center_y + opts.radius * :math.sin(angle)

          {room.id || room.key, {round(x), round(y)}}
        end)
        |> Map.new()

      {:ok, positions}
    end
  end

  @doc """
  Multi-level circular layout with concentric circles.

  Groups rooms into levels and arranges each level in a circle.
  """
  def concentric_layout(rooms, levels, options \\ %{}) do
    opts = Map.merge(@default_options, options)

    rooms_per_level = div(length(rooms), levels)

    positions =
      rooms
      |> Enum.chunk_every(rooms_per_level)
      |> Enum.with_index()
      |> Enum.flat_map(fn {level_rooms, level_index} ->
        radius = opts.radius + level_index * opts.spacing
        count = length(level_rooms)

        level_rooms
        |> Enum.with_index()
        |> Enum.map(fn {room, index} ->
          angle = 2 * :math.pi() * index / count
          x = opts.center_x + radius * :math.cos(angle)
          y = opts.center_y + radius * :math.sin(angle)

          {room.id || room.key, {round(x), round(y)}}
        end)
      end)
      |> Map.new()

    {:ok, positions}
  end
end
