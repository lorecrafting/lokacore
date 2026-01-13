defmodule LokaWeb.Channels.GameChannel.Handlers.TextCommands do
  @moduledoc """
  Handles MUD-style text command input for web clients.

  Parses raw text commands and dispatches to appropriate handlers,
  returning formatted text output for classic MUD experience.
  """

  import Phoenix.Channel, only: [push: 3]

  alias Loka.Game.CommandParser
  alias Loka.Framework.{Inventory, Equipment}
  alias Loka.Framework.World.Atmosphere
  alias LokaWeb.Channels.RoomHelpers

  @doc """
  Handle raw text command input. Returns {:reply, :ok, socket} or delegates
  to GameChannel for structured events.
  """
  def handle_command(input, socket, navigate_fn) do
    case CommandParser.parse(input) do
      {:move, direction} ->
        navigate_fn.(direction)

      {:look, nil} ->
        push_room_description(socket)
        {:reply, :ok, socket}

      {:look, target} ->
        handle_look_at(socket, target)

      {:say, message} ->
        {:delegate, "chat", %{"mode" => "say", "message" => message}}

      {:shout, message} ->
        {:delegate, "chat", %{"mode" => "shout", "message" => message}}

      {:yell, message} ->
        {:delegate, "chat", %{"mode" => "shout", "message" => message}}

      {:talk, nil} ->
        push(socket, "output", %{text: "Talk to whom?"})
        {:reply, :ok, socket}

      {:talk, target} ->
        handle_talk(socket, target)

      {:get, nil} ->
        push(socket, "output", %{text: "Get what?"})
        {:reply, :ok, socket}

      {:get, item} ->
        handle_get(socket, item)

      {:inventory, nil} ->
        push_inventory(socket)
        {:reply, :ok, socket}

      {:equipment, nil} ->
        push_equipment(socket)
        {:reply, :ok, socket}

      {:attack, target} ->
        handle_attack(socket, target)

      {:flee, nil} ->
        push(socket, "output", %{text: "You're not in combat."})
        {:reply, :ok, socket}

      {:help, topic} ->
        push(socket, "output", %{text: CommandParser.help(topic)})
        {:reply, :ok, socket}

      {:who, nil} ->
        push_who(socket)
        {:reply, :ok, socket}

      {:score, nil} ->
        push_score(socket)
        {:reply, :ok, socket}

      {:emote, action} ->
        handle_emote(socket, action)

      {:whisper, target, message} ->
        handle_whisper(socket, target, message)

      {:drop, _item} ->
        push(socket, "output", %{text: "Drop not implemented yet."})
        {:reply, :ok, socket}

      {:unknown, cmd} ->
        push(socket, "output", %{text: "Unknown command: #{cmd}. Type 'help' for commands."})
        {:reply, :ok, socket}
    end
  end

  # Push room description as text
  defp push_room_description(socket) do
    room = socket.assigns.room
    atmosphere = Atmosphere.describe_for_room(room)
    other_players = RoomHelpers.load_other_players(room.id, socket.assigns.player.id)

    # Build text output
    lines = [
      "",
      room.title,
      String.duplicate("-", String.length(room.title)),
      atmosphere,
      "",
      room.description,
      ""
    ]

    # Add entities
    entity_lines =
      Enum.map(room.entities || [], fn e ->
        "#{e.name} is here."
      end)

    # Add items
    item_lines =
      Enum.map(room.items || [], fn i ->
        "#{i.name} lies on the ground."
      end)

    # Add other players
    player_lines =
      Enum.map(other_players, fn p ->
        "#{p.name} is standing here."
      end)

    # Add exits
    exit_dirs = room.exits |> Enum.filter(& &1.destination_id) |> Enum.map(& &1.direction)

    exit_line =
      if Enum.empty?(exit_dirs) do
        "Exits: none"
      else
        "Exits: #{Enum.join(exit_dirs, ", ")}"
      end

    all_lines = lines ++ entity_lines ++ item_lines ++ player_lines ++ ["", exit_line]
    push(socket, "output", %{text: Enum.join(all_lines, "\n")})
  end

  defp handle_look_at(socket, target) do
    room = socket.assigns.room

    # Search entities, items, and players
    found =
      Enum.find(room.entities || [], fn e ->
        String.contains?(String.downcase(e.name), target)
      end) ||
        Enum.find(room.items || [], fn i ->
          String.contains?(String.downcase(i.name), target)
        end)

    case found do
      nil ->
        push(socket, "output", %{text: "You don't see '#{target}' here."})
        {:reply, :ok, socket}

      entity ->
        desc =
          entity.description || Map.get(entity, :extra_desc) || Map.get(entity, :desc) ||
            "You see nothing special."

        push(socket, "output", %{text: "#{entity.name}\n#{desc}"})
        {:reply, :ok, socket}
    end
  end

  defp handle_talk(socket, target) do
    room = socket.assigns.room

    found =
      Enum.find(room.entities || [], fn e ->
        String.contains?(String.downcase(e.name), target)
      end)

    case found do
      nil ->
        push(socket, "output", %{text: "You don't see '#{target}' to talk to."})
        {:reply, :ok, socket}

      _entity ->
        # TODO: Start dialogue system
        push(socket, "output", %{text: "Dialogue system coming soon."})
        {:reply, :ok, socket}
    end
  end

  defp handle_get(socket, item_name) do
    room = socket.assigns.room

    found =
      Enum.find(room.items || [], fn i ->
        String.contains?(String.downcase(i.name), item_name)
      end)

    case found do
      nil ->
        push(socket, "output", %{text: "You don't see '#{item_name}' here."})
        {:reply, :ok, socket}

      _item ->
        # TODO: Implement pickup
        push(socket, "output", %{text: "Item pickup coming soon."})
        {:reply, :ok, socket}
    end
  end

  defp handle_attack(socket, target) do
    room = socket.assigns.room

    found =
      Enum.find(room.entities || [], fn e ->
        String.contains?(String.downcase(e.name), target)
      end)

    case found do
      nil ->
        push(socket, "output", %{text: "You don't see '#{target}' to attack."})
        {:reply, :ok, socket}

      _entity ->
        # TODO: Start combat
        push(socket, "output", %{text: "Combat system coming soon."})
        {:reply, :ok, socket}
    end
  end

  defp handle_emote(socket, action) do
    player = socket.assigns.player
    room = socket.assigns.room
    player_name = player_display_name(player)

    Phoenix.PubSub.broadcast(
      Loka.PubSub,
      "room:#{room.id}",
      {:player_emote, player.id, player_name, action}
    )

    push(socket, "output", %{text: "#{player_name} #{action}"})
    {:reply, :ok, socket}
  end

  defp handle_whisper(socket, target, message) do
    room = socket.assigns.room
    other_players = RoomHelpers.load_other_players(room.id, socket.assigns.player.id)

    found =
      Enum.find(other_players, fn p ->
        String.contains?(String.downcase(p.name), target)
      end)

    case found do
      nil ->
        push(socket, "output", %{text: "You don't see '#{target}' here."})
        {:reply, :ok, socket}

      player ->
        player_name = player_display_name(socket.assigns.player)

        # Send to target
        Phoenix.PubSub.broadcast(
          Loka.PubSub,
          "player:#{player.id}",
          {:whisper, socket.assigns.player.id, player_name, message}
        )

        push(socket, "output", %{text: "You whisper to #{player.name}, \"#{message}\""})
        {:reply, :ok, socket}
    end
  end

  defp push_inventory(socket) do
    game_state = socket.assigns.game_state
    items = Inventory.list_items(game_state)

    if Enum.empty?(items) do
      push(socket, "output", %{text: "You are not carrying anything."})
    else
      lines = ["You are carrying:"] ++ Enum.map(items, fn i -> "  #{i.name}" end)
      push(socket, "output", %{text: Enum.join(lines, "\n")})
    end
  end

  defp push_equipment(socket) do
    game_state = socket.assigns.game_state
    equipped = Equipment.get_equipped(game_state)

    if Enum.empty?(equipped) do
      push(socket, "output", %{text: "You have nothing equipped."})
    else
      lines =
        ["You are wearing:"] ++
          Enum.map(equipped, fn {slot, item} -> "  #{slot}: #{item.name}" end)

      push(socket, "output", %{text: Enum.join(lines, "\n")})
    end
  end

  defp push_who(socket) do
    # TODO: Get all online players
    push(socket, "output", %{text: "Who list coming soon."})
  end

  defp push_score(socket) do
    game_state = socket.assigns.game_state
    player_name = player_display_name(socket.assigns.player)
    health = game_state.health || %{"current" => 100, "max" => 100}
    stats = game_state.stats || %{}

    lines = [
      "",
      "=== #{player_name} ===",
      "",
      "Health: #{health["current"]}/#{health["max"]}",
      ""
    ]

    stat_lines =
      Enum.map(stats, fn {k, v} ->
        "#{String.capitalize(to_string(k))}: #{v}"
      end)

    push(socket, "output", %{text: Enum.join(lines ++ stat_lines, "\n")})
  end

  defp player_display_name(player) do
    player.name || "Player"
  end
end
