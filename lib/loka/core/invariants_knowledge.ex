defmodule Loka.Core.InvariantsKnowledge do
  @moduledoc "Independent knowledge identity, precondition and resulting-row invariant."
  alias Loka.Core.{Compose, Contracts}

  @spec holds?(map(), list(), map()) :: boolean()
  def holds?(state, ops, result) do
    horizon =
      Enum.reduce(ops, state["clock"], fn op, at ->
        if op["op"] == "time.advance", do: op["to"], else: at
      end)

    knowledge = Enum.filter(ops, &(&1["op"] in ~w(visit.record observation.record)))

    expected =
      Enum.reduce_while(knowledge, %{}, &replay(&1, &2, state, horizon))

    expected != false and
      Enum.all?(expected, &written?(&1, result["changes"]))
  end

  defp written?({key, value}, changes),
    do: Enum.any?(changes, &(Compose.key(&1["target"]) == key and &1["value"] == value))

  defp replay(op, rows, state, horizon) do
    key = Compose.key(Compose.target(op))
    section = if op["op"] == "visit.record", do: "visited_rooms", else: "observed_npcs"

    before =
      Map.get_lazy(rows, key, fn -> Map.get(Map.get(state, section, %{}), key, :missing) end)

    if before != nil and valid?(op, before, horizon),
      do: {:cont, Map.put(rows, key, op["value"])},
      else: {:halt, false}
  end

  defp valid?(%{"op" => "visit.record"} = op, before, _),
    do:
      before == :missing and op["value"]["actor_id"] == op["actor_id"] and
        op["value"]["room_id"] == op["room_id"] and
        Contracts.validate("VisitedRoom", op["value"]) == :ok

  defp valid?(op, before, horizon),
    do:
      if(before == :missing, do: nil, else: before) == op["from"] and
        op["value"]["actor_id"] == op["actor_id"] and
        op["value"]["npc_id"] == op["npc_id"] and op["value"]["at"] <= horizon and
        (before == :missing or before["at"] <= op["value"]["at"]) and
        Contracts.validate("ObservedNpc", op["value"]) == :ok
end
