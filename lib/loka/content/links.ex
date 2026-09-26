defmodule Loka.Content.Links do
  @moduledoc """
  Touch links in catalog strings (owner decision 2026-09-25, Q3; text.schema.json TextCatalog):
  `[words]` links the thing whose text it is, and `[words]` followed by `(key)` links that
  detail of the room or item or NPC of the cartridge. A target that names none of them is
  UNRESOLVED_REFERENCE; a room description (or variant) without a link to one of the room's
  details, or a room line (or variant) without one to its item or NPC, is a TOUCH_LINK_MISSING
  warning. Checked for each use of a text key, since its owner decides what a link may name.
  """
  import Loka.Content.Source, only: [diag: 3, at: 2]
  alias Loka.Content.{Entities, RoomParts}

  @link ~r/\[([^\[\]]+)\](?:\(([^()]*)\))?/

  @doc "`{errors, warnings}` for the links of every room, detail, item and NPC text."
  @spec check(map(), map() | :unknown) :: {[map()], [map()]}
  def check(_, :unknown), do: {[], []}

  def check(defs, text) do
    entities = for {_, _, e} <- Entities.all(defs), into: MapSet.new(), do: e["key"]

    uses =
      for({_, {rel, [], r}} <- defs["room"], use <- room_uses(rel, r, entities), do: use) ++
        for {rel, key, steps, t} <- Entities.text_keys(defs),
            do: {rel, steps, t, key, entities, if(room_line?(steps), do: [key], else: [])}

    Enum.reduce(uses, {[], []}, fn use, {es, ws} ->
      {e, w} = links(use, text)
      {es ++ e, ws ++ w}
    end)
  end

  # Each text of room `r` as {rel, steps, key, self, targets, must_link}: the room's title,
  # description and variants (no self; descriptions must link every detail), then each detail's
  # description and variants (self the detail).
  defp room_uses(rel, r, entities) do
    details = Map.get(r, "details", %{})
    targets = MapSet.union(entities, MapSet.new(Map.keys(details)))
    all = Map.keys(details)

    [{rel, ["title"], r["title"], nil, targets, []}] ++
      for {steps, key, self} <- descriptions(r) do
        {rel, steps, key, self, targets, if(self, do: [], else: all)}
      end
  end

  defp descriptions(r) do
    variants = Map.new(RoomParts.variants(r))

    [{["description"], r["description"], nil}] ++
      for({[_, _] = s, v} <- variants, do: {s ++ ["description"], v["description"], nil}) ++
      for {k, d} <- Map.get(r, "details", %{}),
          {s, t} <-
            [{["details", k, "description"], d["description"]}] ++
              for(
                {["details", ^k | _] = s, v} <- variants,
                do: {s ++ ["description"], v["description"]}
              ),
          do: {s, t, k}
  end

  defp room_line?(["room_line"]), do: true
  defp room_line?(["room_line_variants", _, "description"]), do: true
  defp room_line?(_), do: false

  defp links({rel, steps, key, self, targets, must}, text) do
    found = for [_ | rest] <- Regex.scan(@link, Map.get(text, key, "")), do: rest
    path = at(rel, steps)

    named =
      for [words | target] <- found do
        case {target, self} do
          {[t], _} -> {t, t}
          {[], nil} -> {"[#{words}]", nil}
          {[], s} -> {s, s}
        end
      end

    errors =
      for {as, t} <- named,
          t == nil or (not MapSet.member?(targets, t) and t != self),
          do: diag("UNRESOLVED_REFERENCE", path, %{"target" => as})

    linked = for {_, t} <- named, do: t
    {errors, for(t <- must, t not in linked, do: warning(path, t))}
  end

  defp warning(path, t),
    do: Map.put(diag("TOUCH_LINK_MISSING", path, %{"target" => t}), "severity", "warning")
end
