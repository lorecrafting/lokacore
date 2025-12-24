defmodule ExmudWeb.GameLive do
  @moduledoc """
  LiveView game client for ExMUD - "Living Ebook" aesthetic.

  A literary, book-like interface with touch/click-based interactions.
  No text input - all interactions via underlined links and menus.

  This is the main coordinator module. Event handling is delegated to:
  - `ExmudWeb.GameLive.RoomManager` - Room loading and navigation
  - `ExmudWeb.GameLive.CombatManager` - Combat actions and outcomes
  - `ExmudWeb.GameLive.InventoryManager` - Inventory and equipment
  - `ExmudWeb.GameLive.DialogueManager` - NPC dialogue
  - `ExmudWeb.GameLive.Components` - UI components
  """
  use ExmudWeb, :live_view

  alias Exmud.Framework.Player.GameState, as: PlayerGameState
  alias Exmud.Framework.Inventory
  alias Exmud.Framework.Equipment
  alias Exmud.Framework.Quest
  alias Exmud.Engine.Entities
  alias Exmud.Session

  alias ExmudWeb.GameLive.RoomManager
  alias ExmudWeb.GameLive.CombatManager
  alias ExmudWeb.GameLive.InventoryManager
  alias ExmudWeb.GameLive.DialogueManager

  import ExmudWeb.GameLive.Components

  # =============================================================================
  # Mount and Terminate
  # =============================================================================

  @impl true
  def mount(_params, _session, socket) do
    player = socket.assigns.current_scope.player

    # Get or create player game state
    {:ok, game_state} = PlayerGameState.get_or_create_state(player.id)

    # Load room from database (or use starting room if player has no room set)
    {room, game_state} = RoomManager.load_player_room(game_state)

    # Subscribe to room events when connected
    if connected?(socket) and room.id do
      Phoenix.PubSub.subscribe(Exmud.PubSub, "room:#{room.id}")
      Phoenix.PubSub.subscribe(Exmud.PubSub, "player:#{player.id}")

      # Register with session system for unified client messaging
      {:ok, _session_pid} = Session.connect(player, :liveview, self())
      Session.update_room(player.id, room.id)

      # Broadcast that this player entered the room
      Phoenix.PubSub.broadcast(
        Exmud.PubSub,
        "room:#{room.id}",
        {:player_entered, player.id, RoomManager.player_display_name(player)}
      )
    end

    # Load inventory item details
    inventory_items = Inventory.list_items(game_state)
    equipped_items = Equipment.get_equipped(game_state)
    active_quests = Quest.get_active_quests(game_state)
    completed_quests = Quest.get_completed_quests(game_state)

    # Load other players in the room
    other_players = RoomManager.load_other_players(room.id, player.id)

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
    player = socket.assigns[:current_scope] && socket.assigns.current_scope.player
    room = socket.assigns[:room]

    if player && room && room.id do
      Phoenix.PubSub.broadcast(
        Exmud.PubSub,
        "room:#{room.id}",
        {:player_left, player.id, RoomManager.player_display_name(player), "away"}
      )
    end

    :ok
  end

  # =============================================================================
  # Render
  # =============================================================================

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

  # =============================================================================
  # Intro Cutscene
  # =============================================================================

  defp maybe_show_intro_cutscene(socket, game_state) do
    flags = game_state.flags || %{}
    seen_intro = Map.get(flags, "seen_intro", false) || Map.get(flags, :seen_intro, false)

    if not seen_intro do
      cutscene = %{
        id: "intro",
        title: "The Jeweled Path",
        current_page: 0,
        pages: [
          [
            "The mountain wind carries the distant sound of temple bells as you approach the ancient monastery gates.",
            "Prayer flags snap overhead, their faded mantras scattered to the winds. You have journeyed far to reach this place."
          ],
          [
            "Word has spread through the valleys below: something is wrong at the monastery.",
            "Lama Tenzin, the beloved meditation master, has not emerged from his cell in seven days. The monks whisper of demons and dark omens."
          ],
          [
            "You were drawn here by more than rumor. A dream, perhaps. A calling you cannot quite name.",
            "The scent of juniper incense reaches you from somewhere within the monastery walls."
          ],
          [
            "A young novice in saffron robes notices your arrival and approaches with worried eyes.",
            "\"Traveler, the mountain has brought you to us. Perhaps you are the help we have prayed for.\""
          ],
          [
            "Whatever answers lie within these ancient walls, whatever trials await,",
            "Your journey along the Jeweled Path begins now."
          ]
        ]
      }

      assign(socket, :cutscene, cutscene)
    else
      socket
    end
  end

  # =============================================================================
  # Event Handlers - Entity Interactions
  # =============================================================================

  @impl true
  def handle_event("click_entity", %{"id" => id, "type" => "player"}, socket) do
    entity = find_player_entity(socket.assigns.other_players, id)
    {:noreply, update_ui(socket, %{context_entity: entity, compass_open: false})}
  end

  def handle_event("click_entity", %{"id" => id, "type" => type}, socket) do
    entity = find_entity(socket.assigns.room, id, type)
    RoomManager.touch_entity(id)
    {:noreply, update_ui(socket, %{context_entity: entity, compass_open: false})}
  end

  def handle_event("leave_context", _params, socket) do
    {:noreply, update_ui(socket, %{context_entity: nil})}
  end

  # =============================================================================
  # Event Handlers - Menu Actions (delegated)
  # =============================================================================

  def handle_event("menu_action", %{"action" => "get"}, socket) do
    InventoryManager.handle_get_item(socket, socket.assigns.ui.context_entity)
  end

  def handle_event("menu_action", %{"action" => "talk"}, socket) do
    DialogueManager.start_conversation(socket, socket.assigns.ui.context_entity)
  end

  def handle_event("menu_action", %{"action" => "attack"}, socket) do
    CombatManager.start_combat(socket, socket.assigns.ui.context_entity)
  end

  def handle_event("menu_action", %{"action" => "attack_player"}, socket) do
    CombatManager.start_pvp_combat(socket, socket.assigns.ui.context_entity)
  end

  def handle_event("menu_action", %{"action" => "inspect"}, socket) do
    entity = socket.assigns.ui.context_entity
    description = entity.description || "You see nothing remarkable."

    event = %{
      text: "You carefully examine the #{entity.name}.\n\n#{description}",
      timestamp: DateTime.utc_now()
    }

    {:noreply,
     socket
     |> update_ui(%{context_entity: nil})
     |> update(:events, fn events -> events ++ [event] end)}
  end

  def handle_event("menu_action", %{"action" => action}, socket) do
    entity = socket.assigns.ui.context_entity

    event = %{
      text: action_text(action, entity),
      timestamp: DateTime.utc_now()
    }

    {:noreply,
     socket
     |> update_ui(%{context_entity: nil})
     |> update(:events, fn events -> events ++ [event] end)}
  end

  # =============================================================================
  # Event Handlers - Combat (delegated)
  # =============================================================================

  def handle_event("combat_action", %{"action" => action}, socket) do
    CombatManager.handle_action(socket, action)
  end

  # =============================================================================
  # Event Handlers - Cutscenes
  # =============================================================================

  def handle_event("cutscene_next", _params, socket) do
    cutscene = socket.assigns.cutscene
    new_cutscene = %{cutscene | current_page: cutscene.current_page + 1}
    {:noreply, assign(socket, :cutscene, new_cutscene)}
  end

  def handle_event("cutscene_end", _params, socket) do
    cutscene = socket.assigns.cutscene
    game_state = socket.assigns.game_state

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

  # =============================================================================
  # Event Handlers - UI Toggles
  # =============================================================================

  def handle_event("toggle_compass", _params, socket) do
    {:noreply, toggle_ui_panel(socket, :compass_open)}
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

  # =============================================================================
  # Event Handlers - Dialogue (delegated)
  # =============================================================================

  def handle_event("dialogue_choice", %{"index" => index_str}, socket) do
    DialogueManager.handle_choice(socket, index_str)
  end

  def handle_event("end_dialogue", _params, socket) do
    DialogueManager.end_dialogue(socket)
  end

  # =============================================================================
  # Event Handlers - Chat
  # =============================================================================

  def handle_event("say", %{"message" => message}, socket) do
    message = String.trim(message)

    if message != "" do
      player = socket.assigns.current_scope.player
      player_name = RoomManager.player_display_name(player)
      room = socket.assigns.room

      if room.id do
        Phoenix.PubSub.broadcast(
          Exmud.PubSub,
          "room:#{room.id}",
          {:player_says, player.id, player_name, message}
        )
      end

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

  # =============================================================================
  # Event Handlers - Quests
  # =============================================================================

  def handle_event("turn_in_quest", %{"id" => quest_id}, socket) do
    game_state = socket.assigns.game_state

    case Quest.turn_in_quest(game_state, quest_id) do
      {:ok, new_game_state, rewards} ->
        active_quests = Quest.get_active_quests(new_game_state)
        completed_quests = Quest.get_completed_quests(new_game_state)
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

  # =============================================================================
  # Event Handlers - Inventory (delegated)
  # =============================================================================

  def handle_event("inventory_item_click", %{"id" => item_id}, socket) do
    InventoryManager.handle_item_click(socket, item_id)
  end

  def handle_event("drop_item", %{"id" => item_id}, socket) do
    InventoryManager.handle_drop_item(socket, item_id)
  end

  def handle_event("equip_item", %{"id" => item_id}, socket) do
    InventoryManager.handle_equip_item(socket, item_id)
  end

  def handle_event("unequip_item", %{"slot" => slot_string}, socket) do
    InventoryManager.handle_unequip_item(socket, slot_string)
  end

  # =============================================================================
  # Event Handlers - Navigation (delegated)
  # =============================================================================

  def handle_event("navigate", %{"direction" => direction}, socket) do
    room = socket.assigns.room
    exit = Enum.find(room.exits, fn e -> e.direction == direction end)
    RoomManager.handle_navigate(socket, direction, exit)
  end

  # =============================================================================
  # PubSub Handlers
  # =============================================================================

  @impl true
  def handle_info({:enemy_turn, combat}, socket) do
    CombatManager.handle_enemy_turn(socket, combat)
  end

  def handle_info({:player_entered, player_id, player_name}, socket) do
    current_player = socket.assigns.current_scope.player

    if player_id == current_player.id do
      {:noreply, socket}
    else
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

  def handle_info({:player_left, player_id, player_name, direction}, socket) do
    current_player = socket.assigns.current_scope.player

    if player_id == current_player.id do
      {:noreply, socket}
    else
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

  def handle_info({:player_says, player_id, player_name, message}, socket) do
    current_player = socket.assigns.current_scope.player

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

  def handle_info({:player_attacks, attacker_id, attacker_name, target_id, _target_name}, socket) do
    current_player = socket.assigns.current_scope.player

    if attacker_id == current_player.id do
      {:noreply, socket}
    else
      event =
        if target_id == current_player.id do
          %{text: "#{attacker_name} attacks you!", timestamp: DateTime.utc_now()}
        else
          %{text: "#{attacker_name} attacks another player!", timestamp: DateTime.utc_now()}
        end

      {:noreply, update(socket, :events, fn events -> events ++ [event] end)}
    end
  end

  def handle_info({:player_defeated, victor_id, victor_name, defeated_id, _defeated_name}, socket) do
    current_player = socket.assigns.current_scope.player

    if victor_id == current_player.id do
      {:noreply, socket}
    else
      event =
        if defeated_id == current_player.id do
          %{text: "You have been defeated by #{victor_name}!", timestamp: DateTime.utc_now()}
        else
          %{text: "#{victor_name} has defeated another player!", timestamp: DateTime.utc_now()}
        end

      {:noreply, update(socket, :events, fn events -> events ++ [event] end)}
    end
  end

  def handle_info({:mob_respawned, _entity_id, mob_name}, socket) do
    alias Exmud.Framework.World.RoomLoader
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

  # =============================================================================
  # Session Message Handlers (Unified Client Messaging)
  # =============================================================================

  def handle_info({:session_message, message}, socket) do
    handle_session_message(message, socket)
  end

  defp handle_session_message({:room_message, text}, socket) do
    event = %{text: text, timestamp: DateTime.utc_now()}
    {:noreply, update(socket, :events, fn events -> events ++ [event] end)}
  end

  defp handle_session_message({:announcement, text}, socket) do
    event = %{text: "[Announcement] #{text}", timestamp: DateTime.utc_now()}
    {:noreply, update(socket, :events, fn events -> events ++ [event] end)}
  end

  defp handle_session_message({:force_disconnect, reason}, socket) do
    {:noreply, redirect(socket, to: ~p"/players/log-in?reason=#{reason}")}
  end

  defp handle_session_message({:player_action, player_name, action_text}, socket) do
    event = %{text: "#{player_name} #{action_text}.", timestamp: DateTime.utc_now()}
    {:noreply, update(socket, :events, fn events -> events ++ [event] end)}
  end

  defp handle_session_message(_unknown, socket) do
    # Ignore unknown message types gracefully
    {:noreply, socket}
  end

  # =============================================================================
  # Helper Functions
  # =============================================================================

  defp find_entity(room, id, "npc") do
    entity = Enum.find(room.entities, fn e -> e.id == id end)

    if entity do
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

  # UI state helpers

  defp update_ui(socket, updates) when is_map(updates) do
    update(socket, :ui, fn ui -> Map.merge(ui, updates) end)
  end

  @ui_panels [:compass_open, :inventory_open, :quest_open, :stats_open, :chat_open]

  defp toggle_ui_panel(socket, panel) when panel in @ui_panels do
    current_value = socket.assigns.ui[panel]
    new_value = !current_value

    closed_panels = Map.new(@ui_panels, fn p -> {p, false} end)

    updates =
      closed_panels
      |> Map.put(panel, new_value)
      |> Map.put(:context_entity, nil)

    update_ui(socket, updates)
  end
end
