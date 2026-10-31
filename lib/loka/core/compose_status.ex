defmodule Loka.Core.ComposeStatus do
  @moduledoc "One checked status generation on a body, NPC, item or room (toolbox rows 1, G3, status reader 9); the TypeScript story rule owns its producers."

  def transition(op, row, state, now, overlay) do
    next = op["value"]
    prior = row || %{}

    if holder_kind(op["body_id"], state, overlay) in ~w(body npc item room) and
         row == op["expected"] and shape?(prior, next, now) and generation?(prior, next) and
         (prior["active"] == true or next["active"] == true),
       do: {:ok, next},
       else: {:error, "precondition_failed"}
  end

  # A holder an entity.create earlier in this delta made has the kind it will hydrate as.
  defp holder_kind(id, state, overlay) do
    get_in(state, ["known_entities", id, "kind"]) ||
      case overlay[Loka.Core.ComposeTarget.key(%{"kind" => "entity", "entity_id" => id})] do
        {_, _, identity} -> Loka.Core.Creation.kind(identity)
        nil -> nil
      end
  end

  defp shape?(_, %{"active" => false} = next, _),
    do: Map.keys(next) |> Enum.sort() == ~w(active generation)

  # A permanent row (row W8) is its generation alone and never replaces a timed one.
  defp shape?(prior, next, _) when not is_map_key(next, "job_id"),
    do: Map.keys(next) |> Enum.sort() == ~w(active generation) and prior["job_id"] == nil

  defp shape?(prior, next, now) do
    is_integer(next["next_tick_at"]) and next["next_tick_at"] >= now and
      is_binary(next["job_id"]) and ends?(prior, next, now)
  end

  # A ticking permanent row (loka-rn3b) is new or succeeds a ticking permanent one.
  defp ends?(prior, next, _) when not is_map_key(next, "ends_at"),
    do:
      prior["active"] != true or (not is_map_key(prior, "ends_at") and is_binary(prior["job_id"]))

  # A refresh or successor never shortens the end (and a permanent row never turns timed).
  defp ends?(prior, next, now) do
    is_integer(next["ends_at"]) and next["ends_at"] > now and
      (prior["active"] != true or
         (is_integer(prior["ends_at"]) and next["ends_at"] >= prior["ends_at"]))
  end

  defp generation?(%{"active" => true} = prior, next),
    do: next["generation"] == prior["generation"]

  defp generation?(prior, next),
    do: next["generation"] == (prior["generation"] || 0) + if(next["active"], do: 1, else: 0)

  @doc "A delta's last write may not leave a status or bleed active past its end or a tick (skipped)."
  def expired(overlay, horizon) do
    Enum.find_value(overlay, fn {_, {_, target, value}} ->
      if target["kind"] in ~w(status bleed) and value["active"] == true and
           ((is_integer(value["ends_at"]) and value["ends_at"] <= horizon) or
              (is_integer(value["next_tick_at"]) and value["next_tick_at"] < horizon)),
         do: target
    end)
  end
end
