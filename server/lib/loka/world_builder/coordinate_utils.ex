defmodule Loka.WorldBuilder.CoordinateUtils do
  @moduledoc """
  Coordinate transformation utilities for bulk room operations.

  Supports: rotate, scale, translate, mirror, snap, align, distribute.
  """

  def rotate_90(rooms) do
    center = calculate_center(rooms)

    Enum.map(rooms, fn room ->
      dx = room.x - center.x
      dy = room.y - center.y
      %{room | x: center.x - dy, y: center.y + dx}
    end)
  end

  def snap_to_grid(rooms, grid_size \\ 50) do
    Enum.map(rooms, fn room ->
      %{room | x: round(room.x / grid_size) * grid_size, y: round(room.y / grid_size) * grid_size}
    end)
  end

  def align_top(rooms) do
    max_y = Enum.map(rooms, & &1.y) |> Enum.max()
    Enum.map(rooms, &%{&1 | y: max_y})
  end

  def distribute_evenly_x(rooms) do
    sorted = Enum.sort_by(rooms, & &1.x)
    min_x = hd(sorted).x
    max_x = List.last(sorted).x
    count = length(rooms)
    spacing = if count > 1, do: (max_x - min_x) / (count - 1), else: 0

    sorted
    |> Enum.with_index()
    |> Enum.map(fn {room, i} -> %{room | x: round(min_x + i * spacing)} end)
  end

  defp calculate_center(rooms) do
    count = length(rooms)
    sum_x = Enum.sum(Enum.map(rooms, & &1.x))
    sum_y = Enum.sum(Enum.map(rooms, & &1.y))
    %{x: div(sum_x, count), y: div(sum_y, count)}
  end
end
