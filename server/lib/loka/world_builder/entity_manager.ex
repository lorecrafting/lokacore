defmodule Loka.WorldBuilder.EntityManager do
  @moduledoc """
  Unified entity management for World Builder UI.

  All operations persist to the entity database (V2 single source of truth).

  ## Usage

      EntityManager.create_entity(:npc, %{name: "Guard", level: 5})
      EntityManager.create_entity(:item, %{name: "Sword", item_type: "weapon"})
      EntityManager.list_entities(:npc)
      EntityManager.update_entity(entity_id, %{name: "Elite Guard"})
      EntityManager.delete_entity(entity_id)
  """

  require Logger

  alias Loka.Engine.{Entity, Entities}

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

    default_components = build_components(subtype, attrs)
    user_components = Map.get(attrs, :components, %{})
    merged_components = Map.merge(default_components, user_components)

    # Check for duplicate keys
    case Entities.find_one(key: key, type: subtype) do
      {:ok, _existing} ->
        {:error, "#{subtype} with key '#{key}' already exists"}

      {:error, _} ->
        entity =
          Entity.new(
            type: subtype,
            key: key,
            short_desc: name,
            extra_desc: description,
            is_prototype: true,
            tags: Map.get(attrs, :tags, []),
            keywords: [key],
            components: merged_components,
            metadata: %{"draft" => true}
          )

        case Entities.save(entity) do
          {:ok, schema} ->
            saved = Entities.to_entity(schema)
            Logger.info("[EntityManager] Created #{subtype}: #{key}")
            {:ok, enrich_for_ui(saved)}

          {:error, reason} ->
            Logger.error("[EntityManager] Failed to create #{subtype}: #{inspect(reason)}")
            {:error, "Failed to create #{subtype}: #{inspect(reason)}"}
        end
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

      db_updates = %{}

      db_updates =
        if Map.has_key?(attrs, :name),
          do: Map.put(db_updates, :short_desc, attrs[:name]),
          else: db_updates

      db_updates =
        if Map.has_key?(attrs, :description),
          do: Map.put(db_updates, :extra_desc, attrs[:description]),
          else: db_updates

      db_updates =
        if Map.has_key?(attrs, :tags),
          do: Map.put(db_updates, :tags, attrs[:tags]),
          else: db_updates

      db_updates =
        if Map.has_key?(attrs, :components) || Map.has_key?(attrs, :level) do
          merged = merge_components(entity, attrs)
          Map.put(db_updates, :components, merged)
        else
          db_updates
        end

      case Entities.get_entity_by_key(entity.key) do
        %{} = schema ->
          case Entities.update_entity(schema, db_updates) do
            {:ok, _} ->
              Logger.info("[EntityManager] Updated entity: #{entity_id}")
              get_entity(entity_id)

            {:error, reason} ->
              Logger.error("[EntityManager] Update failed: #{inspect(reason)}")
              {:error, "Failed to update entity: #{inspect(reason)}"}
          end

        nil ->
          {:error, "Entity not found in DB"}
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
    case Entities.find_one(key: entity_id) do
      {:ok, entity} ->
        case Entities.get_entity_by_key(entity.key) do
          %{} = schema ->
            Entities.delete_entity(schema)
            Logger.info("[EntityManager] Deleted entity: #{entity_id}")
            :ok

          nil ->
            {:error, :not_found}
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
    components = entity.components || %{}

    level = get_in(components, ["combatant", "level"]) || get_in(components, [:combatant, :level])

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
      metadata: entity.metadata || %{},
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
      {k, v} when is_binary(k) -> {String.to_atom(k), v}
      {k, v} when is_atom(k) -> {k, v}
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
end
