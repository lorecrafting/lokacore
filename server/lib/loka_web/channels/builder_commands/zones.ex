defmodule LokaWeb.Channels.BuilderCommands.Zones do
  @moduledoc """
  Zone CRUD commands: create zone, edit zone, delete zone, zone info.
  """

  alias Loka.Engine.{Entity, Entities}
  alias LokaWeb.Channels.BuilderCommands.Helpers

  def execute(:create_zone, %{key: key, name: name}, socket) do
    case Entities.find_one(key: key, type: :zone) do
      {:ok, _} ->
        {:error, "Zone '#{key}' already exists.", socket}

      {:error, :not_found} ->
        entity =
          Entity.new(
            type: :zone,
            key: key,
            short_desc: name,
            is_prototype: true,
            metadata: %{"draft" => true},
            components: %{
              "data" => %{
                "lifespan_minutes" => 0,
                "reset_mode" => "empty",
                "rooms" => []
              }
            }
          )

        case Entities.save(entity) do
          {:ok, _} ->
            {:ok, "Zone '#{key}' (#{name}) created.", socket}

          {:error, reason} ->
            {:error, "Failed to create zone: #{inspect(reason)}", socket}
        end
    end
  end

  def execute(:edit_zone, %{key: key, field: nil}, socket) do
    case Entities.find_one(key: key, type: :zone) do
      {:ok, zone} ->
        yaml_text = Helpers.format_entity(zone)
        {:ok, "Zone '#{key}'#{Helpers.draft_tag(zone)}:\n#{yaml_text}", socket}

      {:error, :not_found} ->
        {:error, "Zone '#{key}' not found.", socket}
    end
  end

  def execute(:edit_zone, %{key: key, field: field, value: value}, socket) do
    case Entities.find_one(key: key, type: :zone) do
      {:ok, zone} ->
        data = (zone.components || %{})["data"] || %{}
        coerced = Helpers.coerce_value(value)
        updated_data = Map.put(data, field, coerced)
        updated_components = Map.put(zone.components || %{}, "data", updated_data)

        case Entities.update(zone.id, %{components: updated_components}) do
          {:ok, _} ->
            {:ok, "Updated zone '#{key}': #{field} = #{inspect(coerced)}", socket}

          {:error, reason} ->
            {:error, "Failed to update zone: #{inspect(reason)}", socket}
        end

      {:error, :not_found} ->
        {:error, "Zone '#{key}' not found.", socket}
    end
  end

  def execute(:delete_zone, %{key: key}, socket) do
    case Entities.find_one(key: key, type: :zone) do
      {:ok, zone} ->
        case Entities.delete(zone.id) do
          {:ok, _} ->
            {:ok, "Zone '#{key}' deleted.", socket}

          {:error, reason} ->
            {:error, "Failed to delete zone: #{inspect(reason)}", socket}
        end

      {:error, :not_found} ->
        {:error, "Zone '#{key}' not found.", socket}
    end
  end

  def execute(:zone_info, %{key: key}, socket) do
    execute(:edit_zone, %{key: key, field: nil}, socket)
  end
end
