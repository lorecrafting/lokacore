defmodule Loka.Core.ComposeStatus do
  @moduledoc "One checked status generation on a body, NPC or item (toolbox rows 1, G3); the TypeScript story rule owns its producers."

  def transition(op, row, state, now) do
    next = op["value"]
    prior = row || %{}

    if get_in(state, ["known_entities", op["body_id"], "kind"]) in ~w(body npc item) and
         row == op["expected"] and shape?(prior, next, now) and generation?(prior, next) and
         (prior["active"] == true or next["active"] == true),
       do: {:ok, next},
       else: {:error, "precondition_failed"}
  end

  defp shape?(_, %{"active" => false} = next, _),
    do: Map.keys(next) |> Enum.sort() == ~w(active generation)

  # A permanent row (row W8) is its generation alone and never replaces a timed one.
  defp shape?(prior, next, _) when not is_map_key(next, "job_id"),
    do: Map.keys(next) |> Enum.sort() == ~w(active generation) and prior["job_id"] == nil

  # An active row keeps its generation; a refresh or successor never shortens the end (and a
  # permanent row, with no end, never turns timed).
  defp shape?(prior, next, now) do
    is_integer(next["ends_at"]) and next["ends_at"] > now and
      is_integer(next["next_tick_at"]) and next["next_tick_at"] >= now and
      is_binary(next["job_id"]) and
      (prior["active"] != true or
         (is_integer(prior["ends_at"]) and next["ends_at"] >= prior["ends_at"]))
  end

  defp generation?(%{"active" => true} = prior, next),
    do: next["generation"] == prior["generation"]

  defp generation?(prior, next),
    do: next["generation"] == (prior["generation"] || 0) + if(next["active"], do: 1, else: 0)
end
