defmodule Loka.Core.ComposeBleed do
  @moduledoc "One checked body bleed generation; the TypeScript story rule owns its producers."

  def transition(op, row, state, now) do
    next = op["value"]
    prior = row || %{}

    if get_in(state, ["known_entities", op["body_id"], "kind"]) == "body" and
         row == op["expected"] and shape?(next, state, now) and generation?(prior, next) and
         (prior["active"] == true or next["active"] == true),
       do: {:ok, next},
       else: {:error, "precondition_failed"}
  end

  defp shape?(%{"active" => false} = next, _, _),
    do: Map.keys(next) |> Enum.sort() == ~w(active generation)

  defp shape?(next, state, now) do
    is_integer(next["ends_at"]) and next["ends_at"] > now and
      is_integer(next["next_tick_at"]) and next["next_tick_at"] >= now and
      next["next_tick_at"] <= next["ends_at"] and
      is_binary(next["job_id"]) and is_map(next["effect"]) and
      get_in(state, ["known_entities", next["source_id"], "kind"]) == "npc" and
      get_in(state, ["created", next["source_id"], "origin", "role"]) == "hound"
  end

  defp generation?(%{"active" => true} = prior, next),
    do: next["generation"] == prior["generation"]

  defp generation?(prior, next),
    do: next["generation"] == (prior["generation"] || 0) + if(next["active"], do: 1, else: 0)
end
