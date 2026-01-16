defmodule Loka.WorldBuilder.CutsceneManager do
  @moduledoc """
  Cutscene management for World Builder UI.

  Provides CRUD operations for cutscene definitions, supporting the visual
  timeline editor with keyframes and triggers.

  ## Cutscene Structure

  Cutscenes are stored as YAML files in priv/world/cutscenes/ and contain:
  - id: Cutscene identifier
  - trigger: {type, location} - when cutscene activates
  - sequence: Array of steps (dialogue, narration, effects, etc.)
  - effects: Array of game effects (flags, items, quests, etc.)

  Valid sequence types:
  - dialogue, narration, fade_out, fade_in, pause, choice
  - sound, music, image, animation
  - apply_status, spawn_enemy, trigger_ending

  Valid effect types:
  - set_flag, clear_flag, add_insight, give_item, take_item
  - give_xp, teleport, start_quest, complete_quest
  - heal, damage, add_status, start_combat

  ## Usage

      # Create a new cutscene
      CutsceneManager.create_cutscene(%{
        id: "dragon_awakens",
        trigger: %{type: "enter_room", location: "dragon_lair"},
        sequence: [
          %{type: "narration", text: "The dragon stirs..."},
          %{type: "dialogue", speaker: "dragon", text: "Who dares?"}
        ],
        effects: [
          %{type: "start_quest", quest_key: "dragon_hunt"}
        ]
      })

      # List all cutscenes
      cutscenes = CutsceneManager.list_cutscenes()

      # Get cutscene by ID
      {:ok, cutscene} = CutsceneManager.get_cutscene("dragon_awakens")

      # Update cutscene
      CutsceneManager.update_cutscene("dragon_awakens", %{
        sequence: [%{type: "fade_out", duration: 2.0}]
      })

      # Delete cutscene
      CutsceneManager.delete_cutscene("dragon_awakens")
  """

  require Logger

  alias Loka.Testing.Content.CutsceneValidator

  @cutscenes_dir Path.join([:code.priv_dir(:loka), "world", "cutscenes"])

  @doc """
  Create a new cutscene definition.

  ## Parameters
  - attrs: Map of cutscene attributes

  Returns {:ok, cutscene_map} or {:error, reason}
  """
  def create_cutscene(attrs) when is_map(attrs) do
    attrs =
      attrs
      |> ensure_string_keys()
      |> apply_cutscene_defaults()

    # Validate cutscene structure
    case validate_cutscene(attrs) do
      :ok ->
        case save_cutscene_yaml(attrs) do
          :ok ->
            Logger.info("[CutsceneManager] Created cutscene: #{attrs["id"]}")
            {:ok, attrs}

          {:error, reason} ->
            Logger.error("[CutsceneManager] Failed to save cutscene YAML: #{inspect(reason)}")
            {:error, "Failed to save cutscene: #{inspect(reason)}"}
        end

      {:error, errors} ->
        Logger.warning("[CutsceneManager] Cutscene validation failed: #{inspect(errors)}")
        {:error, Enum.join(errors, ", ")}
    end
  end

  @doc """
  Get a cutscene by ID.

  Returns {:ok, cutscene_map} or {:error, :not_found}
  """
  def get_cutscene(id) when is_binary(id) do
    with :ok <- validate_safe_id(id) do
      file_path = Path.join(@cutscenes_dir, "#{id}.yml")

      if File.exists?(file_path) do
        case YamlElixir.read_from_file(file_path) do
          {:ok, data} ->
            {:ok, data}

          {:error, reason} ->
            Logger.error("[CutsceneManager] Failed to read cutscene: #{inspect(reason)}")
            {:error, :invalid_cutscene}
        end
      else
        {:error, :not_found}
      end
    else
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  List all cutscene definitions.

  Returns list of cutscene maps.
  """
  def list_cutscenes do
    ensure_cutscenes_dir()

    @cutscenes_dir
    |> File.ls!()
    |> Enum.filter(&String.ends_with?(&1, ".yml"))
    |> Enum.map(&load_cutscene_file/1)
    |> Enum.reject(&is_nil/1)
    |> Enum.sort_by(& &1["id"])
  rescue
    _ -> []
  end

  @doc """
  Update an existing cutscene.

  Returns {:ok, cutscene_map} or {:error, reason}
  """
  def update_cutscene(id, attrs) when is_binary(id) and is_map(attrs) do
    with {:ok, existing_cutscene} <- get_cutscene(id) do
      updated_cutscene =
        existing_cutscene
        |> Map.merge(ensure_string_keys(attrs))

      case validate_cutscene(updated_cutscene) do
        :ok ->
          case save_cutscene_yaml(updated_cutscene) do
            :ok ->
              Logger.info("[CutsceneManager] Updated cutscene: #{id}")
              {:ok, updated_cutscene}

            {:error, reason} ->
              {:error, "Failed to save cutscene: #{inspect(reason)}"}
          end

        {:error, errors} ->
          {:error, Enum.join(errors, ", ")}
      end
    end
  end

  @doc """
  Delete a cutscene by ID.

  Returns :ok or {:error, reason}
  """
  def delete_cutscene(id) when is_binary(id) do
    with :ok <- validate_safe_id(id) do
      file_path = Path.join(@cutscenes_dir, "#{id}.yml")

      if File.exists?(file_path) do
        case File.rm(file_path) do
          :ok ->
            Logger.info("[CutsceneManager] Deleted cutscene: #{id}")
            :ok

          {:error, reason} ->
            Logger.error("[CutsceneManager] Failed to delete cutscene file: #{inspect(reason)}")
            {:error, reason}
        end
      else
        {:error, :not_found}
      end
    else
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Search cutscenes by trigger type, location, or content.

  Returns list of matching cutscene maps.
  """
  def search_cutscenes(query) when is_binary(query) do
    query_lower = String.downcase(query)

    list_cutscenes()
    |> Enum.filter(fn cutscene ->
      id_match = String.contains?(String.downcase(cutscene["id"] || ""), query_lower)

      trigger_match =
        case cutscene["trigger"] do
          %{"type" => type, "location" => location} ->
            String.contains?(String.downcase(type), query_lower) ||
              String.contains?(String.downcase(location || ""), query_lower)

          _ ->
            false
        end

      sequence_match =
        (cutscene["sequence"] || [])
        |> Enum.any?(fn step ->
          text = step["text"] || ""
          String.contains?(String.downcase(text), query_lower)
        end)

      id_match || trigger_match || sequence_match
    end)
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp apply_cutscene_defaults(attrs) do
    attrs
    |> Map.put_new("id", generate_cutscene_id())
    |> Map.put_new("trigger", %{})
    |> Map.put_new("sequence", [])
    |> Map.put_new("effects", [])
  end

  defp validate_cutscene(cutscene) do
    # Use CutsceneValidator to validate structure
    errors = []

    # Check required fields
    errors =
      if is_nil(cutscene["id"]) || cutscene["id"] == "" do
        ["cutscene must have an id" | errors]
      else
        errors
      end

    # Check sequence is a list
    errors =
      if not is_list(cutscene["sequence"] || []) do
        ["sequence must be a list" | errors]
      else
        errors
      end

    # Check effects is a list
    errors =
      if not is_list(cutscene["effects"] || []) do
        ["effects must be a list" | errors]
      else
        errors
      end

    if Enum.empty?(errors), do: :ok, else: {:error, errors}
  end

  defp save_cutscene_yaml(cutscene) do
    with :ok <- validate_safe_id(cutscene["id"]) do
      ensure_cutscenes_dir()

      file_path = Path.join(@cutscenes_dir, "#{cutscene["id"]}.yml")

      yaml_content = build_cutscene_yaml(cutscene)

      case File.write(file_path, yaml_content) do
        :ok ->
          :ok

        {:error, reason} ->
          {:error, reason}
      end
    else
      {:error, reason} -> {:error, reason}
    end
  end

  defp build_cutscene_yaml(cutscene) do
    id = cutscene["id"]
    trigger = cutscene["trigger"] || %{}
    sequence = cutscene["sequence"] || []
    effects = cutscene["effects"] || []

    trigger_yaml = format_cutscene_map(trigger)
    sequence_yaml = format_cutscene_list(sequence)
    effects_yaml = format_cutscene_list(effects)

    """
    id: #{id}
    trigger: #{trigger_yaml}
    sequence: #{sequence_yaml}
    effects: #{effects_yaml}
    """
  end

  defp format_cutscene_map(map) when map == %{}, do: "{}"

  defp format_cutscene_map(map) when is_map(map) do
    inner =
      map
      |> Enum.map(fn {k, v} -> "#{k}: #{format_cutscene_value(v)}" end)
      |> Enum.join(", ")

    "{#{inner}}"
  end

  defp format_cutscene_list([]), do: "[]"

  defp format_cutscene_list(items) when is_list(items) do
    formatted =
      items
      |> Enum.map(fn item ->
        if is_map(item) do
          format_cutscene_map(item)
        else
          format_cutscene_value(item)
        end
      end)
      |> Enum.join(", ")

    "[#{formatted}]"
  end

  defp format_cutscene_value(value) when is_binary(value) do
    "\"#{escape_cutscene_string(value)}\""
  end

  defp format_cutscene_value(value) when is_integer(value), do: Integer.to_string(value)
  defp format_cutscene_value(value) when is_float(value), do: Float.to_string(value)
  defp format_cutscene_value(value) when is_boolean(value), do: Atom.to_string(value)
  defp format_cutscene_value(value) when is_nil(value), do: "null"
  defp format_cutscene_value(value) when is_map(value), do: format_cutscene_map(value)
  defp format_cutscene_value(value) when is_list(value), do: format_cutscene_list(value)
  defp format_cutscene_value(value), do: inspect(value)

  defp escape_cutscene_string(str) when is_binary(str) do
    str
    |> String.replace("\\", "\\\\")
    |> String.replace("\"", "\\\"")
    |> String.replace("\n", "\\n")
  end

  defp escape_cutscene_string(_), do: ""

  defp load_cutscene_file(filename) do
    file_path = Path.join(@cutscenes_dir, filename)

    case YamlElixir.read_from_file(file_path) do
      {:ok, data} ->
        cutscene_id = Path.rootname(filename)
        Map.put_new(data, "id", cutscene_id)

      {:error, reason} ->
        Logger.warning(
          "[CutsceneManager] Failed to load cutscene #{filename}: #{inspect(reason)}"
        )

        nil
    end
  end

  defp ensure_cutscenes_dir do
    unless File.exists?(@cutscenes_dir) do
      File.mkdir_p!(@cutscenes_dir)
    end

    @cutscenes_dir
  end

  defp ensure_string_keys(map) when is_map(map) do
    Map.new(map, fn
      {k, v} when is_atom(k) -> {Atom.to_string(k), v}
      {k, v} when is_binary(k) -> {k, v}
    end)
  end

  defp generate_cutscene_id do
    "cutscene_#{System.os_time(:millisecond)}"
  end

  # Validates that an ID is safe for file operations - prevents path traversal attacks
  defp validate_safe_id(id) when is_binary(id) do
    cond do
      String.contains?(id, "..") ->
        {:error, "ID cannot contain parent directory references"}

      String.contains?(id, "/") or String.contains?(id, "\\") ->
        {:error, "ID cannot contain path separators"}

      not String.match?(id, ~r/^[a-z0-9_-]+$/) ->
        {:error, "ID must contain only lowercase letters, numbers, hyphens, and underscores"}

      String.length(id) > 64 ->
        {:error, "ID must be 64 characters or less"}

      true ->
        :ok
    end
  end

  defp validate_safe_id(_), do: {:error, "ID must be a string"}
end
