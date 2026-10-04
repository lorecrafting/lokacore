defmodule Loka.Core.Creation do
  @moduledoc "Pinned corpse provenance and initial placement guards."
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

  def initial?(op, state, overlay) do
    created = overlay[key(%{"kind" => "entity", "entity_id" => op["entity_id"]})]
    group = op["writer_group"]
    same_group = match?({^group, _, _}, created)
    room = get_in(state, ["known_entities", op["destination_id"], "kind"]) == "room"
    same_group and room
  end

  defp section(state, name), do: Map.get(state, name, %{})

  defp key(value) do
    {:ok, text} = Canonical.encode(value)
    text
  end
end
