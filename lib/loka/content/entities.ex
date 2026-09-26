defmodule Loka.Content.Entities do
  @moduledoc """
  Items and NPCs (entity.schema.json; 21 §8; 03 §23): their definition kinds and room-line
  variants, their text keys, the variants' conditions, and where they start (containment:
  no cycle, capacity). Ownership and location references are `Loka.Content.Checks.rooms/4`.
  """
  import Loka.Content.Source, only: [diag: 2, diag: 3, at: 2]

  @text ~w(short room_line description)

  @doc "The schema-valid NPCs and items as `{kind, rel, definition}`."
  @spec all(map()) :: [{String.t(), String.t(), map()}]
  def all(defs), do: for(k <- ~w(npc item), {_, {rel, [], e}} <- defs[k], do: {k, rel, e})

  @doc "An entity and each of its room-line variants, as `{steps, kind}` (registry definitions)."
  @spec parts(map(), String.t()) :: [{list(), String.t()}]
  def parts(e, kind), do: [{[], kind} | for({steps, _} <- variants(e), do: {steps, "variant"})]

  defp variants(e) do
    for {v, i} <- Enum.with_index(Map.get(e, "room_line_variants", [])),
        do: {["room_line_variants", i], v}
  end

  @doc "Each room-line variant's condition, as `{rel, steps, root}`."
  @spec conditions(map()) :: [{String.t(), list(), map()}]
  def conditions(defs) do
    for {_, rel, e} <- all(defs),
        {steps, v} <- variants(e),
        do: {rel, steps ++ ["when", "root"], v["when"]["root"]}
  end

  @doc "UNRESOLVED_REFERENCE for each entity text key without a catalog entry."
  @spec texts(map(), map() | :unknown) :: [map()]
  def texts(_, :unknown), do: []

  def texts(defs, text) do
    for {_, rel, e} <- all(defs),
        {steps, key} <- for(f <- @text, do: {[f], e[f]}) ++ variant_texts(e),
        not is_map_key(text, key),
        do: diag("UNRESOLVED_REFERENCE", at(rel, steps), %{"target" => key})
  end

  defp variant_texts(e),
    do: for({s, v} <- variants(e), do: {s ++ ["description"], v["description"]})

  @doc """
  Every text of each entity as `{rel, entity key, steps, text key}`: short, room_line and
  description, then each room-line variant's description.
  """
  @spec text_keys(map()) :: [{String.t(), String.t(), list(), String.t()}]
  def text_keys(defs) do
    for {_, rel, e} <- all(defs),
        {steps, key} <- for(f <- @text, do: {[f], e[f]}) ++ variant_texts(e),
        do: {rel, e["key"], steps, key}
  end

  @doc """
  CONTAINMENT_CYCLE at each item whose location leads back to it through items, and
  CAPACITY_EXCEEDED at each NPC or item that starts holding more items than its capacity.
  """
  @spec holders(map()) :: [map()]
  def holders(defs) do
    items = for {_, {rel, [], i}} <- defs["item"], into: %{}, do: {i["key"], {rel, i}}
    in_cycle = for {key, {rel, _}} <- items, cycle?(key, items), do: rel

    Enum.map(in_cycle, &diag("CONTAINMENT_CYCLE", at(&1, ["location", "item"]))) ++
      over(defs, items)
  end

  defp over(defs, items) do
    held =
      Enum.frequencies(
        for {_, {_, %{"location" => l}}} <- items, do: {l["in"], l[l["in"]]["key"]}
      )

    for {kind, rel, %{"capacity" => cap} = h} <- all(defs),
        n = Map.get(held, {kind, h["key"]}, 0),
        n > cap,
        do: diag("CAPACITY_EXCEEDED", at(rel, ["capacity"]), %{"capacity" => cap, "held" => n})
  end

  # Following items' locations from `key` returns to it within one step per item.
  defp cycle?(key, items) do
    Enum.reduce_while(1..map_size(items), key, fn _, at ->
      case items[at] do
        {_, %{"location" => %{"in" => "item", "item" => %{"key" => ^key}}}} -> {:halt, true}
        {_, %{"location" => %{"in" => "item", "item" => %{"key" => up}}}} -> {:cont, up}
        _ -> {:halt, false}
      end
    end) == true
  end
end
