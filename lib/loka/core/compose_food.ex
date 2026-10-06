defmodule Loka.Core.ComposeFood do
  @moduledoc "Terminal custody preconditions of entity.transfer."
  def valid?(op, state) do
    known = Map.get(state, "known_entities", %{})
    source = known[op["source_id"]] || %{}
    destination = known[op["destination_id"]] || %{}
    item = known[op["entity_id"]] || %{}

    item["kind"] != "consumed" and source["kind"] != "consumed" and
      (destination["kind"] != "consumed" or
         (item["kind"] == "item" and item["edible"] == true and source["kind"] == "body"))
  end
end
