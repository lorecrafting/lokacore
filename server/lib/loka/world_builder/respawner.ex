defmodule Loka.WorldBuilder.Respawner do
  @moduledoc """
  Respawns entities from updated prototypes.
  Stops active processes, deletes old DB records, spawns fresh from prototype.
  """

  require Logger

  alias Loka.Engine.{Entities, EntityRegistry, Spawner}
  alias Loka.Content.Zone

  @doc """
  Respawns all entity instances of a given prototype key.
  Returns {:ok, count} or {:error, reason}.
  """
  def respawn_by_prototype(prototype_key) do
    entities = Entities.get_all_by_key(prototype_key)

    if Enum.empty?(entities) do
      {:error, "No spawned instances found for '#{prototype_key}'"}
    else
      results =
        Enum.map(entities, fn entity_schema ->
          room_id = entity_schema.location_id
          entity_id = entity_schema.id

          # Stop active process if running
          stop_entity_process(entity_id)

          # Delete old entity
          Entities.delete_entity(entity_schema)

          # Spawn fresh from updated prototype
          if room_id do
            Spawner.spawn(prototype_key, location_id: room_id)
          else
            Spawner.spawn(prototype_key)
          end
        end)

      success_count = Enum.count(results, &match?({:ok, _}, &1))
      {:ok, success_count}
    end
  end

  @doc """
  Respawns all entities in a zone.
  Returns {:ok, count} or {:error, reason}.
  """
  def respawn_zone(zone_key) do
    case Zone.get(zone_key) do
      {:ok, zone} ->
        room_keys = Zone.rooms(zone)

        if Enum.empty?(room_keys) do
          {:error, "Zone '#{zone_key}' has no rooms"}
        else
          count =
            room_keys
            |> Enum.flat_map(fn room_key ->
              # Get room entity to find its ID
              case Entities.get_entity_by_key(room_key) do
                nil ->
                  []

                room_schema ->
                  Entities.get_contents(room_schema.id)
                  |> Enum.reject(fn e -> e.type == :room end)
              end
            end)
            |> Enum.reduce(0, fn entity_schema, acc ->
              key = entity_schema.key
              room_id = entity_schema.location_id

              stop_entity_process(entity_schema.id)
              Entities.delete_entity(entity_schema)

              case Spawner.spawn(key, location_id: room_id) do
                {:ok, _} -> acc + 1
                _ -> acc
              end
            end)

          {:ok, count}
        end

      {:error, :not_found} ->
        {:error, "Zone '#{zone_key}' not found"}
    end
  end

  defp stop_entity_process(entity_id) do
    case EntityRegistry.lookup(entity_id) do
      {:ok, _pid} -> EntityRegistry.stop(entity_id)
      :not_found -> :ok
    end
  end
end
