defmodule Loka.Core.ComposeWater do
  @moduledoc "Portable generation-bound water occupancy transition."
  def transition(op, row, {state, _, _} = ctx, read) do
    after_row = op["value"]
    body = after_row["body_id"]
    room = read.(%{"kind" => "containment", "entity_id" => body}, ctx)
    known = state["known_entities"] || %{}

    if identity?(op, row, after_row, known) and
         lifecycle(op["expected"], after_row, state["clock"], known, room),
       do: {:ok, after_row},
       else: {:error, "precondition_failed"}
  end

  defp identity?(op, row, after_row, known) do
    before = op["expected"]
    body = after_row["body_id"]

    row == before and after_row["generation"] == ((before || %{})["generation"] || 0) + 1 and
      (before == nil or before["body_id"] == body) and
      get_in(known, [body, "kind"]) == "body" and
      get_in(known, [body, "owner_id"]) == op["actor_id"]
  end

  defp lifecycle(before, after_row, clock, known, room) do
    if after_row["room_id"] == nil,
      do: surface?(before, after_row),
      else: bottom?(before, after_row, clock, known, room)
  end

  defp surface?(before, after_row) do
    before != nil and before["room_id"] != nil and
      Enum.all?(~w(entered_at deadline job_id), &(after_row[&1] == nil))
  end

  defp bottom?(before, after_row, clock, known, room) do
    (before == nil or before["room_id"] == nil) and after_row["entered_at"] == clock and
      is_integer(after_row["deadline"]) and after_row["deadline"] > clock and
      after_row["job_id"] != nil and
      get_in(known, [after_row["room_id"], "kind"]) == "room" and room == after_row["room_id"]
  end
end
