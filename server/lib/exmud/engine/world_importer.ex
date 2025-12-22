defmodule Exmud.Engine.WorldImporter do
  @moduledoc """
  Import world state from YAML files.

  Counterpart to WorldExporter - reads exported YAML files and recreates
  entities in the database.

  ## Usage

      # Import from a directory containing rooms/, npcs/, items/, exits/
      {:ok, stats} = WorldImporter.import_all("priv/exports/backup_2024")

      # Import with options
      {:ok, stats} = WorldImporter.import_all("priv/exports/backup_2024",
        clear_existing: true,  # Delete existing entities first
        link_exits: true       # Resolve destination_key to destination_id
      )

      # Import just rooms
      {:ok, count} = WorldImporter.import_type("priv/exports/backup_2024/rooms", :room)
  """

  require Logger

  alias Exmud.Engine.{Entity, Entities}

  @doc """
  Import all entities from YAML files organized by type.

  Expects directory structure:
  ```
  input_dir/
    rooms/
      room1.yml
    npcs/
      npc1.yml
    items/
      item1.yml
    exits/
      exit1.yml
  ```

  ## Options

  - `:clear_existing` - Delete all existing entities before import (default: false)
  - `:link_exits` - Resolve exit destination_key to destination_id (default: true)

  ## Returns

  `{:ok, stats}` where stats includes counts of imported entities.
  """
  @spec import_all(String.t(), keyword()) :: {:ok, map()} | {:error, term()}
  def import_all(input_dir, opts \\ []) do
    Logger.info("WorldImporter: Importing from #{input_dir}")

    clear_existing = Keyword.get(opts, :clear_existing, false)
    link_exits = Keyword.get(opts, :link_exits, true)

    # Optionally clear existing entities
    if clear_existing do
      deleted = Entities.delete_all()
      Logger.info("WorldImporter: Cleared #{deleted} existing entities")
    end

    # Import in order: rooms first (needed for locations), then others
    rooms_dir = Path.join(input_dir, "rooms")
    npcs_dir = Path.join(input_dir, "npcs")
    items_dir = Path.join(input_dir, "items")
    exits_dir = Path.join(input_dir, "exits")

    with {:ok, rooms_count} <- import_type(rooms_dir, :room),
         {:ok, npcs_count} <- import_type(npcs_dir, :npc),
         {:ok, items_count} <- import_type(items_dir, :item),
         {:ok, exits_count} <- import_type(exits_dir, :exit) do
      # Link exits to destination IDs
      linked_count = if link_exits, do: link_all_exits(), else: 0

      stats = %{
        rooms: rooms_count,
        npcs: npcs_count,
        items: items_count,
        exits: exits_count,
        exits_linked: linked_count,
        input_dir: input_dir
      }

      total = rooms_count + npcs_count + items_count + exits_count
      Logger.info("WorldImporter: Imported #{total} entities, linked #{linked_count} exits")

      {:ok, stats}
    end
  end

  @doc """
  Import entities of a specific type from a directory.

  ## Returns

  `{:ok, count}` with number of entities imported.
  """
  @spec import_type(String.t(), atom()) :: {:ok, integer()} | {:error, term()}
  def import_type(dir, type) do
    if File.dir?(dir) do
      files = Path.wildcard(Path.join(dir, "*.yml"))
      Logger.debug("WorldImporter: Found #{length(files)} #{type} files in #{dir}")

      results =
        Enum.map(files, fn file ->
          case import_file(file, type) do
            {:ok, _entity} ->
              :ok

            {:error, reason} ->
              Logger.warning("WorldImporter: Failed to import #{file}: #{inspect(reason)}")
              :error
          end
        end)

      count = Enum.count(results, &(&1 == :ok))
      {:ok, count}
    else
      Logger.debug("WorldImporter: Directory not found: #{dir}")
      {:ok, 0}
    end
  end

  @doc """
  Import a single entity from a YAML file.
  """
  @spec import_file(String.t(), atom()) :: {:ok, Entity.t()} | {:error, term()}
  def import_file(filepath, expected_type) do
    case File.read(filepath) do
      {:ok, content} ->
        case YamlElixir.read_from_string(content) do
          {:ok, data} ->
            create_entity_from_yaml(data, expected_type)

          {:error, reason} ->
            {:error, {:yaml_parse_error, reason}}
        end

      {:error, reason} ->
        {:error, {:file_read_error, reason}}
    end
  end

  @doc """
  Create an entity from parsed YAML data.
  """
  @spec create_entity_from_yaml(map(), atom()) :: {:ok, Entity.t()} | {:error, term()}
  def create_entity_from_yaml(data, expected_type) do
    # Parse type from data or use expected
    type = parse_type(data["type"], expected_type)

    # Build entity from YAML data
    entity = %Entity{
      id: UUID.uuid4(),
      type: type,
      key: data["key"] || generate_key(data["name"]),
      name: data["name"] || "Unnamed",
      description: data["description"] || "",
      location_id: nil,
      contents: [],
      components: atomize_component_keys(data["components"] || %{}),
      behaviors: [],
      attributes: atomize_keys(data["attributes"] || %{}),
      tags: data["tags"] || [],
      scripts: %{},
      locks: data["locks"] || %{},
      metadata: %{
        created_at: DateTime.utc_now(),
        updated_at: DateTime.utc_now(),
        imported_from: data["# spawned_from"] || nil,
        imported_at: DateTime.utc_now()
      }
    }

    case Entities.save_entity(entity) do
      {:ok, schema} ->
        {:ok, Entities.to_entity(schema)}

      {:error, changeset} ->
        {:error, {:save_failed, changeset}}
    end
  end

  # Parse type from string or use default
  defp parse_type(nil, default), do: default

  defp parse_type(type_str, _default) when is_binary(type_str) do
    String.to_existing_atom(type_str)
  rescue
    ArgumentError -> String.to_atom(type_str)
  end

  defp parse_type(type, _default) when is_atom(type), do: type

  # Generate a unique key from name
  defp generate_key(nil), do: "imported_#{short_uuid()}"

  defp generate_key(name) do
    slug =
      name
      |> String.downcase()
      |> String.replace(~r/[^a-z0-9]+/, "_")
      |> String.trim("_")

    "#{slug}_#{short_uuid()}"
  end

  defp short_uuid do
    UUID.uuid4() |> String.split("-") |> List.first()
  end

  # Atomize top-level component keys (like "exit", "combatant")
  defp atomize_component_keys(nil), do: %{}

  defp atomize_component_keys(components) when is_map(components) do
    Map.new(components, fn {k, v} ->
      key = if is_atom(k), do: k, else: k
      {key, v}
    end)
  end

  # Recursively atomize attribute keys
  defp atomize_keys(nil), do: %{}

  defp atomize_keys(map) when is_map(map) do
    Map.new(map, fn {k, v} ->
      key = if is_binary(k), do: String.to_atom(k), else: k
      {key, atomize_keys(v)}
    end)
  end

  defp atomize_keys(list) when is_list(list), do: Enum.map(list, &atomize_keys/1)
  defp atomize_keys(value), do: value

  @doc """
  Link all exits in the database by resolving destination_key to destination_id.
  """
  @spec link_all_exits() :: integer()
  def link_all_exits do
    exits = Entities.list_by_type(:exit)

    Enum.count(exits, fn exit_schema ->
      exit = Entities.to_entity(exit_schema)
      exit_component = Map.get(exit.components, "exit", %{})
      dest_key = Map.get(exit_component, "destination_key")

      if dest_key && is_nil(Map.get(exit_component, "destination_id")) do
        case Entities.get_entity_by_key(dest_key) do
          nil ->
            Logger.debug(
              "WorldImporter: Could not find destination #{dest_key} for exit #{exit.key}"
            )

            false

          dest_schema ->
            link_exit(exit, dest_schema.id)
            true
        end
      else
        false
      end
    end)
  end

  defp link_exit(exit, destination_id) do
    exit_component = Map.get(exit.components, "exit", %{})
    updated_component = Map.put(exit_component, "destination_id", destination_id)
    updated_components = Map.put(exit.components, "exit", updated_component)
    updated_exit = %{exit | components: updated_components}

    case Entities.save_entity(updated_exit) do
      {:ok, _} ->
        Logger.debug("WorldImporter: Linked exit #{exit.key} -> #{destination_id}")
        :ok

      {:error, reason} ->
        Logger.warning("WorldImporter: Failed to link exit #{exit.key}: #{inspect(reason)}")
        :error
    end
  end
end
