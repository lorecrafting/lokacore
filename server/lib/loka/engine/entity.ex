defmodule Loka.Engine.Entity do
  @moduledoc """
  Core entity structure for the Loka engine.

  Entities are IC (In-Character) TypedObjects - they exist in the game world with
  locations, contents, and runtime state. This follows a composition-based
  Entity-Component-Behavior model that maps naturally to Elixir's functional paradigm.

  ## TypedObject Compatibility

  Entity extends TypedObject with runtime concerns. The following field mappings
  provide compatibility with the TypedObject system:

  - `name` → `short_desc` (action/speech identifier)
  - `description` → `long_desc` (room display sentence)
  - `extra_description` → `extra_desc` (detailed examination text)

  ## Description Fields (LegendMUD Style)

  - `short_desc` / `name` - Action/speech identifier, used when entity performs actions
    (e.g., "Novice Pema says..." or "a young monk attacks...")
  - `long_desc` / `description` - Room display sentence with verb, shown in room listings
    (e.g., "A young monk with earnest eyes waits anxiously here.")
  - `extra_desc` / `extra_description` - Detailed prose shown when entity is examined/inspected
  - `keywords` - Words that can be used to target/reference the entity
    (e.g., ["monk", "young", "pema", "novice"])
  - `primary_keyword` - Single keyword for touch/click interfaces (e.g., "monk")
    Falls back to first keyword if not set. Used to avoid redundant underlines.
  - `mood` - Current mood affecting display (e.g., "anxious", "cheerful")
  """

  alias Loka.Engine.TypedObject

  @type t :: %__MODULE__{
          # Identity
          id: String.t(),
          type: entity_type(),
          key: String.t(),
          parent_key: String.t() | nil,
          is_prototype: boolean(),
          prototype_key: String.t() | nil,
          # Display (TypedObject-compatible names + legacy names)
          name: String.t() | nil,
          description: String.t() | nil,
          extra_description: String.t() | nil,
          short_desc: String.t() | nil,
          long_desc: String.t() | nil,
          extra_desc: String.t() | nil,
          keywords: [String.t()],
          primary_keyword: String.t() | nil,
          mood: String.t() | nil,
          # Location and contents
          location_id: String.t() | nil,
          contents: [String.t()],
          # Flexible storage
          components: map(),
          behaviors: [module()],
          attributes: map(),
          tags: [String.t()],
          scripts: map(),
          locks: map(),
          data: map(),
          metadata: map()
        }

  @type entity_type :: :character | :room | :item | :npc | :exit

  defstruct [
    :id,
    :type,
    :key,
    :parent_key,
    :prototype_key,
    # TypedObject-compatible display fields
    :name,
    :description,
    :extra_description,
    # Legacy display fields (mapped from TypedObject)
    :short_desc,
    :long_desc,
    :extra_desc,
    :primary_keyword,
    :mood,
    :location_id,
    is_prototype: false,
    keywords: [],
    contents: [],
    components: %{},
    behaviors: [],
    attributes: %{},
    tags: [],
    scripts: %{},
    locks: %{},
    data: %{},
    metadata: %{}
  ]

  @doc """
  Creates a new entity with a generated UUID.

  Supports both TypedObject field names (name, description, extra_description)
  and legacy field names (short_desc, long_desc, extra_desc).
  """
  def new(type, attrs \\ %{}) do
    now = DateTime.utc_now()
    attrs = normalize_attrs(attrs)

    %__MODULE__{
      id: Map.get(attrs, :id) || UUID.uuid4(),
      type: type,
      key: Map.get(attrs, :key),
      parent_key: Map.get(attrs, :parent_key),
      prototype_key: Map.get(attrs, :prototype_key),
      is_prototype: Map.get(attrs, :is_prototype, false),
      # TypedObject-compatible display fields
      name: Map.get(attrs, :name) || Map.get(attrs, :short_desc),
      description: Map.get(attrs, :description) || Map.get(attrs, :long_desc),
      extra_description: Map.get(attrs, :extra_description) || Map.get(attrs, :extra_desc),
      # Legacy display fields (mirror TypedObject fields)
      short_desc: Map.get(attrs, :short_desc) || Map.get(attrs, :name),
      long_desc: Map.get(attrs, :long_desc) || Map.get(attrs, :description),
      extra_desc: Map.get(attrs, :extra_desc) || Map.get(attrs, :extra_description),
      keywords: Map.get(attrs, :keywords, []),
      primary_keyword: Map.get(attrs, :primary_keyword),
      mood: Map.get(attrs, :mood),
      location_id: Map.get(attrs, :location_id),
      contents: Map.get(attrs, :contents, []),
      components: Map.get(attrs, :components, %{}),
      behaviors: Map.get(attrs, :behaviors, []),
      attributes: Map.get(attrs, :attributes, %{}),
      tags: Map.get(attrs, :tags, []),
      scripts: Map.get(attrs, :scripts, %{}),
      locks: Map.get(attrs, :locks, %{}),
      data: Map.get(attrs, :data, %{}),
      metadata:
        Map.merge(
          %{created_at: now, updated_at: now},
          Map.get(attrs, :metadata, %{})
        )
    }
  end

  defp normalize_attrs(attrs) when is_map(attrs), do: attrs

  defp normalize_attrs(attrs) when is_list(attrs) do
    Map.new(attrs)
  end

  @doc """
  Adds a component to an entity.
  """
  def add_component(%__MODULE__{} = entity, component_type, component_data) do
    %{entity | components: Map.put(entity.components, component_type, component_data)}
  end

  @doc """
  Gets a component from an entity.
  """
  def get_component(%__MODULE__{} = entity, component_type) do
    Map.get(entity.components, component_type)
  end

  @doc """
  Checks if an entity has a specific component.
  """
  def has_component?(%__MODULE__{} = entity, component_type) do
    Map.has_key?(entity.components, component_type)
  end

  @doc """
  Adds a behavior module to an entity.
  """
  def add_behavior(%__MODULE__{} = entity, behavior_module) when is_atom(behavior_module) do
    %{entity | behaviors: [behavior_module | entity.behaviors] |> Enum.uniq()}
  end

  @doc """
  Sets an attribute on an entity.
  """
  def set_attribute(%__MODULE__{} = entity, key, value) do
    %{entity | attributes: Map.put(entity.attributes, key, value)}
  end

  @doc """
  Gets an attribute from an entity.
  """
  def get_attribute(%__MODULE__{} = entity, key, default \\ nil) do
    Map.get(entity.attributes, key, default)
  end

  @doc """
  Adds a tag to an entity.
  """
  def add_tag(%__MODULE__{} = entity, tag) when is_binary(tag) do
    %{entity | tags: [tag | entity.tags] |> Enum.uniq()}
  end

  @doc """
  Checks if an entity has a specific tag.
  """
  def has_tag?(%__MODULE__{} = entity, tag) do
    tag in entity.tags
  end

  @doc """
  Returns a human-readable reference for logging and debugging.

  Format: "key#short_uuid" (e.g., "hungry_ghost#44a2b1")

  This provides traceability when multiple instances of the same
  prototype exist, while keeping logs readable.

  ## Examples

      iex> display_ref(%Entity{key: "goblin", id: "44a2b1c3-d4e5-..."})
      "goblin#44a2b1"

      iex> display_ref("44a2b1c3-d4e5-...", "goblin")
      "goblin#44a2b1"
  """
  def display_ref(%__MODULE__{key: key, id: id}) do
    short_id = id |> String.split("-") |> List.first() |> String.slice(0, 6)
    "#{key}##{short_id}"
  end

  def display_ref(id, key) when is_binary(id) and is_binary(key) do
    short_id = id |> String.split("-") |> List.first() |> String.slice(0, 6)
    "#{key}##{short_id}"
  end

  # =============================================================================
  # TypedObject Conversion
  # =============================================================================

  @doc """
  Converts an Entity to a TypedObject struct.

  This allows Entity instances to be stored and queried through
  the unified TypedObject system.
  """
  @spec to_typed_object(t()) :: {:ok, TypedObject.t()} | {:error, [String.t()]}
  def to_typed_object(%__MODULE__{} = entity) do
    TypedObject.new(%{
      id: entity.id,
      key: entity.key,
      type: :entity,
      subtype: entity.type,
      parent_key: entity.parent_key,
      is_prototype: entity.is_prototype,
      prototype_key: entity.prototype_key,
      name: entity.name || entity.short_desc,
      description: entity.description || entity.long_desc,
      extra_description: entity.extra_description || entity.extra_desc,
      keywords: entity.keywords,
      attributes: entity.attributes,
      tags: entity.tags,
      locks: entity.locks,
      data:
        Map.merge(entity.data, %{
          "primary_keyword" => entity.primary_keyword,
          "mood" => entity.mood
        }),
      metadata: entity.metadata,
      location_id: entity.location_id,
      contents: entity.contents,
      components: entity.components,
      behaviors: entity.behaviors,
      scripts: entity.scripts
    })
  end

  @doc """
  Creates an Entity from a TypedObject struct.

  The TypedObject must be of type :entity.
  """
  @spec from_typed_object(TypedObject.t()) :: {:ok, t()} | {:error, String.t()}
  def from_typed_object(%TypedObject{type: :entity} = typed_object) do
    entity = %__MODULE__{
      id: typed_object.id || UUID.uuid4(),
      type: typed_object.subtype || :npc,
      key: typed_object.key,
      parent_key: typed_object.parent_key,
      is_prototype: typed_object.is_prototype,
      prototype_key: typed_object.prototype_key,
      # TypedObject display fields
      name: typed_object.name,
      description: typed_object.description,
      extra_description: typed_object.extra_description,
      # Legacy display fields (mirror)
      short_desc: typed_object.name,
      long_desc: typed_object.description,
      extra_desc: typed_object.extra_description,
      keywords: typed_object.keywords,
      primary_keyword: get_in(typed_object.data, ["primary_keyword"]),
      mood: get_in(typed_object.data, ["mood"]),
      location_id: typed_object.location_id,
      contents: typed_object.contents,
      components: typed_object.components,
      behaviors: typed_object.behaviors,
      attributes: typed_object.attributes,
      tags: typed_object.tags,
      scripts: typed_object.scripts,
      locks: typed_object.locks,
      data: Map.drop(typed_object.data, ["primary_keyword", "mood"]),
      metadata: typed_object.metadata
    }

    {:ok, entity}
  end

  def from_typed_object(%TypedObject{type: type}) do
    {:error, "Expected TypedObject of type :entity, got #{inspect(type)}"}
  end

  @doc """
  Creates an Entity from a TypedObject, raises on error.
  """
  @spec from_typed_object!(TypedObject.t()) :: t()
  def from_typed_object!(typed_object) do
    case from_typed_object(typed_object) do
      {:ok, entity} -> entity
      {:error, reason} -> raise ArgumentError, reason
    end
  end

  @doc """
  Checks if an entity type is valid.
  """
  @spec valid_type?(atom()) :: boolean()
  def valid_type?(type), do: type in [:character, :room, :item, :npc, :exit]

  @doc """
  Returns all valid entity types.
  """
  @spec valid_types() :: [entity_type()]
  def valid_types, do: [:character, :room, :item, :npc, :exit]
end
