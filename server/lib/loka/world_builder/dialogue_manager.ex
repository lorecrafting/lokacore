defmodule Loka.WorldBuilder.DialogueManager do
  @moduledoc """
  Dialogue management for World Builder UI.

  Provides create/delete operations for dialogue definitions, following
  the same pattern as QuestManager.

  ## Usage

      DialogueManager.create_dialogue(%{
        "key" => "merchant_greeting",
        "npc_key" => "merchant_bob"
      })

      DialogueManager.delete_dialogue("merchant_greeting")
  """

  require Logger

  alias Loka.Engine.Entity
  alias Loka.Content.Dialogue

  @dialogues_dir Path.join([:code.priv_dir(:loka), "world", "drafts", "dialogues"])

  @doc """
  Create a new dialogue definition with a starter template.

  Accepts a map with:
  - `"key"` or `:key` — dialogue key (required)
  - `"npc_key"` or `:npc_key` — NPC entity key (required)

  Returns `{:ok, dialogue_map}` or `{:error, reason}`
  """
  def create_dialogue(attrs) when is_map(attrs) do
    attrs =
      attrs
      |> ensure_atom_keys()
      |> Map.put(:type, :dialogue)
      |> apply_dialogue_defaults()
      |> build_dialogue_data()

    entity = Entity.new(attrs)

    case Dialogue.validate(entity) do
      :ok ->
        case save_dialogue_yaml(entity) do
          :ok ->
            Logger.info("[DialogueManager] Created dialogue: #{entity.key}")
            {:ok, enrich_for_ui(entity)}

          {:error, reason} ->
            {:error, "Failed to save dialogue: #{inspect(reason)}"}
        end

      {:error, errors} ->
        {:error, Enum.join(errors, ", ")}
    end
  end

  @doc """
  Delete a dialogue by key.

  Returns `:ok` or `{:error, reason}`
  """
  def delete_dialogue(key) when is_binary(key) do
    with :ok <- validate_safe_key(key) do
      file_path = Path.join(@dialogues_dir, "#{key}.yml")

      if File.exists?(file_path) do
        case File.rm(file_path) do
          :ok ->
            Logger.info("[DialogueManager] Deleted dialogue: #{key}")
            :ok

          {:error, reason} ->
            {:error, reason}
        end
      else
        {:error, :not_found}
      end
    end
  end

  # ---------------------------------------------------------------------------
  # Private
  # ---------------------------------------------------------------------------

  defp enrich_for_ui(%Entity{} = dialogue) do
    %{
      key: dialogue.key,
      entity_key: Dialogue.entity_key(dialogue),
      trigger: Dialogue.trigger(dialogue),
      entry_node: Dialogue.entry_node(dialogue),
      node_count: map_size(Dialogue.nodes(dialogue))
    }
  end

  defp apply_dialogue_defaults(attrs) do
    npc_key = attrs[:npc_key] || attrs[:entity_key] || "unknown_npc"

    attrs
    |> Map.put_new(:npc_key, npc_key)
    |> Map.put_new(:short_desc, "Dialogue for #{npc_key}")
  end

  defp build_dialogue_data(attrs) do
    npc_key = attrs[:npc_key] || "unknown_npc"

    data = %{
      "entity_key" => npc_key,
      "trigger" => "on_talk",
      "entry_node" => "greeting",
      "nodes" => %{
        "greeting" => %{
          "text" => "Hello, traveler.",
          "choices" => [
            %{"text" => "Tell me more.", "next" => "more_info"},
            %{"text" => "Goodbye.", "next" => "farewell"}
          ]
        },
        "more_info" => %{
          "text" => "What would you like to know?",
          "choices" => [
            %{"text" => "Goodbye.", "next" => "farewell"}
          ]
        },
        "farewell" => %{
          "text" => "Safe travels."
        }
      }
    }

    attrs
    |> Map.drop([:npc_key, :entity_key])
    |> Map.put(:components, %{"data" => data})
  end

  defp save_dialogue_yaml(dialogue) do
    with :ok <- validate_safe_key(dialogue.key) do
      ensure_dialogues_dir()
      file_path = Path.join(@dialogues_dir, "#{dialogue.key}.yml")
      yaml_content = build_yaml_content(dialogue)

      case File.write(file_path, yaml_content) do
        :ok ->
          :ok

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  defp build_yaml_content(dialogue) do
    data = (dialogue.components || %{})["data"] || %{}
    entity_key = data["entity_key"] || "unknown_npc"
    trigger = data["trigger"] || "on_talk"
    entry_node = data["entry_node"] || "greeting"
    nodes = data["nodes"] || %{}

    nodes_yaml =
      nodes
      |> Enum.sort_by(fn {k, _} -> k end)
      |> Enum.map(fn {node_key, node} -> format_node(node_key, node) end)
      |> Enum.join("\n")

    """
    key: #{dialogue.key}
    type: dialogue
    data:
      entity_key: #{entity_key}
      trigger: #{trigger}
      entry_node: #{entry_node}
      nodes:
    #{nodes_yaml}
    """
  end

  defp format_node(key, node) do
    text = node["text"] || ""
    choices = node["choices"] || []

    choices_yaml =
      if choices == [] do
        ""
      else
        choice_lines =
          Enum.map(choices, fn choice ->
            choice_text = choice["text"] || ""
            next = choice["next"]

            if next do
              "        - text: \"#{escape_yaml(choice_text)}\"\n          next: #{next}"
            else
              "        - text: \"#{escape_yaml(choice_text)}\""
            end
          end)
          |> Enum.join("\n")

        "\n      choices:\n#{choice_lines}"
      end

    "    #{key}:\n      text: \"#{escape_yaml(text)}\"#{choices_yaml}"
  end

  defp escape_yaml(str) when is_binary(str) do
    str
    |> String.replace("\\", "\\\\")
    |> String.replace("\"", "\\\"")
    |> String.replace("\n", "\\n")
  end

  defp escape_yaml(_), do: ""

  defp ensure_dialogues_dir do
    unless File.exists?(@dialogues_dir) do
      File.mkdir_p!(@dialogues_dir)
    end
  end

  defp validate_safe_key(key) when is_binary(key) do
    cond do
      String.contains?(key, "..") ->
        {:error, "Key cannot contain parent directory references"}

      String.contains?(key, "/") or String.contains?(key, "\\") ->
        {:error, "Key cannot contain path separators"}

      not String.match?(key, ~r/^[a-z0-9_-]+$/) ->
        {:error, "Key must contain only lowercase letters, numbers, hyphens, and underscores"}

      String.length(key) > 64 ->
        {:error, "Key must be 64 characters or less"}

      true ->
        :ok
    end
  end

  defp validate_safe_key(_), do: {:error, "Key must be a string"}

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
end
