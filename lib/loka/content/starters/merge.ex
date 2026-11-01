defmodule Loka.Content.Starters.Merge do
  @moduledoc "How a starter's files meet what is already on disk: refuse a replacement, else merge."

  # Where the starter would replace something: a scalar or shape that differs, or a list of rows
  # that differs (a rerun must not restore a step the author deleted). Lists of names union, and
  # layout's rows only grow (below).
  def clash(old, _, _) when old == %{}, do: nil
  def clash(same, same, _), do: nil

  def clash(old, new, "layout.json:") when is_list(old) and is_list(new), do: nil

  def clash(old, new, at) when is_list(old) and is_list(new) do
    if Enum.all?(new, &is_binary/1), do: nil, else: at
  end

  def clash(old, new, at) when is_map(old) and is_map(new) do
    Enum.find_value(new, fn {k, v} ->
      if is_map_key(old, k), do: clash(old[k], v, at <> " " <> k)
    end)
  end

  def clash(_, _, at), do: at

  # Maps merge by key; a list of names unions (an npc's services); a list of rows (layout) replaces,
  # the template having kept the rows already placed. clash/3 has refused any other difference.
  def merge(old, new) when is_map(old) and is_map(new),
    do: Map.merge(old, new, fn _, a, b -> merge(a, b) end)

  def merge(old, new) when is_list(old) and is_list(new) do
    if Enum.all?(new, &is_binary/1), do: Enum.uniq(old ++ new), else: new
  end

  def merge(_, new), do: new
end
