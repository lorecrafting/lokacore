defmodule LokaWeb.Channels.BuilderCommands.Entities do
  @moduledoc """
  Entity CRUD commands: create npc, create item, edit npc/item, delete npc/item.
  """

  alias Loka.WorldBuilder.EntityManager

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
        data = Map.get(entity, :data, %{})

        lines =
          data
          |> Enum.take(15)
          |> Enum.map(fn {k, v} -> "  #{k}: #{format_value(v)}" end)
          |> Enum.join("\n")

        {:ok, "#{type} '#{key}':\n#{lines}", socket}

      :error ->
        {:error, "#{type} '#{key}' not found.", socket}
    end
  end

  def execute(:edit_entity, %{type: type, key: key, field: field, value: value}, socket) do
    subtype = type_to_atom(type)

    case find_by_key(subtype, key) do
      {:ok, entity} ->
        case EntityManager.update_entity(entity.id, %{field => value}) do
          {:ok, _} -> {:ok, "Updated #{type} '#{key}': #{field} = #{value}", socket}
          {:error, reason} -> {:error, "Failed to update: #{inspect(reason)}", socket}
        end

      :error ->
        {:error, "#{type} '#{key}' not found.", socket}
    end
  end

  def execute(:delete_npc, %{key: key}, socket) do
    case find_by_key(:npc, key) do
      {:ok, entity} ->
        case EntityManager.delete_entity(entity.id) do
          :ok -> {:ok, "NPC '#{key}' deleted.", socket}
          {:error, reason} -> {:error, "Failed to delete NPC: #{inspect(reason)}", socket}
        end

      :error ->
        {:error, "NPC '#{key}' not found.", socket}
    end
  end

  def execute(:delete_item, %{key: key}, socket) do
    case find_by_key(:item, key) do
      {:ok, entity} ->
        case EntityManager.delete_entity(entity.id) do
          :ok -> {:ok, "Item '#{key}' deleted.", socket}
          {:error, reason} -> {:error, "Failed to delete item: #{inspect(reason)}", socket}
        end

      :error ->
        {:error, "Item '#{key}' not found.", socket}
    end
  end

  defp find_by_key(subtype, key) do
    entities = EntityManager.list_entities(subtype)

    case Enum.find(entities, fn e -> e.key == key end) do
      nil -> :error
      entity -> {:ok, entity}
    end
  end

  defp type_to_atom("npc"), do: :npc
  defp type_to_atom("item"), do: :item
  defp type_to_atom("room"), do: :room
  defp type_to_atom(_), do: :npc

  defp format_value(v) when is_binary(v), do: String.slice(v, 0, 80)
  defp format_value(v) when is_map(v), do: "{...}"
  defp format_value(v) when is_list(v), do: "[#{length(v)} items]"
  defp format_value(v), do: inspect(v)
end
