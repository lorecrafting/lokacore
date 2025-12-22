defmodule Exmud.Engine.Prototype do
  @moduledoc """
  Template for spawning entities without code.

  Prototypes define the default properties for an entity type.
  They support inheritance via the :parent field.

  ## Example

      %Prototype{
        key: "goblin_warrior",
        parent: "base_npc",
        type: :npc,
        name: "Goblin Warrior",
        description: "A fierce goblin wielding a rusty sword.",
        components: %{
          "combatant" => %{"health" => %{"current" => 30, "max" => 30}}
        },
        tags: ["hostile", "goblinoid"]
      }
  """

  alias Exmud.Engine.Entity

  @type t :: %__MODULE__{
          key: String.t(),
          parent: String.t() | nil,
          type: entity_type(),
          name: String.t() | nil,
          description: String.t() | nil,
          components: map(),
          behaviors: [module()],
          attributes: map(),
          tags: [String.t()],
          scripts: map(),
          locks: map(),
          exits: map(),
          spawns: [map()]
        }

  @type entity_type :: :character | :room | :item | :npc | :exit

  @enforce_keys [:key, :type]
  defstruct [
    :key,
    :parent,
    :type,
    :name,
    :description,
    components: %{},
    behaviors: [],
    attributes: %{},
    tags: [],
    scripts: %{},
    locks: %{},
    exits: %{},
    spawns: []
  ]

  @valid_types [:room, :npc, :item, :exit, :character]

  @doc """
  Creates a new prototype from a keyword list or map.

  ## Examples

      iex> Prototype.new(key: "goblin", type: :npc, name: "Goblin")
      {:ok, %Prototype{key: "goblin", type: :npc, name: "Goblin", ...}}

      iex> Prototype.new(type: :npc)
      {:error, ["key is required"]}
  """
  @spec new(keyword() | map()) :: {:ok, t()} | {:error, [String.t()]}
  def new(attrs) when is_list(attrs) do
    attrs |> Map.new() |> new()
  end

  def new(attrs) when is_map(attrs) do
    attrs = normalize_keys(attrs)

    prototype = %__MODULE__{
      key: Map.get(attrs, :key),
      parent: Map.get(attrs, :parent),
      type: normalize_type(Map.get(attrs, :type)),
      name: Map.get(attrs, :name),
      description: Map.get(attrs, :description),
      components: Map.get(attrs, :components, %{}),
      behaviors: normalize_behaviors(Map.get(attrs, :behaviors, [])),
      attributes: Map.get(attrs, :attributes, %{}),
      tags: Map.get(attrs, :tags, []),
      scripts: Map.get(attrs, :scripts, %{}),
      locks: Map.get(attrs, :locks, %{}),
      exits: Map.get(attrs, :exits, %{}),
      spawns: Map.get(attrs, :spawns, [])
    }

    case validate(prototype) do
      {:ok, _} -> {:ok, prototype}
      error -> error
    end
  end

  @doc """
  Validates a prototype struct.

  ## Validation Rules

  - `:key` must be a non-empty string
  - `:type` must be one of #{inspect(@valid_types)}
  - `:components` must be a map
  - `:behaviors` must be a list
  - `:tags` must be a list of strings

  ## Examples

      iex> Prototype.validate(%Prototype{key: "test", type: :npc})
      {:ok, %Prototype{key: "test", type: :npc}}

      iex> Prototype.validate(%Prototype{key: "", type: :npc})
      {:error, ["key must be a non-empty string"]}
  """
  @spec validate(t()) :: {:ok, t()} | {:error, [String.t()]}
  def validate(%__MODULE__{} = prototype) do
    errors =
      []
      |> validate_key(prototype.key)
      |> validate_type(prototype.type)
      |> validate_components(prototype.components)
      |> validate_behaviors(prototype.behaviors)
      |> validate_tags(prototype.tags)
      |> validate_exits(prototype.exits)
      |> validate_spawns(prototype.spawns)

    case errors do
      [] -> {:ok, prototype}
      errors -> {:error, Enum.reverse(errors)}
    end
  end

  @doc """
  Merges a child prototype onto a parent prototype.

  Child values override parent values. Maps are deep-merged,
  lists are concatenated (child first, then parent, deduplicated).

  ## Examples

      iex> parent = %Prototype{key: "base", type: :npc, tags: ["npc"]}
      iex> child = %Prototype{key: "goblin", type: :npc, parent: "base", tags: ["hostile"]}
      iex> Prototype.merge_parent(child, parent)
      %Prototype{key: "goblin", type: :npc, tags: ["hostile", "npc"], ...}
  """
  @spec merge_parent(t(), t()) :: t()
  def merge_parent(%__MODULE__{} = child, %__MODULE__{} = parent) do
    %__MODULE__{
      key: child.key,
      parent: child.parent,
      type: child.type || parent.type,
      name: child.name || parent.name,
      description: child.description || parent.description,
      components: deep_merge(parent.components, child.components),
      behaviors: merge_lists(child.behaviors, parent.behaviors),
      attributes: deep_merge(parent.attributes, child.attributes),
      tags: merge_lists(child.tags, parent.tags),
      scripts: deep_merge(parent.scripts, child.scripts),
      locks: Map.merge(parent.locks, child.locks),
      exits: Map.merge(parent.exits, child.exits),
      spawns: child.spawns ++ parent.spawns
    }
  end

  @doc """
  Converts a prototype to an Entity struct.

  Generates a new UUID for the entity. Optionally accepts overrides
  for any field (useful for spawn-time customization).

  ## Examples

      iex> proto = %Prototype{key: "goblin", type: :npc, name: "Goblin"}
      iex> entity = Prototype.to_entity(proto)
      %Entity{id: "...", type: :npc, key: "goblin", name: "Goblin", ...}

      iex> Prototype.to_entity(proto, %{name: "Elite Goblin"})
      %Entity{..., name: "Elite Goblin", ...}
  """
  @spec to_entity(t(), map()) :: Entity.t()
  def to_entity(%__MODULE__{} = prototype, overrides \\ %{}) do
    now = DateTime.utc_now()

    entity = %Entity{
      id: UUID.uuid4(),
      type: prototype.type,
      key: prototype.key,
      name: prototype.name,
      description: prototype.description,
      location_id: nil,
      contents: [],
      components: prototype.components,
      behaviors: prototype.behaviors,
      attributes: prototype.attributes,
      tags: prototype.tags,
      scripts: prototype.scripts,
      locks: prototype.locks,
      metadata: %{
        created_at: now,
        updated_at: now,
        prototype_key: prototype.key
      }
    }

    # Apply overrides
    overrides = normalize_keys(overrides)

    entity
    |> maybe_override(:name, overrides)
    |> maybe_override(:description, overrides)
    |> maybe_override(:location_id, overrides)
    |> maybe_override(:components, overrides)
    |> maybe_override(:behaviors, overrides)
    |> maybe_override(:attributes, overrides)
    |> maybe_override(:tags, overrides)
  end

  @doc """
  Converts a map with string keys (e.g., from YAML parsing) to a Prototype.

  ## Examples

      iex> Prototype.from_map(%{"key" => "goblin", "type" => "npc"})
      {:ok, %Prototype{key: "goblin", type: :npc}}
  """
  @spec from_map(map()) :: {:ok, t()} | {:error, [String.t()]}
  def from_map(map) when is_map(map) do
    new(map)
  end

  @doc """
  Returns the list of valid entity types.
  """
  @spec valid_types() :: [entity_type()]
  def valid_types, do: @valid_types

  # Private functions

  defp normalize_keys(map) when is_map(map) do
    Map.new(map, fn
      {k, v} when is_binary(k) -> {String.to_existing_atom(k), v}
      {k, v} when is_atom(k) -> {k, v}
    end)
  rescue
    ArgumentError -> map
  end

  defp normalize_type(type) when is_binary(type) do
    String.to_existing_atom(type)
  rescue
    ArgumentError -> type
  end

  defp normalize_type(type), do: type

  defp normalize_behaviors(behaviors) when is_list(behaviors) do
    Enum.map(behaviors, fn
      b when is_binary(b) ->
        # Convert module string like "Elixir.Foo.Bar" or "Foo.Bar" to atom
        module_string = if String.starts_with?(b, "Elixir."), do: b, else: "Elixir.#{b}"

        try do
          String.to_existing_atom(module_string)
        rescue
          ArgumentError -> b
        end

      b when is_atom(b) ->
        b
    end)
  end

  defp normalize_behaviors(_), do: []

  defp validate_key(errors, key) when is_binary(key) and byte_size(key) > 0 do
    if valid_identifier?(key) do
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

  defp validate_components(errors, components) when is_map(components), do: errors
  defp validate_components(errors, _), do: ["components must be a map" | errors]

  defp validate_behaviors(errors, behaviors) when is_list(behaviors) do
    invalid =
      behaviors
      |> Enum.filter(fn b -> not is_atom(b) end)

    if Enum.empty?(invalid) do
      errors
    else
      ["behaviors must be a list of module atoms, got invalid: #{inspect(invalid)}" | errors]
    end
  end

  defp validate_behaviors(errors, _), do: ["behaviors must be a list" | errors]

  defp validate_tags(errors, tags) when is_list(tags) do
    invalid = Enum.filter(tags, fn t -> not is_binary(t) end)

    if Enum.empty?(invalid) do
      errors
    else
      ["tags must be a list of strings" | errors]
    end
  end

  defp validate_tags(errors, _), do: ["tags must be a list" | errors]

  defp validate_exits(errors, exits) when is_map(exits), do: errors
  defp validate_exits(errors, _), do: ["exits must be a map" | errors]

  defp validate_spawns(errors, spawns) when is_list(spawns), do: errors
  defp validate_spawns(errors, _), do: ["spawns must be a list" | errors]

  defp valid_identifier?(key) do
    Regex.match?(~r/^[a-zA-Z][a-zA-Z0-9_-]*$/, key)
  end

  defp deep_merge(parent, child) when is_map(parent) and is_map(child) do
    Map.merge(parent, child, fn
      _key, parent_val, child_val when is_map(parent_val) and is_map(child_val) ->
        deep_merge(parent_val, child_val)

      _key, _parent_val, child_val ->
        child_val
    end)
  end

  defp deep_merge(_parent, child), do: child

  defp merge_lists(child, parent) when is_list(child) and is_list(parent) do
    (child ++ parent) |> Enum.uniq()
  end

  defp merge_lists(child, _parent) when is_list(child), do: child
  defp merge_lists(_child, parent) when is_list(parent), do: parent
  defp merge_lists(_, _), do: []

  defp maybe_override(entity, field, overrides) do
    case Map.get(overrides, field) do
      nil -> entity
      value -> Map.put(entity, field, value)
    end
  end
end
