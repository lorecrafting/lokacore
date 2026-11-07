defmodule Loka.Content.LintLayout do
  @moduledoc """
  Author-time area layout lint for `Loka.Content.Lint` (cartridge area layout design, section 5):
  an orphan room, an area nothing leads into, and a room whose every exit leads into one other area.
  """

  @doc "The layout findings for `Source.load` entries, with their real source paths."
  @spec run([{String.t(), term(), term()}]) :: [String.t()]
  def run(files), do: layout(for({_, _, v} = f <- files, is_map(v), do: f))

  defp layout(files) do
    entry =
      Enum.find(files, &match?({"cartridge.json", _, _}, &1)) |> elem(2) |> Map.get("entry")

    # ponytail: a bundled room (areas/<a>.json) counts as a root room here; bundles have no folder to move into.
    rooms = for {rel, {:room, key, _}, r} <- files, into: %{}, do: {key, {area(rel), rel, r}}
    exits = Enum.flat_map(rooms, &exits/1)
    routes = exits ++ Enum.flat_map(files, &ride/1)

    orphans(rooms, routes, files, entry) ++
      unreachable(rooms, routes, entry) ++ astray(rooms, exits)
  end

  @doc """
  Rewrites each finding's leading root address to the file it came from: the area-folder file, and
  for a nested dialogue (loaded beside its scene, SceneFiles.rel/2) the scene file under `dir` and its key.
  """
  @spec at_real([String.t()], [{String.t(), term(), term()}], Path.t()) :: [String.t()]
  def at_real(lines, files, dir) do
    real =
      for {"areas/" <> _ = rel, _, _} <- files,
          [_, _ | lr] = Path.split(rel),
          lr != [],
          into: %{},
          do: {Path.join(lr), rel}

    nested = nested(files, dir)
    at = fn lr -> Map.get(real, lr, lr) |> then(&Map.get(nested, &1, &1)) end
    Enum.map(lines, &Regex.replace(~r/^[^ :]+/, &1, at))
  end

  # Each nested dialogue's rel (no file under `dir`) to its scene file, the longest real stem it extends, and its key.
  defp nested(files, dir) do
    {scenes, made} =
      for({rel, {:dialogue, _, []}, _} <- files, Path.extname(rel) == ".scene", do: rel)
      |> Enum.split_with(&File.regular?(Path.join(dir, &1)))

    for child <- made,
        parents = Enum.filter(scenes, &String.starts_with?(child, Path.rootname(&1) <> "_")),
        parents != [],
        into: %{},
        do: {child, "#{Enum.max_by(parents, &byte_size/1)} (#{Path.basename(child, ".scene")})"}
  end

  defp orphans(rooms, routes, files, entry) do
    seen =
      MapSet.new(
        [entry | for({from, to} <- routes, from != to, do: to)] ++ Enum.flat_map(files, &kept/1)
      )

    for {key, {_, rel, r}} <- Enum.sort(rooms),
        key not in seen and !is_map_key(r, "site"),
        do:
          "#{rel}: no exit or transport reaches this room and nothing is kept here; link it or delete it"
  end

  defp unreachable(rooms, routes, entry) do
    areas = for {_, {a, _, _}} <- rooms, a, uniq: true, do: a

    for a <- Enum.sort(areas),
        in_area(rooms, entry) != a,
        !Enum.any?(routes, fn {from, to} ->
          in_area(rooms, from) != a and in_area(rooms, to) == a
        end),
        do:
          "areas/#{a}: no exit or transport leads into this area; add an exit from another area's room"
  end

  defp astray(rooms, exits) do
    for {key, {own, rel, _}} <- Enum.sort(rooms),
        targets = for({^key, to} <- exits, do: in_area(rooms, to)),
        length(targets) >= 2,
        [other] <- [Enum.uniq(targets)],
        other not in [nil, own],
        do:
          "#{rel}: every exit leads into areas/#{other}; move the file there, or add an exit within #{own || "the root"}"
  end

  defp area("areas/" <> rest), do: with([a, _, _] <- Path.split(rest), do: a, else: (_ -> nil))
  defp area(_), do: nil

  defp in_area(rooms, key), do: with({a, _, _} <- rooms[key], do: a)

  defp ref(%{"key" => k}), do: k
  defp ref(k), do: k

  defp kept({_, {:item, _, _}, %{"location" => %{"room" => r}}}), do: [ref(r)]
  defp kept({_, {:npc, _, _}, %{"room" => r}}), do: [ref(r)]
  defp kept({_, {:population, _, _}, p}), do: Enum.map([p["home"] | p["area"] || []], &ref/1)
  defp kept({_, {:replenish, _, _}, %{"from" => %{"room" => r}}}), do: [ref(r)]
  defp kept(_), do: []

  defp exits({key, {_, _, r}}), do: for({_, e} <- r["exits"] || %{}, do: {key, ref(e["to"])})

  defp ride({_, {:transport, _, _}, t}), do: [{ref(t["room"]), ref(t["destination"])}]
  defp ride(_), do: []
end
