defmodule LokaWeb.Channels.BuilderCommands.Publishing do
  @moduledoc """
  Publish and unpublish commands for draft content.

  In V2, publishing simply removes the "draft" metadata flag from the entity.
  Unpublishing adds it back. No filesystem operations needed.
  """

  require Logger

  alias Loka.Engine.{Entity, Entities}

  @valid_types ~w(quest dialogue script zone cutscene storyline)
  @entity_types ~w(room npc item)
  @all_types @valid_types ++ @entity_types

  def execute(:publish, %{type: type, key: key, force: true}, socket) do
    case do_publish(type, key) do
      {:ok, message} -> {:ok, message, socket}
      {:error, reason} -> {:error, reason, socket}
    end
  end

  def execute(:publish, %{type: type, key: key}, socket) do
    {:ok,
     "Publish #{type} '#{key}'? Run again with --force to confirm:\n  publish --force #{type} #{key}",
     socket}
  end

  def execute(:unpublish, %{type: type, key: key}, socket) do
    case do_unpublish(type, key) do
      {:ok, message} -> {:ok, message, socket}
      {:error, reason} -> {:error, reason, socket}
    end
  end

  defp do_publish(type, key) when type in @all_types do
    case Entities.find_one(key: key) do
      {:ok, entity} ->
        case set_draft_flag(entity, false) do
          {:ok, _} ->
            Logger.info("Published content: #{key} (type: #{type})")
            {:ok, "Published '#{key}' successfully."}

          {:error, reason} ->
            {:error, "Failed to publish '#{key}': #{inspect(reason)}"}
        end

      {:error, :not_found} ->
        {:error, "#{String.capitalize(type)} '#{key}' not found."}
    end
  end

  defp do_publish("zone_all", zone_key) do
    case Entities.find_one(key: zone_key) do
      {:ok, %Entity{type: :zone} = zone} ->
        # Publish the zone first
        set_draft_flag(zone, false)

        data = zone.components["data"] || %{}
        rooms = Map.get(data, "rooms") || []

        {published_rooms, failed} =
          Enum.reduce_while(rooms, {[], nil}, fn room_key, {acc, _} ->
            case Entities.find_one(key: room_key) do
              {:ok, room_entity} ->
                set_draft_flag(room_entity, false)
                {:cont, {[room_key | acc], nil}}

              {:error, :not_found} ->
                {:halt, {acc, {room_key, "not found"}}}
            end
          end)

        case failed do
          nil ->
            published_count = length(published_rooms) + 1
            Logger.info("Published zone '#{zone_key}' and #{published_count - 1} rooms")
            {:ok, "Published zone '#{zone_key}' and #{published_count - 1} associated rooms."}

          {failed_key, reason} ->
            # Rollback: re-draft all previously published rooms
            Enum.each(published_rooms, fn room_key ->
              case Entities.find_one(key: room_key) do
                {:ok, entity} -> set_draft_flag(entity, true)
                _ -> :ok
              end
            end)

            # Rollback: re-draft the zone itself
            set_draft_flag(zone, true)

            Logger.warning(
              "Rolled back zone_all publish of '#{zone_key}': room '#{failed_key}' #{reason}"
            )

            {:error,
             "Failed to publish room '#{failed_key}': #{reason}. All changes have been rolled back."}
        end

      {:ok, _other} ->
        {:error, "Key '#{zone_key}' is not a zone."}

      {:error, :not_found} ->
        {:error, "Zone '#{zone_key}' not found."}
    end
  end

  defp do_publish(type, _key) do
    {:error, "Unknown content type: #{type}. Valid types: #{Enum.join(@all_types, ", ")}"}
  end

  defp do_unpublish(type, key) when type in @all_types do
    case Entities.find_one(key: key) do
      {:ok, entity} ->
        case set_draft_flag(entity, true) do
          {:ok, _} ->
            Logger.info("Unpublished content: #{key} (type: #{type})")
            {:ok, "Unpublished '#{key}' successfully."}

          {:error, reason} ->
            {:error, "Failed to unpublish '#{key}': #{inspect(reason)}"}
        end

      {:error, :not_found} ->
        {:error, "#{String.capitalize(type)} '#{key}' not found."}
    end
  end

  defp do_unpublish(type, _key) do
    {:error, "Unknown content type: #{type}. Valid types: #{Enum.join(@all_types, ", ")}"}
  end

  defp set_draft_flag(%Entity{} = entity, is_draft) do
    metadata = entity.metadata || %{}

    updated_metadata =
      if is_draft,
        do: Map.put(metadata, "draft", true),
        else: Map.delete(metadata, "draft")

    Entities.update_entity(entity.id, %{metadata: updated_metadata})
  end
end
