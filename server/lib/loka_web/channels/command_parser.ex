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

  # Room CRUD commands
  defp do_parse(["dig", rest]) do
    case String.split(rest, " ", parts: 3) do
      [dir, key, name] -> {:builder_dig, %{direction: dir, key: key, name: name}}
      [dir, key] -> {:builder_dig, %{direction: dir, key: key, name: key}}
      _ -> {:unknown, %{text: "dig"}}
    end
  end

  defp do_parse(["@desc", text]), do: {:builder_set_desc, %{text: text}}
  defp do_parse(["@name", text]), do: {:builder_set_name, %{text: text}}

  defp do_parse(["link", rest]) do
    case String.split(rest, " ", parts: 2) do
      [dir, key] -> {:builder_link, %{direction: dir, key: key}}
      _ -> {:unknown, %{text: "link"}}
    end
  end

  defp do_parse(["unlink", direction]), do: {:builder_unlink, %{direction: direction}}

  # Multi-word builder commands (create/edit/delete + type + args)
  defp do_parse(["create", rest]) do
    case String.split(rest, " ", parts: 3) do
      ["room", key_and_name] ->
        case String.split(key_and_name, " ", parts: 2) do
          [key, name] -> {:builder_create_room, %{key: key, name: name}}
          [key] -> {:builder_create_room, %{key: key, name: key}}
        end

      ["room"] ->
        {:unknown, %{text: "create room"}}

      ["npc", key_and_name] ->
        case String.split(key_and_name, " ", parts: 2) do
          [key, name] -> {:builder_create_npc, %{key: key, name: name}}
          [key] -> {:builder_create_npc, %{key: key, name: key}}
        end

      ["npc"] ->
        {:unknown, %{text: "create npc"}}

      ["item", key_and_name] ->
        case String.split(key_and_name, " ", parts: 2) do
          [key, name] -> {:builder_create_item, %{key: key, name: name}}
          [key] -> {:builder_create_item, %{key: key, name: key}}
        end

      ["item"] ->
        {:unknown, %{text: "create item"}}

      ["quest", key_and_name] ->
        case String.split(key_and_name, " ", parts: 2) do
          [key, name] -> {:builder_create_quest, %{key: key, name: name}}
          [key] -> {:builder_create_quest, %{key: key, name: key}}
        end

      ["quest"] ->
        {:unknown, %{text: "create quest"}}

      ["dialogue", npc_key] ->
        {:builder_create_dialogue, %{npc_key: String.trim(npc_key)}}

      _ ->
        {:unknown, %{text: "create"}}
    end
  end

  defp do_parse(["edit", rest]) do
    case String.split(rest, " ", parts: 3) do
      [type, key, field_value] when type in ~w(npc item) ->
        case String.split(field_value, " ", parts: 2) do
          [field, value] ->
            {:builder_edit_entity, %{type: type, key: key, field: field, value: value}}

          [field] ->
            {:builder_edit_entity, %{type: type, key: key, field: field, value: ""}}
        end

      [type, key] when type in ~w(npc item room) ->
        {:builder_edit_entity, %{type: type, key: key, field: nil, value: nil}}

      ["quest", key_and_field] ->
        case String.split(key_and_field, " ", parts: 2) do
          [key, field_value] ->
            case String.split(field_value, " ", parts: 2) do
              [field, value] ->
                {:builder_edit_quest, %{key: key, field: field, value: value}}

              [field] ->
                {:builder_edit_quest, %{key: key, field: field, value: ""}}
            end

          [key] ->
            {:builder_edit_quest, %{key: key, field: nil, value: nil}}
        end

      _ ->
        {:unknown, %{text: "edit"}}
    end
  end

  defp do_parse(["delete", rest]) do
    case String.split(rest, " ", parts: 2) do
      ["room", key] -> {:builder_delete_room, %{key: String.trim(key)}}
      ["npc", key] -> {:builder_delete_npc, %{key: String.trim(key)}}
      ["item", key] -> {:builder_delete_item, %{key: String.trim(key)}}
      _ -> {:unknown, %{text: "delete"}}
    end
  end

  # Quest/dialogue inspection
  defp do_parse(["quest", rest]) do
    case String.split(rest, " ", parts: 2) do
      ["info", key] -> {:builder_quest_info, %{key: String.trim(key)}}
      _ -> {:unknown, %{text: "quest"}}
    end
  end

  defp do_parse(["dialogue", rest]) do
    case String.split(rest, " ", parts: 2) do
      ["info", key] -> {:builder_dialogue_info, %{key: String.trim(key)}}
      _ -> {:unknown, %{text: "dialogue"}}
    end
  end

  # Project commands
  defp do_parse(["project", rest]) do
    case String.split(rest, " ", parts: 3) do
      ["new", key_and_name] ->
        case String.split(key_and_name, " ", parts: 2) do
          [key, name] -> {:builder_project_new, %{key: key, name: name}}
          [key] -> {:builder_project_new, %{key: key, name: key}}
        end

      ["load", key] ->
        {:builder_project_load, %{key: String.trim(key)}}

      ["list"] ->
        {:builder_project_list, %{}}

      ["delete", key] ->
        {:builder_project_delete, %{key: String.trim(key)}}

      _ ->
        {:unknown, %{text: "project"}}
    end
  end

  # Document commands
  defp do_parse(["doc", rest]) do
    case String.split(rest, " ", parts: 3) do
      ["write", filename_and_content] ->
        case String.split(filename_and_content, " ", parts: 2) do
          [filename, content] -> {:builder_doc_write, %{filename: filename, content: content}}
          [filename] -> {:builder_doc_write, %{filename: filename, content: ""}}
        end

      ["read", filename] ->
        {:builder_doc_read, %{filename: String.trim(filename)}}

      ["list"] ->
        {:builder_doc_list, %{}}

      ["delete", filename] ->
        {:builder_doc_delete, %{filename: String.trim(filename)}}

      _ ->
        {:unknown, %{text: "doc"}}
    end
  end

  defp do_parse(["guide", topic]), do: {:builder_guide, %{topic: topic}}

  # AI commands
  defp do_parse(["/ai", prompt]), do: {:builder_ai, %{prompt: prompt}}
  defp do_parse(["/ai"]), do: {:builder_ai_clear, %{}}
  defp do_parse(["chat"]), do: {:builder_chat_mode, %{}}
  defp do_parse(["/exit"]), do: {:builder_exit_chat, %{}}

  # Spark command (available to all players)
  defp do_parse(["/spark", prompt]), do: {:spark, %{prompt: prompt}}

  # Help with topic
  defp do_parse(["help", topic]), do: {:help, %{topic: topic}}

  # Normal MUD commands
  defp do_parse(["clear"]), do: {:clear, %{}}
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
