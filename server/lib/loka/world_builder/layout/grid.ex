defmodule Loka.WorldBuilder.Layout.Grid do
  @moduledoc """
  Grid layout algorithm - snaps rooms to grid positions.

  Arranges rooms in a grid pattern with configurable spacing.

  ## Usage

      rooms = [%{id: "1", x: 7, y: 13}, %{id: "2", x: 52, y: 48}]
      {:ok, positions} = Grid.layout(rooms, %{grid_size: 10})
      # Snaps to nearest grid points
  """

  @default_options %{
    grid_size: 50,
    columns: nil,
    start_x: 0,
    start_y: 0
  }

  @doc """
  Snap existing room positions to nearest grid points.

  ## Parameters
  - rooms: List of room maps with :x, :y
  - options: Configuration map (optional)

  Returns {:ok, positions} where positions is %{room_id => {x, y}}
  """
  def snap_to_grid(rooms, options \\ %{}) do
    opts = Map.merge(@default_options, options)

    positions =
      rooms
      |> Enum.map(fn room ->
        x = snap_coordinate(room.x || 0, opts.grid_size)
        y = snap_coordinate(room.y || 0, opts.grid_size)

        {room.id || room.key, {x, y}}
      end)
      |> Map.new()

    {:ok, positions}
  end

  @doc """
  Arrange rooms in a uniform grid layout.

  ## Parameters
  - rooms: List of room maps
  - options: Configuration map (optional)
    - :columns - Number of columns (auto-calculated if nil)
    - :grid_size - Spacing between rooms
    - :start_x, :start_y - Top-left corner position

  Returns {:ok, positions} where positions is %{room_id => {x, y}}
  """
  def layout(rooms, options \\ %{}) do
    opts = Map.merge(@default_options, options)

    count = length(rooms)

    # Auto-calculate columns if not specified
    columns =
      if opts.columns do
        opts.columns
      else
        # Square-ish grid
        ceil(:math.sqrt(count))
      end

    positions =
      rooms
      |> Enum.with_index()
      |> Enum.map(fn {room, index} ->
        col = rem(index, columns)
        row = div(index, columns)

        x = opts.start_x + col * opts.grid_size
        y = opts.start_y + row * opts.grid_size

        {room.id || room.key, {x, y}}
      end)
      |> Map.new()

    {:ok, positions}
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp snap_coordinate(coord, grid_size) do
    round(coord / grid_size) * grid_size
  end
end
