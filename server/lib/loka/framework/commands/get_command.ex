defmodule Loka.Framework.Commands.GetCommand do
  @moduledoc """
  Command for picking up items from the current room.

  ## Usage

      # Pick up a specific item
      {:ok, parsed} = GetCommand.parse("sword", context)
      {:ok, events} = GetCommand.execute(parsed, context)
  """

  use Loka.Engine.Command

  alias Loka.Engine.{EntityRegistry, Hooks}

  # Framework commands intentionally depend on Framework modules.
  # Engine provides the Command behavior; Framework provides implementations.
  alias Loka.Framework.Inventory

  @impl true
  def key, do: "get"

  @impl true
  def aliases, do: ["take", "pick", "grab"]

  @impl true
  def required_context, do: [:actor, :location, :game_state]

  @impl true
  def help do
    "Pick up an item from the ground."
  end

  @impl true
  def parse(args, context) do
    target = String.trim(args)
    room = Map.get(context, :location)

    cond do
      target == "" ->
        {:error, "Get what?"}

      room == nil ->
        {:error, "You are nowhere."}

      true ->
        item = find_item_by_name(room, target)
        {:ok, %{target: target, item: item, room: room}}
    end
  end

  @impl true
  def execute(%{item: nil, target: target}, _context) do
    event = %{
      type: :system,
      text: "You don't see '#{target}' here.",
      timestamp: DateTime.utc_now()
    }

    {:ok, [event]}
  end

  def execute(%{item: item, room: room}, context) do
    game_state = context.game_state
    actor = context.actor

    # Check if item can be picked up (not locked)
    case check_get_lock(item, actor) do
      :ok ->
        do_get_item(item, room, game_state, actor)

      {:denied, reason} ->
        event = %{
          type: :system,
          text: "You can't pick up the #{item.name}: #{reason}",
          timestamp: DateTime.utc_now()
        }

        {:ok, [event]}
    end
  end

  # =============================================================================
  # Private
  # =============================================================================

  defp find_item_by_name(room, name) do
    name_lower = String.downcase(name)
    items = room.items || []

    Enum.find(items, fn item ->
      item_name = item.name || ""
      String.downcase(item_name) |> String.contains?(name_lower)
    end)
  end

  defp check_get_lock(item, actor) do
    locks = Map.get(item, :locks, %{})
    get_lock = Map.get(locks, "get") || Map.get(locks, :get)

    if get_lock do
      Loka.Engine.Locks.check(item, actor, "get")
    else
      :ok
    end
  end

  defp do_get_item(item, room, game_state, actor) do
    # Run before_get hook
    player_context = %{
      player_id: actor.player_id,
      player_name: actor.player_name,
      type: :player
    }

    case Hooks.run_until_halt(:at_before_get, [player_context, %{item: item}]) do
      {:halt, reason} ->
        event = %{
          type: :system,
          text: "You can't pick that up: #{reason}",
          timestamp: DateTime.utc_now()
        }

        {:ok, [event]}

      :ok ->
        # Add item to inventory
        {:ok, updated_game_state} = Inventory.add_item(game_state, item)

        # Remove item from room entity
        remove_item_from_room(room, item)

        # Fire object_receive hook - Framework's QuestListeners will handle quest progress
        item_key = item.key || item.id

        Hooks.run(:at_object_receive, [
          Map.put(player_context, :game_state, updated_game_state),
          %{item_key: item_key, item: item}
        ])

        # Run after_get hook
        Hooks.run(:at_after_get, [player_context, %{item: item}])

        event = %{
          type: :get_item,
          data: %{
            item: item,
            updated_game_state: updated_game_state
          },
          text: "You pick up the #{item.name}.",
          timestamp: DateTime.utc_now()
        }

        {:ok, [event]}
    end
  end

  defp remove_item_from_room(room, item) do
    if room.id do
      case EntityRegistry.lookup(room.id) do
        {:ok, pid} ->
          # Remove item from room's items component
          Loka.Engine.EntityServer.update(pid, fn entity ->
            items = entity.components[:items] || []
            new_items = Enum.reject(items, fn i -> i.id == item.id end)
            put_in(entity.components[:items], new_items)
          end)

        _ ->
          :ok
      end
    end
  end
end
