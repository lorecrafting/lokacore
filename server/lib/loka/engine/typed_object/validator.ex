defmodule Loka.Engine.TypedObject.Validator do
  @moduledoc """
  Unified validation for all TypedObject types.

  Validates:
  - Schema conformance
  - Parent references exist
  - Cross-references valid (quest targets exist, etc.)
  - Type-specific rules (entity has valid subtype, etc.)

  ## Usage

      # Validate a single TypedObject
      {:ok, typed_object} = Validator.validate(typed_object)

      # Validate all loaded TypedObjects
      :ok = Validator.validate_all()

      # Check specific cross-references
      errors = Validator.validate_references(typed_object)
  """

  alias Loka.Engine.TypedObject
  alias Loka.Engine.TypedObject.Registry

  @doc """
  Validates a TypedObject struct.

  Checks:
  - Required fields present
  - Type is valid
  - Subtype valid for entities
  - Parent key exists (if specified)
  """
  @spec validate(TypedObject.t()) :: {:ok, TypedObject.t()} | {:error, [String.t()]}
  def validate(%TypedObject{} = typed_object) do
    errors =
      []
      |> validate_key(typed_object.key)
      |> validate_type(typed_object.type)
      |> validate_subtype(typed_object)
      |> validate_parent_exists(typed_object)
      |> validate_type_specific(typed_object)

    case errors do
      [] -> {:ok, typed_object}
      errors -> {:error, Enum.reverse(errors)}
    end
  end

  @doc """
  Validates all TypedObjects in the registry.

  Returns `:ok` if all valid, or `{:error, errors}` with list of issues.
  """
  @spec validate_all() :: :ok | {:error, [{String.t(), [String.t()]}]}
  def validate_all do
    errors =
      Registry.all()
      |> Enum.flat_map(fn typed_object ->
        case validate(typed_object) do
          {:ok, _} -> []
          {:error, errs} -> [{typed_object.key, errs}]
        end
      end)

    if Enum.empty?(errors) do
      :ok
    else
      {:error, errors}
    end
  end

  @doc """
  Validates cross-references for a TypedObject.

  Checks:
  - Parent key references exist
  - Quest NPC targets exist
  - Dialogue entity keys exist
  - Zone room lists are valid
  """
  @spec validate_references(TypedObject.t()) :: [String.t()]
  def validate_references(%TypedObject{} = typed_object) do
    []
    |> validate_parent_ref(typed_object)
    |> validate_quest_refs(typed_object)
    |> validate_dialogue_refs(typed_object)
    |> validate_zone_refs(typed_object)
    |> validate_script_refs(typed_object)
  end

  @doc """
  Validates all cross-references in the registry.
  """
  @spec validate_all_references() :: :ok | {:error, [{String.t(), [String.t()]}]}
  def validate_all_references do
    errors =
      Registry.all()
      |> Enum.flat_map(fn typed_object ->
        refs = validate_references(typed_object)
        if Enum.empty?(refs), do: [], else: [{typed_object.key, refs}]
      end)

    if Enum.empty?(errors) do
      :ok
    else
      {:error, errors}
    end
  end

  @doc """
  Runs full validation including cross-references.
  """
  @spec full_validate() :: :ok | {:error, term()}
  def full_validate do
    with :ok <- validate_all(),
         :ok <- validate_all_references(),
         :ok <- validate_no_cycles() do
      :ok
    end
  end

  @doc """
  Validates that there are no inheritance cycles.
  """
  @spec validate_no_cycles() :: :ok | {:error, [term()]}
  def validate_no_cycles do
    all_objects = Registry.all()

    cycles =
      all_objects
      |> Enum.filter(&has_cycle?(&1, all_objects))
      |> Enum.map(&{:cycle, &1.key})

    if Enum.empty?(cycles) do
      :ok
    else
      {:error, cycles}
    end
  end

  # =============================================================================
  # Private Validation Helpers
  # =============================================================================

  defp validate_key(errors, key) when is_binary(key) and byte_size(key) > 0 do
    if Regex.match?(~r/^[a-zA-Z][a-zA-Z0-9_-]*$/, key) do
      errors
    else
      ["key '#{key}' is not a valid identifier" | errors]
    end
  end

  defp validate_key(errors, nil), do: ["key is required" | errors]
  defp validate_key(errors, ""), do: ["key cannot be empty" | errors]
  defp validate_key(errors, _), do: ["key must be a string" | errors]

  defp validate_type(errors, type) when type in [:entity, :quest, :dialogue, :script, :zone] do
    errors
  end

  defp validate_type(errors, nil), do: ["type is required" | errors]
  defp validate_type(errors, type), do: ["invalid type: #{inspect(type)}" | errors]

  defp validate_subtype(errors, %TypedObject{type: :entity, subtype: nil}), do: errors

  defp validate_subtype(errors, %TypedObject{type: :entity, subtype: subtype})
       when subtype in [:npc, :room, :item, :exit, :character] do
    errors
  end

  defp validate_subtype(errors, %TypedObject{type: :entity, subtype: subtype}) do
    ["invalid entity subtype: #{inspect(subtype)}" | errors]
  end

  defp validate_subtype(errors, _), do: errors

  defp validate_parent_exists(errors, %TypedObject{parent_key: nil}), do: errors

  defp validate_parent_exists(errors, %TypedObject{parent_key: parent_key, key: key}) do
    case Registry.get(parent_key) do
      {:ok, _} -> errors
      {:error, :not_found} -> ["parent '#{parent_key}' not found for '#{key}'" | errors]
    end
  end

  defp validate_type_specific(errors, %TypedObject{type: :quest} = quest) do
    validate_quest(errors, quest)
  end

  defp validate_type_specific(errors, %TypedObject{type: :dialogue} = dialogue) do
    validate_dialogue(errors, dialogue)
  end

  defp validate_type_specific(errors, %TypedObject{type: :zone} = zone) do
    validate_zone(errors, zone)
  end

  defp validate_type_specific(errors, %TypedObject{type: :script} = script) do
    validate_script(errors, script)
  end

  defp validate_type_specific(errors, _), do: errors

  # Quest-specific validation
  defp validate_quest(errors, %TypedObject{data: data}) do
    errors
    |> validate_quest_objectives(data)
  end

  defp validate_quest_objectives(errors, %{"objectives" => objectives})
       when is_list(objectives) do
    invalid =
      objectives
      |> Enum.with_index()
      |> Enum.filter(fn {obj, _idx} ->
        not ((is_map(obj) and Map.has_key?(obj, "id")) or Map.has_key?(obj, :id))
      end)

    if Enum.empty?(invalid) do
      errors
    else
      ["quest objectives must have 'id' field" | errors]
    end
  end

  defp validate_quest_objectives(errors, _), do: errors

  # Dialogue-specific validation
  defp validate_dialogue(errors, %TypedObject{data: data}) do
    errors
    |> validate_dialogue_nodes(data)
  end

  defp validate_dialogue_nodes(errors, %{"nodes" => nodes}) when is_map(nodes) do
    entry = Map.get(nodes, "entry_node") || Map.get(nodes, :entry_node, "greeting")

    if Map.has_key?(nodes, entry) or Map.has_key?(nodes, String.to_atom(entry)) do
      errors
    else
      ["dialogue entry_node '#{entry}' not found in nodes" | errors]
    end
  end

  defp validate_dialogue_nodes(errors, _), do: errors

  # Zone-specific validation
  defp validate_zone(errors, %TypedObject{data: data}) do
    errors
    |> validate_zone_rooms(data)
  end

  defp validate_zone_rooms(errors, %{"rooms" => rooms}) when is_list(rooms) do
    if Enum.all?(rooms, &is_binary/1) do
      errors
    else
      ["zone rooms must be a list of room keys" | errors]
    end
  end

  defp validate_zone_rooms(errors, _), do: errors

  # Script-specific validation
  defp validate_script(errors, %TypedObject{data: data}) do
    errors
    |> validate_script_source(data)
  end

  defp validate_script_source(errors, %{"source" => source}) when is_binary(source) do
    # Basic syntax check
    case Code.string_to_quoted(source) do
      {:ok, _} -> errors
      {:error, {_line, msg, _}} -> ["script syntax error: #{msg}" | errors]
    end
  end

  defp validate_script_source(errors, _), do: errors

  # =============================================================================
  # Cross-Reference Validation
  # =============================================================================

  defp validate_parent_ref(errors, %TypedObject{parent_key: nil}), do: errors

  defp validate_parent_ref(errors, %TypedObject{parent_key: parent_key}) do
    case Registry.get(parent_key) do
      {:ok, _} -> errors
      {:error, :not_found} -> ["parent_key '#{parent_key}' does not exist" | errors]
    end
  end

  defp validate_quest_refs(errors, %TypedObject{type: :quest, data: data}) do
    giver_key = Map.get(data, "giver_key") || Map.get(data, :giver_key)

    if giver_key && !Registry.exists?(giver_key) do
      ["quest giver_key '#{giver_key}' does not exist" | errors]
    else
      errors
    end
  end

  defp validate_quest_refs(errors, _), do: errors

  defp validate_dialogue_refs(errors, %TypedObject{type: :dialogue, data: data}) do
    entity_key = Map.get(data, "entity_key") || Map.get(data, :entity_key)

    if entity_key && !Registry.exists?(entity_key) do
      ["dialogue entity_key '#{entity_key}' does not exist" | errors]
    else
      errors
    end
  end

  defp validate_dialogue_refs(errors, _), do: errors

  defp validate_zone_refs(errors, %TypedObject{type: :zone, data: data}) do
    rooms = Map.get(data, "rooms") || Map.get(data, :rooms, [])

    missing =
      rooms
      |> Enum.filter(fn room_key -> !Registry.exists?(room_key) end)

    if Enum.empty?(missing) do
      errors
    else
      ["zone references missing rooms: #{inspect(missing)}" | errors]
    end
  end

  defp validate_zone_refs(errors, _), do: errors

  defp validate_script_refs(errors, %TypedObject{scripts: scripts}) when map_size(scripts) > 0 do
    missing =
      scripts
      |> Map.values()
      |> Enum.filter(fn script_key ->
        is_binary(script_key) && !Registry.exists?(script_key)
      end)

    if Enum.empty?(missing) do
      errors
    else
      ["references missing scripts: #{inspect(missing)}" | errors]
    end
  end

  defp validate_script_refs(errors, _), do: errors

  # Cycle detection
  defp has_cycle?(%TypedObject{parent_key: nil}, _all), do: false

  defp has_cycle?(%TypedObject{key: key, parent_key: parent_key}, all) do
    visited = MapSet.new([key])
    detect_cycle(parent_key, visited, all)
  end

  defp detect_cycle(nil, _visited, _all), do: false

  defp detect_cycle(key, visited, all) do
    if MapSet.member?(visited, key) do
      true
    else
      case Enum.find(all, fn obj -> obj.key == key end) do
        nil -> false
        obj -> detect_cycle(obj.parent_key, MapSet.put(visited, key), all)
      end
    end
  end
end
