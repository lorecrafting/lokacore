defmodule Exmud.Engine.Entity do
  @moduledoc """
  Core entity structure for the ExMUD engine.

  Entities are data containers with attached behaviors that define how they
  interact with the world. This follows a composition-based Entity-Component-Behavior
  model that maps naturally to Elixir's functional paradigm.
  """

  @type t :: %__MODULE__{
          id: String.t(),
          type: entity_type(),
          key: String.t(),
          name: String.t(),
          description: String.t(),
          location_id: String.t() | nil,
          contents: [String.t()],
          components: map(),
          behaviors: [module()],
          attributes: map(),
          tags: [String.t()],
          scripts: map(),
          locks: map(),
          metadata: map()
        }

  @type entity_type :: :character | :room | :item | :npc | :exit

  defstruct [
    :id,
    :type,
    :key,
    :name,
    :description,
    :location_id,
    contents: [],
    components: %{},
    behaviors: [],
    attributes: %{},
    tags: [],
    scripts: %{},
    locks: %{},
    metadata: %{}
  ]

  @doc """
  Creates a new entity with a generated UUID.
  """
  def new(type, attrs \\ %{}) do
    %__MODULE__{
      id: UUID.uuid4(),
      type: type,
      metadata: %{
        created_at: DateTime.utc_now(),
        updated_at: DateTime.utc_now()
      }
    }
    |> Map.merge(Map.take(attrs, [:key, :name, :description, :location_id]))
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
end
