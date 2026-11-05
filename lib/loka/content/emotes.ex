defmodule Loka.Content.Emotes do
  @moduledoc """
  NPC emotes (G9, emote@1; cartridge.md Emote and Ambient declarations): each emote and each
  room's, NPC's or item's ambient is owned by emote@1; an NPC set has exactly one of lines or
  emotes; every line key is in the catalog and every emote resolves.
  """
  import Loka.Content.Source, only: [at: 2, diag: 2, diag: 3, ref: 3]
  import Loka.Content.Refs, only: [owned: 3, owners: 2, reference: 6]

  def check(nil, _, _, _), do: []

  def check(m, defs, {_, text}, registry) do
    required = {m["requires"]["capabilities"], owners(registry, ["definitions"])}

    for(
      {_, {rel, [], e}} <- defs["emote"] || %{},
      d <- owned(rel, "emote", required) ++ texts(rel, e, text),
      do: d
    ) ++ sets(ambient(defs), m, defs, text, required)
  end

  defp sets(sets, m, defs, text, required) do
    Enum.flat_map(sets, &set(&1, m, defs, text)) ++
      for {rel, path} <- Enum.uniq(for {rel, p, _} <- sets, do: {rel, Enum.drop(p, -1)}),
          d <- owned(at(rel, path), "emote", required),
          do: d
  end

  @doc "Each ambient set as `{rel, path, set}`, path ending at its index."
  def ambient(defs) do
    for kind <- ["room", "npc", "item"],
        {_, {rel, steps, d}} <- defs[kind] || %{},
        {set, i} <- Enum.with_index(d["ambient"] || []),
        do: {rel, steps ++ ["ambient", i], set}
  end

  @doc "Each ambient set's condition, as `{rel, steps, root}`."
  def conditions(defs),
    do: for({rel, path, %{"when" => w}} <- ambient(defs), do: {rel, path ++ ["when"], w})

  @doc "NPC ambient sets expanded: each condition via `expand`, each short emote reference."
  def expand(sets, m, expand) do
    for s <- expand.(sets, m),
        do: Map.replace_lazy(s, "emotes", &Enum.map(&1, fn e -> ref(e, "emote", m) end))
  end

  defp set({rel, path, set}, m, defs, text) do
    lines = for {k, i} <- Enum.with_index(set["lines"] || []), do: {path ++ ["lines", i], k}
    one(rel, path, set) ++ missing(rel, lines, text) ++ emotes(rel, path, set, m, defs)
  end

  defp one(_, _, set) when is_map_key(set, "lines") != is_map_key(set, "emotes"), do: []
  defp one(rel, path, _), do: [diag("SCHEMA_VIOLATION", at(rel, path))]

  defp emotes(rel, path, set, m, defs) do
    for {e, i} <- Enum.with_index(set["emotes"] || []),
        d <- reference(rel, path ++ ["emotes"], {i, "emote"}, %{i => e}, m, defs),
        do: d
  end

  defp texts(rel, e, text),
    do:
      missing(
        rel,
        [{["others"], e["others"]} | for({f, k} <- e["to"] || %{}, do: {["to", f], k})],
        text
      )

  defp missing(rel, keys, text) do
    for {path, k} <- keys,
        text != :unknown and not is_map_key(text, k),
        do: diag("UNRESOLVED_REFERENCE", at(rel, path), %{"target" => k})
  end
end
