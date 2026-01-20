defmodule Loka.Engine.TypedObject do
  @moduledoc """
  Universal foundation for all game objects (IC and OOC).

  TypedObject is the base struct that all game content inherits from:

  ## IC Types (Entity)
  Have location, GenServer, spawnable instances
  - `:npc` - Non-player characters
  - `:room` - Locations in the world
  - `:item` - Objects that can be picked up
  - `:exit` - Connections between rooms

  ## OOC Types (Content)
  Definitions only, loaded once, referenced
  - `:quest` - Quest definitions
  - `:dialogue` - Dialogue trees
  - `:script` - Elixir script definitions
  - `:zone` - Zone configurations

  ## Fields

  - `key` - Unique identifier (e.g., "novice_pema", "dragon_hunt")
  - `type` - Category (:entity, :quest, :dialogue, :script, :zone)
  - `subtype` - Sub-category for entities (:npc, :room, :item, :exit)
  - `parent_key` - Key of parent for inheritance
  - `name` - Display name (short_desc equivalent)
  - `description` - Full description (long_desc equivalent)
  - `extra_description` - Detailed examination text
  - `keywords` - Words to target this object
  - `attributes` - Flexible key-value storage
  - `tags` - Categorization tags
  - `locks` - Access control rules
  - `data` - Type-specific fields
  - `metadata` - System metadata (created_at, etc.)
  """

  alias Loka.Engine.TypedObject.Loader

  @type object_type :: :entity | :quest | :dialogue | :script | :zone
  @type entity_subtype :: :npc | :room | :item | :exit | :character
  @type content_type :: :quest | :dialogue | :script | :zone

  @type behavior_config :: %{script: String.t(), config: map()}

  @type t :: %__MODULE__{
          id: String.t() | nil,
          key: String.t(),
          type: object_type(),
          subtype: entity_subtype() | nil,
          parent_key: String.t() | nil,
          is_prototype: boolean(),
          prototype_key: String.t() | nil,
          name: String.t() | nil,
          description: String.t() | nil,
          extra_description: String.t() | nil,
          keywords: [String.t()],
          attributes: map(),
          tags: [String.t()],
          locks: map(),
          data: map(),
          metadata: map(),
          # Entity-specific fields
          location_id: String.t() | nil,
          contents: [String.t()],
          components: map(),
          behaviors: [behavior_config()],
          scripts: map()
        }

  @enforce_keys [:key, :type]
  defstruct [
    :id,
    :key,
    :type,
    :subtype,
    :parent_key,
    :prototype_key,
    :name,
    :description,
    :extra_description,
    :location_id,
    is_prototype: true,
    keywords: [],
    attributes: %{},
    tags: [],
    locks: %{},
    data: %{},
    metadata: %{},
    contents: [],
    components: %{},
    behaviors: [],
    scripts: %{}
  ]

  @valid_types [:entity, :quest, :dialogue, :script, :zone]
  @valid_entity_subtypes [:npc, :room, :item, :exit, :character]

  # =============================================================================
  # Constructor
  # =============================================================================

  @doc """
  Creates a new TypedObject from a map or keyword list.

  ## Examples

      iex> TypedObject.new(key: "goblin", type: :entity, subtype: :npc)
      {:ok, %TypedObject{key: "goblin", type: :entity, subtype: :npc}}

      iex> TypedObject.new(%{"key" => "dragon_hunt", "type" => "quest"})
      {:ok, %TypedObject{key: "dragon_hunt", type: :quest}}
  """
  @spec new(keyword() | map()) :: {:ok, t()} | {:error, [String.t()]}
  def new(attrs) when is_list(attrs), do: attrs |> Map.new() |> new()

  # Known TypedObject struct fields
  @struct_fields ~w(
    id key type subtype parent_key parent is_prototype prototype_key
    name short_desc description long_desc extra_description extra_desc
    keywords attributes tags locks data metadata location_id contents
    components behaviors scripts
  )a

  def new(attrs) when is_map(attrs) do
    attrs = normalize_keys(attrs)

    # Separate struct fields from content-specific fields
    # Content-specific fields (like quest objectives, rewards, etc.) go into data map
    {struct_attrs, extra_attrs} = separate_struct_fields(attrs)

    # Merge extra fields into the data map (for content types like quests)
    data_map = Map.merge(extra_attrs, Map.get(struct_attrs, :data, %{}))

    typed_object = %__MODULE__{
      id: Map.get(struct_attrs, :id),
      key: Map.get(struct_attrs, :key),
      type: normalize_type(Map.get(struct_attrs, :type)),
      subtype: normalize_subtype(Map.get(struct_attrs, :subtype)),
      parent_key: Map.get(struct_attrs, :parent_key) || Map.get(struct_attrs, :parent),
      is_prototype: Map.get(struct_attrs, :is_prototype, true),
      prototype_key: Map.get(struct_attrs, :prototype_key),
      name: Map.get(struct_attrs, :name) || Map.get(struct_attrs, :short_desc),
      description: Map.get(struct_attrs, :description) || Map.get(struct_attrs, :long_desc),
      extra_description:
        Map.get(struct_attrs, :extra_description) || Map.get(struct_attrs, :extra_desc),
      keywords: normalize_keywords(Map.get(struct_attrs, :keywords, [])),
      attributes: Map.get(struct_attrs, :attributes, %{}),
      tags: Map.get(struct_attrs, :tags, []),
      locks: Map.get(struct_attrs, :locks, %{}),
      data: data_map,
      metadata: Map.get(struct_attrs, :metadata, %{}),
      location_id: Map.get(struct_attrs, :location_id),
      contents: Map.get(struct_attrs, :contents, []),
      components: Map.get(struct_attrs, :components, %{}),
      behaviors: normalize_behaviors(Map.get(struct_attrs, :behaviors, [])),
      scripts: Map.get(struct_attrs, :scripts, %{})
    }

    case validate(typed_object) do
      {:ok, _} -> {:ok, typed_object}
      error -> error
    end
  end

  @doc """
  Creates a new TypedObject, raises on error.
  """
  @spec new!(keyword() | map()) :: t()
  def new!(attrs) do
    case new(attrs) do
      {:ok, typed_object} -> typed_object
      {:error, errors} -> raise "Invalid TypedObject: #{inspect(errors)}"
    end
  end

  # =============================================================================
  # Lookup API
  # =============================================================================

  @doc """
  Gets a TypedObject by key from the registry.
  """
  @spec get(String.t()) :: {:ok, t()} | {:error, :not_found}
  def get(key) when is_binary(key), do: Loader.get(key)

  @doc """
  Gets a TypedObject by key, raises if not found.
  """
  @spec get!(String.t()) :: t()
  def get!(key) when is_binary(key), do: Loader.get!(key)

  # =============================================================================
  # Query Functions
  # =============================================================================

  @doc """
  Checks if a TypedObject has a specific tag.
  """
  @spec has_tag?(t(), String.t()) :: boolean()
  def has_tag?(%__MODULE__{tags: tags}, tag), do: tag in tags

  @doc """
  Gets an attribute value.
  """
  @spec get_attribute(t(), atom() | String.t(), any()) :: any()
  def get_attribute(%__MODULE__{attributes: attrs}, key, default \\ nil) do
    Map.get(attrs, key, Map.get(attrs, to_string(key), default))
  end

  @doc """
  Gets a value from the data map.
  """
  @spec get_data(t(), atom() | String.t(), any()) :: any()
  def get_data(%__MODULE__{data: data}, key, default \\ nil) do
    Map.get(data, key, Map.get(data, to_string(key), default))
  end

  @doc """
  Checks if a TypedObject is an entity (IC type).
  """
  @spec entity?(t()) :: boolean()
  def entity?(%__MODULE__{type: :entity}), do: true
  def entity?(_), do: false

  @doc """
  Checks if a TypedObject is a content type (OOC).
  """
  @spec content?(t()) :: boolean()
  def content?(%__MODULE__{type: type}) when type in [:quest, :dialogue, :script, :zone], do: true
  def content?(_), do: false

  @doc """
  Returns a display reference for logging.
  """
  @spec display_ref(t()) :: String.t()
  def display_ref(%__MODULE__{key: key, id: nil}), do: key

  def display_ref(%__MODULE__{key: key, id: id}) do
    short_id = id |> String.split("-") |> List.first() |> String.slice(0, 6)
    "#{key}##{short_id}"
  end

  # =============================================================================
  # Validation
  # =============================================================================

  @doc """
  Validates a TypedObject struct.
  """
  @spec validate(t()) :: {:ok, t()} | {:error, [String.t()]}
  def validate(%__MODULE__{} = typed_object) do
    errors =
      []
      |> validate_key(typed_object.key)
      |> validate_type(typed_object.type)
      |> validate_subtype(typed_object.type, typed_object.subtype)
      |> validate_tags(typed_object.tags)
      |> validate_keywords(typed_object.keywords)

    case errors do
      [] -> {:ok, typed_object}
      errors -> {:error, Enum.reverse(errors)}
    end
  end

  @doc """
  Returns valid object types.
  """
  @spec valid_types() :: [object_type()]
  def valid_types, do: @valid_types

  @doc """
  Returns valid entity subtypes.
  """
  @spec valid_entity_subtypes() :: [entity_subtype()]
  def valid_entity_subtypes, do: @valid_entity_subtypes

  # =============================================================================
  # Inheritance
  # =============================================================================

  @doc """
  Merges a child TypedObject with its parent.

  Child values override parent values. Maps are deep-merged,
  lists are concatenated (child first).
  """
  @spec merge_parent(t(), t()) :: t()
  def merge_parent(%__MODULE__{} = child, %__MODULE__{} = parent) do
    alias Loka.Utils.MapHelpers

    %__MODULE__{
      id: child.id,
      key: child.key,
      type: child.type || parent.type,
      subtype: child.subtype || parent.subtype,
      parent_key: child.parent_key,
      is_prototype: child.is_prototype,
      prototype_key: child.prototype_key,
      name: child.name || parent.name,
      description: child.description || parent.description,
      extra_description: child.extra_description || parent.extra_description,
      keywords: merge_lists(child.keywords, parent.keywords),
      attributes: MapHelpers.deep_merge(parent.attributes, child.attributes),
      tags: merge_lists(child.tags, parent.tags),
      locks: Map.merge(parent.locks, child.locks),
      data: MapHelpers.deep_merge(parent.data, child.data),
      metadata: Map.merge(parent.metadata, child.metadata),
      location_id: child.location_id,
      contents: child.contents,
      components: MapHelpers.deep_merge(parent.components, child.components),
      behaviors: merge_behaviors(child.behaviors, parent.behaviors),
      scripts: MapHelpers.deep_merge(parent.scripts, child.scripts)
    }
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  # Separate TypedObject struct fields from content-specific fields
  # Content-specific fields (e.g., quest objectives, rewards) will be moved to data map
  defp separate_struct_fields(attrs) when is_map(attrs) do
    Map.split_with(attrs, fn {key, _value} ->
      # Check both atom and string versions of the key
      atom_key = if is_atom(key), do: Atom.to_string(key), else: key
      atom_key in @struct_fields || key in @struct_fields
    end)
  end

  # Whitelist of valid field names to prevent atom table exhaustion
  @valid_field_names ~w(
    id key type subtype parent_key parent is_prototype prototype_key
    name short_desc description long_desc extra_description extra_desc
    keywords attributes tags locks data metadata location_id contents
    components behaviors scripts
  )

  defp normalize_keys(map) when is_map(map) do
    Map.new(map, fn
      {k, v} when is_binary(k) ->
        atom_key =
          try do
            String.to_existing_atom(k)
          rescue
            ArgumentError ->
              # Only create new atoms for whitelisted field names
              if k in @valid_field_names do
                String.to_atom(k)
              else
                # Keep as string to prevent atom exhaustion
                k
              end
          end

        {atom_key, v}

      {k, v} when is_atom(k) ->
        {k, v}
    end)
  end

  defp normalize_type(type) when is_binary(type) do
    case type do
      "entity" -> :entity
      "quest" -> :quest
      "dialogue" -> :dialogue
      "script" -> :script
      "zone" -> :zone
      # Legacy support: map old entity types to entity + subtype
      "npc" -> :entity
      "room" -> :entity
      "item" -> :entity
      "exit" -> :entity
      "character" -> :entity
      # Don't create atoms for unknown types - let validation catch them
      _ -> type
    end
  end

  defp normalize_type(type) when is_atom(type) do
    # Convert legacy entity types
    case type do
      t when t in [:npc, :room, :item, :exit, :character] -> :entity
      t -> t
    end
  end

  defp normalize_type(type), do: type

  defp normalize_subtype(nil), do: nil

  defp normalize_subtype(subtype) when is_binary(subtype) do
    # Only convert known subtypes to atoms to prevent atom exhaustion
    case subtype do
      "npc" -> :npc
      "room" -> :room
      "item" -> :item
      "exit" -> :exit
      "character" -> :character
      # Unknown subtypes stay as strings, validation will catch them
      _ -> subtype
    end
  end

  defp normalize_subtype(subtype) when is_atom(subtype), do: subtype

  defp normalize_keywords(keywords) when is_list(keywords) do
    keywords
    |> Enum.map(&to_string/1)
    |> Enum.map(&String.downcase/1)
    |> Enum.uniq()
  end

  defp normalize_keywords(_), do: []

  # Normalize behaviors from YAML format to standardized config format
  # New format: [%{script: "patrol", config: %{route: [...]}}, ...]
  # Legacy format: module names (atoms or strings) - converted to new format
  defp normalize_behaviors(behaviors) when is_list(behaviors) do
    Enum.map(behaviors, fn
      # New format: map with script key
      %{"script" => script} = b ->
        %{
          script: to_string(script),
          config: normalize_behavior_config(Map.get(b, "config", %{}))
        }

      %{script: script} = b ->
        %{
          script: to_string(script),
          config: normalize_behavior_config(Map.get(b, :config, %{}))
        }

      # Legacy format: module name as string
      b when is_binary(b) ->
        # Convert module name to script key format
        script_key =
          b
          |> String.replace(~r/^(Elixir\.)?Loka\.Behaviors\./, "")
          |> Macro.underscore()

        %{script: script_key, config: %{}}

      # Legacy format: module name as atom (but not nil/true/false)
      b when is_atom(b) and not is_nil(b) and b not in [true, false] ->
        script_key =
          b
          |> to_string()
          |> String.replace(~r/^(Elixir\.)?Loka\.Behaviors\./, "")
          |> Macro.underscore()

        %{script: script_key, config: %{}}

      # Unknown format - skip
      _ ->
        nil
    end)
    |> Enum.reject(&is_nil/1)
  end

  defp normalize_behaviors(_), do: []

  # Normalize behavior config keys to atoms (shallow, for top-level config keys)
  defp normalize_behavior_config(config) when is_map(config) do
    Map.new(config, fn
      {k, v} when is_binary(k) ->
        # Try to convert to existing atom, otherwise keep as string
        atom_key =
          try do
            String.to_existing_atom(k)
          rescue
            ArgumentError -> k
          end

        {atom_key, v}

      {k, v} ->
        {k, v}
    end)
  end

  defp normalize_behavior_config(_), do: %{}

  defp merge_lists(child, parent) do
    (child ++ parent) |> Enum.uniq()
  end

  # Merge behaviors by script key - child config overrides parent
  defp merge_behaviors(child, parent) do
    # Build map of parent behaviors by script key
    parent_map =
      parent
      |> Enum.filter(&is_map/1)
      |> Enum.into(%{}, fn b -> {Map.get(b, :script), b} end)

    # Overlay child behaviors, deep merging config
    child
    |> Enum.filter(&is_map/1)
    |> Enum.reduce(parent_map, fn behavior, acc ->
      script_key = Map.get(behavior, :script)

      case Map.get(acc, script_key) do
        nil ->
          Map.put(acc, script_key, behavior)

        parent_behavior ->
          # Deep merge config: parent first, child overrides
          merged_config =
            Loka.Utils.MapHelpers.deep_merge(
              Map.get(parent_behavior, :config, %{}),
              Map.get(behavior, :config, %{})
            )

          Map.put(acc, script_key, %{script: script_key, config: merged_config})
      end
    end)
    |> Map.values()
  end

  # Validation helpers

  defp validate_key(errors, key) when is_binary(key) and byte_size(key) > 0 do
    if Regex.match?(~r/^[a-zA-Z][a-zA-Z0-9_-]*$/, key) do
      errors
    else
      ["key must be a valid identifier (alphanumeric, underscore, hyphen)" | errors]
    end
  end

  defp validate_key(errors, nil), do: ["key is required" | errors]
  defp validate_key(errors, ""), do: ["key must be a non-empty string" | errors]
  defp validate_key(errors, _), do: ["key must be a string" | errors]

  defp validate_type(errors, type) when type in @valid_types, do: errors
  defp validate_type(errors, nil), do: ["type is required" | errors]

  defp validate_type(errors, type) do
    ["type must be one of #{inspect(@valid_types)}, got: #{inspect(type)}" | errors]
  end

  defp validate_subtype(errors, :entity, nil), do: errors

  defp validate_subtype(errors, :entity, subtype) when subtype in @valid_entity_subtypes,
    do: errors

  defp validate_subtype(errors, :entity, subtype) do
    [
      "entity subtype must be one of #{inspect(@valid_entity_subtypes)}, got: #{inspect(subtype)}"
      | errors
    ]
  end

  defp validate_subtype(errors, _type, _subtype), do: errors

  defp validate_tags(errors, tags) when is_list(tags) do
    invalid = Enum.filter(tags, fn t -> not is_binary(t) end)
    if Enum.empty?(invalid), do: errors, else: ["tags must be a list of strings" | errors]
  end

  defp validate_tags(errors, _), do: ["tags must be a list" | errors]

  defp validate_keywords(errors, keywords) when is_list(keywords) do
    invalid = Enum.filter(keywords, fn k -> not is_binary(k) end)
    if Enum.empty?(invalid), do: errors, else: ["keywords must be a list of strings" | errors]
  end

  defp validate_keywords(errors, _), do: ["keywords must be a list" | errors]
end
