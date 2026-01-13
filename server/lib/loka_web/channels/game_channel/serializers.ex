defmodule LokaWeb.Channels.GameChannel.Serializers do
  @moduledoc """
  Serialization functions for GameChannel payloads.

  Converts internal data structures to client-friendly JSON-serializable maps.
  """

  @doc """
  Serializes a room for client display.
  """
  def serialize_room(room) do
    %{
      id: room.id,
      title: room.title,
      description: room.description,
      exits: Enum.map(room.exits, &serialize_exit/1),
      entities: Enum.map(room.entities || [], &serialize_entity/1),
      items: Enum.map(room.items || [], &serialize_item/1),
      tags: room.tags || []
    }
  end

  @doc """
  Serializes a room exit.
  """
  def serialize_exit(exit) do
    %{
      direction: exit.direction,
      destination_id: exit.destination_id,
      description: Map.get(exit, :description)
    }
  end

  @doc """
  Serializes an entity (NPC, mob) for room display.
  """
  def serialize_entity(entity) do
    %{
      id: entity.id,
      key: Map.get(entity, :key),
      name: entity.name,
      type: Map.get(entity, :type, :npc),
      long_desc: Map.get(entity, :long_desc) || "",
      description: entity.description || Map.get(entity, :extra_desc),
      primary_keyword: Map.get(entity, :primary_keyword)
    }
  end

  @doc """
  Serializes basic entity context (without resolved actions).

  NOTE: Prefer using `Loka.Game.Actions.serialize_entity_context/3` which
  resolves actions based on player state, room context, and equipment.

  This function is kept for backwards compatibility but does not include
  the server-resolved actions.
  """
  @deprecated "Use serialize_entity_context/3 from Loka.Game.Actions instead"
  def serialize_entity_context(entity) do
    components = Map.get(entity, :components) || %{}

    component_keys =
      components
      |> Map.keys()
      |> Enum.map(&to_string/1)

    %{
      id: entity.id,
      name: entity.name,
      type: Map.get(entity, :type, :npc),
      long_desc: Map.get(entity, :long_desc) || "",
      description: entity.description || Map.get(entity, :extra_desc),
      primary_keyword: Map.get(entity, :primary_keyword),
      components: component_keys,
      tags: Map.get(entity, :tags) || [],
      actions: []
    }
  end

  @doc """
  Serializes an item for room display.
  """
  def serialize_item(item) do
    %{
      id: item.id,
      key: Map.get(item, :key),
      name: item.name,
      long_desc: Map.get(item, :long_desc) || "",
      description: item.description || Map.get(item, :desc),
      primary_keyword: Map.get(item, :primary_keyword)
    }
  end

  @doc """
  Serializes a list of players.
  """
  def serialize_players(players) do
    Enum.map(players, fn p ->
      %{
        id: p.id,
        name: p.name
      }
    end)
  end

  @doc """
  Serializes inventory items.
  Includes key and components for client-side action determination.
  """
  def serialize_inventory(items) do
    Enum.map(items, fn item ->
      components = Map.get(item, :components) || %{}

      # Extract just the component keys for the client
      component_keys =
        components
        |> Map.keys()
        |> Enum.map(&to_string/1)

      %{
        id: item.id,
        key: Map.get(item, :key),
        name: item.name,
        description: item.description,
        quantity: Map.get(item, :quantity, 1),
        components: component_keys
      }
    end)
  end

  @doc """
  Serializes equipped items by slot.
  """
  def serialize_equipped(equipped) do
    equipped
    |> Enum.filter(fn {_slot, item} -> item != nil end)
    |> Enum.map(fn {slot, item} ->
      {slot,
       %{
         id: item.id,
         name: item.name
       }}
    end)
    |> Map.new()
  end

  @doc """
  Serializes quest data.
  """
  def serialize_quests(quests) do
    Enum.map(quests, fn quest ->
      %{
        id: quest.id,
        title: Map.get(quest, :title) || Map.get(quest, :name),
        description: quest.description,
        objectives: quest.objectives
      }
    end)
  end

  @doc """
  Serializes resource pools (health, mana, mv).
  """
  def serialize_resources(pools) when is_map(pools) do
    pools
    |> Enum.map(fn {key, value} ->
      case value do
        %{current: current, max: max} ->
          {key, %{current: current, max: max}}

        %{"current" => current, "max" => max} ->
          {key, %{current: current, max: max}}

        _ ->
          {key, value}
      end
    end)
    |> Map.new()
  end

  def serialize_resources(_), do: %{}

  @doc """
  Serializes active timers for client display.
  """
  def serialize_timers(timers) do
    Enum.map(timers, fn timer ->
      %{
        id: timer.id,
        timer_type: timer.timer_type,
        duration_ms: timer.duration_ms,
        scheduled_at: timer.scheduled_at,
        completes_at: timer.completes_at,
        remaining_ms: Loka.Timers.Timer.remaining_ms(timer),
        data: timer.data
      }
    end)
  end

  @doc """
  Serializes calendar time for client display.
  Returns compact format for status bar display plus full data for menus.
  """
  def serialize_calendar(calendar_time) do
    branch = calendar_time.hour_branch
    month = calendar_time.month_info
    year = calendar_time.year_cycle
    moon = calendar_time.moon_phase

    %{
      # Compact format for status bar
      hour_char: branch.char,
      hour_animal: branch.animal,
      phase: calendar_time.phase,
      # Full date info
      day: calendar_time.day,
      month: calendar_time.month,
      month_name: month.name,
      month_char: month.char,
      year: calendar_time.year,
      year_animal: year.animal,
      year_element: year.element,
      year_char: year.char,
      # Moon phase info
      moon_phase: moon.key,
      moon_phase_name: moon.name,
      moon_phase_char: moon.char,
      moon_illumination: moon.illumination,
      # Solar term (if on special day)
      solar_term:
        if calendar_time.solar_term do
          %{
            name: calendar_time.solar_term.name,
            char: calendar_time.solar_term.char,
            major: calendar_time.solar_term.major
          }
        else
          nil
        end
    }
  end

  @doc """
  Serializes the visual state for environmental effects on the client.
  Includes time phase, weather, moon, and room-specific visual info.
  """
  def serialize_visual_state(opts \\ []) do
    alias Loka.Framework.World.DayNight
    alias Loka.Framework.World.Weather
    alias Loka.Framework.World.Calendar

    room = Keyword.get(opts, :room)
    player = Keyword.get(opts, :player)

    {hour, minute} = DayNight.get_time()
    phase = DayNight.get_phase()
    light_level = DayNight.get_light_level()
    weather = Weather.get_weather()
    moon = Calendar.get_moon_phase()

    # Get player's light source from equipped items
    player_light_source = get_player_light_source(player)

    # Determine if room is indoor based on tags
    is_indoor = room_is_indoor?(room)

    # Get biome from room tags or default
    biome = get_room_biome(room)

    %{
      # Time information
      phase: phase,
      hour: hour,
      minute: minute,
      light_level: light_level,

      # Moon information
      moon_phase: moon.key,
      moon_illumination: moon.illumination,

      # Weather
      weather: weather,

      # Player state
      player_light_source: player_light_source,

      # Room properties
      is_indoor: is_indoor,
      biome: biome
    }
  end

  # Get player's equipped light source
  defp get_player_light_source(nil), do: nil

  defp get_player_light_source(player) do
    equipped = Map.get(player, :equipped, %{})

    # Check for light-producing items in held slot or light slot
    light_item = Map.get(equipped, :light) || Map.get(equipped, :held)

    case light_item do
      nil ->
        nil

      item ->
        # Check item tags or type for light source classification
        tags = Map.get(item, :tags, [])

        cond do
          "lantern" in tags -> :lantern
          "torch" in tags -> :torch
          "candle" in tags -> :candle
          Map.get(item, :item_type) == "light" -> :torch
          true -> nil
        end
    end
  end

  # Check if room is indoor based on tags
  defp room_is_indoor?(nil), do: false

  defp room_is_indoor?(room) do
    tags = Map.get(room, :tags, [])
    "indoor" in tags or "cave" in tags or "building" in tags
  end

  # Get biome from room tags
  defp get_room_biome(nil), do: :default

  defp get_room_biome(room) do
    tags = Map.get(room, :tags, [])

    biome_tags = [
      :forest,
      :mountain,
      :cave,
      :village,
      :monastery,
      :market,
      :water,
      :desert,
      :swamp,
      :enchanted,
      :bardo
    ]

    Enum.find(biome_tags, :default, fn biome ->
      Atom.to_string(biome) in tags
    end)
  end

  @doc """
  Serializes the sound state for ambient audio on the client.
  Includes ambient sounds based on room tags, weather overlays, and light source sounds.

  The server computes which sounds should play; the client handles actual playback.
  """
  def serialize_sound_state(opts \\ []) do
    alias Loka.Framework.World.SoundEnvironment
    alias Loka.Framework.World.Weather
    alias Loka.Framework.World.DayNight

    room = Keyword.get(opts, :room)
    player = Keyword.get(opts, :player)

    # Get current weather
    weather = Weather.get_weather()

    # Get player's light source
    light_source = get_player_light_source(player)

    # Get active sounds from SoundEnvironment
    sounds =
      if room do
        SoundEnvironment.get_active_sounds(room, weather, light_source)
      else
        %{ambient: [], weather: [], light: [], is_indoor: false}
      end

    %{
      ambient: sounds.ambient,
      weather: sounds.weather,
      light: sounds.light,
      is_indoor: sounds.is_indoor,
      phase: DayNight.get_phase()
    }
  end
end
