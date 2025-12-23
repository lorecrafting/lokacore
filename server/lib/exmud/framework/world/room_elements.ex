defmodule Exmud.Framework.World.RoomElements do
  @moduledoc """
  Environmental elements in rooms that affect gameplay.

  Room elements create dynamic interactions:
  - Water affects fire abilities
  - Darkness requires light sources
  - Elevation affects ranged combat
  - Terrain affects movement

  ## Room Element Configuration (YAML)

      # In room prototype
      components:
        elements:
          water:
            level: high        # none | low | medium | high
            type: river        # river | lake | rain | swamp
          darkness:
            level: total       # dim | dark | total
            light_required: true
          elevation:
            type: elevated     # ground | elevated | underground
            height: 2
          terrain:
            type: rough        # normal | rough | difficult | impassable
            movement_cost: 1.5
          temperature:
            level: cold        # freezing | cold | normal | hot | scorching
          vegetation:
            density: dense     # none | sparse | normal | dense
            type: forest

  ## Element Effects

  Elements provide modifiers that other systems can query:
  - Abilities check water level for fire/lightning damage
  - Combat checks darkness for accuracy
  - Movement checks terrain for speed
  - Gathering checks vegetation for yields
  """

  alias Exmud.Utils.MapHelpers

  @type element_level :: :none | :low | :medium | :high
  @type darkness_level :: :none | :dim | :dark | :total
  @type elevation_type :: :underground | :ground | :elevated
  @type terrain_type :: :normal | :rough | :difficult | :impassable
  @type temperature_level :: :freezing | :cold | :normal | :hot | :scorching

  @type room_elements :: %{
          water: %{level: element_level(), type: String.t() | nil},
          darkness: %{level: darkness_level(), light_required: boolean()},
          elevation: %{type: elevation_type(), height: integer()},
          terrain: %{type: terrain_type(), movement_cost: float()},
          temperature: %{level: temperature_level()},
          vegetation: %{density: element_level(), type: String.t() | nil}
        }

  @default_elements %{
    water: %{level: :none, type: nil},
    darkness: %{level: :none, light_required: false},
    elevation: %{type: :ground, height: 0},
    terrain: %{type: :normal, movement_cost: 1.0},
    temperature: %{level: :normal},
    vegetation: %{density: :none, type: nil}
  }

  @water_modifiers %{none: 0, low: 0.1, medium: 0.25, high: 0.5}
  @darkness_modifiers %{none: 0, dim: 0.1, dark: 0.25, total: 0.5}
  @terrain_costs %{normal: 1.0, rough: 1.25, difficult: 1.5, impassable: 999}
  @temperature_modifiers %{freezing: -2, cold: -1, normal: 0, hot: 1, scorching: 2}

  @doc """
  Gets all elements from a room entity.
  """
  def get_elements(nil), do: @default_elements

  def get_elements(room_entity) do
    components = Map.get(room_entity, :components, %{})
    elements_data = MapHelpers.get_flexible(components, :elements, %{})

    %{
      water: parse_water(elements_data),
      darkness: parse_darkness(elements_data),
      elevation: parse_elevation(elements_data),
      terrain: parse_terrain(elements_data),
      temperature: parse_temperature(elements_data),
      vegetation: parse_vegetation(elements_data)
    }
  end

  @doc """
  Gets a specific element from a room.
  """
  def get_element(room_entity, element_key) do
    elements = get_elements(room_entity)
    Map.get(elements, element_key)
  end

  @doc """
  Gets fire damage modifier based on water level.
  Positive values reduce fire damage.
  """
  def get_fire_modifier(room_entity) do
    elements = get_elements(room_entity)
    -Map.get(@water_modifiers, elements.water.level, 0)
  end

  @doc """
  Gets lightning damage modifier based on water level.
  Positive values increase lightning damage.
  """
  def get_lightning_modifier(room_entity) do
    elements = get_elements(room_entity)
    Map.get(@water_modifiers, elements.water.level, 0)
  end

  @doc """
  Gets accuracy modifier based on darkness.
  Negative values reduce accuracy.
  """
  def get_accuracy_modifier(room_entity, has_light_source \\ false) do
    elements = get_elements(room_entity)

    if has_light_source or elements.darkness.level == :none do
      0
    else
      -Map.get(@darkness_modifiers, elements.darkness.level, 0)
    end
  end

  @doc """
  Gets movement cost multiplier for the room.
  """
  def get_movement_cost(room_entity) do
    elements = get_elements(room_entity)
    Map.get(@terrain_costs, elements.terrain.type, 1.0)
  end

  @doc """
  Checks if light is required in the room.
  """
  def requires_light?(room_entity) do
    elements = get_elements(room_entity)
    elements.darkness.light_required
  end

  @doc """
  Checks if room is passable.
  """
  def passable?(room_entity) do
    elements = get_elements(room_entity)
    elements.terrain.type != :impassable
  end

  @doc """
  Gets temperature modifier for cold/fire effects.
  """
  def get_temperature_modifier(room_entity) do
    elements = get_elements(room_entity)
    Map.get(@temperature_modifiers, elements.temperature.level, 0)
  end

  @doc """
  Checks if room has water (for swimming, fishing, etc.)
  """
  def has_water?(room_entity) do
    elements = get_elements(room_entity)
    elements.water.level != :none
  end

  @doc """
  Checks if room has significant vegetation.
  """
  def has_vegetation?(room_entity) do
    elements = get_elements(room_entity)
    elements.vegetation.density in [:normal, :dense]
  end

  # =============================================================================
  # Parsing Helpers
  # =============================================================================

  defp parse_water(data) do
    water = MapHelpers.get_flexible(data, :water, %{})
    %{
      level: parse_level(MapHelpers.get_flexible(water, :level, :none)),
      type: MapHelpers.get_flexible(water, :type, nil)
    }
  end

  defp parse_darkness(data) do
    darkness = MapHelpers.get_flexible(data, :darkness, %{})
    %{
      level: parse_darkness_level(MapHelpers.get_flexible(darkness, :level, :none)),
      light_required: MapHelpers.get_flexible(darkness, :light_required, false)
    }
  end

  defp parse_elevation(data) do
    elevation = MapHelpers.get_flexible(data, :elevation, %{})
    %{
      type: parse_elevation_type(MapHelpers.get_flexible(elevation, :type, :ground)),
      height: MapHelpers.get_flexible(elevation, :height, 0)
    }
  end

  defp parse_terrain(data) do
    terrain = MapHelpers.get_flexible(data, :terrain, %{})
    terrain_type = parse_terrain_type(MapHelpers.get_flexible(terrain, :type, :normal))
    %{
      type: terrain_type,
      movement_cost: MapHelpers.get_flexible(terrain, :movement_cost, @terrain_costs[terrain_type])
    }
  end

  defp parse_temperature(data) do
    temperature = MapHelpers.get_flexible(data, :temperature, %{})
    %{
      level: parse_temperature_level(MapHelpers.get_flexible(temperature, :level, :normal))
    }
  end

  defp parse_vegetation(data) do
    vegetation = MapHelpers.get_flexible(data, :vegetation, %{})
    %{
      density: parse_level(MapHelpers.get_flexible(vegetation, :density, :none)),
      type: MapHelpers.get_flexible(vegetation, :type, nil)
    }
  end

  defp parse_level(level) when is_atom(level), do: level
  defp parse_level("none"), do: :none
  defp parse_level("low"), do: :low
  defp parse_level("medium"), do: :medium
  defp parse_level("high"), do: :high
  defp parse_level(_), do: :none

  defp parse_darkness_level(level) when is_atom(level), do: level
  defp parse_darkness_level("none"), do: :none
  defp parse_darkness_level("dim"), do: :dim
  defp parse_darkness_level("dark"), do: :dark
  defp parse_darkness_level("total"), do: :total
  defp parse_darkness_level(_), do: :none

  defp parse_elevation_type(type) when is_atom(type), do: type
  defp parse_elevation_type("underground"), do: :underground
  defp parse_elevation_type("ground"), do: :ground
  defp parse_elevation_type("elevated"), do: :elevated
  defp parse_elevation_type(_), do: :ground

  defp parse_terrain_type(type) when is_atom(type), do: type
  defp parse_terrain_type("normal"), do: :normal
  defp parse_terrain_type("rough"), do: :rough
  defp parse_terrain_type("difficult"), do: :difficult
  defp parse_terrain_type("impassable"), do: :impassable
  defp parse_terrain_type(_), do: :normal

  defp parse_temperature_level(level) when is_atom(level), do: level
  defp parse_temperature_level("freezing"), do: :freezing
  defp parse_temperature_level("cold"), do: :cold
  defp parse_temperature_level("normal"), do: :normal
  defp parse_temperature_level("hot"), do: :hot
  defp parse_temperature_level("scorching"), do: :scorching
  defp parse_temperature_level(_), do: :normal
end
