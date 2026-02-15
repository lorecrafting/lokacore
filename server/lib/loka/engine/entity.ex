defmodule Loka.Engine.Entity do
  @moduledoc """
  Core entity structure for the Loka engine (V2).

  In V2, everything is an entity — rooms, NPCs, items, quests, skills, etc.
  All game data lives in `components` (a JSON map). The database is the single
  source of truth; there is no separate ETS registry.

  ## Description Fields (LegendMUD Style)

  - `short_desc` - Action/speech identifier, used when entity performs actions
    (e.g., "Novice Pema says..." or "a young monk attacks...")
  - `long_desc` - Room display sentence with verb, shown in room listings
    (e.g., "A young monk with earnest eyes waits anxiously here.")
  - `extra_desc` - Detailed prose shown when entity is examined/inspected
  - `keywords` - Words that can be used to target/reference the entity
    (e.g., ["monk", "young", "pema", "novice"])
  - `primary_keyword` - Single keyword for touch/click interfaces (e.g., "monk")
    Falls back to first keyword if not set. Used to avoid redundant underline.
  - `mood` - Current mood affecting display (e.g., "anxious", "cheerful")

  ## V2 Changes (from V1)

  Removed fields: `data`, `attributes`, `contents`, `locks`, `parent_key`.
  - `data` → merged into `components`
  - `attributes` → merged into `components`
  - `contents` → derived from `Entities.find_all(location_id: id)`
  - `locks` → `components["locks"]`
  - `parent_key` → `metadata["parent_key"]`

  Added fields: `version`, `account_id`.
  """

  alias Loka.Engine.Constants.EntityTypes

  @type entity_type :: EntityTypes.entity_type()

  @type t :: %__MODULE__{
          # Identity
          id: String.t(),
          type: entity_type(),
          key: String.t(),
          prototype_key: String.t() | nil,
          is_prototype: boolean(),
          version: integer(),
          # Display
          short_desc: String.t() | nil,
          long_desc: String.t() | nil,
          extra_desc: String.t() | nil,
          keywords: [String.t()],
          primary_keyword: String.t() | nil,
          mood: String.t() | nil,
          # Relationships
          location_id: String.t() | nil,
          account_id: String.t() | nil,
          # Game data
          components: map(),
          behaviors: [module()],
          tags: [String.t()],
          scripts: map(),
          metadata: map()
        }

  defstruct [
    :id,
    :type,
    :key,
    :prototype_key,
    :short_desc,
    :long_desc,
    :extra_desc,
    :primary_keyword,
    :mood,
    :location_id,
    :account_id,
    is_prototype: false,
    version: 1,
    keywords: [],
    components: %{},
    behaviors: [],
    tags: [],
    scripts: %{},
    metadata: %{}
  ]

  @doc """
  Creates a new entity from a keyword list or map of attributes.

  Requires `:type`. Generates a UUID if `:id` is not provided.

  ## Examples

      Entity.new(type: :npc, key: "goblin", short_desc: "a goblin")
      Entity.new(%{type: :room, key: "town_square"})
  """
  def new(attrs) when is_list(attrs), do: new(Map.new(attrs))

  def new(attrs) when is_map(attrs) do
    %__MODULE__{
      id: attrs[:id] || Ecto.UUID.generate(),
      type: attrs[:type] || raise(ArgumentError, "type required"),
      version: 1,
      is_prototype: attrs[:is_prototype] || false,
      components: attrs[:components] || %{},
      tags: attrs[:tags] || [],
      metadata: attrs[:metadata] || %{}
    }
    |> struct!(
      Map.drop(attrs, [:id, :type, :is_prototype, :components, :tags, :metadata, :version])
    )
  end

  @doc """
  Creates a new entity of the given type.

  Backward-compatible constructor — delegates to `new/1`.

  ## Examples

      Entity.new(:npc, %{key: "goblin", short_desc: "a goblin"})
  """
  def new(type, attrs) when is_atom(type) do
    attrs = normalize_attrs(attrs)
    new(Map.put(attrs, :type, type))
  end

  @doc """
  Returns a snapshot of the entity for rollback purposes.

  Currently returns the entity as-is. Will be extended to deep-copy
  volatile state when EntityServer rollback is implemented.
  """
  def snapshot(%__MODULE__{} = entity), do: entity

  defp normalize_attrs(attrs) when is_map(attrs), do: attrs
  defp normalize_attrs(attrs) when is_list(attrs), do: Map.new(attrs)

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
  Checks if an entity was spawned from a draft prototype.

  Draft entities carry `"draft" => true` in their metadata, propagated from
  the source TypedObject at spawn time.
  """
  @spec draft?(t()) :: boolean()
  def draft?(%__MODULE__{metadata: metadata}) when is_map(metadata) do
    Map.get(metadata, "draft") == true
  end

  def draft?(_), do: false

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

  @doc """
  Checks if an entity type is valid.
  Delegates to `EntityTypes.valid?/1`.
  """
  @spec valid_type?(atom()) :: boolean()
  def valid_type?(type), do: EntityTypes.valid?(type)

  @doc """
  Returns all valid entity types.
  Delegates to `EntityTypes.all/0`.
  """
  @spec valid_types() :: [entity_type()]
  def valid_types, do: EntityTypes.all()

  # =============================================================================
  # Access Behavior
  # =============================================================================

  @behaviour Access

  @doc """
  Implements Access.fetch/2 for bracket notation on Entity structs.

  Allows `entity[:key]` and `entity["key"]` syntax for compatibility with
  code that handles both maps and structs (e.g., Locks.check/3).
  """
  @impl Access
  def fetch(%__MODULE__{} = entity, key) when is_atom(key) do
    if Map.has_key?(entity, key) do
      {:ok, Map.get(entity, key)}
    else
      :error
    end
  end

  def fetch(%__MODULE__{} = entity, key) when is_binary(key) do
    # Convert string key to atom if it's a valid struct field
    atom_key = String.to_existing_atom(key)
    fetch(entity, atom_key)
  rescue
    ArgumentError -> :error
  end

  @impl Access
  def get_and_update(%__MODULE__{} = entity, key, fun) when is_atom(key) do
    current = Map.get(entity, key)

    case fun.(current) do
      {get_value, update_value} ->
        {get_value, Map.put(entity, key, update_value)}

      :pop ->
        # For structs, we can't really "pop" a field, so we set it to nil
        {current, Map.put(entity, key, nil)}
    end
  end

  def get_and_update(%__MODULE__{} = entity, key, fun) when is_binary(key) do
    atom_key = String.to_existing_atom(key)
    get_and_update(entity, atom_key, fun)
  rescue
    ArgumentError -> {nil, entity}
  end

  @impl Access
  def pop(%__MODULE__{} = entity, key) when is_atom(key) do
    current = Map.get(entity, key)
    {current, Map.put(entity, key, nil)}
  end

  def pop(%__MODULE__{} = entity, key) when is_binary(key) do
    atom_key = String.to_existing_atom(key)
    pop(entity, atom_key)
  rescue
    ArgumentError -> {nil, entity}
  end
end
