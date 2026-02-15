defmodule LokaWeb.Channels.BuilderCommands.Publishing do
  @moduledoc """
  Publish and unpublish commands for draft content.

  Moves files between `priv/world/drafts/<type>/` and `priv/world/<type>/`,
  then syncs the entity's draft flag in the database.
  """

  require Logger

  alias Loka.Engine.{Entity, Entities}
  alias Loka.Engine.Constants.WorldPaths

  @world_dir :code.priv_dir(:loka) |> Path.join("world")

  @valid_types ~w(quest dialogue script zone cutscene storyline)
  @entity_types ~w(room npc item)

  @type_to_dir %{
    "quest" => WorldPaths.quests_dir() |> Path.relative_to(WorldPaths.world_dir()),
    "dialogue" => WorldPaths.dialogues_dir() |> Path.relative_to(WorldPaths.world_dir()),
    "script" => WorldPaths.scripts_dir() |> Path.relative_to(WorldPaths.world_dir()),
    "zone" => WorldPaths.zones_dir() |> Path.relative_to(WorldPaths.world_dir()),
    "cutscene" => WorldPaths.cutscenes_dir() |> Path.relative_to(WorldPaths.world_dir()),
    "storyline" => WorldPaths.storylines_dir() |> Path.relative_to(WorldPaths.world_dir())
  }

  @entity_to_subdir %{
    "room" => WorldPaths.rooms_dir() |> Path.relative_to(WorldPaths.world_dir()),
    "npc" => WorldPaths.npcs_dir() |> Path.relative_to(WorldPaths.world_dir()),
    "item" => WorldPaths.items_dir() |> Path.relative_to(WorldPaths.world_dir())
  }

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

  defp do_publish(type, key) when type in @valid_types do
    dir_name = @type_to_dir[type]
    draft_path = Path.join([@world_dir, "drafts", dir_name, "#{key}.yml"])
    published_path = Path.join([@world_dir, dir_name, "#{key}.yml"])

    with {:ok, message} <- move_and_sync(draft_path, published_path, key, "Published") do
      sync_entity_draft_flag(key, false)
      {:ok, message}
    end
  end

  defp do_publish(type, key) when type in @entity_types do
    subdir = @entity_to_subdir[type]
    draft_path = Path.join([@world_dir, "drafts", subdir, "#{key}.yml"])
    published_path = Path.join([@world_dir, subdir, "#{key}.yml"])

    with {:ok, message} <- move_and_sync(draft_path, published_path, key, "Published") do
      sync_entity_draft_flag(key, false)
      {:ok, message}
    end
  end

  defp do_publish("zone_all", zone_key) do
    # Publish a zone and all its associated content (transactional)
    # First look up by key (any type), then verify it's a zone
    case Entities.find_one(key: zone_key) do
      {:ok, %Entity{type: :zone} = zone} ->
        # Publish the zone file first
        case do_publish("zone", zone_key) do
          {:ok, _} ->
            data = zone.components["data"] || %{}
            rooms = Map.get(data, "rooms") || []

            {published_rooms, failed} =
              Enum.reduce_while(rooms, {[], nil}, fn room_key, {acc, _} ->
                case do_publish("room", room_key) do
                  {:ok, _} ->
                    {:cont, {[room_key | acc], nil}}

                  {:error, reason} ->
                    {:halt, {acc, {room_key, reason}}}
                end
              end)

            case failed do
              nil ->
                published_count = length(published_rooms) + 1

                {:ok, "Published zone '#{zone_key}' and #{published_count - 1} associated files."}

              {failed_key, reason} ->
                # Rollback: unpublish all previously published rooms
                Enum.each(published_rooms, fn room_key ->
                  do_unpublish("room", room_key)
                end)

                # Rollback: unpublish the zone itself
                do_unpublish("zone", zone_key)

                Logger.warning(
                  "Rolled back zone_all publish of '#{zone_key}': room '#{failed_key}' failed with #{inspect(reason)}"
                )

                {:error,
                 "Failed to publish room '#{failed_key}': #{reason}. All changes have been rolled back."}
            end

          {:error, reason} ->
            {:error, "Failed to publish zone '#{zone_key}': #{reason}"}
        end

      {:ok, _other} ->
        {:error, "Key '#{zone_key}' is not a zone."}

      {:error, :not_found} ->
        {:error, "Zone '#{zone_key}' not found."}
    end
  end

  defp do_publish(type, _key) do
    {:error,
     "Unknown content type: #{type}. Valid types: #{Enum.join(@valid_types ++ @entity_types, ", ")}"}
  end

  defp do_unpublish(type, key) when type in @valid_types do
    dir_name = @type_to_dir[type]
    published_path = Path.join([@world_dir, dir_name, "#{key}.yml"])
    draft_path = Path.join([@world_dir, "drafts", dir_name, "#{key}.yml"])

    with {:ok, message} <- move_and_sync(published_path, draft_path, key, "Unpublished") do
      sync_entity_draft_flag(key, true)
      {:ok, message}
    end
  end

  defp do_unpublish(type, key) when type in @entity_types do
    subdir = @entity_to_subdir[type]
    published_path = Path.join([@world_dir, subdir, "#{key}.yml"])
    draft_path = Path.join([@world_dir, "drafts", subdir, "#{key}.yml"])

    with {:ok, message} <- move_and_sync(published_path, draft_path, key, "Unpublished") do
      sync_entity_draft_flag(key, true)
      {:ok, message}
    end
  end

  defp do_unpublish(type, _key) do
    {:error,
     "Unknown content type: #{type}. Valid types: #{Enum.join(@valid_types ++ @entity_types, ", ")}"}
  end

  # Sync the draft flag on a spawned entity after publish/unpublish.
  # Best-effort: if no entity exists (e.g. content-only types), this is a no-op.
  defp sync_entity_draft_flag(key, is_draft) do
    try do
      case Entities.get_entity_by_key(key) do
        %{metadata: metadata} = entity ->
          updated_metadata =
            if is_draft,
              do: Map.put(metadata || %{}, "draft", true),
              else: Map.delete(metadata || %{}, "draft")

          Entities.update_entity(entity, %{metadata: updated_metadata})

        nil ->
          :ok
      end
    rescue
      e ->
        Logger.warning("[Publishing] sync_entity_draft_flag failed for '#{key}': #{inspect(e)}")
        :ok
    end
  end

  defp move_and_sync(source, destination, key, action_label) do
    cond do
      not File.exists?(source) ->
        {:error, "Source file not found: #{Path.relative_to_cwd(source)}"}

      File.exists?(destination) ->
        {:error,
         "Destination already exists: #{Path.relative_to_cwd(destination)}. " <>
           "Delete it first or use a different key."}

      true ->
        # Ensure destination directory exists
        File.mkdir_p!(Path.dirname(destination))

        case File.rename(source, destination) do
          :ok ->
            Logger.info(
              "#{action_label} content: #{key} (#{Path.relative_to_cwd(source)} -> #{Path.relative_to_cwd(destination)})"
            )

            {:ok, "#{action_label} '#{key}' successfully."}

          {:error, reason} ->
            {:error, "Failed to move file: #{inspect(reason)}"}
        end
    end
  end
end
