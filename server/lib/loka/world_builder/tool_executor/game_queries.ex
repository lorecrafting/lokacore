defmodule Loka.WorldBuilder.ToolExecutor.GameQueries do
  @moduledoc """
  Read-only query tools for inspecting game state from the AI.

  Two access modes:
  - `:builder` (default) — full entity dump including all components, metadata, traits
  - `:player` — redacted view safe for player-facing AI (hides internals)
  """

  alias Loka.Engine.{Entity, Entities}
  alias Loka.Engine.Constants.EntityTypes

  @max_query_results 50

  # Types that exist in EntityTypes — these atoms are always loaded at boot.
  # Used to validate LLM-provided type strings without unbounded atom creation.
  @allowed_types EntityTypes.all()

  # Component keys safe to expose to player-facing AI (allowlist).
  # New components default to hidden — must be explicitly added here after review.
  @player_visible_components ~w(
    inventory equipment quest_progress flags wallet skills data
    exit gathering_node
  )

  # ---------------------------------------------------------------------------
  # Public API
  # ---------------------------------------------------------------------------

  @spec execute_get_entity(map(), keyword()) :: {:ok, map()} | {:error, String.t()}
  def execute_get_entity(input, opts \\ []) do
    key = input["key"]
    mode = opts[:mode] || :builder

    result =
      cond do
        input["type"] ->
          with {:ok, type} <- parse_type(input["type"]) do
            Entities.find_one(key: key, type: type)
          end

        uuid?(key) ->
          Entities.find_one(key)

        true ->
          # Single DB query — find_one(key:) works without type
          Entities.find_one(key: key)
      end

    case result do
      {:ok, entity} ->
        {:ok, %{success: true, entity: serialize_entity(entity, mode)}}

      {:error, :not_found} ->
        {:error, "Entity not found: #{key}"}

      {:error, reason} ->
        {:error, "Failed to get entity: #{inspect(reason)}"}
    end
  end

  @spec execute_query_entities(map(), keyword()) :: {:ok, map()} | {:error, String.t()}
  def execute_query_entities(input, opts \\ []) do
    mode = opts[:mode] || :builder

    with {:ok, type} <- parse_type(input["type"]) do
      limit = min(input["limit"] || @max_query_results, @max_query_results)

      filters = [type: type, limit: limit]

      filters =
        if input["location_id"],
          do: filters ++ [location_id: input["location_id"]],
          else: filters

      entities =
        Entities.find_all(filters)
        |> Enum.map(&serialize_entity_summary(&1, mode))

      {:ok,
       %{
         success: true,
         type: input["type"],
         count: length(entities),
         entities: entities
       }}
    end
  end

  @spec execute_get_player_state(keyword()) :: {:ok, map()} | {:error, String.t()}
  def execute_get_player_state(opts) do
    mode = opts[:mode] || :builder

    case opts[:character] do
      nil ->
        {:error, "No player character in current session"}

      character ->
        {:ok,
         %{
           success: true,
           character: serialize_entity(character, mode)
         }}
    end
  end

  # ---------------------------------------------------------------------------
  # Private helpers
  # ---------------------------------------------------------------------------

  defp parse_type(type_str) when is_binary(type_str) do
    atom = String.to_existing_atom(type_str)

    if atom in @allowed_types do
      {:ok, atom}
    else
      {:error, "Invalid entity type: #{type_str}. Allowed: #{inspect(@allowed_types)}"}
    end
  rescue
    ArgumentError ->
      {:error, "Unknown entity type: #{type_str}. Allowed: #{inspect(@allowed_types)}"}
  end

  defp uuid?(str) do
    case Ecto.UUID.cast(str) do
      {:ok, _} -> true
      :error -> false
    end
  end

  defp serialize_entity(%Entity{} = entity, :builder) do
    %{
      id: entity.id,
      key: entity.key,
      type: entity.type,
      name: entity.short_desc,
      description: entity.long_desc,
      location_id: entity.location_id,
      prototype_key: entity.prototype_key,
      tags: entity.tags,
      components: entity.components,
      traits: entity.traits,
      metadata: entity.metadata
    }
  end

  defp serialize_entity(%Entity{} = entity, :player) do
    safe_components =
      entity.components
      |> Map.take(@player_visible_components)

    %{
      id: entity.id,
      key: entity.key,
      type: entity.type,
      name: entity.short_desc,
      description: entity.long_desc,
      location_id: entity.location_id,
      tags: entity.tags,
      components: safe_components
    }
  end

  defp serialize_entity_summary(%Entity{} = entity, _mode) do
    %{
      id: entity.id,
      key: entity.key,
      type: entity.type,
      name: entity.short_desc,
      location_id: entity.location_id,
      tags: entity.tags
    }
  end
end
