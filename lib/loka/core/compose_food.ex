defmodule Loka.Core.ComposeFood do
  @moduledoc "Terminal custody preconditions of entity.transfer."
  def valid?(op, state) do
    known = Map.get(state, "known_entities", %{})
    source = known[op["source_id"]] || %{}
    destination = known[op["destination_id"]] || %{}
    item = known[op["entity_id"]] || %{}

    cond do
      item["kind"] == "consumed" or source["kind"] == "consumed" -> false
      op["consumption"] == "bandaged" -> terminal?(item, source, destination, "bandage")
      destination["kind"] == "consumed" -> terminal?(item, source, destination, "edible")
      true -> true
    end
  end

  defp terminal?(item, source, destination, marker),
    do:
      destination["kind"] == "consumed" and item["kind"] == "item" and
        source["kind"] == "body" and item[marker] == true
end
