defmodule LokaWeb.Channels.BuilderCommands.Zones do
  @moduledoc """
  Zone CRUD commands: create zone, edit zone, delete zone, zone info.
  """

  alias Loka.Content.Zone
  alias Loka.WorldBuilder.YamlBuilder
  alias LokaWeb.Channels.BuilderCommands.Helpers

  @zones_dir Path.join([:code.priv_dir(:loka), "world", "drafts", "zones"])

  def execute(:create_zone, %{key: key, name: name}, socket) do
    case Zone.get(key) do
      {:ok, _} ->
        {:error, "Zone '#{key}' already exists.", socket}

      {:error, :not_found} ->
        yaml_content = YamlBuilder.build_zone_yaml(key, name, resets: [])

        Helpers.ensure_dir(@zones_dir)

        file_path = Path.join(@zones_dir, "#{key}.yml")

        case File.write(file_path, yaml_content) do
          :ok ->
            {:ok, "Zone '#{key}' (#{name}) created.", socket}

          {:error, reason} ->
            {:error, "Failed to create zone: #{inspect(reason)}", socket}
        end
    end
  end

  def execute(:edit_zone, %{key: key, field: nil}, socket) do
    case Zone.get(key) do
      {:ok, zone} ->
        yaml_text = Helpers.format_entity(zone)
        {:ok, "Zone '#{key}'#{Helpers.draft_tag(zone)}:\n#{yaml_text}", socket}

      {:error, :not_found} ->
        {:error, "Zone '#{key}' not found.", socket}
    end
  end

  def execute(:edit_zone, %{key: key, field: field, value: value}, socket) do
    case Zone.get(key) do
      {:ok, zone} ->
        zone_data = (zone.components || %{})["data"] || %{}
        updated_data = Map.put(zone_data, field, value)

        case save_zone_yaml(key, updated_data, zone.short_desc) do
          :ok ->
            {:ok, "Updated zone '#{key}': #{field} = #{value}", socket}

          {:error, reason} ->
            {:error, "Failed to update zone: #{inspect(reason)}", socket}
        end

      {:error, :not_found} ->
        {:error, "Zone '#{key}' not found.", socket}
    end
  end

  def execute(:delete_zone, %{key: key}, socket) do
    file_path = Path.join(@zones_dir, "#{key}.yml")

    if File.exists?(file_path) do
      case File.rm(file_path) do
        :ok ->
          {:ok, "Zone '#{key}' deleted.", socket}

        {:error, reason} ->
          {:error, "Failed to delete zone: #{inspect(reason)}", socket}
      end
    else
      {:error, "Zone '#{key}' not found.", socket}
    end
  end

  def execute(:zone_info, %{key: key}, socket) do
    execute(:edit_zone, %{key: key, field: nil}, socket)
  end

  defp save_zone_yaml(key, data, name) do
    rooms = data["rooms"] || data[:rooms] || []
    lifespan = data["lifespan_minutes"] || data[:lifespan_minutes] || 0
    reset_mode = data["reset_mode"] || data[:reset_mode] || "empty"

    yaml_content =
      YamlBuilder.build_zone_yaml(key, name || key,
        rooms: rooms,
        lifespan_minutes: lifespan,
        reset_mode: reset_mode
      )

    Helpers.ensure_dir(@zones_dir)
    File.write(Path.join(@zones_dir, "#{key}.yml"), yaml_content)
  end
end
