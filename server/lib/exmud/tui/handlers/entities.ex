defmodule Exmud.Tui.Handlers.Entities do
  @moduledoc """
  RPC handlers for entity CRUD operations.
  """

  alias Exmud.Engine.{Entities, Spawner}
  alias Exmud.Tui.Server

  @doc """
  Handles entity RPC methods.
  """
  def handle("list", params) do
    type = get_type(params)
    limit = Map.get(params, "limit", 50)
    offset = Map.get(params, "offset", 0)

    entities =
      if type do
        Entities.list_by_type(type)
      else
        Entities.list_entities()
      end

    result =
      entities
      |> Enum.drop(offset)
      |> Enum.take(limit)
      |> Enum.map(&serialize/1)

    {:ok, %{entities: result, total: length(result), offset: offset, limit: limit}}
  end

  def handle("get", %{"id" => id}) do
    case Entities.get_entity(id) do
      nil -> {:error, {:not_found, "Entity not found: #{id}"}}
      entity -> {:ok, serialize(entity)}
    end
  end

  def handle("get", _params) do
    {:error, {:invalid_params, "Missing id parameter"}}
  end

  def handle("update", %{"id" => id} = params) do
    case Entities.get_entity(id) do
      nil ->
        {:error, {:not_found, "Entity not found: #{id}"}}

      entity ->
        attrs = Map.take(params, ["name", "description", "components", "tags"])
        attrs = for {k, v} <- attrs, into: %{}, do: {String.to_existing_atom(k), v}

        case Entities.update_entity(entity, attrs) do
          {:ok, updated} ->
            broadcast_change("updated", updated)
            {:ok, serialize(updated)}

          {:error, changeset} ->
            {:error, {:validation_error, format_errors(changeset)}}
        end
    end
  end

  def handle("update", _params) do
    {:error, {:invalid_params, "Missing id parameter"}}
  end

  def handle("delete", %{"id" => id}) do
    case Entities.get_entity(id) do
      nil ->
        {:error, {:not_found, "Entity not found: #{id}"}}

      entity ->
        case Entities.delete_entity(entity) do
          {:ok, deleted} ->
            broadcast_change("deleted", deleted)
            {:ok, %{deleted: true, id: id}}

          {:error, reason} ->
            {:error, {:delete_failed, inspect(reason)}}
        end
    end
  end

  def handle("delete", _params) do
    {:error, {:invalid_params, "Missing id parameter"}}
  end

  def handle("count", params) do
    type = get_type(params)

    count =
      if type do
        Entities.count_by_type(type)
      else
        Entities.count_all()
      end

    {:ok, %{count: count}}
  end

  def handle("spawn", %{"prototype_key" => prototype_key} = params) do
    location_id = Map.get(params, "location_id")
    name = Map.get(params, "name")

    opts =
      [
        location_id: location_id,
        name: name
      ]
      |> Enum.reject(fn {_, v} -> is_nil(v) end)

    case Spawner.spawn(prototype_key, opts) do
      {:ok, entity} ->
        broadcast_change("created", entity)
        {:ok, serialize(entity)}

      {:error, :not_found} ->
        {:error, {:not_found, "Prototype not found: #{prototype_key}"}}

      {:error, {:save_failed, changeset}} ->
        {:error, {:validation_error, format_errors(changeset)}}

      {:error, reason} ->
        {:error, {:spawn_failed, inspect(reason)}}
    end
  end

  def handle("spawn", _params) do
    {:error, {:invalid_params, "Missing prototype_key parameter"}}
  end

  def handle(action, _params) do
    {:error, {:method_not_found, "Unknown entities action: #{action}"}}
  end

  # Private

  defp get_type(%{"type" => type}) when is_binary(type) do
    try do
      String.to_existing_atom(type)
    rescue
      ArgumentError -> nil
    end
  end

  defp get_type(_), do: nil

  defp serialize(entity) do
    %{
      id: entity.id,
      type: to_string(entity.type),
      key: entity.key,
      name: entity.name,
      description: entity.description,
      location_id: entity.location_id,
      components: entity.components || %{},
      tags: entity.tags || [],
      inserted_at: entity.inserted_at && DateTime.to_iso8601(entity.inserted_at),
      updated_at: entity.updated_at && DateTime.to_iso8601(entity.updated_at)
    }
  end

  defp broadcast_change(action, entity) do
    Server.broadcast(%{
      method: "entity.changed",
      params: %{
        action: action,
        type: to_string(entity.type),
        id: entity.id,
        room_id: entity.location_id
      }
    })
  end

  defp format_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Regex.replace(~r"%{(\w+)}", msg, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
    |> Enum.map(fn {field, errors} -> "#{field}: #{Enum.join(errors, ", ")}" end)
    |> Enum.join("; ")
  end
end
