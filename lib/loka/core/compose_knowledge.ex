defmodule Loka.Core.ComposeKnowledge do
  @moduledoc "Portable knowledge row identity and monotone observation time."

  @spec record(map(), map(), tuple()) :: {:ok, map()} | {:error, String.t()}
  def record(op, target, {state, horizon, overlay}) do
    before = row(target, state, overlay)
    value = op["value"]

    if before != nil and value["actor_id"] == op["actor_id"] and valid?(op, before, horizon),
      do: {:ok, value},
      else: {:error, "precondition_failed"}
  end

  defp row(target, state, overlay) do
    key = Loka.Core.ComposeTarget.key(target)

    case Map.fetch(overlay, key) do
      {:ok, {_, _, value}} ->
        value

      :error ->
        name = if target["kind"] == "visit", do: "visited_rooms", else: "observed_npcs"
        Map.get(Map.get(state, name, %{}), key, :missing)
    end
  end

  # A first visit has no from and no count; a later one (variety@1) names the current row in from
  # and counts it plus one.
  defp valid?(%{"op" => "visit.record"} = op, before, _),
    do: op["value"]["room_id"] == op["room_id"] and counted?(op, before)

  defp valid?(%{"op" => "observation.record"} = op, before, horizon),
    do:
      if(before == :missing, do: nil, else: before) == op["from"] and
        op["value"]["npc_id"] == op["npc_id"] and
        op["value"]["at"] <= horizon and
        (before == :missing or op["value"]["at"] >= before["at"])

  defp counted?(op, :missing),
    do: not is_map_key(op, "from") and not is_map_key(op["value"], "count")

  defp counted?(op, before),
    do: op["from"] == before and op["value"]["count"] == Map.get(before, "count", 1) + 1
end
