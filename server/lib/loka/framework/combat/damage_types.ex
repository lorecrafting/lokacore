defmodule Loka.Framework.Combat.DamageTypes do
  @moduledoc """
  Physical damage type system for combat.

  Damage types define the physical nature of weapon attacks (slashing, piercing,
  bludgeoning) and how they interact with different armor types (cloth, leather,
  chain, plate, etc.).

  ## Damage Type Relationships

  - **Effective against**: Deals 125% damage (1.25x multiplier)
  - **Weak against**: Deals 75% damage (0.75x multiplier)
  - **Neutral**: Deals 100% damage (1.0x multiplier)

  ## Built-in Damage Types

  - `slashing` - Cutting attacks (swords, axes); Effective vs cloth, leather
  - `piercing` - Stabbing attacks (spears, daggers); Effective vs leather, hide
  - `bludgeoning` - Crushing attacks (maces, hammers); Effective vs metal, bone

  ## Built-in Armor Types

  - `cloth` - Light fabric (robes, clothing)
  - `leather` - Treated hides
  - `hide` - Thick animal skins
  - `chain` - Linked metal rings
  - `plate` - Solid metal plates
  - `bone` - Skeletal armor
  - `stone` - Rock or mineral-based
  - `scale` - Overlapping scales

  ## Usage

      alias Loka.Framework.Combat.DamageTypes

      # Get damage multiplier for slashing against cloth
      multiplier = DamageTypes.calculate_modifier(:slashing, :cloth)
      # => 1.25

      # Apply modifier to base damage
      DamageTypes.apply_modifier(20, :slashing, :cloth)
      # => 25

  ## YAML Configuration

  Damage types are loaded from `priv/world/combat/damage_types.yml`:

      damage_types:
        slashing:
          name: "Slashing"
          description: "Cutting attacks from bladed weapons"
          effective_against: [cloth, leather]
          weak_against: [plate, stone]

      armor_types:
        plate:
          name: "Plate Armor"
          description: "Heavy metal armor"
  """

  use GenServer
  require Logger

  alias Loka.Utils.MapHelpers

  @damage_types_table :loka_damage_types
  @armor_types_table :loka_armor_types

  # Default damage types if no YAML is loaded
  @default_damage_types %{
    slashing: %{
      key: :slashing,
      name: "Slashing",
      description: "Cutting attacks from bladed weapons",
      effective_against: [:cloth, :leather],
      weak_against: [:plate, :stone]
    },
    piercing: %{
      key: :piercing,
      name: "Piercing",
      description: "Stabbing attacks from pointed weapons",
      effective_against: [:leather, :hide],
      weak_against: [:plate, :chain]
    },
    bludgeoning: %{
      key: :bludgeoning,
      name: "Bludgeoning",
      description: "Crushing attacks from blunt weapons",
      effective_against: [:plate, :bone],
      weak_against: [:cloth, :leather]
    },
    # Hybrid types
    cleaving: %{
      key: :cleaving,
      name: "Cleaving",
      description: "Heavy chopping attacks that both cut and crush",
      effective_against: [:hide, :bone],
      weak_against: [:plate]
    }
  }

  @default_armor_types %{
    none: %{key: :none, name: "None", description: "No armor"},
    cloth: %{key: :cloth, name: "Cloth", description: "Light fabric protection"},
    leather: %{key: :leather, name: "Leather", description: "Treated hide armor"},
    hide: %{key: :hide, name: "Hide", description: "Thick animal skin"},
    chain: %{key: :chain, name: "Chain", description: "Linked metal rings"},
    plate: %{key: :plate, name: "Plate", description: "Solid metal plates"},
    bone: %{key: :bone, name: "Bone", description: "Skeletal armor"},
    stone: %{key: :stone, name: "Stone", description: "Rock-based armor"},
    scale: %{key: :scale, name: "Scale", description: "Overlapping scales"}
  }

  # Damage multipliers
  @effective_multiplier 1.25
  @weak_multiplier 0.75
  @neutral_multiplier 1.0

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts the DamageTypes GenServer.
  """
  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Gets a damage type definition by key.

  Returns `{:ok, damage_type}` or `{:error, :not_found}`.
  """
  def get_damage_type(key, server \\ __MODULE__) do
    key = normalize_key(key)
    GenServer.call(server, {:get_damage_type, key})
  end

  @doc """
  Gets an armor type definition by key.

  Returns `{:ok, armor_type}` or `{:error, :not_found}`.
  """
  def get_armor_type(key, server \\ __MODULE__) do
    key = normalize_key(key)
    GenServer.call(server, {:get_armor_type, key})
  end

  @doc """
  Returns all loaded damage types.
  """
  def all_damage_types(server \\ __MODULE__) do
    GenServer.call(server, :all_damage_types)
  end

  @doc """
  Returns all loaded armor types.
  """
  def all_armor_types(server \\ __MODULE__) do
    GenServer.call(server, :all_armor_types)
  end

  @doc """
  Calculates the damage multiplier for a damage type against an armor type.

  Returns a float multiplier (e.g., 1.25 for effective, 0.75 for weak, 1.0 for neutral).

  ## Examples

      iex> DamageTypes.calculate_modifier(:slashing, :cloth)
      1.25

      iex> DamageTypes.calculate_modifier(:slashing, :plate)
      0.75

      iex> DamageTypes.calculate_modifier(:slashing, :chain)
      1.0
  """
  def calculate_modifier(damage_type, armor_type, server \\ __MODULE__)

  def calculate_modifier(nil, _armor_type, _server), do: @neutral_multiplier
  def calculate_modifier(_damage_type, nil, _server), do: @neutral_multiplier
  def calculate_modifier(_damage_type, :none, _server), do: @neutral_multiplier

  def calculate_modifier(damage_type, armor_type, server) do
    damage_key = normalize_key(damage_type)
    armor_key = normalize_key(armor_type)

    case get_damage_type(damage_key, server) do
      {:ok, dt} ->
        cond do
          armor_key in dt.effective_against -> @effective_multiplier
          armor_key in dt.weak_against -> @weak_multiplier
          true -> @neutral_multiplier
        end

      {:error, :not_found} ->
        @neutral_multiplier
    end
  end

  @doc """
  Applies damage type modifier to base damage.

  Returns the modified damage amount (integer).

  ## Examples

      iex> DamageTypes.apply_modifier(20, :slashing, :cloth)
      25

      iex> DamageTypes.apply_modifier(20, :slashing, :plate)
      15
  """
  def apply_modifier(base_damage, damage_type, armor_type, server \\ __MODULE__) do
    multiplier = calculate_modifier(damage_type, armor_type, server)
    round(base_damage * multiplier)
  end

  @doc """
  Returns the relationship between a damage type and armor type.

  Returns `:effective`, `:weak`, or `:neutral`.
  """
  def get_relationship(damage_type, armor_type, server \\ __MODULE__)

  def get_relationship(nil, _armor, _server), do: :neutral
  def get_relationship(_damage, nil, _server), do: :neutral
  def get_relationship(_damage, :none, _server), do: :neutral

  def get_relationship(damage_type, armor_type, server) do
    damage_key = normalize_key(damage_type)
    armor_key = normalize_key(armor_type)

    case get_damage_type(damage_key, server) do
      {:ok, dt} ->
        cond do
          armor_key in dt.effective_against -> :effective
          armor_key in dt.weak_against -> :weak
          true -> :neutral
        end

      {:error, :not_found} ->
        :neutral
    end
  end

  @doc """
  Reloads damage types and armor types from YAML configuration.
  """
  def reload(server \\ __MODULE__) do
    GenServer.call(server, :reload)
  end

  @doc """
  Returns the effective/weak multiplier values.
  """
  def multipliers do
    %{
      effective: @effective_multiplier,
      weak: @weak_multiplier,
      neutral: @neutral_multiplier
    }
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(opts) do
    path = Keyword.get(opts, :path, "priv/world/combat/damage_types.yml")

    # Create ETS tables
    damage_table = :ets.new(@damage_types_table, [:set, :protected, read_concurrency: true])
    armor_table = :ets.new(@armor_types_table, [:set, :protected, read_concurrency: true])

    state = %{
      damage_table: damage_table,
      armor_table: armor_table,
      path: path,
      damage_types: %{},
      armor_types: %{}
    }

    # Load from YAML or use defaults
    state = load_types(state)

    Logger.info(
      "DamageTypes loaded #{map_size(state.damage_types)} damage types, " <>
        "#{map_size(state.armor_types)} armor types"
    )

    {:ok, state}
  end

  @impl true
  def handle_call({:get_damage_type, key}, _from, state) do
    result =
      case Map.get(state.damage_types, key) do
        nil -> {:error, :not_found}
        dt -> {:ok, dt}
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call({:get_armor_type, key}, _from, state) do
    result =
      case Map.get(state.armor_types, key) do
        nil -> {:error, :not_found}
        at -> {:ok, at}
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call(:all_damage_types, _from, state) do
    {:reply, Map.values(state.damage_types), state}
  end

  @impl true
  def handle_call(:all_armor_types, _from, state) do
    {:reply, Map.values(state.armor_types), state}
  end

  @impl true
  def handle_call(:reload, _from, state) do
    new_state = load_types(state)

    Logger.info(
      "DamageTypes reloaded #{map_size(new_state.damage_types)} damage types, " <>
        "#{map_size(new_state.armor_types)} armor types"
    )

    {:reply, :ok, new_state}
  end

  # =============================================================================
  # Private Functions
  # =============================================================================

  defp load_types(state) do
    full_path = resolve_path(state.path)

    {damage_types, armor_types} =
      if File.exists?(full_path) do
        case load_from_yaml(full_path) do
          {:ok, dt, at} -> {dt, at}
          {:error, _} -> {@default_damage_types, @default_armor_types}
        end
      else
        {@default_damage_types, @default_armor_types}
      end

    # Update ETS tables
    :ets.delete_all_objects(state.damage_table)
    :ets.delete_all_objects(state.armor_table)

    Enum.each(damage_types, fn {key, dt} ->
      :ets.insert(state.damage_table, {key, dt})
    end)

    Enum.each(armor_types, fn {key, at} ->
      :ets.insert(state.armor_table, {key, at})
    end)

    %{state | damage_types: damage_types, armor_types: armor_types}
  end

  # sobelow_skip ["Traversal.FileModule"] - path from Application.app_dir, not user input
  defp load_from_yaml(path) do
    with {:ok, content} <- File.read(path),
         {:ok, data} <- YamlElixir.read_from_string(content) do
      # Parse damage types
      damage_data = MapHelpers.get_flexible(data, :damage_types, %{})

      damage_types =
        Enum.reduce(damage_data, %{}, fn {key, value}, acc ->
          atom_key = normalize_key(key)

          dt = %{
            key: atom_key,
            name: MapHelpers.get_flexible(value, :name, to_string(key)),
            description: MapHelpers.get_flexible(value, :description, ""),
            effective_against:
              parse_type_list(MapHelpers.get_flexible(value, :effective_against, [])),
            weak_against: parse_type_list(MapHelpers.get_flexible(value, :weak_against, []))
          }

          Map.put(acc, atom_key, dt)
        end)

      # Parse armor types
      armor_data = MapHelpers.get_flexible(data, :armor_types, %{})

      armor_types =
        Enum.reduce(armor_data, %{}, fn {key, value}, acc ->
          atom_key = normalize_key(key)

          at = %{
            key: atom_key,
            name: MapHelpers.get_flexible(value, :name, to_string(key)),
            description: MapHelpers.get_flexible(value, :description, "")
          }

          Map.put(acc, atom_key, at)
        end)

      {:ok, damage_types, armor_types}
    end
  end

  defp parse_type_list(list) when is_list(list) do
    Enum.map(list, &normalize_key/1)
  end

  defp parse_type_list(_), do: []

  defp normalize_key(key) when is_atom(key), do: key

  # sobelow_skip ["DOS.StringToAtom"] - keys from internal YAML config files
  defp normalize_key(key) when is_binary(key) do
    String.to_existing_atom(key)
  rescue
    ArgumentError -> String.to_atom(key)
  end

  defp resolve_path(path) do
    if Path.type(path) == :absolute do
      path
    else
      Path.join(File.cwd!(), path)
    end
  end
end
