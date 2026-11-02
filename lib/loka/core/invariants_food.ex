defmodule Loka.Core.InvariantsFood do
  @moduledoc "Independent observation of terminal food custody preconditions."
  def holds?(state, ops) do
    metadata = Map.get(state, "known_entities", %{})

    Enum.all?(ops, fn
      %{"op" => "entity.transfer"} = op ->
        transfer?(metadata, op, state)

      _ ->
        true
    end)
  end

  defp transfer?(metadata, op, state) do
    item = metadata[op["entity_id"]] || %{}
    source = get_in(metadata, [op["source_id"], "kind"])
    destination = get_in(metadata, [op["destination_id"], "kind"])

    cond do
      item["kind"] == "consumed" or source == "consumed" ->
        false

      op["consumption"] == "bandaged" ->
        terminal?(item, source, destination, "bandage")

      destination == "consumed" ->
        decayed?(op, state, source) or terminal?(item, source, destination, "edible")

      true ->
        true
    end
  end

  # Independent restatement of ComposeFood.decayed?/3.
  defp decayed?(op, state, source),
    do:
      get_in(state, ["created", op["entity_id"], "origin", "kind"]) == "death" and
        source == "room" and op["consumption"] == nil

  defp terminal?(item, source, destination, marker),
    do:
      destination == "consumed" and source == "body" and item["kind"] == "item" and
        item[marker] == true
end
