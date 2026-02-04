defmodule LokaWeb.Channels.CommandParser do
  @moduledoc """
  Parses raw text input into tagged action tuples.

  Builder/admin commands are prefixed with :builder_* to enable
  security gating at the execution layer. Non-admin players who
  send builder commands see "Unknown command" with no information
  leakage about the command's existence.
  """

  @directions ~w(north south east west up down n s e w u d)

  @doc """
  Parses raw text input into `{action_atom, params_map}`.

  ## Examples

      iex> CommandParser.parse("north")
      {:navigate, %{direction: "north"}}

      iex> CommandParser.parse("goto tavern")
      {:builder_goto, %{room_key: "tavern"}}

      iex> CommandParser.parse("look")
      {:look, %{}}
  """
  @spec parse(String.t()) :: {atom(), map()}
  def parse(text) do
    text
    |> String.trim()
    |> String.split(~r/\s+/, parts: 2)
    |> do_parse()
  end

  # Navigation
  defp do_parse([dir]) when dir in @directions,
    do: {:navigate, %{direction: expand_dir(dir)}}

  # Builder admin commands (all prefixed :builder_*)
  defp do_parse(["goto", room_key]), do: {:builder_goto, %{room_key: room_key}}
  defp do_parse(["spawn", npc_key]), do: {:builder_spawn, %{npc_key: npc_key}}
  defp do_parse(["give", item_key]), do: {:builder_give, %{item_key: item_key}}
  defp do_parse(["info", target]), do: {:builder_info, %{target: target}}
  defp do_parse(["setflag", flag]), do: {:builder_setflag, %{flag: flag}}
  defp do_parse(["clearflag", flag]), do: {:builder_clearflag, %{flag: flag}}
  defp do_parse(["startquest", key]), do: {:builder_startquest, %{key: key}}
  defp do_parse(["completequest", key]), do: {:builder_completequest, %{key: key}}
  defp do_parse(["resetquest", key]), do: {:builder_resetquest, %{key: key}}
  defp do_parse(["settime", time]), do: {:builder_settime, %{time: time}}
  defp do_parse(["list", type]), do: {:builder_list, %{type: type}}
  defp do_parse(["find", search]), do: {:builder_find, %{search: search}}
  defp do_parse(["rooms"]), do: {:builder_rooms, %{}}
  defp do_parse(["where"]), do: {:builder_where, %{}}
  defp do_parse(["purge"]), do: {:builder_purge, %{}}
  defp do_parse(["flags"]), do: {:builder_flags, %{}}
  defp do_parse(["quests"]), do: {:builder_quests, %{}}
  defp do_parse(["reload"]), do: {:builder_reload, %{}}
  defp do_parse(["validate"]), do: {:builder_validate, %{}}
  defp do_parse(["godmode"]), do: {:builder_godmode, %{}}

  # Normal MUD commands
  defp do_parse(["look"]), do: {:look, %{}}
  defp do_parse(["look", target]), do: {:look, %{target: target}}
  defp do_parse(["l"]), do: {:look, %{}}
  defp do_parse(["talk", target]), do: {:talk, %{target: target}}
  defp do_parse(["i"]), do: {:inventory, %{}}
  defp do_parse(["inventory"]), do: {:inventory, %{}}
  defp do_parse(["get", target]), do: {:get_item, %{target: target}}
  defp do_parse(["drop", target]), do: {:drop_item, %{target: target}}
  defp do_parse(["say", message]), do: {:say, %{message: message}}
  defp do_parse(["attack", target]), do: {:attack, %{target: target}}
  defp do_parse(["flee"]), do: {:flee, %{}}
  defp do_parse(["who"]), do: {:who, %{}}
  defp do_parse(["equip", target]), do: {:equip, %{target: target}}
  defp do_parse(["unequip", target]), do: {:unequip, %{target: target}}
  defp do_parse(["help"]), do: {:help, %{}}
  defp do_parse([unknown | _rest]), do: {:unknown, %{text: unknown}}
  defp do_parse([]), do: {:unknown, %{text: ""}}

  defp expand_dir("n"), do: "north"
  defp expand_dir("s"), do: "south"
  defp expand_dir("e"), do: "east"
  defp expand_dir("w"), do: "west"
  defp expand_dir("u"), do: "up"
  defp expand_dir("d"), do: "down"
  defp expand_dir(dir), do: dir
end
