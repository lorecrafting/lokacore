defmodule Loka.Content.Starters.Child do
  @moduledoc """
  `--extends <key>` for `Loka.Content.Starters`: the starter's own file becomes a child of an
  abstract parent of its kind (docs/system/cartridge.md, Source shortcuts), holding `extends` and
  only the starter fields the parent (with its own parents) lacks; the compiler merges the parent in.
  """
  alias Loka.Content.{Areas, Source}
  alias Loka.Content.Starters.Area
  alias Loka.Core.Contracts

  # What the starter derives from the name and the placement stays the child's own.
  @own ~w(keywords room exits location)

  @doc """
  The resolved parent when a starter whose own file is `own` may extend `key`, else
  `{:error, line}`: a bad key, an own file already there without that `extends`, no such parent,
  a population or transport (their keys are derived per kind), one of another kind, one not
  abstract, one with `params` (the child's `with` is the author's), or
  an area crossing.
  """
  def parent(_, _, nil, _), do: {:ok, nil}

  def parent(dir, kind_dir, key, own) do
    path = Path.join(dir, own)

    cond do
      kind_dir in ~w(populations transports) ->
        {:error, "--extends: #{kind_dir} derive their keys per kind; write the child by hand"}

      Contracts.validate("Key", key) != :ok ->
        {:error, "--extends: a key is lowercase letters, digits and _, 64 at most (got #{key})"}

      File.exists?(path) and Area.read(path)["extends"] != key ->
        {:error, "--extends #{key}: #{own} exists; add \"extends\" there by hand"}

      true ->
        found(dir, kind_dir, key, own)
    end
  end

  defp found(dir, kind_dir, key, own) do
    case find(dir, kind_dir, key) do
      {rel, %{"abstract" => true, "params" => [_ | _]}} ->
        {:error, "--extends #{key}: #{rel} has params; write the child and its \"with\" by hand"}

      {rel, %{"abstract" => true} = parent} ->
        area = kind_dir != "rooms" && Areas.crossed(own, rel)
        crossing(key, area, rel, resolved(dir, kind_dir, parent, [key]))

      {rel, _} ->
        {:error, "--extends #{key}: #{rel} is not \"abstract\": true"}

      nil ->
        case Enum.find_value(Map.keys(Source.dirs()) -- [kind_dir], &find(dir, &1, key)) do
          {rel, _} ->
            {:error, "--extends #{key}: #{rel} is another kind; a parent is #{kind_dir}"}

          nil ->
            {:error, "--extends #{key}: no #{kind_dir} #{key}"}
        end
    end
  end

  # Rooms are geography: any room may extend any room (Extends.crossing).
  defp crossing(key, area, rel, _) when is_binary(area),
    do:
      {:error,
       "--extends #{key}: #{rel} belongs to the area #{area}; only that area and the root may extend it"}

  defp crossing(key, _, _, parent), do: {:ok, {key, parent}}

  # The parent over its own parents; a cycle or a missing one is the compiler's to report.
  defp resolved(dir, kind_dir, %{"extends" => up} = parent, seen) when is_binary(up) do
    case up not in seen && find(dir, kind_dir, up) do
      {_, grand} -> deep(resolved(dir, kind_dir, grand, [up | seen]), parent)
      _ -> parent
    end
  end

  defp resolved(_, _, parent, _), do: parent

  # As Extends.merge: objects merge, anything else replaces.
  defp deep(a, b) when is_map(a) and is_map(b), do: Map.merge(a, b, fn _, x, y -> deep(x, y) end)
  defp deep(_, b), do: b

  @doc "Rewrites the starter's own file as the child of `parent`: `extends` and the fields it lacks."
  def extending(files, _, nil), do: files

  def extending(files, own, {key, parent}),
    do:
      Map.replace_lazy(files, own, fn starter ->
        starter |> lacks(Map.drop(parent, @own)) |> Map.put("extends", key)
      end)

  # An object the parent fills in part keeps the starter's other fields.
  defp lacks(starter, parent) do
    for {k, v} <- starter,
        kept = lacks_one(v, Map.fetch(parent, k)),
        kept != :drop,
        into: %{},
        do: {k, kept}
  end

  defp lacks_one(v, :error), do: v

  defp lacks_one(v, {:ok, up}) when is_map(v) and is_map(up) do
    kept = lacks(v, up)
    if kept == %{}, do: :drop, else: kept
  end

  defp lacks_one(_, {:ok, _}), do: :drop

  # A file at the root or in an area folder, else an area bundle's entry.
  defp find(dir, kind_dir, key) do
    files =
      for glob <- ["#{kind_dir}/#{key}.json", "areas/*/#{kind_dir}/#{key}.json"],
          p <- Path.wildcard(Path.join(dir, glob)),
          do: {Path.relative_to(p, dir), Area.read(p)}

    bundled =
      for b <- Path.wildcard(Path.join(dir, "areas/*.json")),
          %{^kind_dir => %{^key => value}} <- [Area.read(b)],
          do: {Path.relative_to(b, dir), value}

    List.first(files ++ bundled)
  end
end
