defmodule Loka.Core.InvariantsEscort do
  @moduledoc "Independent escort identity/status replay and final-row proof."
  @edges [
    {nil, "following"},
    {"following", "separated"},
    {"separated", "following"},
    {"following", "completed"}
  ]

  @spec holds?(map(), [map()], map()) :: boolean()
  def holds?(state, ops, result) do
    case Enum.reduce_while(ops, %{}, &replay(&1, &2, state)) do
      false ->
        false

      written ->
        Enum.all?(written, fn {actor, value} ->
          Enum.any?(
            result["changes"],
            &(&1["target"] == %{"kind" => "escort", "actor_id" => actor} and &1["value"] == value)
          )
        end)
    end
  end

  defp replay(%{"op" => "escort.transition"} = op, written, state) do
    before =
      Map.get_lazy(written, op["actor_id"], fn -> get_in(state, ["escorts", op["actor_id"]]) end)

    value = op["value"]

    identity =
      before == nil or (is_map(before) and Map.put(value, "status", before["status"]) == before)

    if before == op["expected"] and value["actor_id"] == op["actor_id"] and identity and
         {before && before["status"], value["status"]} in @edges,
       do: {:cont, Map.put(written, op["actor_id"], value)},
       else: {:halt, false}
  end

  defp replay(_, written, _), do: {:cont, written}
end
