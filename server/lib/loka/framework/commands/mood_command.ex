defmodule Loka.Framework.Commands.MoodCommand do
  @moduledoc """
  Mood command for persistent emotional state.

  Allows players to set their current mood which modifies how their
  actions and emotes are perceived by others.

  ## Available Moods

  | Mood | Adverb | Description |
  |------|--------|-------------|
  | neutral | - | Default, no modifier |
  | cheerful | cheerfully | Happy and upbeat |
  | melancholy | sadly | Gloomy and pensive |
  | fierce | fiercely | Intense and aggressive |
  | distracted | absently | Not fully present |
  | formal | formally | Stiff and proper |
  | playful | playfully | Lighthearted and mischievous |
  | weary | wearily | Tired and drained |

  ## Usage

      mood                    # Show current mood
      mood cheerful           # Set mood to cheerful
      mood clear              # Return to neutral

  ## Visibility

  Others can see your mood when they look at you:

      look Alice
      > Alice is here, looking somewhat melancholy.

  ## Future Enhancements

  Mood could affect emote output:
      smile (while cheerful) → "You smile cheerfully."
  """

  use Loka.Engine.Command

  alias Loka.Framework.Social.{ScopedMessage, MessageRouter}

  # Curated mood list inspired by LegendMUD's extensive mood system
  # https://www.legendmud.org/index.php/Moods
  @moods [
    :neutral,
    :amused,
    :angry,
    :bored,
    :cheerful,
    :confident,
    :curious,
    :distracted,
    :dreamy,
    :fierce,
    :formal,
    :grateful,
    :melancholy,
    :nervous,
    :pensive,
    :playful,
    :proud,
    :relaxed,
    :serious,
    :shy,
    :suspicious,
    :weary,
    :wistful
  ]

  @mood_aliases %{
    # Direct matches
    "neutral" => :neutral,
    "clear" => :neutral,
    "none" => :neutral,
    "amused" => :amused,
    "angry" => :angry,
    "bored" => :bored,
    "cheerful" => :cheerful,
    "confident" => :confident,
    "curious" => :curious,
    "distracted" => :distracted,
    "dreamy" => :dreamy,
    "fierce" => :fierce,
    "formal" => :formal,
    "grateful" => :grateful,
    "melancholy" => :melancholy,
    "nervous" => :nervous,
    "pensive" => :pensive,
    "playful" => :playful,
    "proud" => :proud,
    "relaxed" => :relaxed,
    "serious" => :serious,
    "shy" => :shy,
    "suspicious" => :suspicious,
    "weary" => :weary,
    "wistful" => :wistful,
    # Aliases
    "happy" => :cheerful,
    "joyful" => :cheerful,
    "sad" => :melancholy,
    "gloomy" => :melancholy,
    "intense" => :fierce,
    "absent" => :distracted,
    "preoccupied" => :distracted,
    "proper" => :formal,
    "stiff" => :formal,
    "mischievous" => :playful,
    "silly" => :playful,
    "tired" => :weary,
    "exhausted" => :weary,
    "calm" => :relaxed,
    "peaceful" => :relaxed,
    "thoughtful" => :pensive,
    "anxious" => :nervous,
    "worried" => :nervous,
    "bold" => :confident,
    "intrigued" => :curious,
    "nostalgic" => :wistful,
    "thankful" => :grateful,
    "stern" => :serious,
    "grave" => :serious,
    "timid" => :shy,
    "bashful" => :shy,
    "wary" => :suspicious,
    "paranoid" => :suspicious
  }

  @impl true
  def key, do: "mood"

  @impl true
  def aliases, do: []

  @impl true
  def help do
    """
    mood [setting] - View or set your emotional state.

    Available moods:
      neutral     - Default, no mood modifier
      amused      - Finding humor in things
      angry       - Hot-tempered and irritable
      bored       - Lacking interest
      cheerful    - Happy and upbeat
      confident   - Self-assured and bold
      curious     - Eager to learn or explore
      distracted  - Not fully present
      dreamy      - Lost in thought or fantasy
      fierce      - Intense and aggressive
      formal      - Stiff and proper
      grateful    - Thankful and appreciative
      melancholy  - Gloomy and pensive
      nervous     - Anxious and uneasy
      pensive     - Deep in thought
      playful     - Lighthearted and mischievous
      proud       - Satisfied with oneself
      relaxed     - Calm and at ease
      serious     - Grave and earnest
      shy         - Timid and reserved
      suspicious  - Wary and distrustful
      weary       - Tired and drained
      wistful     - Longing and nostalgic

    Examples:
      mood              - Show your current mood
      mood cheerful     - Set mood to cheerful
      mood clear        - Return to neutral

    Your mood affects how others perceive you.
    """
  end

  @impl true
  def parse(args, _context) do
    args = String.trim(args)

    cond do
      # No args - show current mood
      args == "" ->
        {:ok, %{action: :show}}

      # Parse mood keyword
      true ->
        case parse_mood(args) do
          {:ok, mood} ->
            {:ok, %{action: :set, mood: mood}}

          {:error, _} ->
            {:error,
             "Unknown mood '#{args}'. Try: cheerful, melancholy, fierce, distracted, formal, playful, weary, or clear."}
        end
    end
  end

  @impl true
  def execute(%{action: :show}, context) do
    game_state = Map.get(context, :game_state, %{})
    mood = get_mood(game_state)
    mood_text = format_mood_display(mood)

    {:ok,
     [
       %{
         type: :info,
         text: mood_text,
         recipient: :actor
       }
     ]}
  end

  def execute(%{action: :set, mood: mood}, context) do
    actor = Map.get(context, :actor)
    location = Map.get(context, :location)
    room_id = get_room_id(location)

    events = [
      %{
        type: :info,
        text: mood_set_message(mood),
        recipient: :actor
      },
      %{
        type: :state_update,
        updates: %{
          social: %{
            mood: %{
              current: mood,
              updated_at: DateTime.utc_now()
            }
          }
        }
      }
    ]

    # Broadcast mood change to room if not neutral
    if mood != :neutral && room_id do
      msg =
        ScopedMessage.new(:room, mood_room_message(actor, mood), actor,
          location: room_id,
          message_type: :emote
        )

      MessageRouter.route(msg)
    end

    {:ok, events}
  end

  # =============================================================================
  # Public API for other modules
  # =============================================================================

  @doc """
  Returns the list of valid mood values.
  """
  def valid_moods, do: @moods

  @doc """
  Gets the adverb form of a mood for modifying action text.

  ## Examples

      iex> MoodCommand.mood_adverb(:cheerful)
      "cheerfully"

      iex> MoodCommand.mood_adverb(:neutral)
      nil
  """
  def mood_adverb(:neutral), do: nil
  def mood_adverb(:amused), do: "with amusement"
  def mood_adverb(:angry), do: "angrily"
  def mood_adverb(:bored), do: "boredly"
  def mood_adverb(:cheerful), do: "cheerfully"
  def mood_adverb(:confident), do: "confidently"
  def mood_adverb(:curious), do: "curiously"
  def mood_adverb(:distracted), do: "absently"
  def mood_adverb(:dreamy), do: "dreamily"
  def mood_adverb(:fierce), do: "fiercely"
  def mood_adverb(:formal), do: "formally"
  def mood_adverb(:grateful), do: "gratefully"
  def mood_adverb(:melancholy), do: "sadly"
  def mood_adverb(:nervous), do: "nervously"
  def mood_adverb(:pensive), do: "pensively"
  def mood_adverb(:playful), do: "playfully"
  def mood_adverb(:proud), do: "proudly"
  def mood_adverb(:relaxed), do: "calmly"
  def mood_adverb(:serious), do: "seriously"
  def mood_adverb(:shy), do: "shyly"
  def mood_adverb(:suspicious), do: "suspiciously"
  def mood_adverb(:weary), do: "wearily"
  def mood_adverb(:wistful), do: "wistfully"
  def mood_adverb(_), do: nil

  @doc """
  Gets the mood description for display when looking at a player.

  ## Examples

      iex> MoodCommand.mood_look_description(:cheerful)
      "looking cheerful"

      iex> MoodCommand.mood_look_description(:neutral)
      nil
  """
  def mood_look_description(:neutral), do: nil
  def mood_look_description(:amused), do: "with an amused expression"
  def mood_look_description(:angry), do: "looking angry"
  def mood_look_description(:bored), do: "looking bored"
  def mood_look_description(:cheerful), do: "looking cheerful"
  def mood_look_description(:confident), do: "looking confident"
  def mood_look_description(:curious), do: "with a curious look"
  def mood_look_description(:distracted), do: "looking distracted"
  def mood_look_description(:dreamy), do: "with a dreamy expression"
  def mood_look_description(:fierce), do: "looking fierce"
  def mood_look_description(:formal), do: "maintaining formal composure"
  def mood_look_description(:grateful), do: "looking grateful"
  def mood_look_description(:melancholy), do: "looking somewhat melancholy"
  def mood_look_description(:nervous), do: "looking nervous"
  def mood_look_description(:pensive), do: "lost in thought"
  def mood_look_description(:playful), do: "with a playful gleam in their eyes"
  def mood_look_description(:proud), do: "looking proud"
  def mood_look_description(:relaxed), do: "looking relaxed"
  def mood_look_description(:serious), do: "looking serious"
  def mood_look_description(:shy), do: "looking shy"
  def mood_look_description(:suspicious), do: "looking suspicious"
  def mood_look_description(:weary), do: "looking weary"
  def mood_look_description(:wistful), do: "with a wistful expression"
  def mood_look_description(_), do: nil

  @doc """
  Applies mood modifier to an action message.

  Replaces common adverbs with mood-specific ones.

  ## Examples

      iex> MoodCommand.apply_mood("You smile happily.", :cheerful)
      "You smile cheerfully."

      iex> MoodCommand.apply_mood("You wave.", :neutral)
      "You wave."
  """
  def apply_mood(message, :neutral), do: message

  def apply_mood(message, mood) do
    adverb = mood_adverb(mood)

    if adverb do
      # Replace common emote adverbs with mood-specific ones
      message
      |> String.replace("happily", adverb)
      |> String.replace("warmly", adverb)
      |> String.replace("friendly", adverb)
    else
      message
    end
  end

  # =============================================================================
  # Private
  # =============================================================================

  defp parse_mood(input) do
    key = input |> String.downcase() |> String.trim()

    case Map.get(@mood_aliases, key) do
      nil -> {:error, :invalid_mood}
      mood -> {:ok, mood}
    end
  end

  defp get_mood(game_state) do
    game_state
    |> Map.get(:social, %{})
    |> Map.get(:mood, %{})
    |> Map.get(:current, :neutral)
  end

  defp format_mood_display(mood) do
    label = mood_label(mood)
    description = mood_description(mood)
    "Your mood: #{label} - #{description}"
  end

  defp mood_set_message(:neutral) do
    "You return to a neutral state of mind."
  end

  defp mood_set_message(mood) do
    label = mood_label(mood)
    "You are now feeling #{label}."
  end

  defp mood_room_message(actor, mood) do
    name = get_actor_name(actor)
    description = mood_look_description(mood)

    if description do
      "#{name} is now #{description}."
    else
      ""
    end
  end

  defp mood_label(:neutral), do: "neutral"
  defp mood_label(:amused), do: "amused"
  defp mood_label(:angry), do: "angry"
  defp mood_label(:bored), do: "bored"
  defp mood_label(:cheerful), do: "cheerful"
  defp mood_label(:confident), do: "confident"
  defp mood_label(:curious), do: "curious"
  defp mood_label(:distracted), do: "distracted"
  defp mood_label(:dreamy), do: "dreamy"
  defp mood_label(:fierce), do: "fierce"
  defp mood_label(:formal), do: "formal"
  defp mood_label(:grateful), do: "grateful"
  defp mood_label(:melancholy), do: "melancholy"
  defp mood_label(:nervous), do: "nervous"
  defp mood_label(:pensive), do: "pensive"
  defp mood_label(:playful), do: "playful"
  defp mood_label(:proud), do: "proud"
  defp mood_label(:relaxed), do: "relaxed"
  defp mood_label(:serious), do: "serious"
  defp mood_label(:shy), do: "shy"
  defp mood_label(:suspicious), do: "suspicious"
  defp mood_label(:weary), do: "weary"
  defp mood_label(:wistful), do: "wistful"
  defp mood_label(_), do: "unknown"

  defp mood_description(:neutral), do: "Your mind is clear and balanced."
  defp mood_description(:amused), do: "You find humor in things around you."
  defp mood_description(:angry), do: "Hot temper simmers beneath the surface."
  defp mood_description(:bored), do: "Nothing seems to hold your interest."
  defp mood_description(:cheerful), do: "You feel happy and upbeat."
  defp mood_description(:confident), do: "Self-assurance radiates from you."
  defp mood_description(:curious), do: "Everything piques your interest."
  defp mood_description(:distracted), do: "Your thoughts wander elsewhere."
  defp mood_description(:dreamy), do: "Your mind drifts to distant places."
  defp mood_description(:fierce), do: "Intensity burns within you."
  defp mood_description(:formal), do: "You maintain proper composure."
  defp mood_description(:grateful), do: "Thankfulness fills your heart."
  defp mood_description(:melancholy), do: "A pensive gloom weighs on you."
  defp mood_description(:nervous), do: "Anxiety keeps you on edge."
  defp mood_description(:pensive), do: "Deep thoughts occupy your mind."
  defp mood_description(:playful), do: "A mischievous energy fills you."
  defp mood_description(:proud), do: "Satisfaction in yourself runs deep."
  defp mood_description(:relaxed), do: "A calm ease settles over you."
  defp mood_description(:serious), do: "Gravity marks your demeanor."
  defp mood_description(:shy), do: "You prefer to stay in the background."
  defp mood_description(:suspicious), do: "Wariness colors your perception."
  defp mood_description(:weary), do: "Fatigue drags at your spirit."
  defp mood_description(:wistful), do: "Longing for something just out of reach."
  defp mood_description(_), do: ""

  defp get_room_id(nil), do: nil
  defp get_room_id(%{id: id}), do: id
  defp get_room_id(room_id) when is_binary(room_id), do: room_id
  defp get_room_id(_), do: nil

  defp get_actor_name(nil), do: "Someone"

  defp get_actor_name(actor) when is_map(actor) do
    Map.get(actor, :short_desc) ||
      Map.get(actor, :character_name) ||
      Map.get(actor, :name) ||
      "Someone"
  end

  defp get_actor_name(_), do: "Someone"
end
