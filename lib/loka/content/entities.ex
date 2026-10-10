defmodule Loka.Content.Entities do
  @moduledoc """
  Items and NPCs (entity.schema.json; 21 §8; 03 §23): their definition kinds and room-line
  variants, their text keys, the variants' conditions, and where they start (containment:
  no cycle, capacity). Ownership and location references are `Loka.Content.Checks.rooms/4`.
  """
  import Loka.Content.Source, only: [diag: 2, diag: 3, diag: 4, at: 2]

  @text ~w(short room_line description)

  @doc "The schema-valid NPCs and items as `{kind, rel, definition}`."
  @spec all(map()) :: [{String.t(), String.t(), map()}]
  def all(defs), do: for(k <- ~w(npc item), {_, {rel, [], e}} <- defs[k], do: {k, rel, e})

  @doc "Authored carrying requires complete item masses, containment and API 1.3."
  @spec carry(map() | nil, map(), {term(), map()}) :: [map()]
  def carry(m, defs, {_, %{"world" => %{"carry" => _}}}) when m != nil do
    owner =
      if m["requires"]["capabilities"]["containment"] == 1,
        do: [],
        else: [
          diag(
            "UNDECLARED_CAPABILITY",
            "cartridge.world.carry",
            %{"capability" => "containment"},
            [
              "containment@1"
            ]
          )
        ]

    version =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    api =
      if version < [1, 3],
        do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
        else: []

    masses =
      for {"item", rel, e} <- all(defs),
          not is_map_key(e, "mass_grams"),
          do: diag("SCHEMA_VIOLATION", at(rel, ["mass_grams"]), %{"error" => "missing_property"})

    masses ++ owner ++ api
  end

  def carry(_, _, _), do: []

  @doc """
  An entity, each of its text variants, an NPC's daily schedule and an item's slot, as
  `{steps, kind}` (registry definitions).
  """
  @spec parts(map(), String.t()) :: [{list(), String.t()}]
  def parts(e, kind) do
    optional =
      for {f, k} <- [
            {"daily_schedule", "schedule"},
            {"slot", "slot"},
            {"shop", "shop"},
            {"fuel", "fuel"},
            {"readable", "readable"},
            {"edible", "edible"},
            {"tags", "tags"}
          ],
          is_map_key(e, f),
          do: {[f], k}

    [{[], kind} | for({steps, _} <- variants(e), do: {steps, "variant"})] ++ optional
  end

  # An item's or NPC's text variant lists (TextVariants; toolbox row W6).
  defp variants(e) do
    for f <- ~w(short_variants room_line_variants description_variants),
        {v, i} <- Enum.with_index(Map.get(e, f, [])),
        do: {[f, i], v}
  end

  @doc "Each text variant's condition, as `{rel, steps, root}`."
  @spec conditions(map()) :: [{String.t(), list(), map()}]
  def conditions(defs) do
    for {_, rel, e} <- all(defs),
        {steps, v} <- variants(e) ++ cases(e),
        do: {rel, steps ++ ["when", "root"], v["when"]["root"]}
  end

  # Toolbox row W10: each case of a source daily_schedule hour list (Loka.Content.Schedules).
  defp cases(e) do
    for {h, list} when is_list(list) <- Map.get(e, "daily_schedule", %{}),
        {%{"when" => _} = c, i} <- Enum.with_index(list),
        do: {["daily_schedule", h, i], c}
  end

  @doc "UNRESOLVED_REFERENCE for each entity text key without a catalog entry."
  @spec texts(map(), map() | :unknown) :: [map()]
  def texts(_, :unknown), do: []

  def texts(defs, text) do
    for {rel, _, steps, key} <- text_keys(defs),
        not is_map_key(text, key),
        do: diag("UNRESOLVED_REFERENCE", at(rel, steps), %{"target" => key})
  end

  defp fuel_texts(%{"fuel" => %{"kind" => "source"} = f}),
    do: for(k <- ~w(ignited doused refueled), do: {["fuel", k], f[k]})

  defp fuel_texts(_), do: []

  defp readable_texts(%{"readable" => r}),
    do: for(f <- ~w(label text), do: {["readable", f], r[f]})

  defp readable_texts(_), do: []

  defp shop_texts(%{"shop" => s}), do: for(f <- ~w(bought sold), do: {["shop", f], s[f]})
  defp shop_texts(_), do: []

  defp goal_texts(e), do: for({s, %{"goal" => g}} <- cases(e), do: {s ++ ["goal"], g})

  defp variant_texts(e),
    do: for({s, v} <- variants(e), do: {s ++ ["description"], v["description"]})

  @doc """
  Every text of each entity as `{rel, entity key, steps, text key}`: short, room_line and
  description, then each text variant's description.
  """
  @spec text_keys(map()) :: [{String.t(), String.t(), list(), String.t()}]
  def text_keys(defs) do
    for {_, rel, e} <- all(defs),
        {steps, key} <- definition_texts(e),
        do: {rel, e["key"], steps, key}
  end

  defp definition_texts(e),
    do:
      for(f <- @text, do: {[f], e[f]}) ++
        variant_texts(e) ++ shop_texts(e) ++ fuel_texts(e) ++ readable_texts(e) ++ goal_texts(e)

  @doc """
  CONTAINMENT_CYCLE at each item whose location leads back to it through items, and
  CAPACITY_EXCEEDED at each NPC or item that starts holding more items than its capacity.
  """
  @spec holders(map()) :: [map()]
  def holders(defs) do
    items = for {_, {rel, [], i}} <- defs["item"], into: %{}, do: {i["key"], {rel, i}}
    in_cycle = for {key, {rel, _}} <- items, cycle?(key, items), do: rel

    Enum.map(in_cycle, &diag("CONTAINMENT_CYCLE", at(&1, ["location", "item"]))) ++
      receptacles(items) ++ children(items) ++ over(defs, items)
  end

  defp receptacles(items) do
    for {_, {rel, i}} <- items,
        f <- ~w(capacity barrier),
        i["container"] != true,
        is_map_key(i, f),
        do: diag("SCHEMA_VIOLATION", at(rel, [f]), %{"error" => "invalid_value"})
  end

  defp children(items) do
    for {_, {rel, %{"location" => %{"in" => "item", "item" => ref}}}} <- items,
        {_, holder} <- [items[ref["key"]]],
        holder["container"] != true,
        do: diag("SCHEMA_VIOLATION", at(rel, ["location", "item"]), %{"error" => "invalid_value"})
  end

  defp over(defs, items) do
    held =
      Enum.frequencies(
        for {_, {_, %{"location" => l}}} <- items,
            l["in"] != "template",
            do: {l["in"], l[l["in"]]["key"]}
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
