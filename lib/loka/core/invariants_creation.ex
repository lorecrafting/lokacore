defmodule Loka.Core.InvariantsCreation do
  @moduledoc "Independent durable creation/initial-custody proof (M5-B)."
  alias Loka.Core.{Compose, Contracts}

  def custody?(s, ops, r) do
    created = for %{"op" => "entity.create", "identity" => i} <- ops, do: i["id"]

    moved =
      for %{"target" => %{"kind" => "containment", "entity_id" => e}, "value" => c} <-
            Map.get(r, "changes", []),
          do: {e, c}

    Map.has_key?(r, "fault") or
      (holds?(s, ops, r) and custody_rows?(moved, Map.get(s, "containers", %{}), created))
  end

  defp custody_rows?(moved, containers, created) do
    ids = Enum.map(moved, &elem(&1, 0))

    ids == Enum.uniq(ids) and
      Enum.all?(moved, fn {e, c} ->
        is_binary(c) and (Map.has_key?(containers, e) or e in created)
      end)
  end

  def holds?(state, ops, result) do
    ids = for %{"op" => "entity.create", "identity" => i} <- ops, do: i["id"]

    length(ids) == length(Enum.uniq(ids)) and
      Enum.all?(Enum.with_index(ops), &op_holds?(&1, state, ops, result))
  end

  defp op_holds?({op, index}, state, ops, result) do
    case op["op"] do
      "entity.create" -> created?(state, op, Enum.at(ops, index + 1), result)
      "entity.transfer" -> op["source_id"] != nil or placed?(state, op, Enum.at(ops, index - 1))
      _ -> true
    end
  end

  defp placed?(s, op, %{"op" => "entity.create", "identity" => i} = previous),
    do:
      previous["writer_group"] == op["writer_group"] and i["id"] == op["entity_id"] and
        get_in(s, ["known_entities", op["destination_id"], "kind"]) == "room"

  defp placed?(_, _, _), do: false

  defp created?(s, op, next, result) do
    i = op["identity"]

    Contracts.validate("EntityIdentity", i) == :ok and
      not Map.has_key?(i, "scope") and not Map.has_key?(i, "audience") and
      Enum.all?(~w(created known_entities containers), &(get_in(s, [&1, i["id"]]) == nil)) and
      match?(%{"op" => "entity.transfer", "source_id" => nil}, next) and
      placed?(s, next, op) and provenance?(s, i) and rows_match?(result, i)
  end

  defp rows_match?(result, i) do
    Enum.any?(
      result["changes"],
      &(&1["target"] == %{"kind" => "entity", "entity_id" => i["id"]} and &1["value"] == i)
    ) and
      Enum.any?(
        result["changes"],
        &(&1["target"] == %{"kind" => "containment", "entity_id" => i["id"]})
      )
  end

  defp provenance?(s, i) do
    origin = i["origin"]
    victim = get_in(s, ["known_entities", origin["victim_id"]]) || %{}
    template = get_in(s, ["corpse_templates", Compose.key(i["definition"])])

    owner =
      case template do
        "player" -> victim["kind"] == "body" and origin["owner_id"] == victim["owner_id"]
        "npc" -> victim["kind"] == "npc" and origin["owner_id"] == nil
        _ -> false
      end

    origin["kind"] == "death" and owner
  end
end
