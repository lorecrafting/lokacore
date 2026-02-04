defmodule LokaWeb.Channels.BuilderCommands do
  @moduledoc """
  Admin-only builder command implementations for the MUD terminal.

  All commands are gated by `socket.assigns.player.is_admin` at the
  GameChannel dispatch layer. These functions assume the caller is authorized.

  All output is prefixed with [BUILDER] for visual distinction.
  """

  require Logger

  import Phoenix.Socket, only: [assign: 3]
  import Phoenix.Channel, only: [push: 3]

  alias Loka.Engine.{Spawner, TypedObject.Loader}
  alias Loka.Framework.Player.GameState, as: PlayerGameState
  alias Loka.Framework.{Inventory, Quest}
  alias Loka.Framework.World.Atmosphere
  alias Loka.WorldBuilder.{RoomManager, EntityManager, ValidationManager}
  alias LokaWeb.Channels.RoomHelpers
  alias LokaWeb.Channels.GameChannel.Serializers

  @doc """
  Execute a builder command. Returns `{:reply, :ok, socket}`.
  """
  def execute(cmd, params, socket) do
    case do_execute(cmd, params, socket) do
      {:ok, text, socket} ->
        push_builder(socket, text)
        {:reply, :ok, socket}

      {:ok, socket} ->
        {:reply, :ok, socket}

      {:error, text, socket} ->
        push_builder(socket, text)
        {:reply, :ok, socket}
    end
  end

  # ---------------------------------------------------------------------------
  # Navigation & Teleport
  # ---------------------------------------------------------------------------

  defp do_execute(:goto, %{room_key: room_key}, socket) do
    player = socket.assigns.player
    game_state = socket.assigns.game_state

    case find_room_by_key(room_key) do
      nil ->
        {:error, "Room '#{room_key}' not found.", socket}

      room ->
        # Unsubscribe from old room
        old_room_id = game_state.current_room_id

        if old_room_id do
          Phoenix.PubSub.unsubscribe(Loka.PubSub, "room:#{old_room_id}")
        end

        # Update game state with new room
        {:ok, updated_state} =
          PlayerGameState.update_state(game_state, %{current_room_id: room.id})

        # Subscribe to new room
        Phoenix.PubSub.subscribe(Loka.PubSub, "room:#{room.id}")

        # Update session
        Loka.Session.update_room(player.id, room.id)

        # Load and serialize room
        {loaded_room, final_state} = RoomHelpers.load_player_room(updated_state)
        atmosphere = Atmosphere.describe_for_room(loaded_room)

        socket = assign(socket, :game_state, final_state)

        push(socket, "room_update", %{
          room: Serializers.serialize_room(loaded_room),
          atmosphere: atmosphere
        })

        {:ok, "Teleported to #{room_key}.", socket}
    end
  end

  defp do_execute(:rooms, _params, socket) do
    rooms = RoomManager.list_rooms()

    lines =
      rooms
      |> Enum.sort_by(& &1.key)
      |> Enum.map(fn room ->
        coords = "(#{room[:x] || 0}, #{room[:y] || 0})"
        "  #{room.key} - #{room.name} #{coords}"
      end)
      |> Enum.join("\n")

    text = "Rooms (#{length(rooms)}):\n#{lines}"
    {:ok, text, socket}
  end

  defp do_execute(:where, _params, socket) do
    game_state = socket.assigns.game_state
    room_id = game_state.current_room_id

    {room, _state} = RoomHelpers.load_player_room(game_state)
    key = Map.get(room, :key, "unknown")
    x = Map.get(room, :x, 0)
    y = Map.get(room, :y, 0)
    z = Map.get(room, :z, 0)
    {:ok, "Room: #{key} (#{x}, #{y}, #{z}) [id: #{room_id}]", socket}
  end

  # ---------------------------------------------------------------------------
  # Entity Inspection
  # ---------------------------------------------------------------------------

  defp do_execute(:info, %{target: target}, socket) do
    case Loader.get(target) do
      {:ok, obj} ->
        yaml_text = format_typed_object(obj)
        {:ok, "Info for '#{target}':\n#{yaml_text}", socket}

      _ ->
        {:error, "Entity '#{target}' not found. Use the prototype key.", socket}
    end
  end

  defp do_execute(:list, %{type: type_str}, socket) do
    case type_str do
      t when t in ["npcs", "npc"] ->
        entities = EntityManager.list_entities(:npc)
        format_entity_list("NPCs", entities, socket)

      t when t in ["items", "item"] ->
        entities = EntityManager.list_entities(:item)
        format_entity_list("Items", entities, socket)

      t when t in ["quests", "quest"] ->
        quests = Loader.list_by_type(:quest)
        lines = Enum.map(quests, fn q -> "  #{q.key} - #{q.data["name"] || q.key}" end)
        {:ok, "Quests (#{length(quests)}):\n#{Enum.join(lines, "\n")}", socket}

      _ ->
        {:error, "Unknown type '#{type_str}'. Use: npcs, items, quests", socket}
    end
  end

  defp do_execute(:find, %{search: search}, socket) do
    search_lower = String.downcase(search)

    # Search across rooms, NPCs, and items
    rooms = RoomManager.list_rooms()
    npcs = EntityManager.list_entities(:npc)
    items = EntityManager.list_entities(:item)

    room_matches =
      Enum.filter(rooms, fn r ->
        matches?(r.key, search_lower) || matches?(r.name, search_lower)
      end)
      |> Enum.map(fn r -> "  [room] #{r.key} - #{r.name}" end)

    npc_matches =
      Enum.filter(npcs, fn n ->
        matches?(n.key, search_lower) || matches?(n.name, search_lower)
      end)
      |> Enum.map(fn n -> "  [npc] #{n.key} - #{n.name}" end)

    item_matches =
      Enum.filter(items, fn i ->
        matches?(i.key, search_lower) || matches?(i.name, search_lower)
      end)
      |> Enum.map(fn i -> "  [item] #{i.key} - #{i.name}" end)

    all = room_matches ++ npc_matches ++ item_matches

    if all == [] do
      {:ok, "No matches for '#{search}'.", socket}
    else
      {:ok, "Search results for '#{search}' (#{length(all)}):\n#{Enum.join(all, "\n")}", socket}
    end
  end

  # ---------------------------------------------------------------------------
  # Content Testing
  # ---------------------------------------------------------------------------

  defp do_execute(:spawn, %{npc_key: npc_key}, socket) do
    game_state = socket.assigns.game_state
    room_id = game_state.current_room_id

    case Spawner.spawn(npc_key, location_id: room_id) do
      {:ok, entity} ->
        name = Map.get(entity, :name, npc_key)

        # Push room update so the client sees the new NPC
        {room, _state} = RoomHelpers.load_player_room(game_state)
        atmosphere = Atmosphere.describe_for_room(room)

        push(socket, "room_update", %{
          room: Serializers.serialize_room(room),
          atmosphere: atmosphere
        })

        {:ok, "Spawned '#{name}' in current room.", socket}

      {:error, reason} ->
        {:error, "Failed to spawn '#{npc_key}': #{inspect(reason)}", socket}
    end
  end

  defp do_execute(:purge, _params, socket) do
    game_state = socket.assigns.game_state

    # Load room to find spawned entities
    {room, _state} = RoomHelpers.load_player_room(game_state)
    entities = Map.get(room, :entities, [])

    count =
      Enum.reduce(entities, 0, fn entity, acc ->
        case Spawner.despawn(entity.id) do
          :ok -> acc + 1
          _ -> acc
        end
      end)

    # Push room update
    {updated_room, _state} = RoomHelpers.load_player_room(game_state)
    atmosphere = Atmosphere.describe_for_room(updated_room)

    push(socket, "room_update", %{
      room: Serializers.serialize_room(updated_room),
      atmosphere: atmosphere
    })

    {:ok, "Purged #{count} entities from current room.", socket}
  end

  defp do_execute(:give, %{item_key: item_key}, socket) do
    game_state = socket.assigns.game_state

    case Spawner.spawn(item_key) do
      {:ok, item_entity} ->
        case Inventory.add_item(game_state, item_entity.id) do
          {:ok, updated_state} ->
            socket = assign(socket, :game_state, updated_state)

            # Push inventory update
            items = Inventory.list_items(updated_state)

            push(socket, "inventory_update", %{
              items: Serializers.serialize_inventory(items)
            })

            name = Map.get(item_entity, :name, item_key)
            {:ok, "Added '#{name}' to inventory.", socket}

          {:error, reason} ->
            {:error, "Failed to add item: #{inspect(reason)}", socket}
        end

      {:error, reason} ->
        {:error, "Item '#{item_key}' not found: #{inspect(reason)}", socket}
    end
  end

  # ---------------------------------------------------------------------------
  # Flags
  # ---------------------------------------------------------------------------

  defp do_execute(:setflag, %{flag: flag}, socket) do
    game_state = socket.assigns.game_state
    flags = Map.get(game_state, :flags, %{}) || %{}
    updated_flags = Map.put(flags, flag, true)

    {:ok, updated_state} = PlayerGameState.update_state(game_state, %{flags: updated_flags})
    socket = assign(socket, :game_state, updated_state)
    {:ok, "Flag '#{flag}' set to true.", socket}
  end

  defp do_execute(:clearflag, %{flag: flag}, socket) do
    game_state = socket.assigns.game_state
    flags = Map.get(game_state, :flags, %{}) || %{}
    updated_flags = Map.delete(flags, flag)

    {:ok, updated_state} = PlayerGameState.update_state(game_state, %{flags: updated_flags})
    socket = assign(socket, :game_state, updated_state)
    {:ok, "Flag '#{flag}' cleared.", socket}
  end

  defp do_execute(:flags, _params, socket) do
    game_state = socket.assigns.game_state
    flags = Map.get(game_state, :flags, %{}) || %{}

    if flags == %{} do
      {:ok, "No flags set.", socket}
    else
      lines =
        flags
        |> Enum.sort_by(&elem(&1, 0))
        |> Enum.map(fn {k, v} -> "  #{k} = #{inspect(v)}" end)
        |> Enum.join("\n")

      {:ok, "Flags (#{map_size(flags)}):\n#{lines}", socket}
    end
  end

  # ---------------------------------------------------------------------------
  # Quest Testing
  # ---------------------------------------------------------------------------

  defp do_execute(:startquest, %{key: key}, socket) do
    game_state = socket.assigns.game_state

    case Quest.Progress.accept_quest(game_state, key) do
      {:ok, updated_state} ->
        socket = assign(socket, :game_state, updated_state)
        {:ok, "Quest '#{key}' started.", socket}

      {:error, reason} ->
        {:error, "Failed to start quest '#{key}': #{inspect(reason)}", socket}
    end
  end

  defp do_execute(:completequest, %{key: key}, socket) do
    game_state = socket.assigns.game_state

    case Quest.Progress.turn_in_quest(game_state, key) do
      {:ok, updated_state, _rewards} ->
        socket = assign(socket, :game_state, updated_state)
        {:ok, "Quest '#{key}' completed.", socket}

      {:error, reason} ->
        {:error, "Failed to complete quest '#{key}': #{inspect(reason)}", socket}
    end
  end

  defp do_execute(:resetquest, %{key: key}, socket) do
    game_state = socket.assigns.game_state
    quests = Map.get(game_state, :quests, %{}) || %{}

    active = Map.get(quests, "active", %{}) |> Map.delete(key)
    completed = Map.get(quests, "completed", []) |> List.delete(key)

    updated_quests = %{quests | "active" => active, "completed" => completed}

    {:ok, updated_state} = PlayerGameState.update_state(game_state, %{quests: updated_quests})
    socket = assign(socket, :game_state, updated_state)
    {:ok, "Quest '#{key}' reset.", socket}
  end

  defp do_execute(:quests, _params, socket) do
    game_state = socket.assigns.game_state
    active = Quest.get_active_quests(game_state)
    completed = Quest.Progress.get_completed_quests(game_state)

    active_lines =
      case active do
        [] ->
          ["  (none)"]

        quests ->
          Enum.map(quests, fn q ->
            name = Map.get(q, :name, Map.get(q, "name", q[:quest_id] || "?"))
            "  [active] #{name}"
          end)
      end

    completed_lines =
      case completed do
        [] -> ["  (none)"]
        ids -> Enum.map(ids, fn id -> "  [done] #{id}" end)
      end

    text =
      "Active Quests:\n#{Enum.join(active_lines, "\n")}\n\nCompleted:\n#{Enum.join(completed_lines, "\n")}"

    {:ok, text, socket}
  end

  # ---------------------------------------------------------------------------
  # World State
  # ---------------------------------------------------------------------------

  defp do_execute(:settime, %{time: time}, socket) do
    valid_times = ~w(dawn noon dusk midnight)

    if time in valid_times do
      # settime is a builder convenience - just report the time period
      {:ok, "Time period set to #{time}. (Note: full calendar implementation pending)", socket}
    else
      {:error, "Invalid time. Use: #{Enum.join(valid_times, ", ")}", socket}
    end
  end

  defp do_execute(:reload, _params, socket) do
    Loader.reload()
    {:ok, "YAML content reloaded.", socket}
  end

  defp do_execute(:validate, _params, socket) do
    rooms = RoomManager.list_rooms()
    validation = ValidationManager.validation_summary(rooms)

    errors = Map.get(validation, :errors, 0)
    warnings = Map.get(validation, :warnings, 0)

    text =
      if errors == 0 and warnings == 0 do
        "Validation passed. No issues found."
      else
        "Validation: #{errors} error(s), #{warnings} warning(s)."
      end

    {:ok, text, socket}
  end

  defp do_execute(:godmode, _params, socket) do
    current = Map.get(socket.assigns, :godmode, false)
    new_value = !current
    socket = assign(socket, :godmode, new_value)

    status = if new_value, do: "ON", else: "OFF"
    {:ok, "God mode #{status}.", socket}
  end

  # ---------------------------------------------------------------------------
  # Helpers
  # ---------------------------------------------------------------------------

  defp push_builder(socket, text) do
    push(socket, "output", %{text: "[BUILDER] #{text}"})
  end

  defp find_room_by_key(key) do
    rooms = RoomManager.list_rooms()
    Enum.find(rooms, fn r -> r.key == key end)
  end

  defp format_entity_list(label, entities, socket) do
    lines =
      entities
      |> Enum.sort_by(& &1.key)
      |> Enum.map(fn e -> "  #{e.key} - #{e.name}" end)
      |> Enum.join("\n")

    {:ok, "#{label} (#{length(entities)}):\n#{lines}", socket}
  end

  defp format_typed_object(obj) do
    data = Map.get(obj, :data, %{})

    [
      "  key: #{obj.key}",
      "  type: #{obj.type}",
      "  name: #{data["name"] || obj.key}"
    ]
    |> then(fn lines ->
      if desc = data["description"],
        do: lines ++ ["  description: #{String.slice(desc, 0, 120)}..."],
        else: lines
    end)
    |> then(fn lines ->
      components = data["components"] || %{}

      if components != %{} do
        comp_lines =
          Enum.map(components, fn {k, _v} -> "    - #{k}" end)

        lines ++ ["  components:"] ++ comp_lines
      else
        lines
      end
    end)
    |> Enum.join("\n")
  end

  defp matches?(nil, _search), do: false

  defp matches?(text, search) do
    String.contains?(String.downcase(to_string(text)), search)
  end
end
