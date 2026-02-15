defmodule LokaWeb.Channels.BuilderCommands.Testing do
  @moduledoc """
  Builder testing commands: spawn, purge, give, flags, quests, godmode.
  """

  import Phoenix.Socket, only: [assign: 3]
  import Phoenix.Channel, only: [push: 3]

  alias Loka.Engine.Spawner
  alias Loka.Framework.Player.GameState, as: PlayerGameState
  alias Loka.Framework.Inventory
  alias Loka.Framework.Quest
  alias Loka.Framework.World.Atmosphere
  alias LokaWeb.Channels.RoomHelpers
  alias LokaWeb.Channels.GameChannel.Serializers

  def execute(:spawn, %{npc_key: npc_key}, socket) do
    game_state = socket.assigns.game_state
    room_id = game_state.current_room_id

    case Spawner.spawn(npc_key, location_id: room_id) do
      {:ok, entity} ->
        name = Map.get(entity, :name, npc_key)

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

  def execute(:purge, _params, socket) do
    game_state = socket.assigns.game_state

    {room, _state} = RoomHelpers.load_player_room(game_state)
    entities = Map.get(room, :entities, [])

    count =
      Enum.reduce(entities, 0, fn entity, acc ->
        case Spawner.despawn(entity.id) do
          :ok -> acc + 1
          _ -> acc
        end
      end)

    {updated_room, _state} = RoomHelpers.load_player_room(game_state)
    atmosphere = Atmosphere.describe_for_room(updated_room)

    push(socket, "room_update", %{
      room: Serializers.serialize_room(updated_room),
      atmosphere: atmosphere
    })

    {:ok, "Purged #{count} entities from current room.", socket}
  end

  def execute(:give, %{item_key: item_key}, socket) do
    game_state = socket.assigns.game_state

    case Spawner.spawn(item_key) do
      {:ok, item_entity} ->
        case Inventory.add_item(game_state, item_entity.id) do
          {:ok, updated_state} ->
            socket = assign(socket, :game_state, updated_state)

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

  def execute(:setflag, %{flag: flag}, socket) do
    game_state = socket.assigns.game_state
    flags = Map.get(game_state, :flags, %{}) || %{}
    updated_flags = Map.put(flags, flag, true)

    {:ok, updated_state} = PlayerGameState.update_state(game_state, %{flags: updated_flags})
    socket = assign(socket, :game_state, updated_state)
    {:ok, "Flag '#{flag}' set to true.", socket}
  end

  def execute(:clearflag, %{flag: flag}, socket) do
    game_state = socket.assigns.game_state
    flags = Map.get(game_state, :flags, %{}) || %{}
    updated_flags = Map.delete(flags, flag)

    {:ok, updated_state} = PlayerGameState.update_state(game_state, %{flags: updated_flags})
    socket = assign(socket, :game_state, updated_state)
    {:ok, "Flag '#{flag}' cleared.", socket}
  end

  def execute(:flags, _params, socket) do
    character = socket.assigns.character
    flags = get_in(character.components, ["flags"]) || %{}

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

  def execute(:startquest, %{key: key}, socket) do
    game_state = socket.assigns.game_state

    case Quest.Progress.accept_quest(game_state, key) do
      {:ok, updated_state} ->
        socket = assign(socket, :game_state, updated_state)
        {:ok, "Quest '#{key}' started.", socket}

      {:error, reason} ->
        {:error, "Failed to start quest '#{key}': #{inspect(reason)}", socket}
    end
  end

  def execute(:completequest, %{key: key}, socket) do
    game_state = socket.assigns.game_state

    case Quest.Progress.turn_in_quest(game_state, key) do
      {:ok, updated_state, _rewards} ->
        socket = assign(socket, :game_state, updated_state)
        {:ok, "Quest '#{key}' completed.", socket}

      {:error, reason} ->
        {:error, "Failed to complete quest '#{key}': #{inspect(reason)}", socket}
    end
  end

  def execute(:resetquest, %{key: key}, socket) do
    game_state = socket.assigns.game_state
    quests = Map.get(game_state, :quests, %{}) || %{}

    active = Map.get(quests, "active", %{}) |> Map.delete(key)
    completed = Map.get(quests, "completed", []) |> List.delete(key)

    updated_quests = %{quests | "active" => active, "completed" => completed}

    {:ok, updated_state} = PlayerGameState.update_state(game_state, %{quests: updated_quests})
    socket = assign(socket, :game_state, updated_state)
    {:ok, "Quest '#{key}' reset.", socket}
  end

  def execute(:quests, _params, socket) do
    game_state = socket.assigns.game_state
    active = Quest.Progress.get_active_quests(game_state)
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

  def execute(:godmode, _params, socket) do
    current = Map.get(socket.assigns, :godmode, false)
    new_value = !current
    socket = assign(socket, :godmode, new_value)

    status = if new_value, do: "ON", else: "OFF"
    {:ok, "God mode #{status}.", socket}
  end
end
