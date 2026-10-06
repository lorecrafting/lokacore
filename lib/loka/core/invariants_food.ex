defmodule Loka.Core.InvariantsFood do
  @moduledoc "Independent observation of terminal food custody preconditions."
  def holds?(state, ops) do
    metadata = Map.get(state, "known_entities", %{})

    Enum.all?(ops, fn
      %{"op" => "entity.transfer"} = op ->
        source = get_in(metadata, [op["source_id"], "kind"])
        destination = get_in(metadata, [op["destination_id"], "kind"])

        get_in(metadata, [op["entity_id"], "kind"]) != "consumed" and source != "consumed" and
          (destination != "consumed" or
             (source == "body" and get_in(metadata, [op["entity_id"], "kind"]) == "item" and
                get_in(metadata, [op["entity_id"], "edible"]) == true))

      _ ->
        true
    end)
  end
end
