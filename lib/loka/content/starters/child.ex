defmodule Loka.Content.Starters.Child do
  @moduledoc """
  `--extends <key>` for `Loka.Content.Starters`: the starter's own file becomes a child of an
  abstract parent of its kind (docs/system/cartridge.md, Source shortcuts), holding `extends` and
  only the starter fields the parent lacks; the compiler merges the parent in.
  """
  alias Loka.Content.{Areas, Source}
  alias Loka.Content.Starters.Area

  @doc """
  The parent definition when a starter whose own file is `own` may extend `key`, else
  `{:error, line}`: no such parent, one of another kind, one not abstract, or an area crossing.
  """
  def parent(_, _, nil, _), do: {:ok, nil}

  def parent(dir, kind_dir, key, own) do
    case key =~ ~r/^[a-z][a-z0-9_]{0,63}$/ && find(dir, kind_dir, key) do
      {rel, %{"abstract" => true} = parent} ->
        crossing(key, kind_dir != "rooms" && Areas.crossed(own, rel), rel, parent)

      {rel, _} ->
        {:error, "--extends #{key}: #{rel} is not \"abstract\": true"}

      false ->
        {:error, "--extends: a key is lowercase letters, digits and _, 64 at most (got #{key})"}

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

  @doc "Rewrites the starter's own file as the child of `parent`: `extends` and the fields it lacks."
  def extending(files, _, nil), do: files

  # The placement the starter derived (the room, a --from exit) stays the child's own.
  def extending(files, own, {key, parent}),
    do:
      Map.replace_lazy(files, own, fn starter ->
        starter |> Map.drop(Map.keys(parent) -- ~w(room exits)) |> Map.put("extends", key)
      end)

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
