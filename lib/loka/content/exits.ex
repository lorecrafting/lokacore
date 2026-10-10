defmodule Loka.Content.Exits do
  @moduledoc "A room's exits: source reference expansion and reference checks (corpse ingress, hidden_until, climb)."
  import Loka.Content.Source, only: [ref: 3]
  import Loka.Content.Refs, only: [reference: 6]

  @doc "Expands each exit's short references to local DefinitionRefs."
  @spec expand(map(), map()) :: map()
  def expand(exits, m), do: Map.new(exits, fn {d, e} -> {d, Map.new(e, &field(&1, m))} end)

  defp field({k, v}, m) when k in ~w(corpse_ingress hidden_until knock),
    do: {k, Loka.Content.Checks.expand(v, m)}

  defp field({"climb", v}, m), do: {"climb", Map.update!(v, "item", &ref(&1, "item", m))}
  defp field({k, v}, m), do: {k, ref(v, if(k == "to", do: "room", else: k), m)}

  @doc "Unresolved destination and corpse-ingress fact references of a room's exits."
  @spec check(String.t(), map(), map(), map()) :: [map()]
  def check(rel, exits, m, defs) do
    Enum.flat_map(exits, fn {dir, exit} ->
      reference(rel, ["exits", dir], {"to", "room"}, exit, m, defs) ++
        if(exit["corpse_ingress"],
          do:
            reference(
              rel,
              ["exits", dir, "corpse_ingress"],
              {"fact", "fact"},
              exit["corpse_ingress"],
              m,
              defs
            ),
          else: []
        )
    end)
  end
end
