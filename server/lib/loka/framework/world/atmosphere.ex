defmodule Loka.Framework.World.Atmosphere do
  @moduledoc """
  Combines weather and day/night into atmospheric descriptions for the UI.

  Provides evocative, literary descriptions that fit the "Living Ebook" aesthetic.

  ## Indoor vs Outdoor

  Rooms with the "indoor" tag will receive indoor-appropriate descriptions
  that don't reference outdoor weather like sun, rain, etc.

  Rooms with the "outdoor" tag (or no indoor/outdoor tag) receive full
  weather descriptions.
  """

  alias Loka.Framework.World.{Weather, DayNight}

  @doc """
  Gets the current atmospheric description combining weather and time of day.

  Returns a short, evocative sentence suitable for the game UI.

  ## Options

  - `indoor: true` - Returns indoor-appropriate descriptions (no weather)
  - `region: "region_name"` - Weather region (default: "default")

  ## Examples

      iex> Atmosphere.describe()
      "Rain falls softly in the morning light."

      iex> Atmosphere.describe(indoor: true)
      "Dust motes drift in the light."

      iex> Atmosphere.describe()
      "Stars glitter in the clear night sky."
  """
  def describe(opts \\ []) do
    indoor = Keyword.get(opts, :indoor, false)
    region = Keyword.get(opts, :region, "default")
    phase = get_phase()
    weather = get_weather(region)

    if indoor do
      indoor_description(phase)
    else
      combine_description(phase, weather)
    end
  end

  @doc """
  Gets atmospheric description with a pre-computed phase.

  Use this when calling from within the DayNight GenServer to avoid
  a self-call deadlock.
  """
  def describe_with_phase(phase, opts \\ []) do
    indoor = Keyword.get(opts, :indoor, false)
    region = Keyword.get(opts, :region, "default")
    weather = get_weather(region)

    if indoor do
      indoor_description(phase)
    else
      combine_description(phase, weather)
    end
  end

  @doc """
  Gets atmospheric description with pre-computed phase and weather.

  Use this when calling from within the Weather or DayNight GenServer
  to avoid self-call deadlocks.
  """
  def describe_with_phase_and_weather(phase, weather, opts \\ []) do
    indoor = Keyword.get(opts, :indoor, false)

    if indoor do
      indoor_description(phase)
    else
      combine_description(phase, weather)
    end
  end

  @doc """
  Gets an atmospheric description appropriate for the given room.

  Checks room tags to determine if it's indoor or outdoor and returns
  an appropriate description.
  """
  def describe_for_room(%{tags: tags}) when is_list(tags) do
    describe(indoor: "indoor" in tags)
  end

  def describe_for_room(%{"tags" => tags}) when is_list(tags) do
    describe(indoor: "indoor" in tags)
  end

  def describe_for_room(_), do: describe()

  @doc """
  Gets the current time phase (:dawn, :day, :dusk, :night).
  Returns :day if DayNight system is not running.
  """
  def get_phase do
    if Process.whereis(DayNight) do
      DayNight.get_phase()
    else
      :day
    end
  end

  @doc """
  Gets the current weather key ("clear", "rain", etc.).
  Returns "clear" if Weather system is not running.
  """
  def get_weather(region \\ "default") do
    if Process.whereis(Weather) do
      Weather.get_weather(region)
    else
      "clear"
    end
  end

  @doc """
  Gets the formatted game time (e.g., "2:30 PM").
  Returns nil if DayNight system is not running.
  """
  def get_formatted_time do
    if Process.whereis(DayNight) do
      DayNight.format_time()
    else
      nil
    end
  end

  @doc """
  Gets the current light level (0.0 to 1.0).
  Returns 1.0 if DayNight system is not running.
  """
  def get_light_level do
    if Process.whereis(DayNight) do
      DayNight.get_light_level()
    else
      1.0
    end
  end

  # Combine phase and weather into evocative descriptions
  defp combine_description(:dawn, "clear"), do: "The first light of dawn breaks over the horizon."
  defp combine_description(:dawn, "cloudy"), do: "Grey clouds greet the pale morning light."
  defp combine_description(:dawn, "rain"), do: "Rain falls softly as dawn breaks."
  defp combine_description(:dawn, "storm"), do: "Thunder rumbles in the stormy dawn."
  defp combine_description(:dawn, "fog"), do: "Morning fog blankets the world in grey."
  defp combine_description(:dawn, "snow"), do: "Snowflakes drift down in the pale dawn light."

  defp combine_description(:day, "clear"), do: "The sun shines brightly overhead."
  defp combine_description(:day, "cloudy"), do: "Grey clouds drift across the sky."
  defp combine_description(:day, "rain"), do: "Rain falls steadily from grey clouds."
  defp combine_description(:day, "storm"), do: "Thunder rumbles and lightning flashes."
  defp combine_description(:day, "fog"), do: "Thick fog limits visibility."
  defp combine_description(:day, "snow"), do: "Snowflakes drift down from the grey sky."

  defp combine_description(:dusk, "clear"),
    do: "The sun sets, painting the sky in orange and red."

  defp combine_description(:dusk, "cloudy"), do: "The sun sets behind grey clouds."
  defp combine_description(:dusk, "rain"), do: "Rain continues as darkness approaches."
  defp combine_description(:dusk, "storm"), do: "The storm rages as night approaches."
  defp combine_description(:dusk, "fog"), do: "Fog thickens as evening falls."
  defp combine_description(:dusk, "snow"), do: "Snow falls as the light fades."

  defp combine_description(:night, "clear"), do: "Stars glitter in the clear night sky."
  defp combine_description(:night, "cloudy"), do: "Clouds obscure the night sky."
  defp combine_description(:night, "rain"), do: "Rain patters in the darkness."
  defp combine_description(:night, "storm"), do: "Lightning illuminates the stormy night."
  defp combine_description(:night, "fog"), do: "Night fog swallows all light."
  defp combine_description(:night, "snow"), do: "Snow falls silently through the darkness."

  defp combine_description(_phase, _weather), do: "The world is quiet."

  # Indoor descriptions based on time of day (no weather references)
  defp indoor_description(:dawn), do: "Pale morning light filters through the windows."
  defp indoor_description(:day), do: "Dust motes drift in the light."
  defp indoor_description(:dusk), do: "The fading daylight casts long shadows."
  defp indoor_description(:night), do: "Candles flicker in the darkness."
  defp indoor_description(_), do: "The air is still."
end
