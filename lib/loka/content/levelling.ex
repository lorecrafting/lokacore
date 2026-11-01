defmodule Loka.Content.Levelling do
  @moduledoc """
  Checks toolbox row 4 world.levelling and experience.grant steps.
  """
  import Loka.Content.Source, only: [at: 2, diag: 2, diag: 3, diag: 4, ref: 3]
  alias Loka.Content.Refs

  def settings(%{"world" => %{"levelling" => %{"kills" => kills}}} = settings, m),
    do:
      put_in(
        settings,
        ["world", "levelling", "kills"],
        Enum.map(kills, fn k -> Map.update!(k, "npc", &ref(&1, "npc", m)) end)
      )

  def settings(settings, _), do: settings

  def check(m, defs, {_, settings}, text) do
    levelling = get_in(settings, ["world", "levelling"])
    rules = level_rules(defs)

    if levelling,
      do: declared(levelling, m, defs, text) ++ Enum.flat_map(rules, &level_rule(&1, levelling)),
      else: undeclared(defs) ++ for({rel, _} <- rules, do: refused(rel, ["on", "event"]))
  end

  defp undeclared(defs) do
    for {_, {rel, [], r}} <- defs["reaction"] || %{},
        {%{"op" => "experience.grant"}, i} <- Enum.with_index(r["steps"]),
        do: refused(rel, ["steps", i, "op"])
  end

  defp level_rules(defs) do
    for {_, {rel, [], %{"on" => %{"event" => "level_reached"}} = r}} <- defs["reaction"] || %{},
        do: {rel, r}
  end

  defp refused(rel, path), do: diag("SCHEMA_VIOLATION", at(rel, path))

  # A grant under level_reached could re-enter the event it reacts to; a level no threshold
  # reaches never fires (mechanics.md row 4).
  defp level_rule({rel, r}, l) do
    level = r["on"]["level"]

    filter =
      if level == nil or level in 2..(length(l["thresholds"]) + 1),
        do: [],
        else: [diag("SCHEMA_VIOLATION", at(rel, ["on", "level"]), %{"error" => "invalid_value"})]

    filter ++
      for {%{"op" => "experience.grant"}, i} <- Enum.with_index(r["steps"]),
          do: refused(rel, ["steps", i])
  end

  defp declared(l, m, defs, text) do
    owner(m) ++ rising(l["thresholds"]) ++ kills(l["kills"] || [], m, defs) ++ line(l, text)
  end

  @path ["world", "levelling"]

  defp owner(m) do
    if m["requires"]["capabilities"]["attribute"] == 1,
      do: [],
      else: [
        diag(
          "UNDECLARED_CAPABILITY",
          at("cartridge.json", @path),
          %{"capability" => "attribute"},
          [
            "attribute@1"
          ]
        )
      ]
  end

  defp rising(thresholds) do
    for {[a, b], i} <- Enum.with_index(Enum.chunk_every(thresholds, 2, 1, :discard), 1),
        b <= a,
        do: diag("SCHEMA_VIOLATION", at("cartridge.json", @path ++ ["thresholds", i]))
  end

  defp kills(kills, m, defs) do
    for {k, i} <- Enum.with_index(kills),
        e <- Refs.reference("cartridge.json", @path ++ ["kills", i], "npc", k, m, defs),
        do: e
  end

  defp line(l, text) do
    for field <- ["level_up", "gained"],
        key = l[field],
        text != :unknown and not is_map_key(text, key),
        do: diag("UNRESOLVED_REFERENCE", at("cartridge.json", @path ++ [field]))
  end
end
