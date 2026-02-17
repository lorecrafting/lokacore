defmodule Loka.WorldBuilder.DialogueManager do
  @moduledoc """
  Dialogue management for World Builder UI.

  Provides create/delete operations for dialogue definitions.
  All operations persist to the entity database (V2 single source of truth).
  """

  require Logger

  alias Loka.Engine.{Entity, Entities}
  alias Loka.Content.Dialogue

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

    key = attrs[:key]

    with :ok <- validate_key(key) do
      entity = Entity.new(attrs)

      case Dialogue.validate(entity) do
        :ok ->
          case Entities.save(entity) do
            {:ok, schema} ->
              saved = Entities.to_entity(schema)
              Logger.info("[DialogueManager] Created dialogue: #{saved.key}")
              {:ok, enrich_for_ui(saved)}

            {:error, reason} ->
              {:error, "Failed to save dialogue: #{inspect(reason)}"}
          end

        {:error, errors} ->
          {:error, Enum.join(errors, ", ")}
      end
    end
  end

  @doc """
  Delete a dialogue by key.

  Returns `:ok` or `{:error, reason}`
  """
  def delete_dialogue(key) when is_binary(key) do
    case Entities.get_entity_by_key(key) do
      %{type: :dialogue} = schema ->
        case Entities.delete_entity(schema) do
          {:ok, _} ->
            Logger.info("[DialogueManager] Deleted dialogue: #{key}")
            :ok

          {:error, reason} ->
            {:error, reason}
        end

      _ ->
        {:error, :not_found}
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

  defp validate_key(nil), do: {:error, "Key is required"}

  defp validate_key(key) when is_binary(key) do
    cond do
      String.contains?(key, "..") ->
        {:error, "Key must not contain parent directory traversal (..)"}

      not Regex.match?(~r/^[a-z0-9_]+$/, key) ->
        {:error, "Key must contain only lowercase letters, digits, and underscores"}

      true ->
        :ok
    end
  end

  defp ensure_atom_keys(map) when is_map(map) do
    Map.new(map, fn
      {k, v} when is_binary(k) -> {String.to_atom(k), v}
      {k, v} when is_atom(k) -> {k, v}
    end)
  end
end
