defmodule Loka.Core.ComposeFood do
  @moduledoc "Terminal custody preconditions of entity.transfer."
  def valid?(op, state) do
    known = Map.get(state, "known_entities", %{})
    source = known[op["source_id"]] || %{}
    destination = known[op["destination_id"]] || %{}
    item = known[op["entity_id"]] || %{}

    cond do
      item["kind"] == "consumed" or source["kind"] == "consumed" ->
        false

      op["consumption"] == "bandaged" ->
        terminal?(item, source, destination, "bandage")

      destination["kind"] == "consumed" ->
        consumed?(op, state, item, source, destination)

      true ->
        true
    end
  end

  defp consumed?(op, state, item, source, destination),
    do: decayed?(op, state, source["kind"]) or terminal?(item, source, destination, "edible")

  # death@1 decay: a death-created corpse leaves its room for the consumed holder.
  defp decayed?(op, state, source),
    do:
      get_in(state, ["created", op["entity_id"], "origin", "kind"]) == "death" and
        source == "room" and op["consumption"] == nil

  defp terminal?(item, source, destination, marker),
    do:
      destination["kind"] == "consumed" and item["kind"] == "item" and
        source["kind"] == "body" and item[marker] == true
end
