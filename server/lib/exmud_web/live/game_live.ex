defmodule ExmudWeb.GameLive do
  @moduledoc """
  LiveView game client for ExMUD - "Living Ebook" aesthetic.

  A literary, book-like interface with touch/click-based interactions.
  No text input - all interactions via underlined links and menus.
  """
  use ExmudWeb, :live_view

  alias Exmud.DemoGame.{PlayerGameState, RoomLoader}
  alias Exmud.DemoGame.Systems.{Inventory, Equipment, Dialogue, Quest}
  alias Exmud.Engine.Entities

  @impl true
  def mount(_params, _session, socket) do
    player = socket.assigns.current_player

    # Get or create player game state
    {:ok, game_state} = PlayerGameState.get_or_create_state(player.id)

    # Load room from database (or use starting room if player has no room set)
    {room, game_state} = load_player_room(game_state)

    # Subscribe to room events when connected
    if connected?(socket) and room.id do
      Phoenix.PubSub.subscribe(Exmud.PubSub, "room:#{room.id}")
      Phoenix.PubSub.subscribe(Exmud.PubSub, "player:#{player.id}")
    end

    # Load inventory item details
    inventory_items = Inventory.list_items(game_state)
    equipped_items = Equipment.get_equipped(game_state)
    active_quests = Quest.get_active_quests(game_state)
    completed_quests = Quest.get_completed_quests(game_state)

    {:ok,
     socket
     |> assign(:room, room)
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
     |> assign(:context_entity, nil)
     |> assign(:compass_open, false)
     |> assign(:inventory_open, false)
     |> assign(:quest_open, false)
     |> assign(:dialogue, nil)
     |> assign(:dialogue_npc, nil)
     |> assign(:events, [])}
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
      <%= if @dialogue do %>
        <.dialogue_panel
          dialogue={@dialogue}
          npc={@dialogue_npc}
          room_title={@room.title}
        />
      <% else %>
        <%= if @quest_open do %>
          <.quest_panel
            active_quests={@active_quests}
            completed_quests={@completed_quests}
          />
        <% else %>
          <%= if @inventory_open do %>
            <.inventory_panel
              inventory_items={@inventory_items}
              equipped_items={@equipped_items}
              stats={@stats}
              health={@health}
            />
          <% else %>
            <%= if @context_entity do %>
              <.context_panel
                entity={@context_entity}
                room_title={@room.title}
                compass_open={@compass_open}
                exits={@room.exits}
              />
            <% else %>
              <.room_view
                room={@room}
                events={@events}
                compass_open={@compass_open}
              />
            <% end %>
          <% end %>
        <% end %>
      <% end %>

      <.bottom_bar
        compass_open={@compass_open}
        exits={@room.exits}
        inventory_open={@inventory_open}
        quest_open={@quest_open}
      />
    </div>
    """
  end

  # Room View Component
  attr :room, :map, required: true
  attr :events, :list, required: true
  attr :compass_open, :boolean, required: true

  defp room_view(assigns) do
    ~H"""
    <div class="ebook-context">
      <h1 class="ebook-title">{@room.title}</h1>

      <p class="ebook-prose">{@room.description}</p>

      <.entities_section entities={@room.entities} items={@room.items} />

      <.events_section events={@events} />
    </div>
    """
  end

  # Entities Section
  attr :entities, :list, required: true
  attr :items, :list, required: true

  defp entities_section(assigns) do
    ~H"""
    <div class="mt-6">
      <p class="ebook-prose" style="text-indent: 0;">
        <%= for {entity, idx} <- Enum.with_index(@entities) do %>
          <%= if idx > 0 do %> <% end %>
          <%= entity.short_desc %>
          <span
            class="ebook-link"
            phx-click="click_entity"
            phx-value-id={entity.id}
            phx-value-type="npc"
          ><%= entity.name %></span><%= if entity[:suffix], do: " #{entity.suffix}", else: "" %>.<%= if idx < length(@entities) - 1, do: "" %>
        <% end %>
        <%= if length(@entities) > 3 do %>
          <span class="ebook-more">[...{length(@entities) - 3} more]</span>
        <% end %>
      </p>

      <p class="ebook-prose" style="text-indent: 0;">
        <%= for {item, idx} <- Enum.with_index(@items) do %>
          <%= if idx > 0 do %> <% end %>
          <%= item.desc %>
          <span
            class="ebook-link"
            phx-click="click_entity"
            phx-value-id={item.id}
            phx-value-type="item"
          ><%= item.name %></span><%= if item[:suffix], do: " #{item.suffix}", else: "" %>.
        <% end %>
      </p>
    </div>
    """
  end

  # Events Section
  attr :events, :list, required: true

  defp events_section(assigns) do
    ~H"""
    <div :if={length(@events) > 0} class="ebook-events">
      <div :for={event <- @events} class="ebook-event">
        {event.text}
      </div>
    </div>
    """
  end

  # Context Panel Component (when entity is clicked)
  attr :entity, :map, required: true
  attr :room_title, :string, required: true
  attr :compass_open, :boolean, required: true
  attr :exits, :list, required: true

  defp context_panel(assigns) do
    ~H"""
    <div class="ebook-context">
      <h1 class="ebook-title ebook-title--muted">{@room_title}</h1>

      <p class="ebook-prose" style="text-indent: 0;">{@entity.description}</p>

      <ul class="ebook-menu">
        <li class="ebook-menu-item" phx-click="menu_action" phx-value-action="inspect">
          Inspect
        </li>
        <%= if @entity.type == :item do %>
          <li class="ebook-menu-item" phx-click="menu_action" phx-value-action="get">
            Get
          </li>
        <% else %>
          <%= if has_component?(@entity, "conversant") do %>
            <li class="ebook-menu-item" phx-click="menu_action" phx-value-action="talk">
              Talk
            </li>
          <% end %>
          <%= if has_component?(@entity, "trader") do %>
            <li class="ebook-menu-item" phx-click="menu_action" phx-value-action="trade">
              Trade
            </li>
          <% end %>
          <%= if has_component?(@entity, "quest_giver") do %>
            <li class="ebook-menu-item" phx-click="menu_action" phx-value-action="quest">
              Quest
            </li>
          <% end %>
          <%= if has_component?(@entity, "combatant") do %>
            <li class="ebook-menu-item" phx-click="menu_action" phx-value-action="attack">
              Attack
            </li>
          <% end %>
        <% end %>
        <li class="ebook-menu-item" phx-click="leave_context">
          Leave
        </li>
      </ul>
    </div>
    """
  end

  # Inventory Panel Component
  attr :inventory_items, :list, required: true
  attr :equipped_items, :map, required: true
  attr :stats, :map, required: true
  attr :health, :map, required: true

  defp inventory_panel(assigns) do
    ~H"""
    <div class="ebook-context">
      <h1 class="ebook-title">Inventory</h1>

      <div class="mt-4">
        <p class="ebook-prose" style="text-indent: 0; font-style: italic; opacity: 0.7;">
          Health: {@health["current"] || @health[:current] || 100} / {@health["max"] || @health[:max] || 100}
        </p>
      </div>

      <div class="mt-4">
        <h2 class="ebook-subtitle">Equipment</h2>
        <ul class="ebook-menu">
          <.equipment_slot slot="weapon" item={@equipped_items[:weapon] || @equipped_items["weapon"]} />
          <.equipment_slot slot="armor" item={@equipped_items[:armor] || @equipped_items["armor"]} />
          <.equipment_slot slot="accessory" item={@equipped_items[:accessory] || @equipped_items["accessory"]} />
        </ul>
      </div>

      <div class="mt-4">
        <h2 class="ebook-subtitle">Carried Items</h2>
        <%= if length(@inventory_items) > 0 do %>
          <ul class="ebook-menu">
            <li :for={item <- @inventory_items} class="ebook-menu-item--row">
              <span class="ebook-item-name">{item.name}</span>
              <span class="ebook-item-actions">
                <%= if is_equipable?(item) do %>
                  <span class="ebook-link" phx-click="equip_item" phx-value-id={item.id}>equip</span>
                <% end %>
                <span class="ebook-link" phx-click="drop_item" phx-value-id={item.id}>drop</span>
              </span>
            </li>
          </ul>
        <% else %>
          <p class="ebook-prose" style="text-indent: 0; font-style: italic; opacity: 0.7;">
            Your inventory is empty.
          </p>
        <% end %>
      </div>

      <div class="mt-6">
        <span class="ebook-link" phx-click="toggle_inventory">Close</span>
      </div>
    </div>
    """
  end

  attr :slot, :string, required: true
  attr :item, :map, default: nil

  defp equipment_slot(assigns) do
    ~H"""
    <li class="ebook-menu-item--row">
      <span class="ebook-item-name">{String.capitalize(@slot)}:</span>
      <%= if @item do %>
        <span class="ebook-item-actions">
          <span class="ebook-item-equipped">{@item.name}</span>
          <span class="ebook-link" phx-click="unequip_item" phx-value-slot={@slot}>unequip</span>
        </span>
      <% else %>
        <span class="ebook-link--muted">empty</span>
      <% end %>
    </li>
    """
  end

  # Quest Panel Component
  attr :active_quests, :list, required: true
  attr :completed_quests, :list, required: true

  defp quest_panel(assigns) do
    ~H"""
    <div class="ebook-context">
      <h1 class="ebook-title">Quest Log</h1>

      <div class="mt-4">
        <h2 class="ebook-subtitle">Active Quests</h2>
        <%= if length(@active_quests) > 0 do %>
          <div :for={quest <- @active_quests} class="ebook-quest">
            <p class="ebook-quest-title">
              {quest.name || quest.id}
              <%= if quest.is_complete do %>
                <span class="ebook-tag">[complete]</span>
              <% end %>
            </p>
            <p class="ebook-prose" style="text-indent: 0; font-size: 0.9em; opacity: 0.8;">
              {quest.description}
            </p>
            <ul class="ebook-objectives">
              <li :for={obj <- quest.objectives || []} class={"ebook-objective #{if obj.completed, do: "ebook-objective--done", else: ""}"}>
                <%= if obj.completed do %>
                  ✓
                <% else %>
                  ○
                <% end %>
                {obj.description}
                <%= if obj.target_count > 1 do %>
                  ({obj.progress}/{obj.target_count})
                <% end %>
              </li>
            </ul>
            <%= if quest.is_complete do %>
              <div class="mt-2">
                <span class="ebook-link" phx-click="turn_in_quest" phx-value-id={quest.id}>
                  Turn in quest
                </span>
              </div>
            <% end %>
          </div>
        <% else %>
          <p class="ebook-prose" style="text-indent: 0; font-style: italic; opacity: 0.7;">
            No active quests. Speak with villagers to find adventure.
          </p>
        <% end %>
      </div>

      <%= if length(@completed_quests) > 0 do %>
        <div class="mt-4">
          <h2 class="ebook-subtitle">Completed</h2>
          <p class="ebook-prose" style="text-indent: 0; opacity: 0.7;">
            {length(@completed_quests)} quest(s) completed
          </p>
        </div>
      <% end %>

      <div class="mt-6">
        <span class="ebook-link" phx-click="toggle_quest">Close</span>
      </div>
    </div>
    """
  end

  # Dialogue Panel Component
  attr :dialogue, :map, required: true
  attr :npc, :map, required: true
  attr :room_title, :string, required: true

  defp dialogue_panel(assigns) do
    ~H"""
    <div class="ebook-context">
      <h1 class="ebook-title ebook-title--muted">{@room_title}</h1>

      <div class="ebook-dialogue">
        <p class="ebook-dialogue-speaker">
          The <span class="ebook-link--static">{@npc.name}</span> says:
        </p>
        <p class="ebook-prose ebook-dialogue-text">
          "{@dialogue.text}"
        </p>
      </div>

      <%= if length(@dialogue.choices) > 0 do %>
        <ul class="ebook-menu">
          <li
            :for={choice <- @dialogue.choices}
            class="ebook-menu-item"
            phx-click="dialogue_choice"
            phx-value-index={choice.index}
          >
            {choice.text}
          </li>
        </ul>
      <% else %>
        <div class="mt-4">
          <span class="ebook-link" phx-click="end_dialogue">Continue</span>
        </div>
      <% end %>
    </div>
    """
  end

  defp is_equipable?(item) do
    components = item[:components] || item.components || %{}
    Map.has_key?(components, "equipable")
  end

  defp has_component?(entity, component_name) do
    components = entity[:components] || %{}
    Map.has_key?(components, component_name)
  end

  # Bottom Bar with Compass, Inventory, and Quest Log
  attr :compass_open, :boolean, required: true
  attr :exits, :list, required: true
  attr :inventory_open, :boolean, required: true
  attr :quest_open, :boolean, required: true

  defp bottom_bar(assigns) do
    ~H"""
    <div class="ebook-bottombar">
      <div class="ebook-bottombar-left">
        <div class="ebook-compass" phx-click="toggle_compass">
          <span class="ebook-compass-icon">⊕</span>

          <div class={"ebook-compass-popup #{if @compass_open, do: "ebook-compass-popup--open", else: ""}"}>
            <%= if length(@exits) > 0 do %>
              <div :for={exit <- @exits}>
                <span
                  class="ebook-compass-direction"
                  phx-click="navigate"
                  phx-value-direction={exit.direction}
                >
                  {String.capitalize(exit.direction)} — {exit.destination}
                </span>
              </div>
            <% else %>
              <div class="ebook-compass-direction--disabled">No exits</div>
            <% end %>
          </div>
        </div>
      </div>

      <div class="ebook-bottombar-right">
        <span
          class={"ebook-bottombar-btn #{if @quest_open, do: "ebook-bottombar-btn--active", else: ""}"}
          phx-click="toggle_quest"
          title="Quest Log"
        >
          ⚑
        </span>
        <span
          class={"ebook-bottombar-btn #{if @inventory_open, do: "ebook-bottombar-btn--active", else: ""}"}
          phx-click="toggle_inventory"
          title="Inventory"
        >
          ☰
        </span>
      </div>
    </div>
    """
  end

  # Event Handlers

  @impl true
  def handle_event("click_entity", %{"id" => id, "type" => type}, socket) do
    # Find the entity and show context panel
    entity = find_entity(socket.assigns.room, id, type)

    {:noreply,
     socket
     |> assign(:context_entity, entity)
     |> assign(:compass_open, false)}
  end

  def handle_event("leave_context", _params, socket) do
    {:noreply, assign(socket, :context_entity, nil)}
  end

  def handle_event("menu_action", %{"action" => "get"}, socket) do
    entity = socket.assigns.context_entity
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
                events = Enum.map(completed_objectives, fn {_quest_id, obj_id} ->
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
           |> assign(:context_entity, nil)
           |> update(:events, fn events -> events ++ [event] ++ objective_events end)}

        {:error, _reason} ->
          event = %{
            text: "You can't pick up the #{entity.name}.",
            timestamp: DateTime.utc_now()
          }

          {:noreply,
           socket
           |> assign(:context_entity, nil)
           |> update(:events, fn events -> events ++ [event] end)}
      end
    else
      {:noreply, assign(socket, :context_entity, nil)}
    end
  end

  def handle_event("menu_action", %{"action" => "talk"}, socket) do
    entity = socket.assigns.context_entity

    # Try to start a dialogue with this NPC
    case Dialogue.start_conversation(entity.id) do
      {:ok, dialogue_node} ->
        {:noreply,
         socket
         |> assign(:dialogue, dialogue_node)
         |> assign(:dialogue_npc, entity)
         |> assign(:context_entity, nil)}

      {:error, _reason} ->
        # NPC has no dialogue, show default message
        event = %{
          text: "The #{entity.name} nods in acknowledgment.",
          timestamp: DateTime.utc_now()
        }

        {:noreply,
         socket
         |> assign(:context_entity, nil)
         |> update(:events, fn events -> events ++ [event] end)}
    end
  end

  def handle_event("menu_action", %{"action" => action}, socket) do
    entity = socket.assigns.context_entity

    # Add event for the action
    event = %{
      text: action_text(action, entity),
      timestamp: DateTime.utc_now()
    }

    {:noreply,
     socket
     |> assign(:context_entity, nil)
     |> update(:events, fn events -> events ++ [event] end)}
  end

  def handle_event("toggle_compass", _params, socket) do
    {:noreply, update(socket, :compass_open, &(!&1))}
  end

  def handle_event("dialogue_choice", %{"index" => index_str}, socket) do
    index = String.to_integer(index_str)
    npc = socket.assigns.dialogue_npc
    current_node = socket.assigns.dialogue

    case Dialogue.choose_option(npc.id, index, current_node.id) do
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
    {:noreply,
     socket
     |> update(:inventory_open, &(!&1))
     |> assign(:compass_open, false)
     |> assign(:context_entity, nil)}
  end

  def handle_event("toggle_quest", _params, socket) do
    {:noreply,
     socket
     |> update(:quest_open, &(!&1))
     |> assign(:compass_open, false)
     |> assign(:inventory_open, false)
     |> assign(:context_entity, nil)}
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
         |> assign(:quest_open, false)
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
       |> assign(:inventory_open, false)
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

  def handle_event("unequip_item", %{"slot" => slot_string}, socket) do
    game_state = socket.assigns.game_state
    slot = String.to_existing_atom(slot_string)

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
         |> assign(:compass_open, false)
         |> update(:events, fn events -> events ++ [event] end)}

      %{destination_id: destination_id} ->
        # Unsubscribe from old room
        if room.id do
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

            # Create movement event for display
            event = %{
              text: "You head #{direction} to #{new_room.title}.",
              timestamp: DateTime.utc_now()
            }

            {:noreply,
             socket
             |> assign(:room, new_room)
             |> assign(:game_state, new_game_state)
             |> assign(:compass_open, false)
             |> assign(:context_entity, nil)
             |> assign(:events, [event])}

          {:error, :not_found} ->
            event = %{
              text: "Something went wrong... the path #{direction} leads to nowhere.",
              timestamp: DateTime.utc_now()
            }

            {:noreply,
             socket
             |> assign(:compass_open, false)
             |> update(:events, fn events -> events ++ [event] end)}
        end
    end
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

  defp handle_dialogue_action(socket, _unknown_action), do: socket
end
