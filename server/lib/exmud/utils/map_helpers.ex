defmodule Exmud.Utils.MapHelpers do
  @moduledoc """
  Utility functions for consistent map access patterns.

  This module handles the common case where map keys may be either
  atoms or strings (e.g., from JSON deserialization or database reads).

  ## Key Format Convention

  The codebase uses a mixed approach due to Ecto/JSON serialization:

  - **Database/JSON boundary**: String keys (from JSON parsing)
  - **Internal Elixir code**: Prefer atoms when creating new maps
  - **Reading values**: Use `get_flexible/3` to handle both formats

  ## Usage Examples

      # Reading health value that might have string or atom keys
      health = MapHelpers.get_flexible(game_state.health, :current, 100)

      # Normalizing a map to atom keys
      normalized = MapHelpers.atomize_keys(json_map)

  """

  @doc """
  Gets a value from a map, trying multiple key formats.

  Tries each key in order and returns the first non-nil value found,
  or the default if none are found.

  ## Examples

      iex> MapHelpers.get_any(%{"current" => 100}, [:current, "current"], 0)
      100

      iex> MapHelpers.get_any(%{current: 100}, [:current, "current"], 0)
      100

      iex> MapHelpers.get_any(%{}, [:current, "current"], 50)
      50

  """
  @spec get_any(map(), [atom() | String.t()], any()) :: any()
  def get_any(map, keys, default \\ nil) when is_map(map) and is_list(keys) do
    Enum.find_value(keys, default, fn key ->
      case Map.get(map, key) do
        nil -> nil
        value -> value
      end
    end)
  end

  @doc """
  Gets a value trying both atom and string versions of a key.

  This is a convenience wrapper around `get_any/3` for the common case
  of atom/string key pairs.

  ## Examples

      iex> MapHelpers.get_flexible(%{"health" => 100}, :health, 0)
      100

      iex> MapHelpers.get_flexible(%{health: 100}, :health, 0)
      100

  """
  @spec get_flexible(map(), atom(), any()) :: any()
  def get_flexible(map, key, default \\ nil) when is_map(map) and is_atom(key) do
    get_any(map, [key, Atom.to_string(key)], default)
  end

  @doc """
  Safely converts a string to an existing atom, or returns nil.

  Unlike `String.to_existing_atom/1`, this won't raise if the atom doesn't exist.

  ## Examples

      iex> MapHelpers.safe_to_existing_atom("attack")
      :attack

      iex> MapHelpers.safe_to_existing_atom("nonexistent_atom_xyz123")
      nil

  """
  @spec safe_to_existing_atom(String.t()) :: atom() | nil
  def safe_to_existing_atom(string) when is_binary(string) do
    String.to_existing_atom(string)
  rescue
    ArgumentError -> nil
  end

  @doc """
  Converts all string keys in a map to atoms (non-recursive).

  Use with caution on untrusted input as this creates atoms.

  ## Examples

      iex> MapHelpers.atomize_keys(%{"health" => 100, "name" => "foo"})
      %{health: 100, name: "foo"}

      iex> MapHelpers.atomize_keys(%{already: :atoms})
      %{already: :atoms}

  """
  @spec atomize_keys(map()) :: map()
  def atomize_keys(map) when is_map(map) do
    Map.new(map, fn
      {k, v} when is_binary(k) -> {String.to_atom(k), v}
      {k, v} -> {k, v}
    end)
  end

  @doc """
  Converts all string keys in a map to atoms (recursive for nested maps).

  Use with caution on untrusted input as this creates atoms.

  ## Examples

      iex> MapHelpers.deep_atomize_keys(%{"health" => %{"current" => 100}})
      %{health: %{current: 100}}

  """
  @spec deep_atomize_keys(map()) :: map()
  def deep_atomize_keys(map) when is_map(map) do
    Map.new(map, fn
      {k, v} when is_binary(k) and is_map(v) -> {String.to_atom(k), deep_atomize_keys(v)}
      {k, v} when is_binary(k) -> {String.to_atom(k), v}
      {k, v} when is_map(v) -> {k, deep_atomize_keys(v)}
      {k, v} -> {k, v}
    end)
  end
end
