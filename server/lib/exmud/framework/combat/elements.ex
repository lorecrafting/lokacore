defmodule Exmud.Framework.Combat.Elements do
  @moduledoc """
  Elemental damage type system for combat.

  Elements define magical or energy-based damage types with strengths and
  weaknesses against other elements. When an attack has an element and the
  target has an elemental affinity, damage is modified based on their
  relationship.

  ## Element Relationships

  - **Strong against**: Deals 150% damage (1.5x multiplier)
  - **Weak against**: Deals 50% damage (0.5x multiplier)
  - **Neutral**: Deals 100% damage (1.0x multiplier)

  ## Built-in Elements

  - `fire` - Strong vs ice, plant; Weak vs water, earth
  - `water` - Strong vs fire, earth; Weak vs lightning, ice
  - `lightning` - Strong vs water, metal; Weak vs earth, wood
  - `earth` - Strong vs lightning, poison; Weak vs water, plant
  - `ice` - Strong vs water, plant; Weak vs fire, metal
  - `plant` - Strong vs earth, water; Weak vs fire, ice
  - `poison` - Strong vs plant, flesh; Weak vs earth, metal
  - `metal` - Strong vs ice, bone; Weak vs lightning, fire
  - `light` - Strong vs shadow, undead; Weak vs none
  - `shadow` - Strong vs light, mind; Weak vs light

  ## Usage

      alias Exmud.Framework.Combat.Elements

      # Get damage multiplier for fire attacking ice
      multiplier = Elements.calculate_modifier(:fire, :ice)
      # => 1.5

      # Calculate modified damage
      base_damage = 20
      final_damage = Elements.apply_modifier(base_damage, :fire, :ice)
      # => 30

  ## YAML Configuration

  Elements are loaded from `priv/world/combat/elements.yml`:

      elements:
        fire:
          name: "Fire"
          strong_against: [ice, plant]
          weak_against: [water, earth]
          color: red
  """

  use GenServer
  require Logger

  alias Exmud.Utils.MapHelpers

  @elements_table :exmud_elements

  # Default elements if no YAML is loaded
  @default_elements %{
    fire: %{
      key: :fire,
      name: "Fire",
      strong_against: [:ice, :plant],
      weak_against: [:water, :earth],
      color: "red"
    },
    water: %{
      key: :water,
      name: "Water",
      strong_against: [:fire, :earth],
      weak_against: [:lightning, :ice],
      color: "blue"
    },
    lightning: %{
      key: :lightning,
      name: "Lightning",
      strong_against: [:water, :metal],
      weak_against: [:earth, :wood],
      color: "yellow"
    },
    earth: %{
      key: :earth,
      name: "Earth",
      strong_against: [:lightning, :poison],
      weak_against: [:water, :plant],
      color: "brown"
    },
    ice: %{
      key: :ice,
      name: "Ice",
      strong_against: [:water, :plant],
      weak_against: [:fire, :metal],
      color: "cyan"
    },
    plant: %{
      key: :plant,
      name: "Plant",
      strong_against: [:earth, :water],
      weak_against: [:fire, :ice],
      color: "green"
    },
    poison: %{
      key: :poison,
      name: "Poison",
      strong_against: [:plant, :flesh],
      weak_against: [:earth, :metal],
      color: "purple"
    },
    metal: %{
      key: :metal,
      name: "Metal",
      strong_against: [:ice, :bone],
      weak_against: [:lightning, :fire],
      color: "silver"
    },
    light: %{
      key: :light,
      name: "Light",
      strong_against: [:shadow, :undead],
      weak_against: [],
      color: "white"
    },
    shadow: %{
      key: :shadow,
      name: "Shadow",
      strong_against: [:light, :mind],
      weak_against: [:light],
      color: "black"
    }
  }

  # Damage multipliers
  @strong_multiplier 1.5
  @weak_multiplier 0.5
  @neutral_multiplier 1.0

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts the Elements GenServer.
  """
  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc """
  Gets an element definition by key.

  Returns `{:ok, element}` or `{:error, :not_found}`.
  """
  def get(key, server \\ __MODULE__) do
    key = normalize_key(key)
    GenServer.call(server, {:get, key})
  end

  @doc """
  Returns all loaded elements.
  """
  def all(server \\ __MODULE__) do
    GenServer.call(server, :all)
  end

  @doc """
  Calculates the damage multiplier for an attack element against a target element.

  Returns a float multiplier (e.g., 1.5 for strong, 0.5 for weak, 1.0 for neutral).

  ## Examples

      iex> Elements.calculate_modifier(:fire, :ice)
      1.5

      iex> Elements.calculate_modifier(:fire, :water)
      0.5

      iex> Elements.calculate_modifier(:fire, :lightning)
      1.0
  """
  def calculate_modifier(attack_element, target_element, server \\ __MODULE__)

  def calculate_modifier(nil, _target_element, _server), do: @neutral_multiplier
  def calculate_modifier(_attack_element, nil, _server), do: @neutral_multiplier

  def calculate_modifier(attack_element, target_element, server) do
    attack_key = normalize_key(attack_element)
    target_key = normalize_key(target_element)

    case get(attack_key, server) do
      {:ok, element} ->
        cond do
          target_key in element.strong_against -> @strong_multiplier
          target_key in element.weak_against -> @weak_multiplier
          true -> @neutral_multiplier
        end

      {:error, :not_found} ->
        @neutral_multiplier
    end
  end

  @doc """
  Applies elemental modifier to base damage.

  Returns the modified damage amount (integer).

  ## Examples

      iex> Elements.apply_modifier(20, :fire, :ice)
      30

      iex> Elements.apply_modifier(20, :fire, :water)
      10
  """
  def apply_modifier(base_damage, attack_element, target_element, server \\ __MODULE__) do
    multiplier = calculate_modifier(attack_element, target_element, server)
    round(base_damage * multiplier)
  end

  @doc """
  Returns the relationship between two elements.

  Returns `:strong`, `:weak`, or `:neutral`.
  """
  def get_relationship(attack_element, target_element, server \\ __MODULE__)

  def get_relationship(nil, _target, _server), do: :neutral
  def get_relationship(_attack, nil, _server), do: :neutral

  def get_relationship(attack_element, target_element, server) do
    attack_key = normalize_key(attack_element)
    target_key = normalize_key(target_element)

    case get(attack_key, server) do
      {:ok, element} ->
        cond do
          target_key in element.strong_against -> :strong
          target_key in element.weak_against -> :weak
          true -> :neutral
        end

      {:error, :not_found} ->
        :neutral
    end
  end

  @doc """
  Returns the color associated with an element (for UI display).
  """
  def get_color(element_key, server \\ __MODULE__) do
    case get(element_key, server) do
      {:ok, element} -> element.color
      {:error, :not_found} -> "gray"
    end
  end

  @doc """
  Reloads elements from YAML configuration.
  """
  def reload(server \\ __MODULE__) do
    GenServer.call(server, :reload)
  end

  @doc """
  Returns the strong/weak multiplier values.
  """
  def multipliers do
    %{
      strong: @strong_multiplier,
      weak: @weak_multiplier,
      neutral: @neutral_multiplier
    }
  end

  # =============================================================================
  # GenServer Callbacks
  # =============================================================================

  @impl true
  def init(opts) do
    path = Keyword.get(opts, :path, "priv/world/combat/elements.yml")

    # Create ETS table for element storage
    table = :ets.new(@elements_table, [:set, :protected, read_concurrency: true])

    state = %{
      table: table,
      path: path,
      elements: %{}
    }

    # Load from YAML or use defaults
    state = load_elements(state)

    Logger.info("Elements loaded #{map_size(state.elements)} element types")

    {:ok, state}
  end

  @impl true
  def handle_call({:get, key}, _from, state) do
    result =
      case Map.get(state.elements, key) do
        nil -> {:error, :not_found}
        element -> {:ok, element}
      end

    {:reply, result, state}
  end

  @impl true
  def handle_call(:all, _from, state) do
    {:reply, Map.values(state.elements), state}
  end

  @impl true
  def handle_call(:reload, _from, state) do
    new_state = load_elements(state)
    Logger.info("Elements reloaded #{map_size(new_state.elements)} element types")
    {:reply, :ok, new_state}
  end

  # =============================================================================
  # Private Functions
  # =============================================================================

  defp load_elements(state) do
    full_path = resolve_path(state.path)

    elements =
      if File.exists?(full_path) do
        case load_from_yaml(full_path) do
          {:ok, loaded} -> loaded
          {:error, _} -> @default_elements
        end
      else
        @default_elements
      end

    # Update ETS
    :ets.delete_all_objects(state.table)

    Enum.each(elements, fn {key, element} ->
      :ets.insert(state.table, {key, element})
    end)

    %{state | elements: elements}
  end

  defp load_from_yaml(path) do
    with {:ok, content} <- File.read(path),
         {:ok, data} <- YamlElixir.read_from_string(content) do
      elements_data = MapHelpers.get_flexible(data, :elements, %{})

      elements =
        Enum.reduce(elements_data, %{}, fn {key, value}, acc ->
          atom_key = normalize_key(key)

          element = %{
            key: atom_key,
            name: MapHelpers.get_flexible(value, :name, to_string(key)),
            strong_against: parse_element_list(MapHelpers.get_flexible(value, :strong_against, [])),
            weak_against: parse_element_list(MapHelpers.get_flexible(value, :weak_against, [])),
            color: MapHelpers.get_flexible(value, :color, "gray")
          }

          Map.put(acc, atom_key, element)
        end)

      {:ok, elements}
    end
  end

  defp parse_element_list(list) when is_list(list) do
    Enum.map(list, &normalize_key/1)
  end

  defp parse_element_list(_), do: []

  defp normalize_key(key) when is_atom(key), do: key

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
