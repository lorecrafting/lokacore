defmodule Loka.WorldBuilder.ToolExecutor.GameActions do
  @moduledoc """
  Executes game commands on behalf of the AI agent.

  Parses text commands (like "north", "look", "talk merchant") into
  Actions-compatible calls, executes them, and returns readable text
  for the AI. The Result is also stashed in the process dictionary
  so the calling channel process can flush state changes to the socket.

  ## Process Dictionary Keys

  Reads from (stashed by ai.ex before each tool call):
  - `:loka_ai_character` — current character entity
  - `:loka_ai_player` — current player struct
  - `:loka_ai_dialogue_state` — active dialogue state (if any)

  Writes to (consumed by ai.ex `flush_game_result/1` after tool call):
  - `:loka_ai_game_result` — the `Result.t()` for ActionBridge to apply
  """

  require Logger

  alias Loka.Engine.Entities
  alias Loka.Framework.{Inventory, Equipment}
  alias Loka.Game.Actions
  alias Loka.Game.Actions.Context
  alias LokaWeb.Channels.{CommandParser, RoomHelpers}

  # Commands the AI is NOT allowed to execute (builder/admin/AI commands)
  @blocked_prefixes ~w(builder_ unknown)

  @doc """
  Execute a game command string on behalf of the AI.

  Returns `{:ok, %{message: text}}` or `{:error, reason}`.
  Stashes the Result in `Process.put(:loka_ai_game_result, result)` for
  the channel to flush via ActionBridge.
  """
  @spec execute_game_command(map(), keyword()) :: {:ok, map()} | {:error, String.t()}
  def execute_game_command(%{"command" => command}, _opts) when is_binary(command) do
    command = String.trim(command)

    if command == "" do
      {:error, "Empty command"}
    else
      execute_parsed_command(command)
    end
  end

  def execute_game_command(_input, _opts) do
    {:error, "Missing 'command' parameter"}
  end

  # ---------------------------------------------------------------------------
  # Command Execution Pipeline
  # ---------------------------------------------------------------------------

  defp execute_parsed_command(command) do
    {action, params} = CommandParser.parse(command)

    action_str = Atom.to_string(action)

    cond do
      Enum.any?(@blocked_prefixes, &String.starts_with?(action_str, &1)) ->
        {:error, "Command not available via game_command tool: #{command}"}

      action in [:clear, :help, :spark] ->
        {:error, "Command not available via game_command tool: #{command}"}

      # Special handling for commands that aren't Actions-based
      action == :look and not Map.has_key?(params, :target) ->
        with_character(&execute_look/1)

      action == :inventory ->
        with_character(&execute_inventory/1)

      action == :who ->
        with_character_and_player(&execute_who/2)

      # Commands that need entity resolution by keyword
      action in [:talk, :get_item, :attack] ->
        with_room(&execute_entity_keyword_action(action, params, &1, &2))

      action in [:drop_item, :equip, :unequip, :use_item] ->
        with_room(&execute_inventory_keyword_action(action, params, &1, &2))

      action == :look and Map.has_key?(params, :target) ->
        with_room(&execute_look_target(params.target, &1, &2))

      action == :say ->
        with_room(&execute_action(:chat, %{mode: :say, message: params.message}, &1, &2))

      action == :flee ->
        with_room(&execute_action(:flee, %{}, &1, &2))

      # Navigation and other direct actions
      true ->
        with_room(&execute_action(action, params, &1, &2))
    end
  end

  # ---------------------------------------------------------------------------
  # Context Loaders (single room load per command)
  # ---------------------------------------------------------------------------

  defp with_character(fun) do
    case Process.get(:loka_ai_character) do
      nil -> {:error, "No character available"}
      character -> fun.(character)
    end
  end

  defp with_character_and_player(fun) do
    character = Process.get(:loka_ai_character)
    player = Process.get(:loka_ai_player)

    if character && player do
      fun.(character, player)
    else
      {:error, "No character available"}
    end
  end

  # Loads character, player, and room once — threads them to the callback.
  defp with_room(fun) do
    character = Process.get(:loka_ai_character)
    player = Process.get(:loka_ai_player)

    if character && player do
      {room, _} = RoomHelpers.load_room_for_character(character)
      fun.(character, %{player: player, room: room})
    else
      {:error, "No character or player available"}
    end
  end

  # ---------------------------------------------------------------------------
  # Special Commands (not Actions-based)
  # ---------------------------------------------------------------------------

  defp execute_look(character) do
    {room, _} = RoomHelpers.load_room_for_character(character)
    {:ok, %{message: format_room(room)}}
  end

  defp execute_inventory(character) do
    items = Inventory.list_items(character)
    equipped = Equipment.get_equipped(character)

    inv_text =
      if items == [] do
        "You are carrying nothing."
      else
        lines =
          Enum.map(items, fn item ->
            name = Map.get(item, :name, Map.get(item, "name", "unknown"))
            key = Map.get(item, :key, Map.get(item, "key", ""))
            "  #{name} (#{key})"
          end)

        "Inventory:\n" <> Enum.join(lines, "\n")
      end

    equip_text =
      equipped
      |> Enum.reject(fn {_slot, v} -> is_nil(v) or v == "" end)
      |> case do
        [] ->
          ""

        slots ->
          lines =
            Enum.map(slots, fn {slot, item_id} ->
              name =
                case Entities.find_one(key: item_id) do
                  {:ok, e} -> e.short_desc || item_id
                  _ -> item_id
                end

              "  #{slot}: #{name}"
            end)

          "\nEquipment:\n" <> Enum.join(lines, "\n")
      end

    {:ok, %{message: inv_text <> equip_text}}
  end

  defp execute_who(character, player) do
    room_id = character.location_id
    players = RoomHelpers.load_other_players(room_id, player.id)

    text =
      if players == [] do
        "You are alone here."
      else
        names = Enum.map(players, fn p -> "  #{p.name}" end) |> Enum.join("\n")
        "Players here:\n#{names}"
      end

    {:ok, %{message: text}}
  end

  defp execute_look_target(target, character, %{room: room}) do
    case find_entity_by_keyword(room, target) do
      {:ok, entity} ->
        desc = Map.get(entity, :extra_desc) || Map.get(entity, :long_desc) || ""
        name = entity.short_desc || Map.get(entity, :name, target)
        {:ok, %{message: "#{name}\n#{desc}" |> String.trim()}}

      :error ->
        # Check inventory
        case find_inventory_item_by_keyword(character, target) do
          {:ok, item} ->
            name = Map.get(item, :name, target)
            desc = Map.get(item, :description, "")
            {:ok, %{message: "#{name}\n#{desc}" |> String.trim()}}

          :error ->
            {:ok, %{message: "You don't see '#{target}' here."}}
        end
    end
  end

  # ---------------------------------------------------------------------------
  # Entity Keyword Resolution
  # ---------------------------------------------------------------------------

  defp execute_entity_keyword_action(action, params, _character, %{room: room} = ctx) do
    target = params[:target]

    case find_entity_by_keyword(room, target) do
      {:ok, entity} ->
        action_params = build_entity_action_params(action, entity, room)
        execute_action(action, action_params, ctx)

      :error ->
        {:ok, %{message: "You don't see '#{target}' here."}}
    end
  end

  defp execute_inventory_keyword_action(action, params, character, %{room: room} = ctx) do
    keyword = params[:target] || params[:item]

    case find_inventory_item_by_keyword(character, keyword) do
      {:ok, item} ->
        action_params = build_inventory_action_params(action, item, params, room)
        execute_action(action_params.action, action_params.params, ctx)

      :error ->
        {:ok, %{message: "You don't have '#{keyword}'."}}
    end
  end

  defp build_entity_action_params(:talk, entity, _room) do
    %{entity_id: entity.id}
  end

  defp build_entity_action_params(:get_item, entity, _room) do
    %{entity_id: entity.id}
  end

  defp build_entity_action_params(:attack, entity, room) do
    # Attack needs the entity struct too
    full_entity =
      Enum.find(room.entities || [], fn e ->
        to_string(e.id) == to_string(entity.id)
      end)

    %{entity_id: entity.id, entity: full_entity || entity}
  end

  defp build_inventory_action_params(:drop_item, item, _params, _room) do
    %{action: :drop_item, params: %{item_id: item.id}}
  end

  defp build_inventory_action_params(:equip, item, _params, _room) do
    %{action: :equip_item, params: %{item_id: item.id}}
  end

  defp build_inventory_action_params(:unequip, _item, params, _room) do
    %{action: :unequip_item, params: %{slot: params[:target]}}
  end

  defp build_inventory_action_params(:use_item, item, params, room) do
    base = %{item_id: item.id}

    target_params =
      case Map.get(params, :target) do
        nil ->
          %{}

        target_keyword ->
          # Reuse the already-loaded room instead of loading again
          case find_entity_by_keyword(room, target_keyword) do
            {:ok, target} -> %{target_id: target.id}
            :error -> %{target_keyword: target_keyword}
          end
      end

    %{action: :use_item, params: Map.merge(base, target_params)}
  end

  # ---------------------------------------------------------------------------
  # Execute via Actions Engine
  # ---------------------------------------------------------------------------

  # Two-arity entry point used by cond branches that called with_room
  defp execute_action(action, params, _character, ctx), do: execute_action(action, params, ctx)

  defp execute_action(action, params, %{player: player, room: room}) do
    character = Process.get(:loka_ai_character)

    ctx = %Context{
      player_id: player.id,
      player_name: character.short_desc || player.name || player.email,
      character: character,
      room: room,
      combat: nil,
      dialogue: Process.get(:loka_ai_dialogue_state),
      container: nil
    }

    try do
      case Actions.execute(action, params, ctx) do
        {:ok, result} ->
          # Stash for channel to flush via ActionBridge
          Process.put(:loka_ai_game_result, result)

          # Update stashed character if state changed
          if result.state[:character] do
            Process.put(:loka_ai_character, result.state[:character])
          end

          # Update dialogue state if changed
          if Map.has_key?(result.state, :dialogue) do
            Process.put(:loka_ai_dialogue_state, result.state[:dialogue])
          end

          text = format_result_events(result)
          {:ok, %{message: text}}

        {:error, reason} ->
          {:ok, %{message: format_error(reason)}}
      end
    rescue
      e ->
        Logger.warning("[GameActions] Action #{action} crashed: #{Exception.message(e)}")

        {:ok, %{message: "Command failed unexpectedly."}}
    end
  end

  # ---------------------------------------------------------------------------
  # Entity Keyword Lookup (mirrors game_channel logic)
  # ---------------------------------------------------------------------------

  defp find_entity_by_keyword(room, keyword) do
    keyword_lower = String.downcase(to_string(keyword))

    entity =
      ((room.entities || []) ++ (room.items || []))
      |> Enum.find(fn e ->
        name = Map.get(e, :name, "") |> to_string() |> String.downcase()
        key = Map.get(e, :key, "") |> to_string() |> String.downcase()
        pk = Map.get(e, :primary_keyword, "") |> to_string() |> String.downcase()

        name == keyword_lower || key == keyword_lower || pk == keyword_lower ||
          String.contains?(name, keyword_lower)
      end)

    case entity do
      nil -> :error
      e -> {:ok, e}
    end
  end

  defp find_inventory_item_by_keyword(character, keyword) do
    items = Inventory.list_items(character)
    keyword_lower = String.downcase(to_string(keyword))

    item =
      Enum.find(items, fn item ->
        name = Map.get(item, :name, "") |> to_string() |> String.downcase()
        key = Map.get(item, :key, "") |> to_string() |> String.downcase()
        name == keyword_lower || key == keyword_lower || String.contains?(name, keyword_lower)
      end)

    case item do
      nil -> :error
      i -> {:ok, i}
    end
  end

  # ---------------------------------------------------------------------------
  # Result Formatting (AI-readable text)
  # ---------------------------------------------------------------------------

  defp format_result_events(result) do
    result.events
    |> Enum.map(&format_event/1)
    |> Enum.reject(&is_nil/1)
    |> Enum.join("\n")
    |> case do
      "" -> "Done."
      text -> text
    end
  end

  defp format_event({:event, text}), do: text
  defp format_event({:room_changed, data}), do: format_room_data(data)
  defp format_event({:room_update, data}), do: format_room_data(data)
  defp format_event({:dialogue_start, data}), do: format_dialogue(data)
  defp format_event({:dialogue_update, data}), do: format_dialogue(data)
  defp format_event({:dialogue_end, _data}), do: "Conversation ended."
  defp format_event({:inventory_update, _data}), do: nil
  defp format_event({:equipment_update, _data}), do: nil
  defp format_event({:stats_update, _data}), do: nil
  defp format_event({:quest_accepted, data}), do: "Quest accepted: #{data[:name] || "unknown"}"
  defp format_event({:quest_completed, data}), do: "Quest completed: #{data[:name] || "unknown"}"
  defp format_event({:quest_progress, _data}), do: nil

  defp format_event({:combat_start, data}),
    do: "Combat started with #{data[:target_name] || "enemy"}!"

  defp format_event({:combat_update, _data}), do: nil
  defp format_event({:combat_end, data}), do: "Combat ended. #{data[:result] || ""}"
  defp format_event({:resources_update, _data}), do: nil
  # Skip broadcasts, timers, and other transport-only events
  defp format_event({:broadcast_room, _, _}), do: nil
  defp format_event({:broadcast_player, _, _}), do: nil
  defp format_event({:schedule_timer, _, _}), do: nil
  defp format_event({:cancel_timer, _}), do: nil
  defp format_event({:output, %{text: text}}), do: text
  defp format_event(_), do: nil

  # ---------------------------------------------------------------------------
  # Room / Dialogue Formatting
  #
  # `format_room/1` — formats a loaded room struct (dot-access fields)
  # `format_room_data/1` — formats serialized event data (bracket-access maps)
  # These are intentionally separate: room structs use atoms, event maps use
  # string or atom keys depending on the serializer.
  # ---------------------------------------------------------------------------

  defp format_room(room) do
    exits =
      (room.exits || [])
      |> Enum.map(fn e -> e.direction end)
      |> Enum.join(", ")

    npcs = format_entity_list(room.entities || [], &struct_name/1)
    items = format_entity_list(room.items || [], &struct_name/1)

    build_room_lines(room.title || "Unknown", room.description || "", exits, npcs, items)
  end

  defp format_room_data(data) do
    room = data[:room] || data

    exits =
      (room[:exits] || [])
      |> Enum.map(fn e -> e[:direction] || e["direction"] end)
      |> Enum.reject(&is_nil/1)
      |> Enum.join(", ")

    npcs = format_entity_list(room[:entities] || [], &map_name/1)
    items = format_entity_list(room[:items] || [], &map_name/1)

    build_room_lines(room[:title] || "Unknown", room[:description] || "", exits, npcs, items)
  end

  defp build_room_lines(title, desc, exits, npcs, items) do
    [
      title,
      desc,
      "",
      if(exits != "", do: "Exits: #{exits}"),
      if(npcs != "", do: "NPCs: #{npcs}"),
      if(items != "", do: "Items: #{items}")
    ]
    |> Enum.reject(&is_nil/1)
    |> Enum.join("\n")
  end

  defp format_entity_list(entities, name_fn) do
    entities
    |> Enum.map(fn e ->
      {name, key} = name_fn.(e)
      "#{key} (#{name})"
    end)
    |> Enum.join(", ")
  end

  # Name extraction for struct-accessed room entities (from RoomLoader)
  defp struct_name(e) do
    name = e.short_desc || Map.get(e, :name, "unknown")
    key = Map.get(e, :key, "")
    {name, key}
  end

  # Name extraction for map-accessed event data (from Serializers)
  defp map_name(e) do
    name = e[:name] || e[:short_desc] || "unknown"
    key = e[:key] || ""
    {name, key}
  end

  defp format_dialogue(data) do
    npc_name = data[:npc_name] || data["npc_name"] || "NPC"
    text = data[:text] || data["text"] || ""
    choices = data[:choices] || data["choices"] || []

    choice_text =
      choices
      |> Enum.with_index(1)
      |> Enum.map(fn {choice, i} ->
        label = choice[:text] || choice["text"] || "..."
        "  #{i}. #{label}"
      end)
      |> Enum.join("\n")

    result = "#{npc_name} says: \"#{text}\""

    if choice_text != "" do
      result <> "\n" <> choice_text
    else
      result
    end
  end

  defp format_error(reason) when is_binary(reason), do: reason

  defp format_error(reason) when is_atom(reason) do
    reason |> Atom.to_string() |> String.replace("_", " ") |> String.capitalize()
  end

  defp format_error(reason), do: inspect(reason)
end
