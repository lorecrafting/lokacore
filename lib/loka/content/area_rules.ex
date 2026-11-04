defmodule Loka.Content.AreaRules do
  @moduledoc """
  The area border on references: a definition in an area may name a definition of another kind
  only in its own area or the root; any definition may name a room
  (docs/system/cartridge.md, Area folders). `extends` and `behaviours` are checked in Source.
  """

  import Loka.Content.Source, only: [diag: 3, at: 2]
  alias Loka.Content.Areas

  @doc "An `area_crossing` diagnostic for each expanded reference across an area border."
  @spec check(map() | nil, map()) :: [map()]
  def check(nil, _), do: []

  def check(manifest, defs) do
    for {_, ds} <- defs,
        is_map(ds),
        {_, {rel, steps, value}} when is_binary(rel) <- ds,
        Areas.area_of(rel),
        {path, %{"key" => _} = ref} <- refs(value, [], manifest["id"]),
        d <- crossing(defs, rel, steps ++ path, ref),
        do: d
  end

  defp crossing(defs, rel, steps, %{"kind" => kind, "key" => key}) do
    with {trel, tsteps, _} when is_binary(trel) <- get_in(defs, [kind, key]),
         area when is_binary(area) <- Areas.crossed(rel, trel),
         do: [diag("SCHEMA_VIOLATION", at(rel, steps), data(trel, tsteps, key, area))],
         else: (_ -> [])
  end

  defp data(trel, tsteps, key, area) do
    dir = if tsteps == [], do: trel |> Path.split() |> Enum.at(-2), else: hd(tsteps)
    %{"why" => "area_crossing", "target" => dir <> "/" <> key, "area" => area}
  end

  defp refs(%{"cartridge_id" => id, "kind" => kind} = ref, path, id) when kind != "room",
    do: [{path, ref}]

  defp refs(%{} = map, path, id),
    do: Enum.flat_map(map, fn {k, v} -> refs(v, path ++ [k], id) end)

  defp refs(list, path, id) when is_list(list),
    do: list |> Enum.with_index() |> Enum.flat_map(fn {v, i} -> refs(v, path ++ [i], id) end)

  defp refs(_, _, _), do: []
end
