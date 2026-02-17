defmodule LokaWeb.Channels.BuilderCommands.Entities do
  @moduledoc """
  Entity CRUD commands: create npc, create item, edit npc/item, delete npc/item.
  """

  alias Loka.Engine.Entities
  alias Loka.WorldBuilder.EntityManager
  alias Loka.WorldBuilder.Respawner
  alias LokaWeb.Channels.BuilderCommands.Helpers

  def execute(:respawn, %{key: key, type: "zone"}, socket) do
    case Respawner.respawn_zone(key) do
      {:ok, count} ->
        {:ok, "Respawned #{count} entities in zone '#{key}'.", socket}

      {:error, reason} ->
        {:error, reason, socket}
    end
  end

  def execute(:respawn, %{key: key}, socket) do
    case Respawner.respawn_by_prototype(key) do
      {:ok, count} ->
        {:ok, "Respawned #{count} entities for '#{key}'.", socket}

      {:error, reason} ->
        {:error, reason, socket}
    end
  end

  def execute(:create_npc, %{key: key, name: name}, socket) do
    params = %{"key" => key, "name" => name}

    case EntityManager.create_entity(:npc, params) do
      {:ok, _} -> {:ok, "NPC '#{key}' (#{name}) created.", socket}
      {:error, reason} -> {:error, "Failed to create NPC: #{inspect(reason)}", socket}
    end
  end

  def execute(:create_item, %{key: key, name: name}, socket) do
    params = %{"key" => key, "name" => name}

    case EntityManager.create_entity(:item, params) do
      {:ok, _} -> {:ok, "Item '#{key}' (#{name}) created.", socket}
      {:error, reason} -> {:error, "Failed to create item: #{inspect(reason)}", socket}
    end
  end

  def execute(:edit_entity, %{type: type, key: key, field: nil}, socket) do
    subtype = type_to_atom(type)

    case find_by_key(subtype, key) do
      {:ok, entity} ->
        components = Map.get(entity, :components, %{})
        data = Map.get(components, "data", %{})

        lines =
          data
          |> Enum.take(15)
          |> Enum.map(fn {k, v} -> "  #{k}: #{format_value(v)}" end)
          |> Enum.join("\n")

        {:ok, "#{type} '#{key}':\n#{lines}", socket}

      {:error, :not_found} ->
        {:error, "#{type} '#{key}' not found.", socket}
    end
  end

  def execute(:edit_entity, %{type: type, key: key, field: field, value: value}, socket) do
    subtype = type_to_atom(type)

    case find_by_key(subtype, key) do
      {:ok, entity} ->
        coerced = Helpers.coerce_value(value)

        case EntityManager.update_entity(entity.key, %{field => coerced}) do
          {:ok, _} -> {:ok, "Updated #{type} '#{key}': #{field} = #{inspect(coerced)}", socket}
          {:error, reason} -> {:error, "Failed to update: #{inspect(reason)}", socket}
        end

      {:error, :not_found} ->
        {:error, "#{type} '#{key}' not found.", socket}
    end
  end

  def execute(:delete_npc, %{key: key}, socket) do
    case find_by_key(:npc, key) do
      {:ok, entity} ->
        case EntityManager.delete_entity(entity.key) do
          :ok -> {:ok, "NPC '#{key}' deleted.", socket}
          {:error, reason} -> {:error, "Failed to delete NPC: #{inspect(reason)}", socket}
        end

      {:error, :not_found} ->
        {:error, "NPC '#{key}' not found.", socket}
    end
  end

  def execute(:delete_item, %{key: key}, socket) do
    case find_by_key(:item, key) do
      {:ok, entity} ->
        case EntityManager.delete_entity(entity.key) do
          :ok -> {:ok, "Item '#{key}' deleted.", socket}
          {:error, reason} -> {:error, "Failed to delete item: #{inspect(reason)}", socket}
        end

      {:error, :not_found} ->
        {:error, "Item '#{key}' not found.", socket}
    end
  end

  defp find_by_key(subtype, key) do
    case Entities.find_one(key: key, type: subtype) do
      {:ok, entity} -> {:ok, entity}
      {:error, _} -> {:error, :not_found}
    end
  end

  defp type_to_atom("npc"), do: :npc
  defp type_to_atom("item"), do: :item

  defp format_value(v) when is_binary(v), do: String.slice(v, 0, 80)
  defp format_value(v) when is_map(v), do: "{...}"
  defp format_value(v) when is_list(v), do: "[#{length(v)} items]"
  defp format_value(v), do: inspect(v)
end
