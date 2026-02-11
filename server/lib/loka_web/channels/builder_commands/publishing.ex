defmodule LokaWeb.Channels.BuilderCommands.Publishing do
  @moduledoc """
  Publish and unpublish commands for draft content.

  Moves files between `priv/world/drafts/<type>/` and `priv/world/<type>/`,
  then reloads the TypedObject registry so the draft flag is updated.
  """

  require Logger

  alias Loka.Engine.Entities
  alias Loka.Engine.TypedObject
  alias Loka.Engine.TypedObject.Loader

  @world_dir :code.priv_dir(:loka) |> Path.join("world")

  # Derive publishable types from the single source of truth in TypedObject.
  # These are strings because publishing operates on user-facing commands and file paths.
  @valid_types TypedObject.publishable_content_types() |> Enum.map(&Atom.to_string/1)
  @entity_types TypedObject.publishable_entity_subtypes() |> Enum.map(&Atom.to_string/1)

  # Map content type string to directory name, derived from TypedObject
  @type_to_dir Map.new(TypedObject.publishable_content_types(), fn type ->
                 {Atom.to_string(type), TypedObject.content_dir(type)}
               end)

  # Map entity subtype string to prototype subdirectory, derived from TypedObject
  @entity_to_subdir Map.new(TypedObject.publishable_entity_subtypes(), fn subtype ->
                      {Atom.to_string(subtype), TypedObject.entity_dir(subtype)}
                    end)

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

    move_and_reload(draft_path, published_path, key, "Published")
  end

  defp do_publish(type, key) when type in @entity_types do
    subdir = @entity_to_subdir[type]
    draft_path = Path.join([@world_dir, "drafts", subdir, "#{key}.yml"])
    published_path = Path.join([@world_dir, subdir, "#{key}.yml"])

    with {:ok, message} <- move_and_reload(draft_path, published_path, key, "Published") do
      sync_entity_draft_flag(key, false)
      {:ok, message}
    end
  end

  defp do_publish("zone_all", zone_key) do
    # Publish a zone and all its associated content (transactional)
    case Loader.get(zone_key) do
      {:ok, %TypedObject{type: :zone} = zone} ->
        # Publish the zone file first
        case do_publish("zone", zone_key) do
          {:ok, _} ->
            # Track successfully published files for rollback
            rooms = Map.get(zone.data, "rooms") || Map.get(zone.data, :rooms, [])

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

      {:ok, _} ->
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

    move_and_reload(published_path, draft_path, key, "Unpublished")
  end

  defp do_unpublish(type, key) when type in @entity_types do
    subdir = @entity_to_subdir[type]
    published_path = Path.join([@world_dir, subdir, "#{key}.yml"])
    draft_path = Path.join([@world_dir, "drafts", subdir, "#{key}.yml"])

    with {:ok, message} <- move_and_reload(published_path, draft_path, key, "Unpublished") do
      sync_entity_draft_flag(key, true)
      {:ok, message}
    end
  end

  defp do_unpublish(type, _key) do
    {:error,
     "Unknown content type: #{type}. Valid types: #{Enum.join(@valid_types ++ @entity_types, ", ")}"}
  end

  # Sync the draft flag on a spawned entity after publish/unpublish.
  # The YAML registry is updated by reload_file, but the live DB entity
  # retains its original metadata until explicitly updated.
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

  defp move_and_reload(source, destination, key, action_label) do
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
            # Reload from new path (replaces registry entry with updated draft flag)
            case Loader.reload_file(destination) do
              {:ok, _loaded_key} ->
                Logger.info(
                  "#{action_label} content: #{key} (#{Path.relative_to_cwd(source)} -> #{Path.relative_to_cwd(destination)})"
                )

                {:ok, "#{action_label} '#{key}' successfully."}

              {:error, reason} ->
                # Rollback: move the file back to its original location
                File.rename(destination, source)

                Logger.warning(
                  "Rolled back #{String.downcase(action_label)} of '#{key}': reload failed with #{inspect(reason)}"
                )

                {:error, "Failed to reload after move: #{inspect(reason)}"}
            end

          {:error, reason} ->
            {:error, "Failed to move file: #{inspect(reason)}"}
        end
    end
  end
end
