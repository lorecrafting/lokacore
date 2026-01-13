defmodule Loka.Game.CommandParser do
  @moduledoc """
  Parses text commands from MUD-style input.

  Supports classic MUD commands with aliases:
  - Movement: north/n, south/s, east/e, west/w, up/u, down/d
  - Looking: look/l, examine/ex
  - Communication: say, shout, yell, whisper
  - Interaction: talk, get/take, drop, give
  - Inventory: inventory/inv/i, equipment/eq
  - Combat: attack/kill, flee
  - Info: help, who, score
  """

  @direction_aliases %{
    "n" => "north",
    "s" => "south",
    "e" => "east",
    "w" => "west",
    "u" => "up",
    "d" => "down",
    "ne" => "northeast",
    "nw" => "northwest",
    "se" => "southeast",
    "sw" => "southwest"
  }

  @type command ::
          {:move, String.t()}
          | {:look, String.t() | nil}
          | {:say, String.t()}
          | {:shout, String.t()}
          | {:yell, String.t()}
          | {:whisper, String.t(), String.t()}
          | {:talk, String.t()}
          | {:get, String.t()}
          | {:drop, String.t()}
          | {:inventory, nil}
          | {:equipment, nil}
          | {:attack, String.t()}
          | {:flee, nil}
          | {:help, String.t() | nil}
          | {:who, nil}
          | {:score, nil}
          | {:emote, String.t()}
          | {:unknown, String.t()}

  @doc """
  Parse a command string into a structured command tuple.

  ## Examples

      iex> CommandParser.parse("north")
      {:move, "north"}

      iex> CommandParser.parse("n")
      {:move, "north"}

      iex> CommandParser.parse("look")
      {:look, nil}

      iex> CommandParser.parse("look monk")
      {:look, "monk"}

      iex> CommandParser.parse("say hello everyone")
      {:say, "hello everyone"}

      iex> CommandParser.parse("'hello everyone")
      {:say, "hello everyone"}
  """
  @spec parse(String.t()) :: command()
  def parse(input) do
    input
    |> String.trim()
    |> String.downcase()
    |> do_parse()
  end

  # Movement - single letter or full direction
  defp do_parse(dir)
       when dir in ~w(north south east west up down northeast northwest southeast southwest) do
    {:move, dir}
  end

  defp do_parse(alias) when is_map_key(@direction_aliases, alias) do
    {:move, @direction_aliases[alias]}
  end

  # Look
  defp do_parse("look"), do: {:look, nil}
  defp do_parse("l"), do: {:look, nil}
  defp do_parse("look " <> target), do: {:look, target}
  defp do_parse("l " <> target), do: {:look, target}
  defp do_parse("examine " <> target), do: {:look, target}
  defp do_parse("ex " <> target), do: {:look, target}

  # Say - with quote shortcut
  defp do_parse("say " <> message), do: {:say, message}
  defp do_parse("'" <> message), do: {:say, message}

  # Shout/Yell
  defp do_parse("shout " <> message), do: {:shout, message}
  defp do_parse("yell " <> message), do: {:yell, message}

  # Whisper
  defp do_parse("whisper " <> rest) do
    case String.split(rest, " ", parts: 2) do
      [target, message] -> {:whisper, target, message}
      [target] -> {:whisper, target, ""}
    end
  end

  # Talk to NPC
  defp do_parse("talk " <> target), do: {:talk, target}
  defp do_parse("talk"), do: {:talk, nil}

  # Get/Take items
  defp do_parse("get " <> item), do: {:get, item}
  defp do_parse("take " <> item), do: {:get, item}
  defp do_parse("get"), do: {:get, nil}
  defp do_parse("take"), do: {:get, nil}

  # Drop items
  defp do_parse("drop " <> item), do: {:drop, item}
  defp do_parse("drop"), do: {:drop, nil}

  # Inventory
  defp do_parse("inventory"), do: {:inventory, nil}
  defp do_parse("inv"), do: {:inventory, nil}
  defp do_parse("i"), do: {:inventory, nil}

  # Equipment
  defp do_parse("equipment"), do: {:equipment, nil}
  defp do_parse("eq"), do: {:equipment, nil}

  # Combat
  defp do_parse("attack " <> target), do: {:attack, target}
  defp do_parse("kill " <> target), do: {:attack, target}
  defp do_parse("flee"), do: {:flee, nil}

  # Info commands
  defp do_parse("help"), do: {:help, nil}
  defp do_parse("help " <> topic), do: {:help, topic}
  defp do_parse("?"), do: {:help, nil}
  defp do_parse("who"), do: {:who, nil}
  defp do_parse("score"), do: {:score, nil}
  defp do_parse("stats"), do: {:score, nil}

  # Emote
  defp do_parse("emote " <> action), do: {:emote, action}
  defp do_parse(":" <> action), do: {:emote, action}

  # Unknown command
  defp do_parse(input), do: {:unknown, input}

  @doc """
  Returns help text for commands.
  """
  @spec help(String.t() | nil) :: String.t()
  def help(nil) do
    """
    Available commands:

    Movement: north/n, south/s, east/e, west/w, up/u, down/d
    Looking:  look/l, look <target>, examine <target>
    Chat:     say <message>, '<message>, shout <message>
    Social:   whisper <player> <message>, emote <action>
    NPCs:     talk <npc>
    Items:    get <item>, drop <item>, inventory/i
    Combat:   attack <target>, flee
    Info:     who, score/stats, help <topic>
    """
  end

  def help("movement") do
    """
    Movement Commands:

    north/n  - Move north
    south/s  - Move south
    east/e   - Move east
    west/w   - Move west
    up/u     - Move up
    down/d   - Move down

    You can also use: ne, nw, se, sw for diagonal movement.
    """
  end

  def help("chat") do
    """
    Chat Commands:

    say <message>  - Speak to everyone in the room
    '<message>     - Shortcut for say
    shout <message> - Shout to adjacent rooms
    whisper <player> <message> - Private message to player in room
    """
  end

  def help(_topic) do
    "No help available for that topic. Try: help movement, help chat"
  end
end
