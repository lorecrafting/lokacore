defmodule Loka.Content.RoomParts do
  @moduledoc """
  A room's inspectable details and description variants (21 §6; room.schema.json): their text
  keys, the details' reachability and where each variant sits in its room file. Room-level
  checks and ownership are `Loka.Content.Checks.rooms/4`.
  """
  import Loka.Content.Source, only: [diag: 2, diag: 3, at: 2]

  @doc "UNRESOLVED_REFERENCE for each variant description without a catalog entry."
  @spec variant_texts(map(), map() | :unknown) :: [map()]
  def variant_texts(_, :unknown), do: []

  def variant_texts(defs, text) do
    for {_, {rel, [], r}} <- defs["room"],
        {steps, %{"description" => t}} <- variants(r),
        not is_map_key(text, t),
        do: diag("UNRESOLVED_REFERENCE", at(rel, steps ++ ["description"]), %{"target" => t})
  end

  @doc "Each description variant of room `r` and of its details, with its steps in the room file."
  @spec variants(map()) :: [{list(), map()}]
  def variants(r) do
    for {steps, d} <- [
          {[], r} | for({k, d} <- Map.get(r, "details", %{}), do: {["details", k], d})
        ],
        {v, i} <- Enum.with_index(Map.get(d, "variants", [])),
        do: {steps ++ ["variants", i], v}
  end

  @doc """
  The room `r`, each of its details and each description variant, as `{steps, kind}`, the
  definition kinds of capability_registry.json.
  """
  @spec parts(map()) :: [{list(), String.t()}]
  def parts(r) do
    details = for {k, _} <- Map.get(r, "details", %{}), do: {["details", k], "detail"}
    [{[], "room"} | details] ++ for {steps, _} <- variants(r), do: {steps, "variant"}
  end

  @doc "Each variant's condition in the schema-valid rooms, as `{rel, steps, root}`."
  @spec conditions(map()) :: [{String.t(), list(), map()}]
  def conditions(defs) do
    for {_, {rel, [], r}} <- defs["room"],
        {steps, v} <- variants(r),
        do: {rel, steps ++ ["when", "root"], v["when"]["root"]}
  end

  @doc """
  Each detail's description has a catalog entry, and its first alias is one no other detail of
  its room has, in the form a lookup produces (room.schema.json InspectableDetail).
  """
  @spec details(map(), map() | :unknown) :: [map()]
  def details(defs, text) do
    for {_, {rel, [], r}} <- defs["room"],
        ds = Map.get(r, "details", %{}),
        {key, detail} <- ds,
        d <- detail_text(rel, key, detail, text) ++ reachable(rel, key, detail, ds),
        do: d
  end

  defp detail_text(_, _, _, :unknown), do: []

  defp detail_text(rel, key, %{"description" => t}, text) do
    if is_map_key(text, t),
      do: [],
      else: [
        diag("UNRESOLVED_REFERENCE", at(rel, ["details", key, "description"]), %{"target" => t})
      ]
  end

  defp reachable(rel, key, detail, ds) do
    others = for {k, o} <- ds, k != key, a <- o["aliases"], into: MapSet.new(), do: a

    [first | _] = words = String.split(hd(detail["aliases"]), "_")

    if "" in words or first in ~w(at the a an) or hd(detail["aliases"]) in others,
      do: [diag("UNREACHABLE_DETAIL", at(rel, ["details", key]))],
      else: []
  end
end
