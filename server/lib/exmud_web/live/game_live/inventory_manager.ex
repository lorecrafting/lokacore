defmodule ExmudWeb.GameLive.InventoryManager do
  @moduledoc """
  Inventory and equipment event handlers for GameLive.

  Handles:
  - Getting items from the room
  - Dropping items
  - Equipping/unequipping items
  - Inventory item interactions
  """

  import Phoenix.Component, only: [assign: 3, update: 3]

  alias Exmud.Framework.Player.GameState, as: PlayerGameState
  alias Exmud.Framework.World.RoomLoader
  alias Exmud.Framework.Inventory
  alias Exmud.Framework.Equipment
  alias Exmud.Framework.Quest
  alias Exmud.Engine.Entities

  @equipment_slots %{"weapon" => :weapon, "armor" => :armor, "accessory" => :accessory}

  @doc """
  Handles picking up an item from the room.
  """
  def handle_get_item(socket, entity) do
    game_state = socket.assigns.game_state
    item_entity = Entities.get_entity(entity.id)

    if item_entity do
      {:ok, _} = Entities.update_entity(item_entity, %{location_id: nil})

      case Inventory.add_item(game_state, entity.id) do
        {:ok, new_game_state} ->
          item_key = item_entity.key || entity.id

          {new_game_state, objective_events} =
            case Quest.update_progress(new_game_state, %{type: :get_item, target_id: item_key}) do
              {:ok, updated_state, completed_objectives} ->
                events =
                  Enum.map(completed_objectives, fn {_quest_id, obj_id} ->
                    %{text: "Objective complete: #{obj_id}", timestamp: DateTime.utc_now()}
                  end)

                {updated_state, events}

              {:error, _} ->
                {new_game_state, []}
            end

          inventory_items = Inventory.list_items(new_game_state)
          active_quests = Quest.get_active_quests(new_game_state)
          completed_quests = Quest.get_completed_quests(new_game_state)

          {:ok, room} = RoomLoader.load_room_for_display(socket.assigns.room.id)

          event = %{
            text: "You pick up the #{entity.name}.",
            timestamp: DateTime.utc_now()
          }

          {:noreply,
           socket
           |> assign(:game_state, new_game_state)
           |> assign(:inventory, new_game_state.inventory)
           |> assign(:inventory_items, inventory_items)
           |> assign(:quests, new_game_state.quests)
           |> assign(:active_quests, active_quests)
           |> assign(:completed_quests, completed_quests)
           |> assign(:room, room)
           |> update_ui(%{context_entity: nil})
           |> update(:events, fn events -> events ++ [event] ++ objective_events end)}

        {:error, _reason} ->
          event = %{
            text: "You can't pick up the #{entity.name}.",
            timestamp: DateTime.utc_now()
          }

          {:noreply,
           socket
           |> update_ui(%{context_entity: nil})
           |> update(:events, fn events -> events ++ [event] end)}
      end
    else
      {:noreply, update_ui(socket, %{context_entity: nil})}
    end
  end

  @doc """
  Handles dropping an item from inventory.
  """
  def handle_drop_item(socket, item_id) do
    game_state = socket.assigns.game_state
    room = socket.assigns.room
    item = Enum.find(socket.assigns.inventory_items, fn i -> i.id == item_id end)

    if item && room.id do
      item_entity = Entities.get_entity(item_id)

      if item_entity do
        {:ok, _} = Entities.update_entity(item_entity, %{location_id: room.id})

        case Inventory.remove_item(game_state, item_id) do
          {:ok, new_game_state} ->
            inventory_items = Inventory.list_items(new_game_state)
            {:ok, new_room} = RoomLoader.load_room_for_display(room.id)

            event = %{
              text: "You drop the #{item.name}.",
              timestamp: DateTime.utc_now()
            }

            {:noreply,
             socket
             |> assign(:game_state, new_game_state)
             |> assign(:inventory, new_game_state.inventory)
             |> assign(:inventory_items, inventory_items)
             |> assign(:room, new_room)
             |> update(:events, fn events -> events ++ [event] end)}

          {:error, _} ->
            {:noreply, socket}
        end
      else
        {:noreply, socket}
      end
    else
      {:noreply, socket}
    end
  end

  @doc """
  Handles equipping an item.
  """
  def handle_equip_item(socket, item_id) do
    game_state = socket.assigns.game_state
    item = Enum.find(socket.assigns.inventory_items, fn i -> i.id == item_id end)

    if item do
      case Equipment.equip(game_state, item_id) do
        {:ok, new_game_state} ->
          inventory_items = Inventory.list_items(new_game_state)
          equipped_items = Equipment.get_equipped(new_game_state)

          event = %{
            text: "You equip the #{item.name}.",
            timestamp: DateTime.utc_now()
          }

          {:noreply,
           socket
           |> assign(:game_state, new_game_state)
           |> assign(:inventory, new_game_state.inventory)
           |> assign(:inventory_items, inventory_items)
           |> assign(:equipment, new_game_state.equipment)
           |> assign(:equipped_items, equipped_items)
           |> update(:events, fn events -> events ++ [event] end)}

        {:error, :not_equipable} ->
          event = %{
            text: "You can't equip the #{item.name}.",
            timestamp: DateTime.utc_now()
          }

          {:noreply, update(socket, :events, fn events -> events ++ [event] end)}

        {:error, {:requirements_not_met, _}} ->
          event = %{
            text: "You don't meet the requirements to equip the #{item.name}.",
            timestamp: DateTime.utc_now()
          }

          {:noreply, update(socket, :events, fn events -> events ++ [event] end)}

        {:error, _} ->
          {:noreply, socket}
      end
    else
      {:noreply, socket}
    end
  end

  @doc """
  Handles unequipping an item from a slot.
  """
  def handle_unequip_item(socket, slot_string) do
    game_state = socket.assigns.game_state
    slot = Map.get(@equipment_slots, slot_string)

    if slot do
      case Equipment.unequip(game_state, slot) do
        {:ok, new_game_state} ->
          inventory_items = Inventory.list_items(new_game_state)
          equipped_items = Equipment.get_equipped(new_game_state)

          event = %{
            text: "You unequip your #{slot_string}.",
            timestamp: DateTime.utc_now()
          }

          {:noreply,
           socket
           |> assign(:game_state, new_game_state)
           |> assign(:inventory, new_game_state.inventory)
           |> assign(:inventory_items, inventory_items)
           |> assign(:equipment, new_game_state.equipment)
           |> assign(:equipped_items, equipped_items)
           |> update(:events, fn events -> events ++ [event] end)}

        {:error, :slot_empty} ->
          {:noreply, socket}

        {:error, _} ->
          {:noreply, socket}
      end
    else
      {:noreply, socket}
    end
  end

  @doc """
  Handles clicking on an inventory item.
  """
  def handle_item_click(socket, item_id) do
    item = Enum.find(socket.assigns.inventory_items, fn i -> i.id == item_id end)

    if item do
      event = %{
        text: "You examine the #{item.name}.",
        timestamp: DateTime.utc_now()
      }

      {:noreply,
       socket
       |> update_ui(%{inventory_open: false})
       |> update(:events, fn events -> events ++ [event] end)}
    else
      {:noreply, socket}
    end
  end

  # Private helpers

  defp update_ui(socket, updates) do
    update(socket, :ui, fn ui -> Map.merge(ui, updates) end)
  end
end
