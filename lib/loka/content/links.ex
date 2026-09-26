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

  @doc """
  The link diagnostics of a v2 source's rooms, details, items and NPCs (`{entry, text}`; nil
  for v1), warnings included (severity warning).
  """
  @spec check(map(), {term(), map() | :unknown} | nil) :: [map()]
  def check(_, nil), do: []
  def check(_, {_, :unknown}), do: []

  def check(defs, {_, text}) do
    entities = MapSet.new(for {_, _, e} <- Entities.all(defs), do: e["key"])

    for use <- room_uses(defs, entities) ++ entity_uses(defs, entities),
        d <- links(use, text),
        do: d
  end

  # Each use as {rel, steps, text key, self, targets, must link}: an item's or NPC's texts
  # (self the item or NPC; its room lines must link it).
  defp entity_uses(defs, entities) do
    for {rel, key, steps, t} <- Entities.text_keys(defs),
        do: {rel, steps, t, key, entities, if(room_line?(steps), do: [key], else: [])}
  end

  # A room's texts (targets its details too): its descriptions must link every detail.
  defp room_uses(defs, entities) do
    for {_, {rel, [], r}} <- defs["room"],
        details = Map.keys(Map.get(r, "details", %{})),
        targets = MapSet.union(entities, MapSet.new(details)),
        {steps, key} <- texts(r) do
      self = detail_of(steps)
      {rel, steps, key, self, targets, if(self || steps == ["title"], do: [], else: details)}
    end
  end

  # The title, description and variants of room `r`, then each detail's description and
  # variants (RoomParts.variants), as {steps, text key}.
  defp texts(r) do
    details = for {k, d} <- Map.get(r, "details", %{}), do: {["details", k], d}

    [
      {["title"], r["title"]}
      | for({s, d} <- [{[], r} | details], do: {s ++ ["description"], d["description"]})
    ] ++
      for {s, v} <- RoomParts.variants(r), do: {s ++ ["description"], v["description"]}
  end

  defp detail_of(["details", k | _]), do: k
  defp detail_of(_), do: nil

  defp room_line?(["room_line"]), do: true
  defp room_line?(["room_line_variants", _, "description"]), do: true
  defp room_line?(_), do: false

  defp links({rel, steps, key, self, targets, must}, text) do
    path = at(rel, steps)
    named = for [_, w | t] <- Regex.scan(@link, Map.get(text, key, "")), do: target(w, t, self)
    unresolved(named, self, targets, path) ++ missing(named, must, path)
  end

  defp unresolved(named, self, targets, path) do
    for {as, t} <- named,
        not valid?(t, self, targets),
        do: diag("UNRESOLVED_REFERENCE", path, %{"target" => as})
  end

  defp missing(named, must, path) do
    linked = for {_, t} <- named, do: t
    for t <- must, t not in linked, do: warning(path, t)
  end

  defp valid?(t, self, targets), do: t != nil and (t == self or MapSet.member?(targets, t))

  # A link's {target as reported, target}: its key, else the text's own thing (none in a
  # room's own text, reported as the link).
  defp target(_, [t], _), do: {t, t}
  defp target(words, [], nil), do: {"[#{words}]", nil}
  defp target(_, [], self), do: {self, self}

  defp warning(path, t),
    do: Map.put(diag("TOUCH_LINK_MISSING", path, %{"target" => t}), "severity", "warning")
end
