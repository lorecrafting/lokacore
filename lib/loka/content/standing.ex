defmodule Loka.Content.Standing do
  @moduledoc """
  Toolbox rows 15 and G11: a reaction's fact.adjust names a bounded int fact (FACT_TYPE_MISMATCH);
  an NPC's disposition is on an authored NPC, with an engage line exactly when it is hostile and
  has an attack and is not `unattackable` (SCHEMA_VIOLATION). Row 35: an arrest instead of the engage line needs
  `hostile` and no `engage` (SCHEMA_VIOLATION) and a room to move the body to
  (UNRESOLVED_REFERENCE).
  The conditions and the engage text are
  checked with every entity's (Loka.Content.Entities). A hostile-capable NPC speaking a dialogue
  that accepts, hands over, receives or escorts (refused while hostile): HOSTILE_QUEST_SPEAKER, a
  warning.
  """
  import Loka.Content.Source, only: [diag: 3, at: 2]
  alias Loka.Content.Refs

  # A missing or schema-invalid manifest (nil) has its own diagnostics.
  def check(nil, _), do: []

  def check(m, defs) do
    npcs = for {_, {rel, [], npc}} <- defs["npc"] || %{}, do: {rel, npc}
    adjusts = for {_, {rel, [], r}} <- defs["reaction"] || %{}, a <- adjusts(r), do: {rel, a}

    shapes(npcs) ++
      unattackable_engage(npcs) ++
      arrests(npcs, m, defs) ++
      ints(adjusts, m, defs) ++ speakers(m, defs)
  end

  # Not an error: a giver who turns on the player may be intended (PM ruling, loka-kgd.54).
  defp speakers(m, defs) do
    for {_, {rel, [], d}} <- defs["dialogue"] || %{},
        {_, _, %{"disposition" => %{"hostile" => _}}} <- [Refs.resolve(d["npc"], "npc", m, defs)],
        Enum.any?(d["choices"] || %{}, fn {_, c} ->
          Enum.any?(~w(accept hand_over receive escort), &is_map_key(c, &1))
        end),
        do: Map.put(diag("HOSTILE_QUEST_SPEAKER", at(rel, ["npc"]), %{}), "severity", "warning")
  end

  defp adjusts(r) do
    for {%{"op" => "fact.adjust"} = s, i} <- Enum.with_index(r["steps"] || []), do: {s, i}
  end

  # An engage line opens a fight, which an unattackable NPC never has (loka-w9id).
  defp unattackable_engage(npcs) do
    for {rel, %{"unattackable" => true, "disposition" => %{"engage" => _}}} <- npcs,
        do:
          diag("SCHEMA_VIOLATION", at(rel, ["unattackable"]), %{
            "why" => "unattackable_engage",
            "rel" => rel
          })
  end

  defp shapes(npcs) do
    for {rel, %{"disposition" => d} = n} <- npcs,
        n["spawn_template"] || bad?(d, n) ||
          (is_map_key(d, "refuse") and not is_map_key(d, "hostile")),
        do: diag("SCHEMA_VIOLATION", at(rel, ["disposition"]), %{"error" => "invalid_value"})
  end

  defp bad?(%{"arrest" => _} = d, _), do: not is_map_key(d, "hostile") or is_map_key(d, "engage")

  # An unattackable NPC never engages: an engage line has its own diagnostic, none is required.
  defp bad?(_, %{"unattackable" => true}), do: false

  defp bad?(d, n),
    do: is_map_key(d, "engage") != (is_map_key(d, "hostile") and is_map_key(n, "attack"))

  defp arrests(npcs, m, defs) do
    for {rel, %{"disposition" => %{"arrest" => a}}} <- npcs,
        diag <- Refs.reference(rel, ["disposition", "arrest"], {"to", "room"}, a, m, defs),
        do: diag
  end

  defp ints(adjusts, m, defs) do
    for {rel, {s, i}} <- adjusts,
        {_, _, %{"value_type" => t}} <- [Refs.resolve(s["fact"], "fact", m, defs)],
        not match?(%{"type" => "int", "minimum" => _, "maximum" => _}, t),
        do: diag("FACT_TYPE_MISMATCH", at(rel, ["steps", i, "fact"]), %{})
  end
end
