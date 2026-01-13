defmodule Loka.Utils.MapHelpers do
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
    # Can't use Enum.find_value because it treats `false` as falsy
    # Instead, check if key exists and return its value (including false)
    Enum.find_value(keys, fn key ->
      if Map.has_key?(map, key) do
        {:found, Map.get(map, key)}
      else
        nil
      end
    end)
    |> case do
      {:found, value} -> value
      nil -> default
    end
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
  Converts string keys to EXISTING atoms only (safe for untrusted input).

  Keys that don't have corresponding existing atoms are kept as strings.
  This prevents atom table exhaustion attacks.

  ## Examples

      iex> MapHelpers.atomize_keys(%{"health" => 100, "name" => "foo"})
      %{health: 100, name: "foo"}

      iex> MapHelpers.atomize_keys(%{already: :atoms})
      %{already: :atoms}

  """
  @spec atomize_keys(map()) :: map()
  def atomize_keys(map) when is_map(map) do
    Map.new(map, fn
      {k, v} when is_binary(k) ->
        case safe_to_existing_atom(k) do
          nil -> {k, v}
          atom -> {atom, v}
        end

      {k, v} ->
        {k, v}
    end)
  end

  @doc """
  Normalizes a string to an existing atom, with a fallback.

  Unlike `String.to_atom/1`, this won't create new atoms.
  Returns the fallback if the atom doesn't exist.

  ## Examples

      iex> MapHelpers.normalize_atom("attack", :unknown)
      :attack

      iex> MapHelpers.normalize_atom("nonexistent_xyz", :unknown)
      :unknown

      iex> MapHelpers.normalize_atom(:already_atom, :unknown)
      :already_atom

  """
  @spec normalize_atom(atom() | String.t(), atom()) :: atom()
  def normalize_atom(value, fallback \\ :unknown)
  def normalize_atom(value, _fallback) when is_atom(value), do: value

  def normalize_atom(value, fallback) when is_binary(value) do
    case safe_to_existing_atom(value) do
      nil -> fallback
      atom -> atom
    end
  end

  @doc """
  Converts string keys to EXISTING atoms recursively (safe for untrusted input).

  Keys that don't have corresponding existing atoms are kept as strings.
  This prevents atom table exhaustion attacks.

  ## Examples

      iex> MapHelpers.deep_atomize_keys(%{"health" => %{"current" => 100}})
      %{health: %{current: 100}}

  """
  @spec deep_atomize_keys(map()) :: map()
  def deep_atomize_keys(map) when is_map(map) do
    Map.new(map, fn
      {k, v} when is_binary(k) and is_map(v) ->
        key =
          case safe_to_existing_atom(k) do
            nil -> k
            atom -> atom
          end

        {key, deep_atomize_keys(v)}

      {k, v} when is_binary(k) ->
        case safe_to_existing_atom(k) do
          nil -> {k, v}
          atom -> {atom, v}
        end

      {k, v} when is_map(v) ->
        {k, deep_atomize_keys(v)}

      {k, v} ->
        {k, v}
    end)
  end

  @doc """
  Deep merges two maps, recursively merging nested maps.

  When both values for a key are maps, they are recursively merged.
  Otherwise, the value from the second map (override) wins.

  ## Examples

      iex> MapHelpers.deep_merge(%{a: 1, b: %{c: 2}}, %{b: %{d: 3}})
      %{a: 1, b: %{c: 2, d: 3}}

      iex> MapHelpers.deep_merge(%{a: %{b: 1}}, %{a: %{b: 2, c: 3}})
      %{a: %{b: 2, c: 3}}

      iex> MapHelpers.deep_merge(%{a: 1}, %{a: 2})
      %{a: 2}

      iex> MapHelpers.deep_merge(%{a: 1}, nil)
      nil

  """
  @spec deep_merge(map(), map() | nil) :: map() | nil
  def deep_merge(base, override) when is_map(base) and is_map(override) do
    Map.merge(base, override, fn
      _key, base_val, override_val when is_map(base_val) and is_map(override_val) ->
        deep_merge(base_val, override_val)

      _key, _base_val, override_val ->
        override_val
    end)
  end

  def deep_merge(_base, override), do: override

  @doc """
  Merges two lists, keeping items from both with deduplication.

  Child items come first, then parent items. Duplicates are removed.

  ## Examples

      iex> MapHelpers.merge_lists(["a", "b"], ["b", "c"])
      ["a", "b", "c"]

      iex> MapHelpers.merge_lists(nil, ["a"])
      ["a"]

  """
  @spec merge_lists(list() | nil, list() | nil) :: list()
  def merge_lists(child, parent) when is_list(child) and is_list(parent) do
    (child ++ parent) |> Enum.uniq()
  end

  def merge_lists(child, _parent) when is_list(child), do: child
  def merge_lists(_child, parent) when is_list(parent), do: parent
  def merge_lists(_, _), do: []
end
