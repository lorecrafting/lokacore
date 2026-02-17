defmodule Loka.WorldBuilder.ToolExecutor.Entities do
  @moduledoc false

  alias Loka.WorldBuilder.EntityManager

  def execute_create_npc(input) do
    level = input["level"] || 1

    attrs = %{
      key: input["key"],
      name: input["name"],
      description: input["description"],
      level: level,
      tags: input["tags"] || [],
      parent_key: input["room_key"]
    }

    case EntityManager.create_entity(:npc, attrs) do
      {:ok, npc} ->
        # Level is stored in components, extract it safely
        npc_level = get_in(npc.components, ["npc_data", "level"]) || level

        {:ok,
         %{
           success: true,
           message: "Created NPC '#{npc.name}' (#{npc.key})",
           npc: %{
             key: npc.key,
             name: npc.name,
             description: npc.description,
             level: npc_level
           }
         }}

      {:error, reason} ->
        {:error, "Failed to create NPC: #{inspect(reason)}"}
    end
  end

  def execute_create_item(input) do
    item_type = input["item_type"] || "misc"

    attrs = %{
      key: input["key"],
      name: input["name"],
      description: input["description"],
      item_type: item_type,
      tags: input["tags"] || [],
      parent_key: input["room_key"]
    }

    case EntityManager.create_entity(:item, attrs) do
      {:ok, item} ->
        # Item type is stored in components, extract it safely
        stored_item_type = get_in(item.components, ["item", "item_type"]) || item_type

        {:ok,
         %{
           success: true,
           message: "Created item '#{item.name}' (#{item.key})",
           item: %{
             key: item.key,
             name: item.name,
             description: item.description,
             item_type: stored_item_type
           }
         }}

      {:error, reason} ->
        {:error, "Failed to create item: #{inspect(reason)}"}
    end
  end

  def execute_list_npcs(input) do
    npcs = EntityManager.list_entities(:npc)

    filtered_npcs =
      cond do
        room_key = input["room_key"] ->
          Enum.filter(npcs, fn npc ->
            get_safe_field(npc, :parent_key) == room_key
          end)

        tag = input["tag"] ->
          Enum.filter(npcs, fn npc ->
            tags = get_safe_field(npc, :tags) || []
            tag in tags
          end)

        true ->
          npcs
      end

    npc_list =
      Enum.map(filtered_npcs, fn npc ->
        %{
          key: get_safe_field(npc, :key),
          name: get_safe_field(npc, :name),
          level:
            get_in(npc, [:components, "npc_data", "level"]) || get_safe_field(npc, :level) || 1,
          room_key: get_safe_field(npc, :parent_key)
        }
      end)

    {:ok,
     %{
       success: true,
       message: "Found #{length(npc_list)} NPCs",
       npcs: npc_list
     }}
  end

  def execute_list_items(input) do
    items = EntityManager.list_entities(:item)

    filtered_items =
      cond do
        room_key = input["room_key"] ->
          Enum.filter(items, fn item ->
            get_safe_field(item, :parent_key) == room_key
          end)

        item_type = input["item_type"] ->
          Enum.filter(items, fn item ->
            get_item_type(item) == item_type
          end)

        true ->
          items
      end

    item_list =
      Enum.map(filtered_items, fn item ->
        %{
          key: get_safe_field(item, :key),
          name: get_safe_field(item, :name),
          item_type: get_item_type(item) || "misc",
          room_key: get_safe_field(item, :parent_key)
        }
      end)

    {:ok,
     %{
       success: true,
       message: "Found #{length(item_list)} items",
       items: item_list
     }}
  end

  def execute_update_entity(subtype, input) do
    key = input["key"]

    updates =
      input
      |> Map.drop(["key"])
      |> Enum.reject(fn {_k, v} -> is_nil(v) end)
      |> Map.new()

    entities = EntityManager.list_entities(subtype)

    case Enum.find(entities, fn e -> get_safe_field(e, :key) == key end) do
      nil ->
        {:error, "#{subtype} '#{key}' not found"}

      entity ->
        case EntityManager.update_entity(entity.key, updates) do
          {:ok, updated} ->
            {:ok,
             %{
               success: true,
               message: "Updated #{subtype} '#{key}'",
               entity: %{
                 key: get_safe_field(updated, :key),
                 name: get_safe_field(updated, :name)
               }
             }}

          {:error, reason} ->
            {:error, "Failed to update #{subtype}: #{inspect(reason)}"}
        end
    end
  end

  def execute_delete_entity(subtype, input) do
    key = input["key"]
    entities = EntityManager.list_entities(subtype)

    case Enum.find(entities, fn e -> get_safe_field(e, :key) == key end) do
      nil ->
        {:error, "#{subtype} '#{key}' not found"}

      entity ->
        case EntityManager.delete_entity(entity.key) do
          :ok ->
            {:ok,
             %{
               success: true,
               message: "Deleted #{subtype} '#{key}'"
             }}

          {:error, reason} ->
            {:error, "Failed to delete #{subtype}: #{inspect(reason)}"}
        end
    end
  end

  # Safe field accessor that works with both maps and structs.
  # Also used by ToolExecutor.Zones.
  def get_safe_field(data, key) when is_map(data) do
    Map.get(data, key) || Map.get(data, to_string(key))
  end

  defp get_item_type(item) do
    get_safe_field(item, :item_type) ||
      get_in(item, [:components, "item", "item_type"]) ||
      get_in(item, [:components, :item, :item_type])
  end
end
