defmodule Loka.Engine.Directions do
  @moduledoc """
  Direction constants and utilities for spatial navigation.

  Provides a unified source of truth for direction handling across the engine,
  including cardinal directions and vertical movement.

  ## Coordinate System

  The coordinate system uses:
  - X: West (-) to East (+)
  - Y: North (-) to South (+)
  - Z: Down (-) to Up (+)

  ## Supported Directions

  - Cardinal: north, south, east, west
  - Vertical: up, down
  """

  @direction_offsets %{
    "north" => {0, -1, 0},
    "south" => {0, 1, 0},
    "east" => {1, 0, 0},
    "west" => {-1, 0, 0},
    "up" => {0, 0, 1},
    "down" => {0, 0, -1}
  }

  @opposites %{
    "north" => "south",
    "south" => "north",
    "east" => "west",
    "west" => "east",
    "up" => "down",
    "down" => "up"
  }

  @all_directions Map.keys(@direction_offsets)
  @cardinal_directions ["north", "south", "east", "west"]
  @vertical_directions ["up", "down"]

  @doc """
  Returns all supported direction strings.

  ## Examples

      iex> Directions.all()
      ["north", "south", "east", "west", "up", "down", ...]
  """
  @spec all() :: [String.t()]
  def all, do: @all_directions

  @doc """
  Returns cardinal directions (north, south, east, west).
  """
  @spec cardinal() :: [String.t()]
  def cardinal, do: @cardinal_directions

  @doc """
  Returns vertical directions (up, down).
  """
  @spec vertical() :: [String.t()]
  def vertical, do: @vertical_directions

  @doc """
  Gets the coordinate offset for a direction.

  Returns `{dx, dy, dz}` tuple or `nil` for invalid directions.

  ## Examples

      iex> Directions.offset("north")
      {0, -1, 0}

      iex> Directions.offset("east")
      {1, 0, 0}

      iex> Directions.offset(:up)
      {0, 0, 1}

      iex> Directions.offset("invalid")
      nil
  """
  @spec offset(String.t() | atom()) :: {integer(), integer(), integer()} | nil
  def offset(direction) when is_atom(direction) do
    offset(to_string(direction))
  end

  def offset(direction) when is_binary(direction) do
    Map.get(@direction_offsets, String.downcase(direction))
  end

  @doc """
  Returns all direction offsets as a map.

  ## Examples

      iex> Directions.offsets()
      %{"north" => {0, -1, 0}, "south" => {0, 1, 0}, ...}
  """
  @spec offsets() :: %{String.t() => {integer(), integer(), integer()}}
  def offsets, do: @direction_offsets

  @doc """
  Gets the opposite direction.

  Returns the opposite direction string, or `nil` for invalid input.

  ## Examples

      iex> Directions.opposite("north")
      "south"

      iex> Directions.opposite(:east)
      "west"

      iex> Directions.opposite("up")
      "down"

      iex> Directions.opposite("invalid")
      nil
  """
  @spec opposite(String.t() | atom()) :: String.t() | nil
  def opposite(direction) when is_atom(direction) do
    opposite(to_string(direction))
  end

  def opposite(direction) when is_binary(direction) do
    Map.get(@opposites, String.downcase(direction))
  end

  @doc """
  Checks if a string is a valid direction.

  ## Examples

      iex> Directions.valid?("north")
      true

      iex> Directions.valid?("sideways")
      false
  """
  @spec valid?(String.t() | atom()) :: boolean()
  def valid?(direction) when is_atom(direction), do: valid?(to_string(direction))

  def valid?(direction) when is_binary(direction) do
    String.downcase(direction) in @all_directions
  end

  @doc """
  Normalizes a direction to lowercase string form.

  Returns `nil` for invalid directions.

  ## Examples

      iex> Directions.normalize("NORTH")
      "north"

      iex> Directions.normalize(:East)
      "east"

      iex> Directions.normalize("invalid")
      nil
  """
  @spec normalize(String.t() | atom()) :: String.t() | nil
  def normalize(direction) when is_atom(direction), do: normalize(to_string(direction))

  def normalize(direction) when is_binary(direction) do
    normalized = String.downcase(direction)
    if normalized in @all_directions, do: normalized, else: nil
  end

  @doc """
  Infers direction from relative positions of two coordinate tuples.

  Only returns cardinal directions and vertical. For diagonal offsets,
  returns the primary cardinal direction based on the larger offset.

  ## Examples

      iex> Directions.infer_from_coords({0, 0, 0}, {1, 0, 0})
      "east"

      iex> Directions.infer_from_coords({0, 0, 0}, {0, -1, 0})
      "north"
  """
  @spec infer_from_coords(
          {number(), number(), number()},
          {number(), number(), number()}
        ) :: String.t() | nil
  def infer_from_coords({x1, y1, z1}, {x2, y2, z2}) do
    dx = x2 - x1
    dy = y2 - y1
    dz = z2 - z1

    cond do
      dz > 0 -> "up"
      dz < 0 -> "down"
      abs(dx) > abs(dy) and dx > 0 -> "east"
      abs(dx) > abs(dy) and dx < 0 -> "west"
      dy < 0 -> "north"
      dy > 0 -> "south"
      dx > 0 -> "east"
      dx < 0 -> "west"
      true -> nil
    end
  end
end
