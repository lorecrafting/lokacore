defmodule Loka.Framework.World.ExtendedDescriptions do
  @moduledoc """
  Extended room descriptions that change based on context.

  Provides dynamic room descriptions based on:
  - Time of day (dawn, day, dusk, night)
  - Weather conditions
  - Player skills/perception
  - First visit vs return visit
  - Quest state

  ## Extended Description Configuration (YAML)

      # In room prototype
      components:
        extended_description:
          base: "A quiet forest clearing."
          time_variants:
            dawn: "Golden light filters through the morning mist."
            day: "Sunlight dapples through the canopy above."
            dusk: "Long shadows stretch across the clearing."
            night: "Moonlight casts an ethereal glow."
          weather_variants:
            rain: "Rain drips from the leaves overhead."
            storm: "Thunder echoes through the trees."
            fog: "Thick fog obscures your vision."
          perception_reveals:
            - skill: perception
              level: 5
              text: "You notice faint tracks leading north."
            - skill: herbalism
              level: 3
              text: "Several useful herbs grow near the eastern edge."
          first_visit: "You emerge into a clearing you've never seen before."
          secrets:
            - trigger: has_quest:forest_mystery
              text: "A strange symbol is carved into an old oak."
          smell: "The air smells of pine and wildflowers."
          sound: "Birds sing in the branches above."
          details:
            tree: "An ancient oak dominates the clearing."
            flowers: "Colorful wildflowers dot the grass."

  ## Usage

      alias Loka.Framework.World.ExtendedDescriptions

      # Get full description with context
      desc = ExtendedDescriptions.get_description(room_entity, %{
        time_phase: :day,
        weather: "clear",
        game_state: game_state,
        first_visit: true
      })

      # Get specific detail
      detail = ExtendedDescriptions.get_detail(room_entity, "tree")
  """

  alias Loka.Utils.MapHelpers

  @type description_context :: %{
          time_phase: atom(),
          weather: String.t(),
          game_state: map() | nil,
          first_visit: boolean()
        }

  @doc """
  Gets the full room description with all contextual additions.
  """
  def get_description(room_entity, context \\ %{}) do
    ext_desc = get_extended_description(room_entity)

    parts = [
      get_base_or_first_visit(ext_desc, context),
      get_time_variant(ext_desc, context),
      get_weather_variant(ext_desc, context),
      get_perception_reveals(ext_desc, context),
      get_secret_reveals(ext_desc, context)
    ]

    parts
    |> Enum.reject(&is_nil/1)
    |> Enum.reject(&(&1 == ""))
    |> Enum.join(" ")
  end

  @doc """
  Gets just the base description.
  """
  def get_base_description(room_entity) do
    ext_desc = get_extended_description(room_entity)
    ext_desc.base || room_entity[:description] || ""
  end

  @doc """
  Gets a specific detail from the room.
  """
  def get_detail(room_entity, detail_key) do
    ext_desc = get_extended_description(room_entity)
    Map.get(ext_desc.details, detail_key)
  end

  @doc """
  Lists all available details in a room.
  """
  def list_details(room_entity) do
    ext_desc = get_extended_description(room_entity)
    Map.keys(ext_desc.details)
  end

  @doc """
  Gets the smell description.
  """
  def get_smell(room_entity) do
    ext_desc = get_extended_description(room_entity)
    ext_desc.smell
  end

  @doc """
  Gets the sound description.
  """
  def get_sound(room_entity) do
    ext_desc = get_extended_description(room_entity)
    ext_desc.sound
  end

  @doc """
  Gets sensory descriptions (smell, sound combined).
  """
  def get_sensory(room_entity) do
    ext_desc = get_extended_description(room_entity)

    [ext_desc.smell, ext_desc.sound]
    |> Enum.reject(&is_nil/1)
    |> Enum.join(" ")
  end

  # =============================================================================
  # Private Implementation
  # =============================================================================

  defp get_extended_description(nil) do
    default_extended_description()
  end

  defp get_extended_description(room_entity) do
    components = Map.get(room_entity, :components, %{})
    ext_data = MapHelpers.get_flexible(components, :extended_description, %{})

    %{
      base: MapHelpers.get_flexible(ext_data, :base, nil),
      time_variants: parse_variants(MapHelpers.get_flexible(ext_data, :time_variants, %{})),
      weather_variants: parse_variants(MapHelpers.get_flexible(ext_data, :weather_variants, %{})),
      perception_reveals: parse_perception_reveals(ext_data),
      first_visit: MapHelpers.get_flexible(ext_data, :first_visit, nil),
      secrets: parse_secrets(ext_data),
      smell: MapHelpers.get_flexible(ext_data, :smell, nil),
      sound: MapHelpers.get_flexible(ext_data, :sound, nil),
      details: parse_details(MapHelpers.get_flexible(ext_data, :details, %{}))
    }
  end

  defp default_extended_description do
    %{
      base: nil,
      time_variants: %{},
      weather_variants: %{},
      perception_reveals: [],
      first_visit: nil,
      secrets: [],
      smell: nil,
      sound: nil,
      details: %{}
    }
  end

  defp parse_variants(variants) when is_map(variants) do
    Enum.map(variants, fn {key, value} ->
      atom_key =
        cond do
          is_atom(key) -> key
          is_binary(key) -> MapHelpers.safe_to_existing_atom(key) || key
          true -> key
        end

      {atom_key, value}
    end)
    |> Enum.into(%{})
  end

  defp parse_variants(_), do: %{}

  defp parse_perception_reveals(data) do
    reveals = MapHelpers.get_flexible(data, :perception_reveals, [])

    Enum.map(reveals, fn reveal ->
      %{
        skill: MapHelpers.get_flexible(reveal, :skill, "perception"),
        level: MapHelpers.get_flexible(reveal, :level, 1),
        text: MapHelpers.get_flexible(reveal, :text, "")
      }
    end)
  end

  defp parse_secrets(data) do
    secrets = MapHelpers.get_flexible(data, :secrets, [])

    Enum.map(secrets, fn secret ->
      %{
        trigger: MapHelpers.get_flexible(secret, :trigger, ""),
        text: MapHelpers.get_flexible(secret, :text, "")
      }
    end)
  end

  defp parse_details(details) when is_map(details), do: details
  defp parse_details(_), do: %{}

  defp get_base_or_first_visit(ext_desc, context) do
    if Map.get(context, :first_visit, false) and ext_desc.first_visit do
      ext_desc.first_visit
    else
      ext_desc.base
    end
  end

  defp get_time_variant(ext_desc, context) do
    time_phase = Map.get(context, :time_phase, :day)
    Map.get(ext_desc.time_variants, time_phase)
  end

  defp get_weather_variant(ext_desc, context) do
    weather = Map.get(context, :weather, "clear")

    weather_key =
      cond do
        is_atom(weather) -> weather
        is_binary(weather) -> MapHelpers.safe_to_existing_atom(weather) || weather
        true -> weather
      end

    Map.get(ext_desc.weather_variants, weather_key)
  end

  defp get_perception_reveals(ext_desc, context) do
    game_state = Map.get(context, :game_state)

    if game_state do
      skills = get_in(game_state, [:stats, :skills]) || %{}

      ext_desc.perception_reveals
      |> Enum.filter(fn reveal ->
        player_level = get_skill_level(skills, reveal.skill)
        player_level >= reveal.level
      end)
      |> Enum.map(& &1.text)
      |> Enum.join(" ")
    else
      nil
    end
  end

  defp get_secret_reveals(_ext_desc, _context) do
    # Would check quest state, etc.
    nil
  end

  defp get_skill_level(skills, skill_key) do
    skill_data = Map.get(skills, skill_key, %{})
    Map.get(skill_data, :level, 0)
  end
end
