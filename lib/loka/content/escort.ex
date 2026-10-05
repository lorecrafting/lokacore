defmodule Loka.Content.Escort do
  @moduledoc "Bound NPC and quest agreement for an authored escort choice."
  import Loka.Content.Source, only: [diag: 2, diag: 3, at: 2]
  import Loka.Content.Refs, only: [owned: 3, reference: 6]

  @spec choice(String.t(), list(), map(), map(), map()) :: [map()]
  def choice(rel, steps, %{"escort" => escort}, d, ctx) do
    steps = steps ++ ["escort"]

    owned(at(rel, steps), "escort", ctx.kinds) ++
      reference(rel, steps, "quest", escort, ctx.m, ctx.defs) ++
      for {true, diagnostic} <- [
            {not match?(%{"role" => "npc"}, d["roles"][escort["npc"]]),
             diag("UNRESOLVED_REFERENCE", at(rel, steps ++ ["npc"]), %{"target" => escort["npc"]})},
            {not agrees?(escort, d), diag("OUTCOME_MISMATCH", at(rel, steps ++ ["quest"]))}
          ],
          do: diagnostic
  end

  def choice(_, _, _, _, _), do: []

  defp agrees?(%{"transition" => "complete", "quest" => quest}, d), do: d["quest"] == quest
  defp agrees?(_, d), do: not is_map_key(d, "quest")
end
