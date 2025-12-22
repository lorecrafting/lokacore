defmodule Exmud.Tui.Handlers.Prototypes do
  @moduledoc """
  RPC handlers for prototype operations.
  """

  alias Exmud.Engine.PrototypeLoader

  @doc """
  Handles prototype RPC methods.
  """
  def handle("list", params) do
    type = get_type(params)
    limit = Map.get(params, "limit", 50)
    offset = Map.get(params, "offset", 0)

    prototypes =
      if type do
        PrototypeLoader.list_by_type(type)
      else
        PrototypeLoader.all()
      end

    result =
      prototypes
      |> Enum.drop(offset)
      |> Enum.take(limit)
      |> Enum.map(&serialize/1)
      |> Enum.sort_by(& &1.key)

    {:ok, %{prototypes: result, total: length(prototypes), offset: offset, limit: limit}}
  end

  def handle("get", %{"key" => key}) do
    case PrototypeLoader.get(key) do
      {:ok, proto} -> {:ok, serialize(proto)}
      {:error, :not_found} -> {:error, {:not_found, "Prototype not found: #{key}"}}
    end
  end

  def handle("get", _params) do
    {:error, {:invalid_params, "Missing key parameter"}}
  end

  def handle("templates", params) do
    type = get_type(params)
    limit = Map.get(params, "limit", 50)
    offset = Map.get(params, "offset", 0)

    templates =
      if type do
        PrototypeLoader.list_templates_by_type(type)
      else
        PrototypeLoader.list_templates()
      end

    result =
      templates
      |> Enum.drop(offset)
      |> Enum.take(limit)
      |> Enum.map(&serialize/1)
      |> Enum.sort_by(& &1.key)

    {:ok, %{prototypes: result, total: length(templates), offset: offset, limit: limit}}
  end

  def handle("count", params) do
    type = get_type(params)

    count =
      if type do
        PrototypeLoader.list_by_type(type) |> length()
      else
        PrototypeLoader.count()
      end

    {:ok, %{count: count}}
  end

  def handle(action, _params) do
    {:error, {:method_not_found, "Unknown prototypes action: #{action}"}}
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

  defp serialize(proto) do
    %{
      key: proto.key,
      type: to_string(proto.type),
      parent: proto.parent,
      name: proto.name || proto.key,
      description: proto.description || "",
      tags: proto.tags || [],
      is_template: proto.is_template || false
    }
  end
end
