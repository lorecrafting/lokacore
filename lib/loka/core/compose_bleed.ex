defmodule Loka.Core.ComposeBleed do
  @moduledoc "One checked body bleed generation; the TypeScript story rule owns its producers."

  def transition(op, row, state, now, overlay) do
    next = op["value"]
    prior = row || %{}

    if get_in(state, ["known_entities", op["body_id"], "kind"]) == "body" and
         row == op["expected"] and shape?(next, state, now) and generation?(prior, next) and
         cadence?(prior, next, overlay) and
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

  defp cadence?(
         %{"active" => true, "effect" => effect, "source_id" => source} = prior,
         %{"active" => true, "effect" => effect, "source_id" => source} = next,
         overlay
       ) do
    old_job = prior["job_id"]
    job = %{"kind" => "job", "job_id" => old_job}

    completed =
      match?({_, _, %{"status" => "completed"}}, overlay[Loka.Core.ComposeTarget.key(job)])

    if completed, do: successor?(prior, next), else: refresh?(prior, next)
  end

  defp cadence?(%{"active" => true}, %{"active" => true}, _), do: false
  defp cadence?(_, _, _), do: true

  defp successor?(prior, next),
    do:
      next["job_id"] != prior["job_id"] and next["next_tick_at"] > prior["next_tick_at"] and
        next["ends_at"] == prior["ends_at"]

  defp refresh?(prior, next),
    do:
      next["job_id"] == prior["job_id"] and next["next_tick_at"] == prior["next_tick_at"] and
        next["ends_at"] >= prior["ends_at"]
end
