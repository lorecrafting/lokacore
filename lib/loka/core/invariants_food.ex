defmodule Loka.Core.InvariantsFood do
  @moduledoc "Independent observation of terminal food custody preconditions."
  def holds?(state, ops) do
    metadata = Map.get(state, "known_entities", %{})

    Enum.all?(ops, fn
      %{"op" => "entity.transfer"} = op ->
        transfer?(metadata, op)

      _ ->
        true
    end)
  end

  defp transfer?(metadata, op) do
    item = metadata[op["entity_id"]] || %{}
    source = get_in(metadata, [op["source_id"], "kind"])
    destination = get_in(metadata, [op["destination_id"], "kind"])

    cond do
      item["kind"] == "consumed" or source == "consumed" -> false
      op["consumption"] == "bandaged" -> terminal?(item, source, destination, "bandage")
      destination == "consumed" -> terminal?(item, source, destination, "edible")
      true -> true
    end
  end

  defp terminal?(item, source, destination, marker),
    do:
      destination == "consumed" and source == "body" and item["kind"] == "item" and
        item[marker] == true
end
