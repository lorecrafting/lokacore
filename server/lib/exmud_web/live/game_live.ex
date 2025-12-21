defmodule ExmudWeb.GameLive do
  @moduledoc """
  LiveView game client for ExMUD - "Living Ebook" aesthetic.

  A literary, book-like interface with touch/click-based interactions.
  No text input - all interactions via underlined links and menus.
  """
  use ExmudWeb, :live_view

  alias Exmud.DemoGame.{PlayerGameState, RoomLoader}

  alias Exmud.DemoGame.Systems.{
    Inventory,
    Equipment,
    Dialogue,
    Quest,
    Combat,
    Spawner,
    Progression,
    Skills
  }

  alias Exmud.Engine.Entities
  alias Exmud.Accounts
  alias Exmud.Utils.MapHelpers

  import ExmudWeb.GameLive.Components

  @impl true
  def mount(_params, _session, socket) do
    player = socket.assigns.current_scope.player

    # Get or create player game state
    {:ok, game_state} = PlayerGameState.get_or_create_state(player.id)

    # Load room from database (or use starting room if player has no room set)
    {room, game_state} = load_player_room(game_state)

    # Subscribe to room events when connected
    if connected?(socket) and room.id do
      Phoenix.PubSub.subscribe(Exmud.PubSub, "room:#{room.id}")
      Phoenix.PubSub.subscribe(Exmud.PubSub, "player:#{player.id}")

      # Broadcast that this player entered the room
      Phoenix.PubSub.broadcast(
        Exmud.PubSub,
        "room:#{room.id}",
        {:player_entered, player.id, player_display_name(player)}
      )
    end

    # Load inventory item details
    inventory_items = Inventory.list_items(game_state)
    equipped_items = Equipment.get_equipped(game_state)
    active_quests = Quest.get_active_quests(game_state)
    completed_quests = Quest.get_completed_quests(game_state)

    # Load other players in the room
    other_players = load_other_players(room.id, player.id)

    # UI state - panel visibility and transient UI state
    ui_state = %{
      compass_open: false,
      inventory_open: false,
      quest_open: false,
      stats_open: false,
      chat_open: false,
      chat_message: "",
      context_entity: nil
    }

    {:ok,
     socket
     # Game world state
     |> assign(:room, room)
     |> assign(:other_players, other_players)
     # Player game state from DB
     |> assign(:game_state, game_state)
     |> assign(:inventory, game_state.inventory || [])
     |> assign(:inventory_items, inventory_items)
     |> assign(:equipment, game_state.equipment || %{})
     |> assign(:equipped_items, equipped_items)
     |> assign(:quests, game_state.quests || %{})
     |> assign(:active_quests, active_quests)
     |> assign(:completed_quests, completed_quests)
     |> assign(:stats, game_state.stats || %{})
     |> assign(:health, game_state.health || %{})
     # UI state
     |> assign(:ui, ui_state)
     # Interaction state (modals/overlays)
     |> assign(:dialogue, nil)
     |> assign(:dialogue_npc, nil)
     |> assign(:combat, nil)
     |> assign(:cutscene, nil)
     |> assign(:events, [])
     |> maybe_show_intro_cutscene(game_state)}
  end

  @impl true
  def terminate(_reason, socket) do
    # Broadcast that player left when they disconnect
    player = socket.assigns[:current_scope] && socket.assigns.current_scope.player
    room = socket.assigns[:room]

    if player && room && room.id do
      Phoenix.PubSub.broadcast(
        Exmud.PubSub,
        "room:#{room.id}",
        {:player_left, player.id, player_display_name(player), "away"}
      )
    end

    :ok
  end

  # Load the player's current room, falling back to starting room
  defp load_player_room(game_state) do
    room_id = game_state.current_room_id || RoomLoader.get_starting_room_id()

    case RoomLoader.load_room_for_display(room_id) do
      {:ok, room} ->
        # Update player's room if they didn't have one set
        game_state = ensure_room_assigned(game_state, room.id)
        {room, game_state}

      {:error, :not_found} ->
        # No rooms in database - show void
        {RoomLoader.empty_room(), game_state}
    end
  end

  # Ensure player has a room assigned (for new players)
  defp ensure_room_assigned(game_state, room_id) do
    if is_nil(game_state.current_room_id) and not is_nil(room_id) do
      case PlayerGameState.update_state(game_state, %{current_room_id: room_id}) do
        {:ok, updated} -> updated
        _ -> game_state
      end
    else
      game_state
    end
  end

  @impl true
  def render(assigns) do
    ~H"""
    <div class="ebook-page" style="padding-bottom: 5rem;">
      <.active_panel {assigns} />

      <.chat_input_panel :if={@ui.chat_open} />

      <.bottom_bar
        compass_open={@ui.compass_open}
        exits={@room.exits}
        inventory_open={@ui.inventory_open}
        quest_open={@ui.quest_open}
        stats_open={@ui.stats_open}
        chat_open={@ui.chat_open}
      />
    </div>
    """
  end

  # Determines which main panel to show based on current state
  # Priority order: cutscene > combat > dialogue > panels > context > room
  defp active_panel(assigns) do
    cond do
      assigns[:cutscene] ->
        ~H"<.cutscene_panel cutscene={@cutscene} />"

      assigns[:combat] ->
        ~H"""
        <.combat_panel
          combat={@combat}
          health={@health}
          stats={@stats}
          room_title={@room.title}
        />
        """

      assigns[:dialogue] ->
        ~H"""
        <.dialogue_panel
          dialogue={@dialogue}
          npc={@dialogue_npc}
          room_title={@room.title}
        />
        """

      assigns.ui.stats_open ->
        ~H"<.stats_panel game_state={@game_state} health={@health} />"

      assigns.ui.quest_open ->
        ~H"<.quest_panel active_quests={@active_quests} completed_quests={@completed_quests} />"

      assigns.ui.inventory_open ->
        ~H"""
        <.inventory_panel
          inventory_items={@inventory_items}
          equipped_items={@equipped_items}
          stats={@stats}
          health={@health}
        />
        """

      assigns.ui.context_entity ->
        ~H"""
        <.context_panel
          entity={@ui.context_entity}
          room_title={@room.title}
          compass_open={@ui.compass_open}
          exits={@room.exits}
        />
        """

      true ->
        ~H"""
        <.room_view
          room={@room}
          events={@events}
          compass_open={@ui.compass_open}
          other_players={@other_players}
        />
        """
    end
  end

  # Chat Input Panel - overlay for typing messages
  defp chat_input_panel(assigns) do
    ~H"""
    <div class="ebook-chat-overlay">
      <form phx-submit="say" class="ebook-chat-form">
        <input
          type="text"
          name="message"
          placeholder="Say something..."
          autofocus
          autocomplete="off"
          class="ebook-chat-input"
          phx-keydown="chat_keydown"
        />
        <button type="submit" class="ebook-chat-send">Say</button>
        <button type="button" phx-click="toggle_chat" class="ebook-chat-cancel">Cancel</button>
      </form>
    </div>
    """
  end

  # Components are imported from ExmudWeb.GameLive.Components

  # Check if this is the player's first login and show intro cutscene
  defp maybe_show_intro_cutscene(socket, game_state) do
    flags = game_state.flags || %{}
    seen_intro = Map.get(flags, "seen_intro", false) || Map.get(flags, :seen_intro, false)

    if not seen_intro do
      cutscene = %{
        id: "intro",
        title: "The Journey Begins",
        current_page: 0,
        pages: [
          [
            "You awaken beneath the ancient oak tree, its massive branches stretching toward the sky like the arms of a sleeping giant.",
            "The air is thick with the scent of moss and wildflowers. How did you come to be here? The memories are hazy, like a half-forgotten dream."
          ],
          [
            "A voice echoes in your mind—or is it the wind through the leaves?",
            "\"Traveler... the forest has chosen you. Your path lies ahead, shrouded in mystery.\""
          ],
          [
            "You rise to your feet, brushing leaves from your clothes. The world feels different somehow—more vivid, more alive.",
            "In the distance, you hear the murmur of a stream and the call of unfamiliar birds."
          ],
          [
            "Whatever brought you here, whatever fate awaits, one thing is certain:",
            "Your adventure begins now."
          ]
        ]
      }

      assign(socket, :cutscene, cutscene)
    else
      socket
    end
  end

  # Event Handlers

  @impl true
  def handle_event("click_entity", %{"id" => id, "type" => "player"}, socket) do
    # Find the player in other_players list
    entity = find_player_entity(socket.assigns.other_players, id)

    {:noreply, update_ui(socket, %{context_entity: entity, compass_open: false})}
  end

  def handle_event("click_entity", %{"id" => id, "type" => type}, socket) do
    # Find the entity and show context panel
    entity = find_entity(socket.assigns.room, id, type)

    {:noreply, update_ui(socket, %{context_entity: entity, compass_open: false})}
  end

  def handle_event("leave_context", _params, socket) do
    {:noreply, update_ui(socket, %{context_entity: nil})}
  end

  def handle_event("menu_action", %{"action" => "get"}, socket) do
    entity = socket.assigns.ui.context_entity
    game_state = socket.assigns.game_state

    # Get the item entity from database
    item_entity = Entities.get_entity(entity.id)

    if item_entity do
      # Remove item from room (set location_id to nil)
      {:ok, _} = Entities.update_entity(item_entity, %{location_id: nil})

      # Add item to inventory
      case Inventory.add_item(game_state, entity.id) do
        {:ok, new_game_state} ->
          # Track quest progress for get_item objectives
          # Use the entity key (e.g. "rusty_sword") for quest matching
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

          # Reload inventory items and quest lists
          inventory_items = Inventory.list_items(new_game_state)
          active_quests = Quest.get_active_quests(new_game_state)
          completed_quests = Quest.get_completed_quests(new_game_state)

          # Reload room to reflect item being removed
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

  def handle_event("menu_action", %{"action" => "talk"}, socket) do
    entity = socket.assigns.ui.context_entity
    player_quests = socket.assigns.quests

    # Try to start a dialogue with this NPC, passing quest state to filter choices
    case Dialogue.start_conversation(entity.id, player_quests: player_quests) do
      {:ok, dialogue_node} ->
        {:noreply,
         socket
         |> assign(:dialogue, dialogue_node)
         |> assign(:dialogue_npc, entity)
         |> update_ui(%{context_entity: nil})}

      {:error, _reason} ->
        # NPC has no dialogue, show default message
        event = %{
          text: "The #{entity.name} nods in acknowledgment.",
          timestamp: DateTime.utc_now()
        }

        {:noreply,
         socket
         |> update_ui(%{context_entity: nil})
         |> update(:events, fn events -> events ++ [event] end)}
    end
  end

  def handle_event("menu_action", %{"action" => "attack"}, socket) do
    entity = socket.assigns.ui.context_entity
    game_state = socket.assigns.game_state

    # Start combat with this entity
    case Combat.start_combat(entity.id, game_state) do
      {:ok, combat_state} ->
        {:noreply,
         socket
         |> assign(:combat, combat_state)
         |> update_ui(%{context_entity: nil})}

      {:error, :not_combatant} ->
        event = %{
          text: "The #{entity.name} doesn't want to fight.",
          timestamp: DateTime.utc_now()
        }

        {:noreply,
         socket
         |> update_ui(%{context_entity: nil})
         |> update(:events, fn events -> events ++ [event] end)}

      {:error, _reason} ->
        {:noreply, update_ui(socket, %{context_entity: nil})}
    end
  end

  def handle_event("menu_action", %{"action" => "attack_player"}, socket) do
    entity = socket.assigns.ui.context_entity
    player = socket.assigns.current_scope.player
    player_name = player_display_name(player)
    game_state = socket.assigns.game_state
    room = socket.assigns.room

    # Start PvP combat
    case Combat.start_pvp_combat(entity.id, entity.name, game_state) do
      {:ok, combat_state} ->
        # Broadcast attack to room (so target player and others see it)
        if room.id do
          Phoenix.PubSub.broadcast(
            Exmud.PubSub,
            "room:#{room.id}",
            {:player_attacks, player.id, player_name, entity.id, entity.name}
          )
        end

        {:noreply,
         socket
         |> assign(:combat, combat_state)
         |> update_ui(%{context_entity: nil})}

      {:error, :player_not_found} ->
        event = %{
          text: "#{entity.name} is no longer here.",
          timestamp: DateTime.utc_now()
        }

        {:noreply,
         socket
         |> update_ui(%{context_entity: nil})
         |> update(:events, fn events -> events ++ [event] end)}

      {:error, _reason} ->
        {:noreply, update_ui(socket, %{context_entity: nil})}
    end
  end

  def handle_event("menu_action", %{"action" => action}, socket) do
    entity = socket.assigns.ui.context_entity

    # Add event for the action
    event = %{
      text: action_text(action, entity),
      timestamp: DateTime.utc_now()
    }

    {:noreply,
     socket
     |> update_ui(%{context_entity: nil})
     |> update(:events, fn events -> events ++ [event] end)}
  end

  # Combat event handlers
  @combat_actions %{"attack" => :attack, "defend" => :defend, "flee" => :flee}

  def handle_event("combat_action", %{"action" => action}, socket) do
    combat = socket.assigns.combat
    game_state = socket.assigns.game_state

    action_atom = Map.get(@combat_actions, action, :attack)

    case Combat.player_action(combat, action_atom, game_state) do
      {:ok, new_combat, _result} ->
        # Check if combat ended after player action
        case Combat.check_combat_end(new_combat, game_state) do
          {:victory, rewards} ->
            handle_combat_victory(socket, new_combat, rewards)

          {:fled} ->
            handle_combat_fled(socket, new_combat)

          :ongoing ->
            # Enemy takes their turn after a short delay
            send(self(), {:enemy_turn, new_combat})
            {:noreply, assign(socket, :combat, new_combat)}
        end

      {:error, _reason} ->
        {:noreply, socket}
    end
  end

  # Cutscene event handlers
  def handle_event("cutscene_next", _params, socket) do
    cutscene = socket.assigns.cutscene
    new_cutscene = %{cutscene | current_page: cutscene.current_page + 1}
    {:noreply, assign(socket, :cutscene, new_cutscene)}
  end

  def handle_event("cutscene_end", _params, socket) do
    cutscene = socket.assigns.cutscene
    game_state = socket.assigns.game_state

    # Mark the cutscene as seen
    if cutscene.id == "intro" do
      flags = game_state.flags || %{}
      new_flags = Map.put(flags, "seen_intro", true)
      {:ok, new_game_state} = PlayerGameState.update_state(game_state, %{flags: new_flags})

      {:noreply,
       socket
       |> assign(:cutscene, nil)
       |> assign(:game_state, new_game_state)}
    else
      {:noreply, assign(socket, :cutscene, nil)}
    end
  end

  def handle_event("toggle_compass", _params, socket) do
    {:noreply, toggle_ui_panel(socket, :compass_open)}
  end

  def handle_event("dialogue_choice", %{"index" => index_str}, socket) do
    index = String.to_integer(index_str)
    npc = socket.assigns.dialogue_npc
    current_node = socket.assigns.dialogue
    player_quests = socket.assigns.quests

    case Dialogue.choose_option(npc.id, index, current_node.id, player_quests: player_quests) do
      {:ok, :end, %{action: action}} ->
        socket = handle_dialogue_action(socket, action)

        {:noreply,
         socket
         |> assign(:dialogue, nil)
         |> assign(:dialogue_npc, nil)}

      {:ok, next_node, %{action: action}} ->
        socket = handle_dialogue_action(socket, action)

        {:noreply, assign(socket, :dialogue, next_node)}

      {:error, _} ->
        {:noreply,
         socket
         |> assign(:dialogue, nil)
         |> assign(:dialogue_npc, nil)}
    end
  end

  def handle_event("end_dialogue", _params, socket) do
    {:noreply,
     socket
     |> assign(:dialogue, nil)
     |> assign(:dialogue_npc, nil)}
  end

  def handle_event("toggle_inventory", _params, socket) do
    {:noreply, toggle_ui_panel(socket, :inventory_open)}
  end

  def handle_event("toggle_quest", _params, socket) do
    {:noreply, toggle_ui_panel(socket, :quest_open)}
  end

  def handle_event("toggle_stats", _params, socket) do
    {:noreply, toggle_ui_panel(socket, :stats_open)}
  end

  def handle_event("toggle_chat", _params, socket) do
    {:noreply, toggle_ui_panel(socket, :chat_open)}
  end

  def handle_event("say", %{"message" => message}, socket) do
    message = String.trim(message)

    if message != "" do
      player = socket.assigns.current_scope.player
      player_name = player_display_name(player)
      room = socket.assigns.room

      # Broadcast to room
      if room.id do
        Phoenix.PubSub.broadcast(
          Exmud.PubSub,
          "room:#{room.id}",
          {:player_says, player.id, player_name, message}
        )
      end

      # Add event for self (we'll also receive the broadcast, but filter it out)
      event = %{
        text: "You say, \"#{message}\"",
        timestamp: DateTime.utc_now()
      }

      {:noreply,
       socket
       |> update_ui(%{chat_open: false})
       |> update(:events, fn events -> events ++ [event] end)}
    else
      {:noreply, update_ui(socket, %{chat_open: false})}
    end
  end

  def handle_event("chat_keydown", %{"key" => "Escape"}, socket) do
    {:noreply, update_ui(socket, %{chat_open: false})}
  end

  def handle_event("chat_keydown", _params, socket) do
    {:noreply, socket}
  end

  def handle_event("turn_in_quest", %{"id" => quest_id}, socket) do
    game_state = socket.assigns.game_state

    case Quest.turn_in_quest(game_state, quest_id) do
      {:ok, new_game_state, rewards} ->
        # Reload quest lists
        active_quests = Quest.get_active_quests(new_game_state)
        completed_quests = Quest.get_completed_quests(new_game_state)

        # Build reward message
        reward_text = format_rewards(rewards)

        event = %{
          text: "Quest complete! #{reward_text}",
          timestamp: DateTime.utc_now()
        }

        {:noreply,
         socket
         |> assign(:game_state, new_game_state)
         |> assign(:quests, new_game_state.quests)
         |> assign(:active_quests, active_quests)
         |> assign(:completed_quests, completed_quests)
         |> assign(:stats, new_game_state.stats)
         |> update_ui(%{quest_open: false})
         |> update(:events, fn events -> events ++ [event] end)}

      {:error, :quest_not_complete} ->
        event = %{
          text: "You haven't completed all objectives yet.",
          timestamp: DateTime.utc_now()
        }

        {:noreply, update(socket, :events, fn events -> events ++ [event] end)}

      {:error, _reason} ->
        {:noreply, socket}
    end
  end

  def handle_event("inventory_item_click", %{"id" => item_id}, socket) do
    # For now, just show a message. Later this will open item actions menu.
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

  def handle_event("drop_item", %{"id" => item_id}, socket) do
    game_state = socket.assigns.game_state
    room = socket.assigns.room
    item = Enum.find(socket.assigns.inventory_items, fn i -> i.id == item_id end)

    if item && room.id do
      # Get the item entity from database
      item_entity = Entities.get_entity(item_id)

      if item_entity do
        # Set item's location to current room
        {:ok, _} = Entities.update_entity(item_entity, %{location_id: room.id})

        # Remove from inventory
        case Inventory.remove_item(game_state, item_id) do
          {:ok, new_game_state} ->
            # Reload inventory items and room
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

  def handle_event("equip_item", %{"id" => item_id}, socket) do
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

  @equipment_slots %{"weapon" => :weapon, "armor" => :armor, "accessory" => :accessory}

  def handle_event("unequip_item", %{"slot" => slot_string}, socket) do
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

  def handle_event("navigate", %{"direction" => direction}, socket) do
    room = socket.assigns.room
    game_state = socket.assigns.game_state

    # Find the exit for this direction
    exit = Enum.find(room.exits, fn e -> e.direction == direction end)

    case exit do
      nil ->
        # No exit in that direction (shouldn't happen if UI is correct)
        {:noreply, socket}

      %{destination_id: nil} ->
        # Exit exists but destination_id is nil (misconfigured)
        event = %{
          text: "The path #{direction} seems to lead nowhere...",
          timestamp: DateTime.utc_now()
        }

        {:noreply,
         socket
         |> update_ui(%{compass_open: false})
         |> update(:events, fn events -> events ++ [event] end)}

      %{destination_id: destination_id} ->
        player = socket.assigns.current_scope.player
        player_name = player_display_name(player)

        # Broadcast leave to old room before unsubscribing
        if room.id do
          Phoenix.PubSub.broadcast(
            Exmud.PubSub,
            "room:#{room.id}",
            {:player_left, player.id, player_name, direction}
          )

          Phoenix.PubSub.unsubscribe(Exmud.PubSub, "room:#{room.id}")
        end

        # Update player's current room
        {:ok, new_game_state} =
          PlayerGameState.update_state(game_state, %{current_room_id: destination_id})

        # Load new room
        case RoomLoader.load_room_for_display(destination_id) do
          {:ok, new_room} ->
            # Subscribe to new room events
            Phoenix.PubSub.subscribe(Exmud.PubSub, "room:#{new_room.id}")

            # Broadcast enter to new room
            Phoenix.PubSub.broadcast(
              Exmud.PubSub,
              "room:#{new_room.id}",
              {:player_entered, player.id, player_name}
            )

            # Load other players in new room
            other_players = load_other_players(new_room.id, player.id)

            # Create movement event for display
            event = %{
              text: "You head #{direction} to #{new_room.title}.",
              timestamp: DateTime.utc_now()
            }

            {:noreply,
             socket
             |> assign(:room, new_room)
             |> assign(:game_state, new_game_state)
             |> assign(:other_players, other_players)
             |> update_ui(%{compass_open: false, context_entity: nil})
             |> assign(:events, [event])}

          {:error, :not_found} ->
            event = %{
              text: "Something went wrong... the path #{direction} leads to nowhere.",
              timestamp: DateTime.utc_now()
            }

            {:noreply,
             socket
             |> update_ui(%{compass_open: false})
             |> update(:events, fn events -> events ++ [event] end)}
        end
    end
  end

  @impl true
  def handle_info({:enemy_turn, combat}, socket) do
    game_state = socket.assigns.game_state

    case Combat.enemy_turn(combat, game_state) do
      {:ok, new_combat, %{action: :attack, damage: damage}} ->
        # Apply damage to player
        current_health = socket.assigns.health

        current_hp = MapHelpers.get_flexible(current_health, :current, 100)

        new_hp = max(0, current_hp - damage)
        new_health = Map.put(current_health, "current", new_hp)

        # Update game state in DB
        {:ok, new_game_state} = PlayerGameState.update_state(game_state, %{health: new_health})

        # Check if player died
        case Combat.check_combat_end(new_combat, new_game_state) do
          {:defeat} ->
            handle_combat_defeat(socket, new_combat, new_game_state)

          :ongoing ->
            {:noreply,
             socket
             |> assign(:combat, new_combat)
             |> assign(:health, new_health)
             |> assign(:game_state, new_game_state)}
        end

      {:ok, new_combat, _result} ->
        # Enemy defended
        {:noreply, assign(socket, :combat, new_combat)}

      {:error, _reason} ->
        {:noreply, socket}
    end
  end

  # Handle player entering the room
  def handle_info({:player_entered, player_id, player_name}, socket) do
    current_player = socket.assigns.current_scope.player

    # Ignore our own enter event
    if player_id == current_player.id do
      {:noreply, socket}
    else
      # Add player to other_players list
      new_player = %{id: player_id, name: player_name}

      other_players =
        socket.assigns.other_players
        |> Enum.reject(fn p -> p.id == player_id end)
        |> Kernel.++([new_player])

      event = %{
        text: "#{player_name} arrives.",
        timestamp: DateTime.utc_now()
      }

      {:noreply,
       socket
       |> assign(:other_players, other_players)
       |> update(:events, fn events -> events ++ [event] end)}
    end
  end

  # Handle player leaving the room
  def handle_info({:player_left, player_id, player_name, direction}, socket) do
    current_player = socket.assigns.current_scope.player

    # Ignore our own leave event
    if player_id == current_player.id do
      {:noreply, socket}
    else
      # Remove player from other_players list
      other_players = Enum.reject(socket.assigns.other_players, fn p -> p.id == player_id end)

      event = %{
        text: "#{player_name} leaves #{direction}.",
        timestamp: DateTime.utc_now()
      }

      {:noreply,
       socket
       |> assign(:other_players, other_players)
       |> update(:events, fn events -> events ++ [event] end)}
    end
  end

  # Handle player chat messages
  def handle_info({:player_says, player_id, player_name, message}, socket) do
    current_player = socket.assigns.current_scope.player

    # Ignore our own message (we already added it locally)
    if player_id == current_player.id do
      {:noreply, socket}
    else
      event = %{
        text: "#{player_name} says, \"#{message}\"",
        timestamp: DateTime.utc_now()
      }

      {:noreply, update(socket, :events, fn events -> events ++ [event] end)}
    end
  end

  # Handle player attacking another player
  def handle_info({:player_attacks, attacker_id, attacker_name, target_id, _target_name}, socket) do
    current_player = socket.assigns.current_scope.player

    # Ignore our own attack (we already added it locally)
    if attacker_id == current_player.id do
      {:noreply, socket}
    else
      event =
        if target_id == current_player.id do
          # We are the target!
          %{
            text: "#{attacker_name} attacks you!",
            timestamp: DateTime.utc_now()
          }
        else
          # We're just a bystander
          %{
            text: "#{attacker_name} attacks another player!",
            timestamp: DateTime.utc_now()
          }
        end

      {:noreply, update(socket, :events, fn events -> events ++ [event] end)}
    end
  end

  # Handle player being defeated in PvP
  def handle_info(
        {:player_defeated, victor_id, victor_name, defeated_id, _defeated_name},
        socket
      ) do
    current_player = socket.assigns.current_scope.player

    # Ignore our own victory (we already handled it locally)
    if victor_id == current_player.id do
      {:noreply, socket}
    else
      event =
        if defeated_id == current_player.id do
          # We were defeated!
          %{
            text: "You have been defeated by #{victor_name}!",
            timestamp: DateTime.utc_now()
          }
        else
          # We're just a bystander
          %{
            text: "#{victor_name} has defeated another player!",
            timestamp: DateTime.utc_now()
          }
        end

      {:noreply, update(socket, :events, fn events -> events ++ [event] end)}
    end
  end

  # Handle mob respawn notifications
  def handle_info({:mob_respawned, _entity_id, mob_name}, socket) do
    # Reload room to show the respawned mob
    {:ok, room} = RoomLoader.load_room_for_display(socket.assigns.room.id)

    event = %{
      text: "A #{mob_name} emerges from the shadows.",
      timestamp: DateTime.utc_now()
    }

    {:noreply,
     socket
     |> assign(:room, room)
     |> update(:events, fn events -> events ++ [event] end)}
  end

  defp handle_combat_victory(socket, combat, rewards) do
    game_state = socket.assigns.game_state
    room = socket.assigns.room
    is_pvp = Map.get(combat, :pvp, false)

    # For PvE, despawn the defeated mob (will respawn after delay)
    # For PvP, broadcast defeat to the target player
    if is_pvp do
      player = socket.assigns.current_scope.player
      player_name = player_display_name(player)

      # Broadcast to room that we defeated the player
      if room.id do
        Phoenix.PubSub.broadcast(
          Exmud.PubSub,
          "room:#{room.id}",
          {:player_defeated, player.id, player_name, combat.enemy_id, combat.enemy.name}
        )
      end
    else
      Spawner.despawn_mob(combat.enemy_id)
    end

    # Apply rewards (may include level up)
    {new_game_state, level_up_event} =
      case Combat.apply_rewards(game_state, rewards) do
        {:ok, updated_state} ->
          {updated_state, nil}

        {:ok, updated_state, level_up_info} ->
          level_event = %{
            text:
              "LEVEL UP! You are now level #{level_up_info.new_level}. Gained #{level_up_info.skill_points_gained} skill points!",
            timestamp: DateTime.utc_now()
          }

          {updated_state, level_event}
      end

    # Reload room to reflect mob despawn (for PvE)
    {:ok, updated_room} = RoomLoader.load_room_for_display(room.id)

    victory_event =
      if is_pvp do
        %{
          text: "Victory! You defeated #{combat.enemy.name}. Gained #{rewards.xp} XP.",
          timestamp: DateTime.utc_now()
        }
      else
        %{
          text:
            "Victory! You defeated the #{combat.enemy.name}. Gained #{rewards.xp} XP and #{rewards.gold} gold.",
          timestamp: DateTime.utc_now()
        }
      end

    events = [victory_event] ++ if(level_up_event, do: [level_up_event], else: [])

    {:noreply,
     socket
     |> assign(:combat, nil)
     |> assign(:game_state, new_game_state)
     |> assign(:stats, new_game_state.stats)
     |> assign(:health, new_game_state.health)
     |> assign(:room, updated_room)
     |> update(:events, fn e -> e ++ events end)}
  end

  defp handle_combat_fled(socket, combat) do
    event = %{
      text: "You fled from the #{combat.enemy.name}!",
      timestamp: DateTime.utc_now()
    }

    {:noreply,
     socket
     |> assign(:combat, nil)
     |> update(:events, fn events -> events ++ [event] end)}
  end

  defp handle_combat_defeat(socket, combat, game_state) do
    # Reset player health to max (respawn)
    current_health = game_state.health
    max_hp = MapHelpers.get_flexible(current_health, :max, 100)
    new_health = Map.put(current_health, "current", max_hp)

    {:ok, new_game_state} = PlayerGameState.update_state(game_state, %{health: new_health})

    event = %{
      text: "You were defeated by the #{combat.enemy.name}... You wake up feeling disoriented.",
      timestamp: DateTime.utc_now()
    }

    {:noreply,
     socket
     |> assign(:combat, nil)
     |> assign(:health, new_health)
     |> assign(:game_state, new_game_state)
     |> update(:events, fn events -> events ++ [event] end)}
  end

  # Helper Functions

  defp find_entity(room, id, "npc") do
    entity = Enum.find(room.entities, fn e -> e.id == id end)

    if entity do
      # Load full entity from DB to get components
      db_entity = Entities.get_entity(id)
      components = if db_entity, do: db_entity.components || %{}, else: %{}

      %{
        id: entity.id,
        name: entity.name,
        type: :npc,
        description: entity.description || "A #{entity.name} #{entity.short_desc}.",
        components: components
      }
    end
  end

  defp find_entity(room, id, "item") do
    item = Enum.find(room.items, fn i -> i.id == id end)

    if item do
      # Load full entity from DB to get components
      db_entity = Entities.get_entity(id)
      components = if db_entity, do: db_entity.components || %{}, else: %{}

      %{
        id: item.id,
        name: item.name,
        type: :item,
        description: item.description || "#{item.desc} #{item.name}.",
        components: components
      }
    end
  end

  defp find_player_entity(other_players, id) do
    player = Enum.find(other_players, fn p -> to_string(p.id) == to_string(id) end)

    if player do
      %{
        id: player.id,
        name: player.name,
        type: :player,
        description: "#{player.name} stands here, a fellow adventurer.",
        components: %{}
      }
    end
  end

  defp action_text("inspect", entity), do: "You carefully inspect the #{entity.name}."
  defp action_text("talk", entity), do: "The #{entity.name} nods in acknowledgment."
  defp action_text("trade", entity), do: "The #{entity.name} has nothing to trade."
  defp action_text("quest", entity), do: "The #{entity.name} has no quests for you."
  defp action_text("attack", entity), do: "You ready yourself against the #{entity.name}."
  defp action_text(_, _), do: "Nothing happens."

  defp format_rewards(rewards) do
    parts = []
    xp = Map.get(rewards, "xp") || Map.get(rewards, :xp, 0)
    gold = Map.get(rewards, "gold") || Map.get(rewards, :gold, 0)
    items = Map.get(rewards, "items") || Map.get(rewards, :items, [])

    parts = if xp > 0, do: parts ++ ["#{xp} XP"], else: parts
    parts = if gold > 0, do: parts ++ ["#{gold} gold"], else: parts
    parts = if length(items) > 0, do: parts ++ ["#{length(items)} item(s)"], else: parts

    case parts do
      [] -> ""
      _ -> "Received: " <> Enum.join(parts, ", ") <> "."
    end
  end

  # Dialogue action handler
  defp handle_dialogue_action(socket, nil), do: socket

  defp handle_dialogue_action(socket, {:accept_quest, quest_id}) do
    game_state = socket.assigns.game_state

    case Quest.accept_quest(game_state, quest_id) do
      {:ok, new_game_state} ->
        # Reload quest lists
        active_quests = Quest.get_active_quests(new_game_state)
        completed_quests = Quest.get_completed_quests(new_game_state)

        # Get quest name for the event message
        quest_def = Quest.get_quest_definition(quest_id)
        quest_name = if quest_def, do: quest_def.name, else: quest_id

        event = %{
          text: "New quest: #{quest_name}",
          timestamp: DateTime.utc_now()
        }

        socket
        |> assign(:game_state, new_game_state)
        |> assign(:quests, new_game_state.quests)
        |> assign(:active_quests, active_quests)
        |> assign(:completed_quests, completed_quests)
        |> update(:events, fn events -> events ++ [event] end)

      {:error, :already_active} ->
        event = %{
          text: "You already have this quest.",
          timestamp: DateTime.utc_now()
        }

        update(socket, :events, fn events -> events ++ [event] end)

      {:error, :already_completed} ->
        event = %{
          text: "You've already completed this quest.",
          timestamp: DateTime.utc_now()
        }

        update(socket, :events, fn events -> events ++ [event] end)

      {:error, _reason} ->
        socket
    end
  end

  defp handle_dialogue_action(socket, {:give_item, item_id}) do
    game_state = socket.assigns.game_state

    case Inventory.add_item(game_state, item_id) do
      {:ok, new_game_state} ->
        inventory_items = Inventory.list_items(new_game_state)

        event = %{
          text: "You received an item.",
          timestamp: DateTime.utc_now()
        }

        socket
        |> assign(:game_state, new_game_state)
        |> assign(:inventory, new_game_state.inventory)
        |> assign(:inventory_items, inventory_items)
        |> update(:events, fn events -> events ++ [event] end)

      {:error, _} ->
        socket
    end
  end

  defp handle_dialogue_action(socket, {:set_flag, flag_name}) do
    game_state = socket.assigns.game_state
    flags = game_state.flags || %{}
    new_flags = Map.put(flags, flag_name, true)

    case PlayerGameState.update_state(game_state, %{flags: new_flags}) do
      {:ok, new_game_state} ->
        assign(socket, :game_state, new_game_state)

      {:error, _} ->
        socket
    end
  end

  defp handle_dialogue_action(socket, {:learn_skill, skill_id, skill_cost}) do
    game_state = socket.assigns.game_state
    skill = Skills.get_skill(skill_id)

    case Progression.learn_skill(game_state, skill_id, skill_cost) do
      {:ok, new_game_state} ->
        skill_name = if skill, do: skill.name, else: skill_id

        event = %{
          text: "You have learned #{skill_name}! (#{skill_cost} skill points spent)",
          timestamp: DateTime.utc_now()
        }

        socket
        |> assign(:game_state, new_game_state)
        |> assign(:stats, new_game_state.stats)
        |> update(:events, fn events -> events ++ [event] end)

      {:error, :not_enough_skill_points} ->
        event = %{
          text: "You don't have enough skill points to learn this skill.",
          timestamp: DateTime.utc_now()
        }

        update(socket, :events, fn events -> events ++ [event] end)

      {:error, :already_learned} ->
        event = %{
          text: "You already know this skill.",
          timestamp: DateTime.utc_now()
        }

        update(socket, :events, fn events -> events ++ [event] end)

      {:error, _} ->
        socket
    end
  end

  defp handle_dialogue_action(socket, _unknown_action), do: socket

  # Load other players in a room (excluding self)
  defp load_other_players(nil, _player_id), do: []

  defp load_other_players(room_id, player_id) do
    room_id
    |> PlayerGameState.get_players_in_room(exclude: player_id)
    |> Enum.map(fn pid ->
      case Accounts.get_player(pid) do
        nil -> nil
        player -> %{id: player.id, name: player_display_name(player)}
      end
    end)
    |> Enum.reject(&is_nil/1)
  end

  # Extract display name from player (uses email username)
  defp player_display_name(%{email: email}) when is_binary(email) do
    email
    |> String.split("@")
    |> List.first()
    |> String.capitalize()
  end

  defp player_display_name(_), do: "Someone"

  # UI state helpers

  # Updates the ui assign map with new values
  defp update_ui(socket, updates) when is_map(updates) do
    update(socket, :ui, fn ui -> Map.merge(ui, updates) end)
  end

  # Panel toggle helper - toggles the specified panel and closes all others
  @ui_panels [:compass_open, :inventory_open, :quest_open, :stats_open, :chat_open]

  defp toggle_ui_panel(socket, panel) when panel in @ui_panels do
    current_value = socket.assigns.ui[panel]
    new_value = !current_value

    # Close all panels, then set the toggled one
    closed_panels = Map.new(@ui_panels, fn p -> {p, false} end)

    updates =
      closed_panels
      |> Map.put(panel, new_value)
      |> Map.put(:context_entity, nil)

    update_ui(socket, updates)
  end
end
