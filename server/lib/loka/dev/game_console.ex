defmodule Loka.Dev.GameConsole do
  @moduledoc """
  Dev-only game console for testing game state without a browser.

  Provides a programmatic interface for running game commands and collecting
  text output. Used by `mix loka.console` and the dev HTTP endpoint.

  ## Usage

      {:ok, session} = GameConsole.start("admin@loka.local")
      {output, session} = GameConsole.run(session, "look")
      IO.puts(output)

      {output, session} = GameConsole.run(session, "north")
      IO.puts(output)

      {output, session} = GameConsole.run(session, "talk thera")
      IO.puts(output)

      {output, session} = GameConsole.run(session, "1")
      IO.puts(output)

  ## Session State

  The session struct tracks character, room, dialogue, and combat state
  across multiple command calls. It must be threaded through each `run/2`
  call to preserve state correctly (e.g., dialogue choices require active
  dialogue state from the previous `talk` command).
  """

  alias Loka.Accounts
  alias Loka.Game.Actions
  alias Loka.Game.Actions.Context
  alias Loka.Engine.{Entities, EntityRegistry, EntityServer}
  alias LokaWeb.Channels.{CommandParser, RoomHelpers}
  alias LokaWeb.Channels.GameChannel.Character, as: GameCharacter

  @type t :: %__MODULE__{
          player: map(),
          character: map(),
          room: map(),
          dialogue: map() | nil,
          combat: map() | nil,
          container: map() | nil
        }

  defstruct [:player, :character, :room, :dialogue, :combat, :container]

  @doc """
  Start a game console session for a player.

  Loads the player, finds or creates their character, and positions them
  in their current room (or the starting room if location is invalid).
  """
  @spec start(String.t()) :: {:ok, t()} | {:error, String.t()}
  def start(player_email \\ "admin@loka.local") do
    case Accounts.get_player_by_email(player_email) do
      nil ->
        {:error, "Player not found: #{player_email}"}

      player ->
        case GameCharacter.find_or_create(player) do
          {:ok, character} ->
            EntityRegistry.get_or_start(character.id)
            {room, character} = RoomHelpers.load_room_for_character(character)
            {:ok, %__MODULE__{player: player, character: character, room: room}}

          {:error, reason} ->
            {:error, "Character error: #{inspect(reason)}"}
        end
    end
  end

  @doc """
  Run a game command and return `{text_output, updated_session}`.

  The updated session must be passed to subsequent `run/2` calls to preserve
  state like dialogue, combat, and room position.
  """
  @spec run(t(), String.t()) :: {String.t(), t()}
  def run(%__MODULE__{} = session, text) do
    parsed = CommandParser.parse(String.trim(text))
    dispatch(session, parsed)
  end

  # ===========================================================================
  # Command Dispatch
  # ===========================================================================

  # Look — describe the current room
  defp dispatch(session, {:look, %{target: _target}}) do
    # For the dev console, targeted look just re-describes the room
    dispatch(session, {:look, %{}})
  end

  defp dispatch(session, {:look, %{}}) do
    {room, character} = RoomHelpers.load_room_for_character(session.character)
    {format_room(room), %{session | room: room, character: character}}
  end

  # Navigate
  defp dispatch(session, {:navigate, %{direction: direction}}) do
    ctx = build_ctx(session)

    case Actions.execute(:navigate, %{direction: direction}, ctx) do
      {:ok, result} ->
        new_session = apply_state(session, result.state)
        {format_events(result.events), new_session}

      {:error, reason} ->
        {format_error(reason), session}
    end
  end

  # Talk to NPC by keyword
  defp dispatch(session, {:talk, %{target: target}}) do
    {room, _} = RoomHelpers.load_room_for_character(session.character)

    case find_entity_in_room(room, target) do
      {:ok, entity_id} ->
        ctx = build_ctx(session)

        case Actions.execute(:talk, %{entity_id: entity_id}, ctx) do
          {:ok, result} ->
            new_session = apply_state(session, result.state)
            {format_events(result.events), new_session}

          {:error, reason} ->
            {format_error(reason), session}
        end

      :error ->
        entities = list_entities(room)
        output = "You don't see '#{target}' here.\nEntities present: #{entities}"
        {output, session}
    end
  end

  # Dialogue choice (typing "1", "2", etc.)
  defp dispatch(session, {:dialogue_choice, %{choice_index: idx}}) do
    if is_nil(session.dialogue) do
      {"No active dialogue. Use 'talk <name>' to start a conversation.", session}
    else
      ctx = build_ctx(session)

      case Actions.execute(:dialogue_choice, %{choice_index: idx}, ctx) do
        {:ok, result} ->
          new_session = apply_state(session, result.state)
          {format_events(result.events), new_session}

        {:error, reason} ->
          {format_error(reason), session}
      end
    end
  end

  # Builder goto — teleport to room by key
  defp dispatch(session, {:builder_goto, %{room_key: room_key}}) do
    case Entities.find_one(key: room_key, type: :room) do
      {:ok, target_room} ->
        character = %{session.character | location_id: target_room.id}

        # Sync to EntityServer and force-save to DB for stateless HTTP persistence
        sync_character_to_entity_server(character)

        {room, character} = RoomHelpers.load_room_for_character(character)
        output = "Teleported to #{room_key}.\n\n" <> format_room(room)
        {output, %{session | room: room, character: character}}

      {:error, :not_found} ->
        {"Room '#{room_key}' not found.", session}
    end
  end

  # Builder spawn — spawn an NPC in the current room
  defp dispatch(session, {:builder_spawn, %{npc_key: npc_key}}) do
    {room, _} = RoomHelpers.load_room_for_character(session.character)

    case Loka.Engine.Spawner.spawn(npc_key, location_id: room.id) do
      {:ok, entity} ->
        {"Spawned #{entity.key} (id: #{entity.id}) in this room.", session}

      {:error, reason} ->
        {"Failed to spawn #{npc_key}: #{inspect(reason)}", session}
    end
  end

  # Builder info — show entity details
  defp dispatch(session, {:builder_info, %{target: target}}) do
    {room, _} = RoomHelpers.load_room_for_character(session.character)

    case find_entity_in_room(room, target) do
      {:ok, entity_id} ->
        case Entities.find_one(id: entity_id) do
          {:ok, entity} ->
            {format_entity_info(entity), session}

          {:error, _} ->
            {"Entity #{entity_id} not found in database.", session}
        end

      :error ->
        {"No entity matching '#{target}' in current room.", session}
    end
  end

  # Help
  defp dispatch(session, {:help, _}) do
    output = """
    GameConsole Commands:
      look                   - Describe current room
      north/south/east/west  - Navigate (n/s/e/w also work)
      talk <name>            - Talk to an NPC
      1 / 2 / 3 / ...        - Choose dialogue option
      goto <room_key>        - Teleport to a room
      spawn <npc_key>        - Spawn an NPC in current room
      info <name>            - Show entity details
      help                   - Show this help
    """

    {output, session}
  end

  defp dispatch(session, _unknown) do
    {"Unknown command. Type 'help' for available commands.", session}
  end

  # ===========================================================================
  # Context & State
  # ===========================================================================

  defp build_ctx(session) do
    %Context{
      player_id: session.player.id,
      player_name: session.player.name || session.player.email,
      character: session.character,
      room: session.room,
      dialogue: session.dialogue,
      combat: session.combat,
      container: session.container
    }
  end

  defp apply_state(session, state) do
    new_session =
      session
      |> maybe_put(:character, state[:character])
      |> maybe_put(:room, state[:room])
      |> maybe_put(:dialogue, state[:dialogue])
      |> maybe_put(:combat, state[:combat])
      |> maybe_put(:container, state[:container])

    # Sync character to EntityServer when it changes (persists location, etc.)
    if state[:character] && state[:character] != session.character do
      sync_character_to_entity_server(state[:character])
    end

    new_session
  end

  defp maybe_put(session, _key, nil), do: session
  defp maybe_put(session, key, value), do: Map.put(session, key, value)

  defp sync_character_to_entity_server(character) do
    # Update the EntityServer process state
    case EntityRegistry.get_or_start(character.id) do
      {:ok, pid} ->
        EntityServer.update_protected(pid, fn _old -> character end)

      {:error, _} ->
        :ok
    end

    # Also force-save to DB immediately so subsequent stateless HTTP requests
    # pick up the new state (EntityServer auto-save has a 60s delay)
    Entities.save(character)
  end

  # ===========================================================================
  # Entity Lookup
  # ===========================================================================

  defp find_entity_in_room(room, keyword) do
    keyword_lower = String.downcase(keyword)

    entity =
      ((room.entities || []) ++ (room.items || []))
      |> Enum.find(fn e ->
        name = Map.get(e, :name, "") |> to_string() |> String.downcase()
        key = Map.get(e, :key, "") |> to_string() |> String.downcase()
        pk = Map.get(e, :primary_keyword, "") |> to_string() |> String.downcase()

        name == keyword_lower || key == keyword_lower || pk == keyword_lower ||
          String.contains?(name, keyword_lower)
      end)

    if entity do
      {:ok, entity.id}
    else
      :error
    end
  end

  defp list_entities(room) do
    all = (room.entities || []) ++ (room.items || [])

    case all do
      [] ->
        "(none)"

      list ->
        Enum.map_join(list, ", ", fn e ->
          Map.get(e, :name) || Map.get(e, :key) || "?"
        end)
    end
  end

  # ===========================================================================
  # Formatting
  # ===========================================================================

  defp format_room(room) do
    title = room.title || room.short_desc || room.key || "Unknown Room"
    desc = (room.description || room.extra_desc || "(no description)") |> String.trim_trailing()

    exits = room.exits || []

    exits_text =
      case exits do
        [] ->
          "Exits: none"

        list ->
          dirs =
            Enum.map_join(list, ", ", fn e ->
              Map.get(e, :direction) || Map.get(e, "direction") || "?"
            end)

          "Exits: #{dirs}"
      end

    entities = room.entities || []

    entities_text =
      case entities do
        [] ->
          nil

        list ->
          names =
            Enum.map_join(list, ", ", fn e -> Map.get(e, :name) || Map.get(e, :key) || "?" end)

          "Present: #{names}"
      end

    items = room.items || []

    items_text =
      case items do
        [] ->
          nil

        list ->
          names =
            Enum.map_join(list, ", ", fn e -> Map.get(e, :name) || Map.get(e, :key) || "?" end)

          "Items: #{names}"
      end

    [title, "", desc, "", exits_text, entities_text, items_text]
    |> Enum.filter(&(&1 != nil && &1 != ""))
    |> Enum.join("\n")
  end

  defp format_events([]), do: ""

  defp format_events(events) do
    events
    |> Enum.map(&format_event/1)
    |> Enum.reject(&(&1 == nil || &1 == ""))
    |> Enum.join("\n")
  end

  defp format_event({:event, text}), do: text

  defp format_event({:room_changed, data}) do
    room = data[:room] || data["room"] || %{}
    format_room_data(room)
  end

  defp format_event({:room_update, data}) do
    room = data[:room] || data["room"] || %{}
    format_room_data(room)
  end

  defp format_event({:dialogue_start, data}), do: format_dialogue(data)
  defp format_event({:dialogue_update, data}), do: format_dialogue(data)
  defp format_event({:dialogue_end, _}), do: "[Dialogue ended]"

  defp format_event({:quest_started, data}) do
    title = get_in(data, [:quest, :title]) || get_in(data, ["quest", "title"]) || "a quest"
    "[Quest started: #{title}]"
  end

  defp format_event({:quest_completed, data}) do
    title = get_in(data, [:quest, :title]) || get_in(data, ["quest", "title"]) || "a quest"
    "[Quest completed: #{title}]"
  end

  defp format_event({:quest_update, _}), do: "[Quest updated]"
  defp format_event({:inventory_update, _}), do: "[Inventory updated]"
  defp format_event({:stats_update, _}), do: nil
  defp format_event(_), do: nil

  defp format_room_data(room) when is_map(room) do
    title = Map.get(room, :title) || Map.get(room, "title") || "Unknown Room"
    desc = Map.get(room, :description) || Map.get(room, "description") || ""

    exits = Map.get(room, :exits) || Map.get(room, "exits") || []

    exits_text =
      case exits do
        [] ->
          "Exits: none"

        list ->
          dirs =
            Enum.map_join(list, ", ", fn e ->
              Map.get(e, :direction) || Map.get(e, "direction") || "?"
            end)

          "Exits: #{dirs}"
      end

    entities = Map.get(room, :entities) || Map.get(room, "entities") || []

    entities_text =
      case entities do
        [] ->
          nil

        list ->
          "Present: " <>
            Enum.map_join(list, ", ", &(Map.get(&1, :name) || Map.get(&1, "name") || "?"))
      end

    [title, desc, exits_text, entities_text]
    |> Enum.filter(&(&1 != nil && &1 != ""))
    |> Enum.join("\n")
  end

  defp format_room_data(_), do: ""

  defp format_dialogue(data) do
    speaker = data[:speaker] || data["speaker"] || "NPC"
    text = data[:text] || data["text"] || ""
    choices = data[:choices] || data["choices"] || []

    header = "#{speaker}: #{text}"

    choice_lines =
      choices
      |> Enum.with_index(1)
      |> Enum.map(fn {choice, idx} ->
        choice_text = Map.get(choice, :text) || Map.get(choice, "text") || "?"
        "  #{idx}. #{choice_text}"
      end)

    ([header] ++ choice_lines) |> Enum.join("\n")
  end

  defp format_error(reason) when is_binary(reason), do: "Error: #{reason}"
  defp format_error(:no_exit), do: "There's no exit in that direction."
  defp format_error(:invalid_direction), do: "Invalid direction."
  defp format_error(:not_found), do: "Not found."
  defp format_error(reason), do: "Error: #{inspect(reason)}"

  defp format_entity_info(entity) do
    components = entity.components || %{}

    """
    Key:          #{entity.key}
    ID:           #{entity.id}
    Type:         #{entity.type}
    Name:         #{entity.short_desc}
    Location:     #{entity.location_id}
    Is prototype: #{entity.is_prototype}
    Traits:       #{inspect(entity.traits)}
    Components:   #{Map.keys(components) |> Enum.join(", ")}
    """
  end
end
