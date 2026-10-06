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
        {steps, t} <- description_keys(r),
        not is_map_key(text, t),
        do: diag("UNRESOLVED_REFERENCE", at(rel, steps), %{"target" => t})
  end

  defp description_keys(r) do
    variants = for {s, v} <- variants(r), do: {s ++ ["description"], v["description"]}

    if r["dark_description"],
      do: [{["dark_description"], r["dark_description"]} | variants],
      else: variants
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
  The room `r`, its details, embedded readables and description variants as `{steps, kind}`, the
  definition kinds of capability_registry.json.
  """
  @spec parts(map()) :: [{list(), String.t()}]
  def parts(r) do
    details = for {k, _} <- Map.get(r, "details", %{}), do: {["details", k], "detail"}

    readables =
      for {k, d} <- Map.get(r, "details", %{}),
          field <- ~w(readable notice_board bed),
          is_map_key(d, field),
          do: {["details", k, field], if(field == "bed", do: "bed", else: "readable")}

    [{[], "room"} | details] ++
      if(r["dark_description"], do: [{["dark_description"], "darkness"}], else: []) ++
      readables ++
      for {steps, _} <- variants(r), do: {steps, "variant"}
  end

  @doc "Each variant's condition in the schema-valid rooms, as `{rel, steps, root}`."
  @spec conditions(map()) :: [{String.t(), list(), map()}]
  def conditions(defs) do
    for {_, {rel, [], r}} <- defs["room"],
        {steps, v} <- variants(r),
        do: {rel, steps ++ ["when", "root"], v["when"]["root"]}
  end

  @doc """
  Each detail's description and readable keys have catalog entries, and its first alias is one no other detail of
  its room has, in the form a lookup produces (room.schema.json InspectableDetail).
  """
  @spec details(map(), map() | :unknown) :: [map()]
  def details(defs, text) do
    for {_, {rel, [], r}} <- defs["room"],
        ds = Map.get(r, "details", %{}),
        {key, detail} <- ds,
        d <-
          detail_text(rel, key, detail, text) ++
            board_refs(rel, key, detail, ds) ++ reachable(rel, key, detail, ds),
        do: d
  end

  defp detail_text(_, _, _, :unknown), do: []

  defp detail_text(rel, key, detail, text) do
    fields =
      [{["description"], detail["description"]}] ++
        for({field, value} <- Map.get(detail, "readable", %{}), do: {["readable", field], value}) ++
        board_text(detail) ++
        harvest_text(detail)

    for {steps, value} <- fields,
        not is_map_key(text, value),
        do: diag("UNRESOLVED_REFERENCE", at(rel, ["details", key] ++ steps), %{"target" => value})
  end

  defp harvest_text(detail),
    do:
      for({k, v} <- Map.drop(Map.get(detail, "harvest", %{}), ["items"]), do: {["harvest", k], v})

  defp board_text(%{"notice_board" => board}) do
    [{["notice_board", "title"], board["title"]}] ++
      for {notice, i} <- Enum.with_index(board["notices"]),
          do: {["notice_board", "notices", i, "title"], notice["title"]}
  end

  defp board_text(_), do: []

  defp board_refs(rel, key, %{"notice_board" => board} = detail, ds) do
    at = at(rel, ["details", key, "notice_board"])
    own = if is_map_key(detail, "readable"), do: [diag("UNRESOLVED_REFERENCE", at)], else: []

    {errors, _} =
      Enum.reduce(Enum.with_index(board["notices"]), {[], MapSet.new()}, fn {notice, i},
                                                                            {errors, seen} ->
        {errors ++ board_ref(at, key, notice, i, ds, seen), MapSet.put(seen, notice["detail"])}
      end)

    own ++ errors
  end

  defp board_refs(_, _, _, _), do: []

  defp board_ref(at, key, notice, i, ds, seen) do
    target = notice["detail"]
    sibling = ds[target] || %{}

    if target != key and not MapSet.member?(seen, target) and is_map_key(sibling, "readable"),
      do: [],
      else: [diag("UNRESOLVED_REFERENCE", at <> ".notices[#{i}].detail", %{"target" => target})]
  end

  defp reachable(rel, key, detail, ds) do
    others = for {k, o} <- ds, k != key, a <- o["aliases"], into: MapSet.new(), do: a

    [first | _] = words = String.split(hd(detail["aliases"]), "_")

    if "" in words or first in ~w(at the a an) or hd(detail["aliases"]) in others,
      do: [diag("UNREACHABLE_DETAIL", at(rel, ["details", key]))],
      else: []
  end
end
