defmodule Loka.Content.Standing do
  @moduledoc """
  Toolbox rows 15 and G11: a reaction's fact.adjust names a bounded int fact (FACT_TYPE_MISMATCH);
  an NPC's disposition is on an authored NPC, with an engage line exactly when it is hostile and
  has an attack (SCHEMA_VIOLATION); either, or a friendly buy_discount, needs kernel_api 1.47.
  Twin of kernel/ts/src/content/cartridge_standing.ts; the conditions and the engage text are
  checked with every entity's (Loka.Content.Entities). A hostile-capable NPC speaking a dialogue
  that accepts, hands over or receives (refused while hostile): HOSTILE_QUEST_SPEAKER, a warning.
  """
  import Loka.Content.Source, only: [diag: 3, at: 2]
  alias Loka.Content.Refs

  # A missing or schema-invalid manifest (nil) has its own diagnostics.
  def check(nil, _, _), do: []

  def check(m, defs, _) do
    npcs = for {_, {rel, [], npc}} <- defs["npc"] || %{}, do: {rel, npc}
    adjusts = for {_, {rel, [], r}} <- defs["reaction"] || %{}, a <- adjusts(r), do: {rel, a}

    shapes(npcs) ++ ints(adjusts, m, defs) ++ floor(m, npcs, adjusts) ++ speakers(m, defs)
  end

  # Not an error: a giver who turns on the player may be intended (PM ruling, loka-kgd.54).
  defp speakers(m, defs) do
    for {_, {rel, [], d}} <- defs["dialogue"] || %{},
        {_, _, %{"disposition" => %{"hostile" => _}}} <- [Refs.resolve(d["npc"], "npc", m, defs)],
        Enum.any?(d["choices"], fn {_, c} ->
          Enum.any?(~w(accept hand_over receive), &is_map_key(c, &1))
        end),
        do: Map.put(diag("HOSTILE_QUEST_SPEAKER", at(rel, ["npc"]), %{}), "severity", "warning")
  end

  defp adjusts(r) do
    for {%{"op" => "fact.adjust"} = s, i} <- Enum.with_index(r["apply"] || []), do: {s, i}
  end

  defp shapes(npcs) do
    for {rel, %{"disposition" => d} = n} <- npcs,
        n["spawn_template"] ||
          is_map_key(d, "engage") != (is_map_key(d, "hostile") and is_map_key(n, "attack")),
        do: diag("SCHEMA_VIOLATION", at(rel, ["disposition"]), %{"error" => "invalid_value"})
  end

  defp ints(adjusts, m, defs) do
    for {rel, {s, i}} <- adjusts,
        {_, _, %{"value_type" => t}} <- [Refs.resolve(s["fact"], "fact", m, defs)],
        not match?(%{"type" => "int", "minimum" => _, "maximum" => _}, t),
        do: diag("FACT_TYPE_MISMATCH", at(rel, ["apply", i, "fact"]), %{})
  end

  defp floor(m, npcs, adjusts) do
    api =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    used =
      adjusts != [] or
        Enum.any?(npcs, fn {_, n} ->
          is_map_key(n, "disposition") or get_in(n, ["shop", "buy_discount", "friendly"]) == true
        end)

    if used and api < [1, 47],
      do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least", %{})],
      else: []
  end
end
