defmodule Loka.WorldBuilder.TemplateManager do
  @moduledoc """
  Template system for World Builder.

  Manages room templates for rapid prototyping. Templates are stored as YAML files
  in priv/world/templates/ and support TypedObject parent_key inheritance.

  Features:
  - Save room configurations as reusable templates
  - Load built-in and user-created templates
  - Create room instances from templates with field overrides
  - Template inheritance via parent_key
  """

  require Logger

  alias Loka.WorldBuilder.RoomManager
  alias Loka.Engine.TypedObject

  @templates_dir Path.join([:code.priv_dir(:loka), "world", "templates"])

  @doc """
  List all available templates.

  Returns a list of template maps with metadata.
  """
  def list_templates do
    templates_dir = ensure_templates_dir()

    templates_dir
    |> File.ls!()
    |> Enum.filter(&String.ends_with?(&1, ".yml"))
    |> Enum.map(&load_template_file/1)
    |> Enum.reject(&is_nil/1)
    |> Enum.sort_by(& &1.name)
  end

  @doc """
  Get a specific template by key.

  Returns {:ok, template_map} or {:error, :not_found}
  """
  def get_template(template_key) when is_binary(template_key) do
    file_path = Path.join(@templates_dir, "#{template_key}.yml")

    if File.exists?(file_path) do
      case YamlElixir.read_from_file(file_path) do
        {:ok, data} ->
          {:ok, normalize_template(data)}

        {:error, reason} ->
          Logger.error("[TemplateManager] Failed to read template: #{inspect(reason)}")
          {:error, :invalid_template}
      end
    else
      {:error, :not_found}
    end
  end

  @doc """
  Save a room as a template.

  ## Parameters
  - room_id: ID or key of the room to save as template
  - template_key: Key for the new template (filename without .yml)
  - metadata: Optional metadata (name, description, tags)

  Returns {:ok, template_path} or {:error, reason}
  """
  def save_as_template(room_id, template_key, metadata \\ %{}) do
    with {:ok, room} <- RoomManager.get_room(room_id) do
      template_data = build_template_data(room, metadata)
      file_path = Path.join(@templates_dir, "#{template_key}.yml")

      ensure_templates_dir()

      yaml_content = build_yaml_content(template_data)

      case File.write(file_path, yaml_content) do
        :ok ->
          Logger.info("[TemplateManager] Saved template: #{template_key}")
          {:ok, file_path}

        {:error, reason} ->
          Logger.error("[TemplateManager] Failed to save template: #{inspect(reason)}")
          {:error, "Failed to save template: #{inspect(reason)}"}
      end
    end
  end

  @doc """
  Create a room instance from a template.

  ## Parameters
  - template_key: Key of the template to instantiate
  - overrides: Map of fields to override (position, name, etc.)

  Returns {:ok, room_map} or {:error, reason}
  """
  def create_from_template(template_key, overrides \\ %{}) when is_binary(template_key) do
    with {:ok, template} <- get_template(template_key) do
      # Merge template data with overrides
      attrs =
        template
        |> Map.drop([:template_key, :template_name, :preview])
        |> Map.merge(ensure_atom_keys(overrides))
        |> ensure_unique_key()

      # Create the room using RoomManager
      RoomManager.create_room(attrs)
    end
  end

  @doc """
  Search templates by tag.

  Returns list of template maps matching the tag.
  """
  def search_by_tag(tag) when is_binary(tag) do
    list_templates()
    |> Enum.filter(fn template ->
      tags = template[:tags] || []
      Enum.any?(tags, &String.contains?(String.downcase(&1), String.downcase(tag)))
    end)
  end

  @doc """
  Search templates by name or description.

  Returns list of template maps matching the query.
  """
  def search(query) when is_binary(query) do
    query_lower = String.downcase(query)

    list_templates()
    |> Enum.filter(fn template ->
      name_match = String.contains?(String.downcase(template.name), query_lower)
      desc_match = String.contains?(String.downcase(template.description || ""), query_lower)

      tag_match =
        Enum.any?(template.tags || [], &String.contains?(String.downcase(&1), query_lower))

      name_match || desc_match || tag_match
    end)
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp ensure_templates_dir do
    unless File.exists?(@templates_dir) do
      File.mkdir_p!(@templates_dir)
    end

    @templates_dir
  end

  defp load_template_file(filename) do
    file_path = Path.join(@templates_dir, filename)

    case YamlElixir.read_from_file(file_path) do
      {:ok, data} ->
        template_key = Path.rootname(filename)
        normalize_template(Map.put(data, "template_key", template_key))

      {:error, reason} ->
        Logger.warning(
          "[TemplateManager] Failed to load template #{filename}: #{inspect(reason)}"
        )

        nil
    end
  end

  defp normalize_template(data) when is_map(data) do
    %{
      template_key: data["template_key"] || data["key"],
      name: data["name"] || data["template_name"] || "Unnamed Template",
      description: data["description"] || "",
      tags: data["tags"] || [],
      x: data["x"] || 0,
      y: data["y"] || 0,
      z: data["z"] || 0,
      parent_key: data["parent_key"],
      attributes: data["attributes"] || %{},
      preview: generate_preview(data)
    }
  end

  defp build_template_data(room, metadata) do
    %{
      "template_name" => metadata[:name] || room.name,
      "name" => room.name,
      "description" => metadata[:description] || room.description || "",
      "tags" => metadata[:tags] || room.tags || [],
      "x" => 0,
      # Templates stored with relative position (0,0,0)
      "y" => 0,
      "z" => 0,
      "parent_key" => metadata[:parent_key],
      "attributes" => %{}
    }
  end

  defp generate_preview(data) do
    # Simple text preview for now - could be enhanced with mini-3D later
    name = data["name"] || "Unnamed"
    tags = Enum.join(data["tags"] || [], ", ")
    "#{name} [#{tags}]"
  end

  # YAML serialization helpers
  defp build_yaml_content(data) when is_map(data) do
    data
    |> Enum.map(fn {k, v} -> "#{k}: #{format_yaml_value(v)}" end)
    |> Enum.join("\n")
  end

  defp format_yaml_value(value) when is_binary(value), do: ~s("#{escape_yaml_string(value)}")
  defp format_yaml_value(value) when is_integer(value), do: Integer.to_string(value)
  defp format_yaml_value(value) when is_float(value), do: Float.to_string(value)
  defp format_yaml_value(value) when is_boolean(value), do: Atom.to_string(value)
  defp format_yaml_value(nil), do: "null"

  defp format_yaml_value(value) when is_list(value) do
    if Enum.empty?(value) do
      "[]"
    else
      items = Enum.map(value, &format_yaml_value/1)
      "[#{Enum.join(items, ", ")}]"
    end
  end

  defp format_yaml_value(value) when is_map(value) do
    if Enum.empty?(value) do
      "{}"
    else
      items =
        Enum.map(value, fn {k, v} -> "#{k}: #{format_yaml_value(v)}" end)

      "{#{Enum.join(items, ", ")}}"
    end
  end

  defp format_yaml_value(value) when is_atom(value), do: Atom.to_string(value)

  defp escape_yaml_string(str) do
    str
    |> String.replace("\\", "\\\\")
    |> String.replace("\"", "\\\"")
    |> String.replace("\n", "\\n")
  end

  defp ensure_atom_keys(map) when is_map(map) do
    Map.new(map, fn
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

  defp ensure_unique_key(attrs) do
    # If no key provided, generate one based on name
    if Map.has_key?(attrs, :key) do
      attrs
    else
      base_key = slugify(attrs[:name] || "room")
      unique_key = "#{base_key}_#{generate_suffix()}"
      Map.put(attrs, :key, unique_key)
    end
  end

  defp slugify(str) do
    str
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9_]/, "_")
    |> String.replace(~r/_+/, "_")
    |> String.trim("_")
  end

  defp generate_suffix do
    :crypto.hash(:md5, "#{System.os_time(:millisecond)}")
    |> Base.encode16()
    |> String.slice(0..5)
    |> String.downcase()
  end
end
