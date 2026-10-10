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

  # An active row keeps its generation; a refresh or successor never shortens the end.
  defp shape?(prior, next, now) do
    is_integer(next["ends_at"]) and next["ends_at"] > now and
      is_integer(next["next_tick_at"]) and next["next_tick_at"] >= now and
      is_binary(next["job_id"]) and
      (prior["active"] != true or next["ends_at"] >= prior["ends_at"])
  end

  defp generation?(%{"active" => true} = prior, next),
    do: next["generation"] == prior["generation"]

  defp generation?(prior, next),
    do: next["generation"] == (prior["generation"] || 0) + if(next["active"], do: 1, else: 0)
end
