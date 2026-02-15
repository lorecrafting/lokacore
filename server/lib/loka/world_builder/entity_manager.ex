defmodule Loka.WorldBuilder.EntityManager do
  @moduledoc """
  Unified entity management for World Builder UI.

  All operations persist to YAML files in priv/world/prototypes/ following the YAML-only
  architecture documented in docs/proposals/builder-content-layer.md.

  ## Architecture Pattern

  World Builder follows this layered approach:

  1. **Content Modules** (lib/loka/content/*.ex)
     - Domain-specific APIs for game logic
     - Used by BOTH game code AND World Builder UI
     - Examples: Content.Quest, Content.Dialogue, Content.Script

  2. **EntityManager** (this module)
     - Generic CRUD operations for World Builder UI
     - UI enrichment (Entity → frontend maps)
     - Cross-cutting concerns (listing, filtering, search)
     - Saves to YAML files in priv/world/prototypes/

  3. **Specialized Managers** (when needed)
     - RoomManager: exits and coordinate management
     - TemplateManager: template save/load/instantiate
     - Only create when entity has unique UI requirements

  ## Usage

      # Create entities (NPCs, Items, etc.)
      EntityManager.create_entity(:npc, %{name: "Guard", level: 5})
      EntityManager.create_entity(:item, %{name: "Sword", item_type: "weapon"})

      # List entities by subtype
      EntityManager.list_entities(:npc)
      EntityManager.list_entities(:item)

      # Update/delete
      EntityManager.update_entity(entity_id, %{name: "Elite Guard"})
      EntityManager.delete_entity(entity_id)

  ## When to Create a Specialized Manager

  Only create a specialized manager (like RoomManager) when:
  - Entity has complex relationships (e.g., room exits)
  - Entity needs special coordinate/layout handling
  - Entity has unique UI requirements not covered here

  Otherwise, use this EntityManager for all World Builder CRUD.
  """

  require Logger

  alias Loka.Engine.{Entity, Entities}

  @prototypes_dir Path.join([:code.priv_dir(:loka), "world", "drafts", "prototypes"])

  @doc """
  Create a new entity of any subtype.

  ## Parameters
  - subtype: Entity subtype (:npc, :item, :quest, etc.)
  - attrs: Map of entity attributes

  Returns {:ok, entity_map} or {:error, reason}
  """
  def create_entity(subtype, attrs) when is_atom(subtype) and is_map(attrs) do
    attrs = ensure_atom_keys(attrs)
    attrs = apply_subtype_defaults(attrs, subtype)

    key = Map.get(attrs, :key) || generate_unique_key(Map.get(attrs, :name, "entity"))
    name = Map.get(attrs, :name, "New #{subtype}")
    description = Map.get(attrs, :description, "")

    # Build entity data for YAML - merge default components with user-provided
    default_components = build_components(subtype, attrs)
    user_components = Map.get(attrs, :components, %{})
    merged_components = Map.merge(default_components, user_components)

    entity_data = %{
      key: key,
      subtype: subtype,
      name: name,
      description: description,
      tags: Map.get(attrs, :tags, []),
      components: merged_components,
      # Subtype-specific fields
      level: Map.get(attrs, :level),
      item_type: Map.get(attrs, :item_type),
      keywords: [key]
    }

    # Save to YAML file
    case save_entity_yaml(entity_data) do
      :ok ->
        # Try to get the entity from DB
        case Entities.find_one(key: key) do
          {:ok, entity} ->
            Logger.info("[EntityManager] Created #{subtype}: #{key}")
            {:ok, enrich_for_ui(entity)}

          {:error, _} ->
            # Entity created but not yet in DB - build a response
            Logger.info("[EntityManager] Created #{subtype}: #{key} (pending)")

            {:ok,
             %{
               id: key,
               key: key,
               type: subtype,
               subtype: subtype,
               name: name,
               description: description,
               tags: Map.get(attrs, :tags, []),
               components: merged_components,
               level: nil,
               item_type: nil
             }}
        end

      {:error, reason} ->
        Logger.error("[EntityManager] Failed to create #{subtype}: #{inspect(reason)}")
        {:error, "Failed to create #{subtype}: #{inspect(reason)}"}
    end
  end

  @doc """
  Get an entity by ID.

  Returns {:ok, entity_map} or {:error, reason}
  """
  def get_entity(entity_id) when is_binary(entity_id) do
    case Entities.find_one(key: entity_id) do
      {:ok, entity} ->
        {:ok, enrich_for_ui(entity)}

      {:error, :not_found} ->
        {:error, :not_found}
    end
  end

  @doc """
  Update an existing entity.

  Returns {:ok, entity_map} or {:error, reason}
  """
  def update_entity(entity_id, attrs) when is_binary(entity_id) and is_map(attrs) do
    with {:ok, entity} <- Entities.find_one(key: entity_id) do
      attrs = ensure_atom_keys(attrs)

      # Build updated entity data from existing + new attrs
      entity_data = %{
        key: entity.key,
        subtype: entity.type,
        name: Map.get(attrs, :name, entity.short_desc || entity.key),
        description: Map.get(attrs, :description, entity.extra_desc || ""),
        tags: Map.get(attrs, :tags, entity.tags || []),
        components: merge_components(entity, attrs),
        keywords: entity.keywords || [entity.key],
        # Preserve subtype-specific fields
        level: get_level(entity, attrs),
        item_type: get_item_type(entity, attrs)
      }

      case save_entity_yaml(entity_data) do
        :ok ->
          Logger.info("[EntityManager] Updated entity (YAML): #{entity_id}")
          get_entity(entity_id)

        {:error, reason} ->
          Logger.error("[EntityManager] Update failed: #{inspect(reason)}")
          {:error, "Failed to update entity: #{inspect(reason)}"}
      end
    else
      {:error, :not_found} ->
        {:error, :not_found}
    end
  end

  @doc """
  Delete an entity by ID.

  Returns :ok or {:error, reason}
  """
  def delete_entity(entity_id) when is_binary(entity_id) do
    # Get entity to find its type for the correct directory
    case Entities.find_one(key: entity_id) do
      {:ok, entity} ->
        # Delete the YAML file
        case delete_entity_yaml(entity.key, entity.type) do
          :ok ->
            Logger.info("[EntityManager] Deleted entity: #{entity_id}")
            :ok

          {:error, reason} ->
            Logger.error("[EntityManager] Delete failed: #{inspect(reason)}")
            {:error, reason}
        end

      {:error, :not_found} ->
        {:error, :not_found}
    end
  end

  @doc """
  List all entities of a specific subtype.

  Returns list of entity maps.
  """
  def list_entities(subtype) when is_atom(subtype) do
    Entities.find_all(type: subtype, is_prototype: true)
    |> Enum.map(&enrich_for_ui/1)
  end

  @doc """
  Duplicate an entity (NPC or Item) with a new key.

  Returns {:ok, entity_map} or {:error, reason}
  """
  def duplicate_entity(type, key) when type in [:npc, :item] and is_binary(key) do
    Logger.info("[EntityManager] Duplicating #{type}: #{key}")

    with {:ok, entity} <- get_entity(key) do
      new_key = generate_duplicate_key(key)

      attrs = %{
        key: new_key,
        name: "#{entity.name} (copy)",
        description: entity.description,
        level: entity[:level],
        tags: entity.tags,
        components: entity.components
      }

      create_entity(type, attrs)
    end
  end

  defp generate_duplicate_key(original_key) do
    suffix = :crypto.strong_rand_bytes(3) |> Base.encode16() |> String.downcase()
    "#{original_key}_#{suffix}"
  end

  @doc """
  Search entities by name or description.

  Returns list of matching entity maps.
  """
  def search_entities(subtype, query) when is_atom(subtype) and is_binary(query) do
    query_lower = String.downcase(query)

    list_entities(subtype)
    |> Enum.filter(fn entity ->
      name_match = String.contains?(String.downcase(entity.name || ""), query_lower)
      desc_match = String.contains?(String.downcase(entity.description || ""), query_lower)
      name_match || desc_match
    end)
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp enrich_for_ui(%Entity{} = entity) do
    # Convert Entity to UI-friendly map
    components = entity.components || %{}

    # Extract level from components.combatant.level for NPCs
    level = get_in(components, ["combatant", "level"]) || get_in(components, [:combatant, :level])

    # Extract item_type from components.item.item_type for items
    item_type =
      get_in(components, ["item", "item_type"]) || get_in(components, [:item, :item_type])

    %{
      id: entity.id || entity.key,
      key: entity.key,
      type: entity.type,
      subtype: entity.type,
      name: entity.short_desc || entity.key,
      description: entity.extra_desc || "",
      tags: entity.tags || [],
      components: components,
      level: level,
      item_type: item_type
    }
  end

  defp apply_subtype_defaults(attrs, :npc) do
    attrs
    |> Map.put_new(:name, "New NPC")
    |> Map.put_new(:description, "An NPC in the world")
    |> Map.put_new(:level, 1)
  end

  defp apply_subtype_defaults(attrs, :item) do
    attrs
    |> Map.put_new(:name, "New Item")
    |> Map.put_new(:description, "An item")
    |> Map.put_new(:item_type, "misc")
  end

  defp apply_subtype_defaults(attrs, _subtype) do
    attrs
    |> Map.put_new(:name, "New Entity")
    |> Map.put_new(:description, "")
  end

  defp ensure_atom_keys(attrs) when is_map(attrs) do
    Map.new(attrs, fn
      {k, v} when is_binary(k) ->
        try do
          {String.to_existing_atom(k), v}
        rescue
          ArgumentError -> {String.to_atom(k), v}
        end

      {k, v} when is_atom(k) ->
        {k, v}
    end)
  end

  defp generate_unique_key(name) when is_binary(name) do
    slug =
      name
      |> String.downcase()
      |> String.replace(~r/[^a-z0-9]+/, "_")
      |> String.trim("_")

    short_id = UUID.uuid4() |> String.split("-") |> List.first()
    "#{slug}_#{short_id}"
  end

  defp generate_unique_key(_), do: generate_unique_key("entity")

  defp build_components(:npc, attrs) do
    level = Map.get(attrs, :level, 1)

    %{
      "combatant" => %{"level" => level},
      "npc_data" => %{"level" => level}
    }
  end

  defp build_components(:item, attrs) do
    item_type = Map.get(attrs, :item_type, "misc")

    %{
      "item" => %{"item_type" => item_type}
    }
  end

  defp build_components(_subtype, _attrs) do
    %{}
  end

  # =============================================================================
  # YAML Persistence
  # =============================================================================

  defp save_entity_yaml(entity_data) do
    with :ok <- validate_safe_key(entity_data.key) do
      subtype = entity_data.subtype
      dir = get_subtype_dir(subtype)
      ensure_dir(dir)

      file_path = Path.join(dir, "#{entity_data.key}.yml")
      yaml_content = build_entity_yaml(entity_data)

      case File.write(file_path, yaml_content) do
        :ok ->
          :ok

        {:error, reason} ->
          {:error, reason}
      end
    else
      {:error, reason} -> {:error, reason}
    end
  end

  defp delete_entity_yaml(key, subtype) do
    dir = get_subtype_dir(subtype)
    file_path = Path.join(dir, "#{key}.yml")

    case File.rm(file_path) do
      :ok ->
        :ok

      {:error, :enoent} ->
        # File doesn't exist, that's fine
        :ok

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp get_subtype_dir(:npc), do: Path.join(@prototypes_dir, "npcs")
  defp get_subtype_dir(:item), do: Path.join(@prototypes_dir, "items")
  defp get_subtype_dir(subtype), do: Path.join(@prototypes_dir, "#{subtype}s")

  defp build_entity_yaml(entity_data) do
    subtype = entity_data.subtype
    key = entity_data.key
    name = entity_data.name || key
    description = entity_data.description || ""
    tags = entity_data[:tags] || []
    components = entity_data[:components] || %{}
    keywords = entity_data[:keywords] || [key]

    parent = get_parent(subtype)

    # Build YAML content
    yaml = """
    key: #{key}
    type: #{subtype}
    parent: #{parent}
    short_desc: "#{escape_yaml_string(name)}"
    long_desc: "#{escape_yaml_string(description)}"
    extra_desc: |
    #{indent_multiline(description, 2)}
    keywords: #{format_yaml_list(keywords)}
    primary_keyword: #{List.first(keywords) || key}
    """

    # Add subtype-specific fields
    yaml =
      case subtype do
        :npc ->
          yaml <> "mood: neutral\n"

        :item ->
          yaml

        _ ->
          yaml
      end

    # Add tags
    yaml =
      if tags != [] do
        tags_yaml = tags |> Enum.map(&"  - #{&1}") |> Enum.join("\n")
        yaml <> "tags:\n" <> tags_yaml <> "\n"
      else
        yaml <> "tags: []\n"
      end

    # Add components if any
    yaml =
      if map_size(components) > 0 do
        yaml <> "components:\n" <> build_components_yaml(components, 2)
      else
        yaml
      end

    yaml
  end

  defp get_parent(:npc), do: "base_npc"
  defp get_parent(:item), do: "base_item"
  defp get_parent(_), do: "base_entity"

  defp build_components_yaml(components, indent) when is_map(components) do
    prefix = String.duplicate(" ", indent)

    components
    |> Enum.map(fn {key, value} ->
      key_str = if is_atom(key), do: Atom.to_string(key), else: key
      "#{prefix}#{key_str}:\n#{build_yaml_value(value, indent + 2)}"
    end)
    |> Enum.join("")
  end

  defp build_yaml_value(value, indent) when is_map(value) do
    prefix = String.duplicate(" ", indent)

    value
    |> Enum.map(fn {k, v} ->
      key_str = if is_atom(k), do: Atom.to_string(k), else: k

      cond do
        is_map(v) and map_size(v) > 0 ->
          # Recursively handle nested maps
          "#{prefix}#{key_str}:\n#{build_yaml_value(v, indent + 2)}"

        is_list(v) ->
          "#{prefix}#{key_str}:\n#{build_yaml_list_block(v, indent + 2)}"

        true ->
          "#{prefix}#{key_str}: #{format_inline_value(v)}\n"
      end
    end)
    |> Enum.join("")
  end

  defp build_yaml_value(value, indent) when is_list(value) do
    build_yaml_list_block(value, indent)
  end

  defp build_yaml_value(value, indent) do
    prefix = String.duplicate(" ", indent)
    "#{prefix}#{format_inline_value(value)}\n"
  end

  defp build_yaml_list_block(items, indent) when is_list(items) do
    prefix = String.duplicate(" ", indent)

    items
    |> Enum.map(fn item ->
      cond do
        is_map(item) and map_size(item) > 0 ->
          # Handle maps in lists (like dialogue choices)
          # First key-value pair on same line as -, rest indented
          build_yaml_list_map_item(item, indent)

        is_binary(item) ->
          "#{prefix}- \"#{escape_yaml_string(item)}\"\n"

        true ->
          "#{prefix}- #{format_inline_value(item)}\n"
      end
    end)
    |> Enum.join("")
  end

  # Render a map as a YAML list item: - key: value\n  key2: value2
  defp build_yaml_list_map_item(map, indent) do
    prefix = String.duplicate(" ", indent)
    inner_prefix = String.duplicate(" ", indent + 2)

    items = Enum.to_list(map)

    case items do
      [] ->
        "#{prefix}- {}\n"

      [{first_key, first_val} | rest] ->
        first_key_str = if is_atom(first_key), do: Atom.to_string(first_key), else: first_key

        # First key-value pair on same line as -
        first_line =
          cond do
            is_map(first_val) and map_size(first_val) > 0 ->
              "#{prefix}- #{first_key_str}:\n#{build_yaml_value(first_val, indent + 4)}"

            is_list(first_val) ->
              "#{prefix}- #{first_key_str}:\n#{build_yaml_list_block(first_val, indent + 4)}"

            true ->
              "#{prefix}- #{first_key_str}: #{format_inline_value(first_val)}\n"
          end

        # Remaining key-value pairs indented
        rest_lines =
          rest
          |> Enum.map(fn {k, v} ->
            key_str = if is_atom(k), do: Atom.to_string(k), else: k

            cond do
              is_map(v) and map_size(v) > 0 ->
                "#{inner_prefix}#{key_str}:\n#{build_yaml_value(v, indent + 4)}"

              is_list(v) ->
                "#{inner_prefix}#{key_str}:\n#{build_yaml_list_block(v, indent + 4)}"

              true ->
                "#{inner_prefix}#{key_str}: #{format_inline_value(v)}\n"
            end
          end)
          |> Enum.join("")

        first_line <> rest_lines
    end
  end

  defp format_yaml_list([]), do: "[]"

  defp format_yaml_list(items) when is_list(items) do
    inner =
      items
      |> Enum.map(fn item ->
        if is_binary(item), do: item, else: inspect(item)
      end)
      |> Enum.join(", ")

    "[#{inner}]"
  end

  defp format_inline_value(value) when is_binary(value), do: "\"#{escape_yaml_string(value)}\""
  defp format_inline_value(value) when is_integer(value), do: Integer.to_string(value)
  defp format_inline_value(value) when is_float(value), do: Float.to_string(value)
  defp format_inline_value(value) when is_boolean(value), do: Atom.to_string(value)
  defp format_inline_value(value) when is_nil(value), do: "null"
  defp format_inline_value(value) when is_atom(value), do: Atom.to_string(value)
  defp format_inline_value(value), do: inspect(value)

  defp escape_yaml_string(str) when is_binary(str) do
    str
    |> String.replace("\\", "\\\\")
    |> String.replace("\"", "\\\"")
    |> String.replace("\n", "\\n")
  end

  defp escape_yaml_string(_), do: ""

  defp indent_multiline(text, spaces) when is_binary(text) do
    prefix = String.duplicate(" ", spaces)

    text
    |> String.trim()
    |> String.split("\n")
    |> Enum.map(fn line ->
      trimmed = String.trim(line)
      if trimmed == "", do: "", else: "#{prefix}#{trimmed}"
    end)
    |> Enum.join("\n")
    |> String.trim_trailing()
  end

  defp indent_multiline(_, _), do: ""

  defp validate_safe_key(key) when is_binary(key) do
    # Prevent path traversal attacks
    if String.contains?(key, [".", "/", "\\"]) do
      {:error, "Invalid key: contains illegal characters"}
    else
      :ok
    end
  end

  defp validate_safe_key(_), do: {:error, "Invalid key: must be a string"}

  defp ensure_dir(dir) do
    unless File.exists?(dir) do
      File.mkdir_p!(dir)
    end
  end

  # Merge components from existing entity with new attrs
  defp merge_components(entity, attrs) do
    existing = entity.components || %{}

    new_components = Map.get(attrs, :components, %{})
    merged = Map.merge(existing, new_components)

    # If level is provided in attrs, update combatant.level
    if Map.has_key?(attrs, :level) do
      combatant = Map.get(merged, "combatant", %{})
      updated_combatant = Map.put(combatant, "level", attrs.level)
      Map.put(merged, "combatant", updated_combatant)
    else
      merged
    end
  end

  # Extract level from entity or attrs
  defp get_level(entity, attrs) do
    Map.get(attrs, :level) ||
      get_in(entity.components, ["combatant", "level"]) ||
      1
  end

  # Extract item_type from entity or attrs
  defp get_item_type(entity, attrs) do
    Map.get(attrs, :item_type) ||
      get_in(entity.components, ["item", "item_type"]) ||
      "misc"
  end
end
