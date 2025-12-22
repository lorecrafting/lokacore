defmodule Exmud.Engine.WorldExporter do
  @moduledoc """
  Export world state to YAML files.

  ## Usage

      # Export all entities to YAML
      {:ok, path} = WorldExporter.export_all("priv/exports/backup_2024")

      # Export specific types
      {:ok, stats} = WorldExporter.export_rooms("priv/exports/rooms")
      {:ok, stats} = WorldExporter.export_npcs("priv/exports/npcs")

      # Export single entity
      yaml = WorldExporter.entity_to_yaml(entity)

      # Convert entity to prototype map
      proto = WorldExporter.entity_to_prototype(entity)
  """

  require Logger

  alias Exmud.Engine.Entities

  @doc """
  Export all entities to YAML files organized by type.

  Creates directory structure:
  ```
  output_dir/
    rooms/
      room1.yml
      room2.yml
    npcs/
      npc1.yml
    items/
      item1.yml
    exits/
      exit1.yml
  ```

  ## Returns

  `{:ok, stats}` where stats includes counts of exported entities.
  """
  @spec export_all(String.t()) :: {:ok, map()} | {:error, term()}
  def export_all(output_dir) do
    Logger.info("WorldExporter: Exporting all entities to #{output_dir}")

    with :ok <- ensure_directory(output_dir),
         {:ok, room_stats} <- export_by_type(:room, Path.join(output_dir, "rooms")),
         {:ok, npc_stats} <- export_by_type(:npc, Path.join(output_dir, "npcs")),
         {:ok, item_stats} <- export_by_type(:item, Path.join(output_dir, "items")),
         {:ok, exit_stats} <- export_by_type(:exit, Path.join(output_dir, "exits")) do
      stats = %{
        rooms: room_stats.count,
        npcs: npc_stats.count,
        items: item_stats.count,
        exits: exit_stats.count,
        output_dir: output_dir
      }

      Logger.info(
        "WorldExporter: Exported #{stats.rooms + stats.npcs + stats.items + stats.exits} entities"
      )

      {:ok, stats}
    end
  end

  @doc """
  Export all room entities to YAML files.
  """
  @spec export_rooms(String.t()) :: {:ok, map()} | {:error, term()}
  def export_rooms(output_dir), do: export_by_type(:room, output_dir)

  @doc """
  Export all NPC entities to YAML files.
  """
  @spec export_npcs(String.t()) :: {:ok, map()} | {:error, term()}
  def export_npcs(output_dir), do: export_by_type(:npc, output_dir)

  @doc """
  Export all item entities to YAML files.
  """
  @spec export_items(String.t()) :: {:ok, map()} | {:error, term()}
  def export_items(output_dir), do: export_by_type(:item, output_dir)

  @doc """
  Export all exit entities to YAML files.
  """
  @spec export_exits(String.t()) :: {:ok, map()} | {:error, term()}
  def export_exits(output_dir), do: export_by_type(:exit, output_dir)

  defp export_by_type(type, output_dir) do
    with :ok <- ensure_directory(output_dir) do
      entities = Entities.list_by_type(type)

      exported =
        Enum.map(entities, fn entity ->
          filename = "#{sanitize_filename(entity.key)}.yml"
          filepath = Path.join(output_dir, filename)
          yaml = entity_to_yaml(entity)

          case File.write(filepath, yaml) do
            :ok ->
              {:ok, filepath}

            {:error, reason} ->
              Logger.warning("WorldExporter: Failed to write #{filepath}: #{inspect(reason)}")
              {:error, reason}
          end
        end)

      success_count = Enum.count(exported, fn r -> match?({:ok, _}, r) end)
      {:ok, %{count: success_count, output_dir: output_dir}}
    end
  end

  @doc """
  Convert an entity to YAML string.

  ## Returns

  A YAML string representation of the entity in prototype format.
  """
  @spec entity_to_yaml(map()) :: String.t()
  def entity_to_yaml(entity) do
    proto = entity_to_prototype(entity)
    map_to_yaml(proto)
  end

  @doc """
  Convert an entity struct/map to a prototype-compatible map.

  The resulting map can be serialized to YAML and later reloaded.
  Handles both Entity structs and EntitySchema records.
  """
  @spec entity_to_prototype(map()) :: map()
  def entity_to_prototype(entity) do
    base = %{
      "key" => entity.key,
      "type" => to_string(entity.type),
      "name" => entity.name,
      "description" => entity.description
    }

    # Add components if present
    components = get_field(entity, :components, %{})

    base =
      if is_map(components) && map_size(components) > 0 do
        Map.put(base, "components", stringify_keys(components))
      else
        base
      end

    # Add tags if present
    tags = get_field(entity, :tags, [])

    base =
      if is_list(tags) && length(tags) > 0 do
        Map.put(base, "tags", tags)
      else
        base
      end

    # Add attributes from entity (skip if not loaded or empty)
    attrs = get_field(entity, :attributes, %{})

    base =
      if is_map(attrs) && map_size(attrs) > 0 do
        Map.put(base, "attributes", stringify_keys(attrs))
      else
        base
      end

    # Add locks if present
    locks = get_field(entity, :locks, %{})

    base =
      if is_map(locks) && map_size(locks) > 0 do
        Map.put(base, "locks", locks)
      else
        base
      end

    # Add metadata reference to original prototype
    metadata = get_field(entity, :metadata, %{})

    if is_map(metadata) && metadata[:prototype_key] do
      Map.put(base, "# spawned_from", metadata[:prototype_key])
    else
      base
    end
  end

  # Helper to safely get a field, handling Ecto.Association.NotLoaded
  defp get_field(entity, field, default) do
    case Map.get(entity, field, default) do
      %Ecto.Association.NotLoaded{} -> default
      value -> value
    end
  end

  defp stringify_keys(map) when is_map(map) do
    Map.new(map, fn
      {k, v} when is_atom(k) -> {to_string(k), stringify_keys(v)}
      {k, v} -> {k, stringify_keys(v)}
    end)
  end

  defp stringify_keys(list) when is_list(list) do
    Enum.map(list, &stringify_keys/1)
  end

  defp stringify_keys(value), do: value

  # Simple YAML serializer (for basic structures)
  defp map_to_yaml(map, indent \\ 0) do
    prefix = String.duplicate("  ", indent)

    map
    |> Enum.map(fn {key, value} ->
      "#{prefix}#{key}: #{value_to_yaml(value, indent)}"
    end)
    |> Enum.join("\n")
  end

  defp value_to_yaml(value, indent) when is_binary(value) do
    if String.contains?(value, "\n") do
      # Multiline string
      lines =
        value
        |> String.split("\n")
        |> Enum.map(fn line -> "#{String.duplicate("  ", indent + 1)}#{line}" end)
        |> Enum.join("\n")

      "|\n#{lines}"
    else
      if needs_quoting?(value) do
        "\"#{escape_yaml_string(value)}\""
      else
        value
      end
    end
  end

  defp value_to_yaml(value, _indent) when is_number(value), do: to_string(value)
  defp value_to_yaml(true, _indent), do: "true"
  defp value_to_yaml(false, _indent), do: "false"
  defp value_to_yaml(nil, _indent), do: "null"

  defp value_to_yaml(value, indent) when is_list(value) do
    if length(value) == 0 do
      "[]"
    else
      items =
        value
        |> Enum.map(fn item ->
          "#{String.duplicate("  ", indent + 1)}- #{list_item_to_yaml(item, indent + 1)}"
        end)
        |> Enum.join("\n")

      "\n#{items}"
    end
  end

  defp value_to_yaml(value, indent) when is_map(value) do
    if map_size(value) == 0 do
      "{}"
    else
      "\n#{map_to_yaml(value, indent + 1)}"
    end
  end

  defp value_to_yaml(value, _indent) when is_atom(value), do: to_string(value)

  defp list_item_to_yaml(item, _indent) when is_binary(item) do
    if needs_quoting?(item) do
      "\"#{escape_yaml_string(item)}\""
    else
      item
    end
  end

  defp list_item_to_yaml(item, indent) when is_map(item) do
    # Inline map in list
    map_to_yaml(item, indent)
  end

  defp list_item_to_yaml(item, _indent), do: to_string(item)

  defp needs_quoting?(str) do
    String.contains?(str, [
      ": ",
      "#",
      "\"",
      "'",
      "[",
      "]",
      "{",
      "}",
      ",",
      "&",
      "*",
      "!",
      "|",
      ">",
      "%",
      "@",
      "`"
    ]) or
      String.starts_with?(str, [" ", "-"]) or
      String.match?(str, ~r/^\d/)
  end

  defp escape_yaml_string(str) do
    str
    |> String.replace("\\", "\\\\")
    |> String.replace("\"", "\\\"")
  end

  defp sanitize_filename(key) do
    key
    |> String.replace(~r/[^a-zA-Z0-9_-]/, "_")
    |> String.slice(0, 50)
  end

  defp ensure_directory(path) do
    case File.mkdir_p(path) do
      :ok -> :ok
      {:error, reason} -> {:error, {:mkdir_failed, path, reason}}
    end
  end
end
