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
      Enum.all?(Enum.with_index(ops), &op_holds?(&1, state, ops, result)) and
      complete?(ops)
  end

  defp op_holds?({op, index}, state, ops, result) do
    case op["op"] do
      "entity.create" ->
        created?(state, op, Enum.at(ops, index + 1), ops, result)

      "entity.transfer" ->
        op["source_id"] != nil or placed?(state, op, Enum.at(ops, index - 1), ops)

      "resource.initialize" ->
        initialized?(state, op, Enum.take(ops, index), ops, result)

      _ ->
        true
    end
  end

  defp placed?(s, op, %{"op" => "entity.create", "identity" => i} = previous, ops),
    do:
      previous["writer_group"] == op["writer_group"] and i["id"] == op["entity_id"] and
        ((get_in(s, ["known_entities", op["destination_id"], "kind"]) == "room" and
            get_in(i, ["origin", "role"]) != "pelt" and
            (get_in(i, ["origin", "kind"]) != "spawned" or
               get_in(s, ["population_specs", Compose.key(get_in(i, ["origin", "by"])), "home"]) ==
                 op["destination_id"])) or
           paired?(created_identity(ops, op["destination_id"]), i))

  defp placed?(_, _, _, _), do: false

  # size: allow 55, independent birth oracle; ponytail: split only for another bundle. # credo:disable-for-next-line /ABCSize|CyclomaticComplexity/
  defp complete?(ops) do
    spawned =
      Enum.filter(
        ops,
        &(&1["op"] == "entity.create" and get_in(&1, ["identity", "origin", "kind"]) == "spawned")
      )

    hounds = Enum.filter(spawned, &(get_in(&1, ["identity", "origin", "role"]) == "hound"))
    pelts = Enum.filter(spawned, &(get_in(&1, ["identity", "origin", "role"]) == "pelt"))

    length(hounds) == length(pelts) and
      Enum.all?(hounds, fn h ->
        id = get_in(h, ["identity", "id"])
        origin = get_in(h, ["identity", "origin"])
        group = h["writer_group"]

        Enum.count(
          pelts,
          &(&1["writer_group"] == group and get_in(&1, ["identity", "origin", "member_id"]) == id)
        ) == 1 and
          Enum.count(
            ops,
            &(&1["op"] == "resource.initialize" and &1["writer_group"] == group and
                &1["entity_id"] == id)
          ) == 1 and
          Enum.count(ops, fn op ->
            op["op"] == "population.slot" and op["writer_group"] == group and
              op["plan"] == origin["by"] and op["slot"] == origin["slot"] and
              get_in(op, ["value", "generation"]) == origin["generation"] and
              get_in(op, ["value", "member_id"]) == id and
              get_in(op, ["value", "replacement_due"]) == nil
          end) == 1
      end) and
      Enum.all?(ops, fn op ->
        op["op"] != "population.slot" or get_in(op, ["value", "member_id"]) == nil or
          get_in(op, ["value", "replacement_due"]) != nil or
          Enum.any?(hounds, fn h ->
            h["writer_group"] == op["writer_group"] and
              get_in(h, ["identity", "id"]) == get_in(op, ["value", "member_id"]) and
              get_in(h, ["identity", "origin", "by"]) == op["plan"] and
              get_in(h, ["identity", "origin", "slot"]) == op["slot"] and
              get_in(h, ["identity", "origin", "generation"]) ==
                get_in(op, ["value", "generation"])
          end)
      end) and
      Enum.all?(pelts, fn p ->
        Enum.any?(
          hounds,
          &(&1["writer_group"] == p["writer_group"] and
              get_in(&1, ["identity", "id"]) == get_in(p, ["identity", "origin", "member_id"]))
        )
      end)
  end

  defp created_identity(ops, id) do
    Enum.find_value(ops, fn
      %{"op" => "entity.create", "identity" => %{"id" => ^id} = identity} -> identity
      _ -> nil
    end)
  end

  defp paired?(%{"origin" => parent} = p, %{"origin" => child}) do
    parent["kind"] == "spawned" and parent["role"] == "hound" and
      child["kind"] == "spawned" and child["role"] == "pelt" and
      p["id"] == child["member_id"] and
      Map.take(parent, ~w(by bundle slot generation occurrence_id member_id)) ==
        Map.take(child, ~w(by bundle slot generation occurrence_id member_id))
  end

  defp paired?(_, _), do: false

  # ponytail: keep one independent birth-resource oracle visible; split if another resource joins. # credo:disable-for-next-line /ABCSize|CyclomaticComplexity/
  defp initialized?(s, op, prior, ops, result) do
    create =
      Enum.find(prior, fn
        %{"op" => "entity.create", "identity" => %{"id" => id}} -> id == op["entity_id"]
        _ -> false
      end)

    origin = get_in(create || %{}, ["identity", "origin"]) || %{}
    spec = get_in(s, ["population_specs", Compose.key(origin["by"])])
    resource = Map.merge(origin["by"] || %{}, %{"kind" => "resource", "key" => "hp"})
    target = %{"kind" => "resource", "resource" => op["resource"], "entity_id" => op["entity_id"]}

    horizon =
      Enum.reduce(ops, s["clock"], fn x, at ->
        if x["op"] == "time.advance", do: max(at, x["to"]), else: at
      end)

    create != nil and create["writer_group"] == op["writer_group"] and
      origin["kind"] == "spawned" and origin["role"] == "hound" and
      origin["member_id"] == op["entity_id"] and spec != nil and
      op["resource"] == resource and op["value"] == spec["hp"]["start"] and
      op["at"] >= s["clock"] and op["at"] <= horizon and
      get_in(s, ["resources", Compose.key(target)]) == nil and
      Enum.any?(result["changes"], fn row ->
        row["target"] == target and row["value"] == %{"value" => op["value"], "at" => op["at"]}
      end)
  end

  defp created?(s, op, next, ops, result) do
    i = op["identity"]

    Contracts.validate("EntityIdentity", i) == :ok and
      not Map.has_key?(i, "scope") and not Map.has_key?(i, "audience") and
      Enum.all?(~w(created known_entities containers), &(get_in(s, [&1, i["id"]]) == nil)) and
      match?(%{"op" => "entity.transfer", "source_id" => nil}, next) and
      placed?(s, next, op, ops) and provenance?(s, i) and rows_match?(result, i)
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

    if origin["kind"] == "spawned" do
      spec = get_in(s, ["population_specs", Compose.key(origin["by"])])

      spec != nil and origin["bundle"] == spec["bundle"] and
        origin["slot"] <= spec["cap"] and i["definition"] == spec[origin["role"]] and
        if(origin["role"] == "hound",
          do: origin["member_id"] == i["id"],
          else: origin["member_id"] != i["id"]
        )
    else
      death_provenance?(s, i, origin)
    end
  end

  defp death_provenance?(s, i, origin) do
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
