defmodule Loka.WorldBuilder.EntityManager do
  @moduledoc """
  Unified entity management for World Builder UI.

  ## Architecture Pattern

  World Builder follows this layered approach:

  1. **Content Modules** (lib/loka/content/*.ex)
     - Domain-specific APIs for game logic
     - Used by BOTH game code AND World Builder UI
     - Examples: Content.Quest, Content.Dialogue, Content.Script

  2. **EntityManager** (this module)
     - Generic CRUD operations for World Builder UI
     - UI enrichment (TypedObject → frontend maps)
     - Cross-cutting concerns (listing, filtering, search)

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

  alias Loka.Engine.{TypedObject, Spawner, EntityServer, Entity, Entities}
  alias Loka.Engine.TypedObject.Registry

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

    # Build entity struct directly (not from prototype)
    entity = %Entity{
      id: UUID.uuid4(),
      type: subtype,
      key: key,
      short_desc: name,
      long_desc: description,
      extra_desc: description,
      keywords: [key],
      location_id: nil,
      contents: [],
      components: build_components(subtype, attrs),
      behaviors: [],
      attributes: %{},
      tags: Map.get(attrs, :tags, []),
      scripts: %{},
      locks: %{},
      metadata: %{
        created_at: DateTime.utc_now(),
        updated_at: DateTime.utc_now(),
        created_by: "world_builder"
      }
    }

    case Entities.save_entity(entity) do
      {:ok, schema} ->
        saved_entity = Entities.to_entity(schema)
        Logger.info("[EntityManager] Created #{subtype}: #{key} (#{saved_entity.id})")
        {:ok, enrich_entity_for_ui(saved_entity)}

      {:error, changeset} ->
        Logger.error("[EntityManager] Failed to create #{subtype}: #{inspect(changeset)}")
        {:error, "Failed to create #{subtype}"}
    end
  end

  @doc """
  Get an entity by ID.

  Returns {:ok, entity_map} or {:error, reason}
  """
  def get_entity(entity_id) when is_binary(entity_id) do
    case Registry.get(entity_id) do
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
    with {:ok, _entity} <- Registry.get(entity_id) do
      updates = ensure_atom_keys(attrs)

      case EntityServer.update(entity_id, updates) do
        {:ok, _} ->
          Logger.info("[EntityManager] Updated entity: #{entity_id}")
          get_entity(entity_id)

        {:error, reason} ->
          Logger.error("[EntityManager] Update failed: #{inspect(reason)}")
          {:error, "Failed to update entity: #{inspect(reason)}"}
      end
    else
      {:error, :not_found} ->
        {:error, :entity_not_found}
    end
  end

  @doc """
  Delete an entity by ID.

  Returns :ok or {:error, reason}
  """
  def delete_entity(entity_id) when is_binary(entity_id) do
    case Spawner.despawn(entity_id) do
      :ok ->
        Logger.info("[EntityManager] Deleted entity: #{entity_id}")
        :ok

      {:error, reason} ->
        Logger.error("[EntityManager] Delete failed: #{inspect(reason)}")
        {:error, reason}
    end
  end

  @doc """
  List all entities of a specific subtype.

  Returns list of entity maps.
  """
  def list_entities(subtype) when is_atom(subtype) do
    Registry.list_by_type(:entity, subtype)
    |> Enum.map(&enrich_for_ui/1)
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

  defp enrich_for_ui(entity) when is_struct(entity, TypedObject) do
    # Convert TypedObject to UI-friendly map
    %{
      id: entity.id,
      key: entity.key,
      type: entity.type,
      subtype: entity.subtype,
      name: entity.name || entity.key,
      description: entity.description || "",
      tags: entity.tags || [],
      attributes: entity.attributes || %{},
      components: entity.components || %{},
      data: entity.data || %{}
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

  # Enrich an Entity struct for the UI
  defp enrich_entity_for_ui(%Entity{} = entity) do
    %{
      id: entity.id,
      key: entity.key,
      type: entity.type,
      subtype: entity.type,
      name: entity.short_desc || entity.key,
      description: entity.extra_desc || "",
      tags: entity.tags || [],
      attributes: entity.attributes || %{},
      components: entity.components || %{},
      data: %{}
    }
  end
end
