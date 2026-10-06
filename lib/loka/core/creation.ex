defmodule Loka.Core.Creation do
  @moduledoc "Pinned corpse and population provenance with initial placement guards."
  alias Loka.Core.{Canonical, Contracts}

  def initial_pair?(op, next) when is_map(next),
    do:
      next["op"] == "entity.transfer" and next["entity_id"] == op["identity"]["id"] and
        next["source_id"] == nil and next["writer_group"] == op["writer_group"]

  def initial_pair?(_, _), do: false

  def valid?(identity, state) do
    Contracts.validate("EntityIdentity", identity) == :ok and
      not Map.has_key?(section(state, "known_entities"), identity["id"]) and
      not Map.has_key?(section(state, "containers"), identity["id"]) and
      not Map.has_key?(identity, "scope") and not Map.has_key?(identity, "audience") and
      provenance?(identity, state)
  end

  defp provenance?(identity, state) do
    origin = identity["origin"]
    if origin["kind"] == "spawned", do: spawned?(identity, state), else: death?(identity, state)
  end

  defp spawned?(identity, state) do
    origin = identity["origin"]
    spec = section(state, "population_specs")[key(origin["by"])]

    spec != nil and origin["bundle"] == spec["bundle"] and
      origin["slot"] <= spec["cap"] and identity["definition"] == spec[origin["role"]] and
      if(origin["role"] == "hound",
        do: origin["member_id"] == identity["id"],
        else: origin["member_id"] != identity["id"]
      )
  end

  defp death?(identity, state) do
    origin = identity["origin"]
    victim = get_in(state, ["known_entities", origin["victim_id"]]) || %{}
    template = section(state, "corpse_templates")[key(identity["definition"])]

    owner =
      case template do
        "player" -> victim["kind"] == "body" and origin["owner_id"] == victim["owner_id"]
        "npc" -> victim["kind"] == "npc" and origin["owner_id"] == nil
        _ -> false
      end

    origin["kind"] == "death" and owner
  end

  # ponytail: initial room or paired-pelt placement stays one guard. # credo:disable-for-next-line /ABCSize|CyclomaticComplexity/
  def initial?(op, state, overlay) do
    created = overlay[key(%{"kind" => "entity", "entity_id" => op["entity_id"]})]
    group = op["writer_group"]
    same_group = match?({^group, _, _}, created)
    room = get_in(state, ["known_entities", op["destination_id"], "kind"]) == "room"
    parent = overlay[key(%{"kind" => "entity", "entity_id" => op["destination_id"]})]
    child = elem(created || {nil, nil, nil}, 2)
    parent_identity = elem(parent || {nil, nil, nil}, 2)
    child_origin = get_in(child || %{}, ["origin"]) || %{}
    parent_origin = get_in(parent_identity || %{}, ["origin"]) || %{}

    held =
      child_origin["kind"] == "spawned" and child_origin["role"] == "pelt" and
        parent_origin["kind"] == "spawned" and parent_origin["role"] == "hound" and
        op["destination_id"] == parent_origin["member_id"] and
        Map.take(child_origin, ~w(by bundle slot generation occurrence_id member_id)) ==
          Map.take(parent_origin, ~w(by bundle slot generation occurrence_id member_id))

    home = get_in(state, ["population_specs", key(child_origin["by"] || %{}), "home"])

    same_group and
      ((room and child_origin["role"] != "pelt" and
          (child_origin["kind"] != "spawned" or home == op["destination_id"])) or held)
  end

  # size: allow 55, one final birth-group guard; ponytail: split only for another bundle. # credo:disable-for-next-line /ABCSize|CyclomaticComplexity/
  def complete?(ops, state) do
    made =
      Enum.filter(
        ops,
        &(&1["op"] == "entity.create" and get_in(&1, ["identity", "origin", "kind"]) == "spawned")
      )

    hounds = Enum.filter(made, &(get_in(&1, ["identity", "origin", "role"]) == "hound"))
    pelts = Enum.filter(made, &(get_in(&1, ["identity", "origin", "role"]) == "pelt"))

    length(hounds) == length(pelts) and
      Enum.all?(hounds, fn h ->
        origin = h["identity"]["origin"]
        id = h["identity"]["id"]
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
              h["identity"]["id"] == get_in(op, ["value", "member_id"]) and
              get_in(h, ["identity", "origin", "by"]) == op["plan"] and
              get_in(h, ["identity", "origin", "slot"]) == op["slot"] and
              get_in(h, ["identity", "origin", "generation"]) ==
                get_in(op, ["value", "generation"])
          end) or flight_slot?(op, ops, state)
      end) and
      Enum.all?(pelts, fn p ->
        Enum.any?(
          hounds,
          &(&1["writer_group"] == p["writer_group"] and
              &1["identity"]["id"] == get_in(p, ["identity", "origin", "member_id"]))
        )
      end)
  end

  defp flight_slot?(op, ops, state) do
    id = get_in(op, ["value", "member_id"])
    due = flight_due(ops, op, id, state)

    is_integer(due) and flight_transition?(op, id, due) and flight_origin?(op, id, state) and
      one_flight_transfer?(ops, op, id, state)
  end

  defp flight_due(ops, op, id, state) do
    round =
      Enum.find(ops, fn row ->
        row["op"] in ~w(encounter.advance encounter.close) and
          row["writer_group"] == op["writer_group"] and
          id in (get_in(row, ["expected", "active_ids"]) || []) and
          selected_flight?(row["expected"], id, state) and
          (row["op"] == "encounter.close" or id not in (row["active_ids"] || []))
      end)

    if round, do: get_in(state, ["jobs", round["job_id"], "due_time"])
  end

  defp selected_flight?(row, id, state) do
    present =
      Enum.filter(row["active_ids"] || [], &flight_member_present?(&1, row["room_id"], state))

    cursor = row["next_opponent_id"]

    selected =
      if cursor in present,
        do: cursor,
        else: Enum.find(present, &(&1 > cursor)) || List.first(present)

    selected == id
  end

  defp flight_member_present?(id, room, state) do
    origin = get_in(state, ["created", id, "origin"])

    target = %{
      "kind" => "population_slot",
      "plan" => origin && origin["by"],
      "slot" => origin && origin["slot"]
    }

    slot = get_in(state, ["population_slots", key(target)])

    get_in(state, ["containers", id]) == room and is_map(origin) and is_map(slot) and
      Map.take(origin, ~w(kind role member_id)) ==
        %{"kind" => "spawned", "role" => "hound", "member_id" => id} and
      Map.take(slot, ~w(member_id generation replacement_due)) ==
        %{"member_id" => id, "generation" => origin["generation"], "replacement_due" => nil}
  end

  defp flight_transition?(op, id, horizon),
    do:
      id != nil and get_in(op, ["expected", "member_id"]) == id and
        get_in(op, ["expected", "generation"]) == get_in(op, ["value", "generation"]) and
        get_in(op, ["expected", "replacement_due"]) == nil and
        get_in(op, ["value", "replacement_due"]) == nil and
        get_in(op, ["value", "last_flight_at"]) == horizon and
        get_in(op, ["expected", "last_flight_at"]) != horizon

  defp flight_origin?(op, id, state) do
    origin = get_in(state, ["created", id, "origin"])
    spec = get_in(state, ["population_specs", key(op["plan"])])

    is_map(origin) and origin["kind"] == "spawned" and origin["role"] == "hound" and
      origin["member_id"] == id and origin["by"] == op["plan"] and
      origin["slot"] == op["slot"] and
      origin["generation"] == get_in(op, ["value", "generation"]) and
      is_map(get_in(spec || %{}, ["plan", "pack"]))
  end

  defp one_flight_transfer?(ops, op, id, state),
    do:
      Enum.count(ops, fn row ->
        row["op"] == "entity.transfer" and row["writer_group"] == op["writer_group"] and
          row["entity_id"] == id and row["source_id"] == get_in(state, ["containers", id]) and
          row["destination_id"] != row["source_id"]
      end) == 1

  defp section(state, name), do: Map.get(state, name, %{})

  defp key(value) do
    {:ok, text} = Canonical.encode(value)
    text
  end
end
