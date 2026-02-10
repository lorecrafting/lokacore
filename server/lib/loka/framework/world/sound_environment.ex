defmodule Loka.Framework.World.SoundEnvironment do
  @moduledoc """
  Manages ambient sound selection based on room tags, phase, and weather.

  ## Overview

  Sound environment provides a server-driven ambient sound system that mirrors
  the visual environmental effects. The server computes which sounds should play
  based on room properties, and the client handles actual audio playback.

  Sound keys are abstract identifiers that map to audio files on the client.
  This allows content creators to define sound mappings in YAML without touching code.

  ## Sound Layers

  1. **Ambient** - Base layer from room tags and phase (monastery bells, forest birds)
  2. **Weather** - Overlay sounds for weather conditions (rain, thunder, wind)
  3. **Light** - Light source sounds (torch crackling)

  ## Configuration

  Define in `priv/world/config/sound_mappings.yml`:

      tag_sounds:
        monastery:
          dawn: [temple_bells_distant, morning_prayers]
          day: [temple_bells, monks_chanting_soft]

      weather_sounds:
        rain: [rain_light]
        storm: [rain_heavy, thunder_rumble]

      light_sounds:
        torch: [torch_crackle]

  ## Room-specific Overrides

  Rooms can define custom sounds in YAML under `components.ambient_sounds`:

      components:
        ambient_sounds:
          dawn:
            - morning_prayers_temple
            - incense_burning
          night:
            - meditation_bells

  Room-specific sounds are added to (not replacing) tag-based sounds.
  """

  alias Loka.Engine.Entity
  alias Loka.Framework.World.DayNight

  require Logger

  alias Loka.Engine.Constants.WorldPaths

  # Load config at compile time (same pattern as RoomAmbient)
  @config_path WorldPaths.sound_mappings_file()
  @external_resource @config_path

  @sound_config (
                  path = Path.join(:code.priv_dir(:loka), "world/config/sound_mappings.yml")

                  if File.exists?(path) do
                    config = YamlElixir.read_from_file!(path)

                    # Parse tag_sounds: tag -> phase -> [sounds]
                    tag_sounds =
                      (config["tag_sounds"] || %{})
                      |> Enum.map(fn {tag, phases} ->
                        parsed_phases =
                          (phases || %{})
                          |> Enum.map(fn {phase, sounds} ->
                            {String.to_atom(phase), List.wrap(sounds)}
                          end)
                          |> Map.new()

                        {tag, parsed_phases}
                      end)
                      |> Map.new()

                    # Parse simple sound maps: key -> [sounds]
                    parse_simple = fn sounds_map ->
                      (sounds_map || %{})
                      |> Enum.map(fn {key, value} ->
                        {String.to_atom(key), List.wrap(value || [])}
                      end)
                      |> Map.new()
                    end

                    # Parse indoor modifier
                    modifier = config["indoor_modifier"] || %{}

                    indoor_modifier = %{
                      volume_reduction: modifier["volume_reduction"] || 0.3,
                      exclude_weather: modifier["exclude_weather"] != false
                    }

                    %{
                      tag_sounds: tag_sounds,
                      weather_sounds: parse_simple.(config["weather_sounds"]),
                      light_sounds: parse_simple.(config["light_sounds"]),
                      transition_sounds: parse_simple.(config["transition_sounds"]),
                      indoor_modifier: indoor_modifier
                    }
                  else
                    %{
                      tag_sounds: %{},
                      weather_sounds: %{},
                      light_sounds: %{},
                      transition_sounds: %{},
                      indoor_modifier: %{volume_reduction: 0.3, exclude_weather: true}
                    }
                  end
                )

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Gets active sounds for a room based on tags, phase, weather, and player state.

  Returns a map with:
  - `:ambient` - List of ambient sound keys
  - `:weather` - List of weather overlay sound keys
  - `:light` - List of light source sound keys
  - `:is_indoor` - Whether room is indoors (affects client volume)

  ## Example

      iex> SoundEnvironment.get_active_sounds(room_entity, :clear, nil)
      %{
        ambient: ["monastery_bells", "morning_prayers"],
        weather: [],
        light: [],
        is_indoor: false
      }
  """
  @spec get_active_sounds(Entity.t(), atom(), atom() | nil) :: map()
  def get_active_sounds(room_entity, weather \\ :clear, light_source \\ nil) do
    phase = get_current_phase()
    tags = get_room_tags(room_entity)
    is_indoor = has_tag?(tags, "indoor") or has_tag?(tags, :indoor)

    %{
      ambient: get_ambient_sounds(room_entity, tags, phase),
      weather: get_weather_sounds(weather, is_indoor),
      light: get_light_sounds(light_source),
      is_indoor: is_indoor
    }
  end

  @doc """
  Gets ambient sounds for a specific phase (for previewing in World Builder).
  """
  @spec get_ambient_sounds_for_phase(Entity.t(), atom()) :: [String.t()]
  def get_ambient_sounds_for_phase(room_entity, phase) do
    tags = get_room_tags(room_entity)
    get_ambient_sounds(room_entity, tags, phase)
  end

  @doc """
  Gets transition sounds for a phase change (one-shot sounds).
  """
  @spec get_transition_sounds(atom()) :: [String.t()]
  def get_transition_sounds(transition) do
    Map.get(@sound_config.transition_sounds, transition, [])
    |> Enum.map(&to_string/1)
  end

  @doc """
  Gets the sound config (for World Builder preview).
  """
  @spec get_config() :: map()
  def get_config, do: @sound_config

  @doc """
  Gets all configured tags (for World Builder).
  """
  @spec get_configured_tags() :: [String.t()]
  def get_configured_tags do
    @sound_config.tag_sounds
    |> Map.keys()
    |> Enum.map(&to_string/1)
    |> Enum.sort()
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp get_current_phase do
    if Process.whereis(DayNight) do
      DayNight.get_phase()
    else
      :day
    end
  end

  # Get ambient sounds from tags and room-specific config
  defp get_ambient_sounds(room_entity, tags, phase) do
    tag_sounds = get_tag_sounds(tags, phase)
    room_sounds = get_room_sounds(room_entity, phase)

    (tag_sounds ++ room_sounds)
    |> Enum.uniq()
    |> Enum.map(&to_string/1)
  end

  # Get sounds from tag-based config
  defp get_tag_sounds(tags, phase) do
    Enum.flat_map(tags, fn tag ->
      tag_key = normalize_tag(tag)

      case Map.get(@sound_config.tag_sounds, tag_key) do
        nil ->
          []

        phases ->
          # Get phase-specific sounds + "all" sounds (phase-independent)
          phase_sounds = Map.get(phases, phase, [])
          all_sounds = Map.get(phases, :all, [])
          phase_sounds ++ all_sounds
      end
    end)
  end

  # Get room-specific sounds from components
  defp get_room_sounds(room_entity, phase) do
    phase_str = Atom.to_string(phase)

    case room_entity do
      %{components: %{"ambient_sounds" => sounds}} when is_map(sounds) ->
        get_phase_sounds_from_config(sounds, phase_str, phase)

      %{components: %{ambient_sounds: sounds}} when is_map(sounds) ->
        get_phase_sounds_from_config(sounds, phase_str, phase)

      _ ->
        []
    end
  end

  defp get_phase_sounds_from_config(sounds, phase_str, phase) do
    phase_sounds = Map.get(sounds, phase_str, []) ++ Map.get(sounds, phase, [])
    all_sounds = Map.get(sounds, "all", []) ++ Map.get(sounds, :all, [])
    phase_sounds ++ all_sounds
  end

  # Get weather overlay sounds
  defp get_weather_sounds(weather, is_indoor) do
    # Don't play weather sounds indoors (if configured)
    if is_indoor and @sound_config.indoor_modifier.exclude_weather do
      []
    else
      weather_key = normalize_atom(weather)

      Map.get(@sound_config.weather_sounds, weather_key, [])
      |> Enum.map(&to_string/1)
    end
  end

  # Get light source sounds
  defp get_light_sounds(nil), do: []

  defp get_light_sounds(light_source) do
    light_key = normalize_atom(light_source)

    Map.get(@sound_config.light_sounds, light_key, [])
    |> Enum.map(&to_string/1)
  end

  # Extract tags from room entity
  defp get_room_tags(%{tags: tags}) when is_list(tags), do: tags
  defp get_room_tags(%{"tags" => tags}) when is_list(tags), do: tags
  defp get_room_tags(_), do: []

  # Check if tags contain a specific tag
  defp has_tag?(tags, tag) when is_binary(tag) do
    Enum.any?(tags, fn t ->
      to_string(t) == tag
    end)
  end

  defp has_tag?(tags, tag) when is_atom(tag) do
    tag_str = Atom.to_string(tag)

    Enum.any?(tags, fn t ->
      to_string(t) == tag_str or t == tag
    end)
  end

  # Normalize tag to atom for lookup
  defp normalize_tag(tag) when is_binary(tag), do: tag
  defp normalize_tag(tag) when is_atom(tag), do: Atom.to_string(tag)
  defp normalize_tag(_), do: ""

  # Normalize value to atom for lookup
  defp normalize_atom(value) when is_atom(value), do: value
  defp normalize_atom(value) when is_binary(value), do: String.to_atom(value)
  defp normalize_atom(_), do: :clear
end
