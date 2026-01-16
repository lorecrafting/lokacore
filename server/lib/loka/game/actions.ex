defmodule Loka.Game.Actions do
  @moduledoc """
  Transport-agnostic game action coordinator.

  This module is the single entry point for all game actions. Transports
  (GameChannel, LiveView, REST API, CLI) call this module to execute
  game logic and receive structured results.

  ## Architecture

  ```
  Transports (GameChannel, LiveView, etc.)
           │
           ▼
  Loka.Game.Actions (this module)
           │
     ┌─────┴─────┐
     ▼           ▼
  Mechanics   Framework
  (molecules)  (subsystems)
  ```

  ## Design Principles

  1. **Transport agnostic** - No socket, no push, no assigns
  2. **Pure functions** - Same input always produces same output
  3. **Structured results** - Always returns `{:ok, Result.t()}` or `{:error, reason}`
  4. **Event-based** - Returns events for transport to dispatch

  ## Usage

  ```elixir
  # From GameChannel
  def handle_in("navigate", %{"direction" => dir}, socket) do
    ctx = Context.from_socket(socket)

    case Actions.execute(:navigate, %{direction: dir}, ctx) do
      {:ok, result} ->
        socket = apply_state_changes(socket, result.state)
        push_events(socket, result.events)
        {:reply, :ok, socket}

      {:error, reason} ->
        push(socket, "error", %{message: reason})
        {:reply, :error, socket}
    end
  end
  ```

  ## Adding New Actions

  1. Add action handler function: `defp do_action(:my_action, params, ctx)`
  2. Return `{:ok, Result.new(...)}` or `{:error, "reason"}`
  3. Use Mechanics modules for calculations
  4. Use Framework modules for domain logic
  """

  alias Loka.Game.Actions.{Context, Result}
  alias Loka.Framework.Player.GameState, as: PlayerGameState
  alias Loka.Framework.World.{RoomLoader, Atmosphere}
  alias Loka.Framework.{Inventory, Equipment, Quest}
  alias Loka.Framework.Actions.Resolver, as: ActionResolver
  alias Loka.Engine.{Entities, Hooks}
  alias LokaWeb.Channels.GameChannel.Serializers

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Execute a game action.

  ## Parameters

  - `action` - Atom identifying the action (`:navigate`, `:attack`, etc.)
  - `params` - Map of action parameters
  - `ctx` - Context struct with player/game state

  ## Returns

  - `{:ok, Result.t()}` - Action succeeded with result
  - `{:error, String.t()}` - Action failed with reason
  """
  @spec execute(atom(), map(), Context.t()) :: {:ok, Result.t()} | {:error, String.t()}
  def execute(action, params, ctx) do
    case do_action(action, params, ctx) do
      {:ok, result} -> {:ok, result}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Initialize game state for a player.

  Called when a player first connects. Loads their game state
  and current room.
  """
  @spec init(map()) :: {:ok, Context.t(), Result.t()} | {:error, term()}
  def init(player) do
    with {:ok, game_state} <- PlayerGameState.get_or_create_state(player.id),
         true <- PlayerGameState.character_created?(game_state) do
      {room, game_state} = load_player_room(game_state)

      ctx = %Context{
        player_id: player.id,
        player_name: get_player_name(player, game_state),
        game_state: game_state,
        room: room
      }

      result =
        Result.new(
          state: %{game_state: game_state, room: room},
          events: [{:game_initialized, build_client_state(ctx)}]
        )

      {:ok, ctx, result}
    else
      false -> {:error, :character_not_created}
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Build full client state for sending to transport.
  """
  @spec build_client_state(Context.t()) :: map()
  def build_client_state(ctx) do
    game_state = ctx.game_state
    room = ctx.room

    %{
      room: serialize_room(room),
      atmosphere: Atmosphere.describe_for_room(room),
      inventory: Inventory.list_items(game_state),
      equipped: Equipment.get_equipped(game_state),
      quests: Quest.get_active_quests(game_state),
      stats: game_state.stats || %{},
      health: PlayerGameState.get_health(game_state),
      player: %{
        id: ctx.player_id,
        name: ctx.player_name
      }
    }
  end

  # =============================================================================
  # Navigation Actions
  # =============================================================================

  defp do_action(:navigate, %{direction: direction}, ctx) do
    room = ctx.room
    exit = Enum.find(room.exits, fn e -> e.direction == direction end)

    case exit do
      nil ->
        {:error, "You can't go that way."}

      %{destination_id: nil} ->
        {:error, "The path #{direction} leads nowhere..."}

      %{destination_id: destination_id} ->
        navigate_to_room(ctx, destination_id, direction)
    end
  end

  # =============================================================================
  # Entity Interactions
  # =============================================================================

  defp do_action(:click_entity, %{entity_id: id, entity_type: type}, ctx) do
    entity = find_entity(ctx.room, id, type)

    case entity do
      nil ->
        {:error, "You don't see that here."}

      entity ->
        # Serialize entity with resolved actions based on player state
        entity_context = serialize_entity_context(entity, ctx.game_state, ctx.room)
        result = Result.new(events: [{:entity_context, entity_context}])
        {:ok, result}
    end
  end

  defp do_action(:get_item, %{entity_id: entity_id}, ctx) do
    entity = find_entity(ctx.room, entity_id, "item")

    if entity do
      item_entity = Entities.get_entity(entity_id)

      if item_entity do
        # Remove item from room
        {:ok, _} = Entities.update_entity(item_entity, %{location_id: nil})

        case Inventory.add_item(ctx.game_state, entity_id) do
          {:ok, new_game_state} ->
            # Check quest objectives
            {new_game_state, quest_events} =
              check_get_item_quest(new_game_state, item_entity.key)

            # Reload room
            {:ok, new_room} = RoomLoader.load_room_for_display(ctx.room.id)

            # Build quest progress event if objectives were updated
            quest_progress_event =
              if Enum.any?(quest_events) do
                active_quests = Quest.get_active_quests(new_game_state)
                [{:quest_progress, %{quests: Serializers.serialize_quests(active_quests)}}]
              else
                []
              end

            events =
              [
                {:event, "You pick up the #{entity.name}."},
                {:inventory_update,
                 %{
                   inventory:
                     Serializers.serialize_inventory(Inventory.list_items(new_game_state))
                 }},
                {:room_update,
                 %{
                   room: serialize_room(new_room),
                   atmosphere: Atmosphere.describe_for_room(new_room)
                 }}
              ] ++ Enum.map(quest_events, fn e -> {:event, e.text} end) ++ quest_progress_event

            result =
              Result.new(
                state: %{game_state: new_game_state, room: new_room},
                events: events
              )

            {:ok, result}

          {:error, _reason} ->
            {:error, "You can't pick up the #{entity.name}."}
        end
      else
        {:error, "Item not found."}
      end
    else
      {:error, "You don't see that here."}
    end
  end

  defp do_action(:drop_item, %{item_id: item_id}, ctx) do
    game_state = ctx.game_state
    room = ctx.room

    if item_id in (game_state.inventory || []) do
      item_entity = Entities.get_entity(item_id)

      if item_entity do
        # Move item to room
        {:ok, _} = Entities.update_entity(item_entity, %{location_id: room.id})

        case Inventory.remove_item(game_state, item_id) do
          {:ok, new_game_state} ->
            {:ok, new_room} = RoomLoader.load_room_for_display(room.id)
            item_name = item_entity.short_desc || item_entity.key || "item"

            result =
              Result.new(
                state: %{game_state: new_game_state, room: new_room},
                events: [
                  {:event, "You drop the #{item_name}."},
                  {:inventory_update,
                   %{
                     inventory:
                       Serializers.serialize_inventory(Inventory.list_items(new_game_state))
                   }},
                  {:room_update,
                   %{
                     room: serialize_room(new_room),
                     atmosphere: Atmosphere.describe_for_room(new_room)
                   }}
                ]
              )

            {:ok, result}

          {:error, _} ->
            {:error, "Failed to drop item."}
        end
      else
        {:error, "Item not found."}
      end
    else
      {:error, "You don't have that item."}
    end
  end

  # =============================================================================
  # Equipment Actions
  # =============================================================================

  defp do_action(:equip_item, %{item_id: item_id}, ctx) do
    case Equipment.equip(ctx.game_state, item_id) do
      {:ok, new_game_state} ->
        item_entity = Entities.get_entity(item_id)
        item_name = if item_entity, do: item_entity.short_desc || item_entity.key, else: "item"

        result =
          Result.new(
            state: %{game_state: new_game_state},
            events: [
              {:event, "You equip the #{item_name}."},
              {:equipment_update, %{equipped: Equipment.get_equipped(new_game_state)}}
            ]
          )

        {:ok, result}

      {:error, :not_equipable} ->
        {:error, "You can't equip that."}

      {:error, {:requirements_not_met, _}} ->
        {:error, "You don't meet the requirements to equip that."}

      {:error, _} ->
        {:error, "Failed to equip item."}
    end
  end

  defp do_action(:unequip_item, %{slot: slot}, ctx) do
    slot_atom = if is_atom(slot), do: slot, else: String.to_existing_atom(slot)

    case Equipment.unequip(ctx.game_state, slot_atom) do
      {:ok, new_game_state} ->
        result =
          Result.new(
            state: %{game_state: new_game_state},
            events: [
              {:event, "You unequip your #{slot}."},
              {:equipment_update, %{equipped: Equipment.get_equipped(new_game_state)}}
            ]
          )

        {:ok, result}

      {:error, :slot_empty} ->
        {:error, "Nothing equipped in that slot."}

      {:error, _} ->
        {:error, "Failed to unequip."}
    end
  rescue
    ArgumentError ->
      {:error, "Invalid equipment slot."}
  end

  # =============================================================================
  # Chat Actions
  # =============================================================================

  defp do_action(:chat, %{mode: mode, message: message}, ctx) do
    events =
      case mode do
        "say" ->
          [
            {:broadcast_room, ctx.room.id,
             {:player_says, ctx.player_id, ctx.player_name, message}},
            {:event, "You say, \"#{message}\""}
          ]

        "shout" ->
          [
            {:broadcast_room, ctx.room.id,
             {:player_shouts, ctx.player_id, ctx.player_name, message}},
            {:event, "You shout, \"#{message}\""}
          ]

        _ ->
          []
      end

    result = Result.new(events: events)
    {:ok, result}
  end

  # =============================================================================
  # Social Actions (delegated to Actions.Social)
  # =============================================================================

  defp do_action(:emote, %{emote_key: emote_key, target_id: target_id}, ctx) do
    alias Loka.Game.Actions.Social, as: SocialActions
    SocialActions.emote(ctx, emote_key, target_id)
  end

  defp do_action(:emote, %{emote_key: emote_key}, ctx) do
    alias Loka.Game.Actions.Social, as: SocialActions
    SocialActions.emote(ctx, emote_key, nil)
  end

  defp do_action(:set_mood, %{mood: mood}, ctx) do
    alias Loka.Game.Actions.Social, as: SocialActions
    SocialActions.set_mood(ctx, mood)
  end

  defp do_action(:set_pose, %{pose: pose}, ctx) do
    alias Loka.Game.Actions.Social, as: SocialActions
    SocialActions.set_pose(ctx, pose)
  end

  # =============================================================================
  # Combat Actions (delegated to Actions.Combat)
  # =============================================================================

  defp do_action(:attack, %{entity_id: entity_id, entity: entity}, ctx) do
    alias Loka.Game.Actions.Combat, as: CombatActions
    CombatActions.attack(ctx, entity_id, entity)
  end

  defp do_action(:flee, _params, ctx) do
    alias Loka.Game.Actions.Combat, as: CombatActions
    CombatActions.flee(ctx)
  end

  defp do_action(:combat_tick, _params, ctx) do
    alias Loka.Game.Actions.Combat, as: CombatActions
    CombatActions.process_tick(ctx)
  end

  # =============================================================================
  # Dialogue Actions (delegated to Actions.Dialogue)
  # =============================================================================

  defp do_action(:talk, %{entity_id: entity_id}, ctx) do
    alias Loka.Game.Actions.Dialogue, as: DialogueActions
    DialogueActions.start_conversation(ctx, entity_id)
  end

  defp do_action(:dialogue_choice, %{choice_index: choice_index}, ctx) do
    alias Loka.Game.Actions.Dialogue, as: DialogueActions
    DialogueActions.choose_option(ctx, choice_index)
  end

  # =============================================================================
  # Shop Actions (delegated to Actions.Shop)
  # =============================================================================

  defp do_action(:open_shop, %{entity_id: entity_id, entity: entity}, ctx) do
    alias Loka.Game.Actions.Shop, as: ShopActions
    ShopActions.open_shop(ctx, entity_id, entity)
  end

  defp do_action(:buy_item, %{npc_id: npc_id, item_key: item_key, npc_entity: npc_entity}, ctx) do
    alias Loka.Game.Actions.Shop, as: ShopActions
    ShopActions.buy_item(ctx, npc_id, item_key, npc_entity)
  end

  defp do_action(:sell_item, %{npc_id: npc_id, item_id: item_id, npc_entity: npc_entity}, ctx) do
    alias Loka.Game.Actions.Shop, as: ShopActions
    ShopActions.sell_item(ctx, npc_id, item_id, npc_entity)
  end

  defp do_action(:close_shop, _params, ctx) do
    alias Loka.Game.Actions.Shop, as: ShopActions
    ShopActions.close_shop(ctx)
  end

  # =============================================================================
  # Container Actions (delegated to Actions.Container)
  # =============================================================================

  defp do_action(:open_container, %{entity_id: entity_id}, ctx) do
    alias Loka.Game.Actions.Container, as: ContainerActions
    ContainerActions.open_container(ctx, entity_id)
  end

  defp do_action(:take_from_container, %{index: index}, ctx) do
    alias Loka.Game.Actions.Container, as: ContainerActions
    ContainerActions.take_from_container(ctx, index)
  end

  defp do_action(:close_container, _params, ctx) do
    alias Loka.Game.Actions.Container, as: ContainerActions
    ContainerActions.close_container(ctx)
  end

  # =============================================================================
  # Gathering Actions (delegated to Actions.Gathering)
  # =============================================================================

  defp do_action(:gather, %{node_type: node_type}, ctx) do
    alias Loka.Game.Actions.Gathering, as: GatheringActions
    GatheringActions.gather(ctx, node_type)
  end

  defp do_action(:craft, %{recipe_key: recipe_key, tool_id: tool_id}, ctx) do
    alias Loka.Game.Actions.Gathering, as: GatheringActions
    GatheringActions.craft(ctx, recipe_key, tool_id)
  end

  # =============================================================================
  # Bardo Actions (delegated to Actions.Bardo)
  # =============================================================================

  defp do_action(:enter_bardo, %{killer_name: killer_name}, ctx) do
    alias Loka.Game.Actions.Bardo, as: BardoActions
    BardoActions.enter_bardo(ctx, killer_name)
  end

  defp do_action(:reincarnate, %{bardo: bardo}, ctx) do
    alias Loka.Game.Actions.Bardo, as: BardoActions
    BardoActions.reincarnate(ctx, bardo)
  end

  # =============================================================================
  # Fallback
  # =============================================================================

  defp do_action(action, _params, _ctx) do
    {:error, "Unknown action: #{action}"}
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp load_player_room(game_state) do
    case RoomLoader.load_room_for_display(game_state.current_room_id) do
      {:ok, room} ->
        {room, game_state}

      {:error, :not_found} ->
        starting_room_id = RoomLoader.get_starting_room_id()

        case RoomLoader.load_room_for_display(starting_room_id) do
          {:ok, room} ->
            {:ok, new_game_state} =
              PlayerGameState.update_state(game_state, %{current_room_id: room.id})

            {room, new_game_state}

          {:error, _} ->
            {RoomLoader.empty_room(), game_state}
        end
    end
  end

  defp get_player_name(player, game_state) do
    game_state.character_name || player.name || player.email
  end

  defp find_entity(room, id, type) do
    case type do
      "npc" ->
        Enum.find(room.entities || [], fn e -> e.id == id end)

      "item" ->
        Enum.find(room.items || [], fn i -> i.id == id end)

      # Auto-detect: try NPCs first, then items
      _ ->
        Enum.find(room.entities || [], fn e -> e.id == id end) ||
          Enum.find(room.items || [], fn i -> i.id == id end)
    end
  end

  defp check_get_item_quest(game_state, item_key) do
    alias Loka.Framework.Quest.Listeners, as: QuestListeners
    QuestListeners.check_item_received(game_state, item_key)
  end

  defp check_room_entry_quest(game_state, room_key) do
    alias Loka.Framework.Quest.Listeners, as: QuestListeners
    QuestListeners.check_room_entry(game_state, room_key)
  end

  defp navigate_to_room(ctx, destination_id, direction) do
    player_context = %{
      player_id: ctx.player_id,
      player_name: ctx.player_name,
      type: :player
    }

    case Hooks.run_until_halt(:at_before_move, [
           player_context,
           %{destination_id: destination_id, direction: direction}
         ]) do
      {:halt, reason} ->
        {:error, "You can't go that way: #{reason}"}

      :ok ->
        case RoomLoader.load_room_for_display(destination_id) do
          {:ok, new_room} ->
            {:ok, new_game_state} =
              PlayerGameState.update_state(ctx.game_state, %{current_room_id: new_room.id})

            # Check quest objectives for room entry (go_to objectives)
            room_key = new_room.key || new_room.id

            {new_game_state, quest_events} =
              check_room_entry_quest(new_game_state, room_key)

            # Fire enter_room hook for other listeners
            Hooks.run(:at_enter_room, [
              Map.put(player_context, :game_state, new_game_state),
              %{room_id: new_room.id, room_key: room_key}
            ])

            result =
              Result.new(
                state: %{game_state: new_game_state, room: new_room},
                events:
                  [
                    {:room_changed,
                     %{
                       room: serialize_room(new_room),
                       atmosphere: Atmosphere.describe_for_room(new_room)
                     }},
                    {:broadcast_room, ctx.room.id,
                     {:player_left, ctx.player_id, ctx.player_name, direction}},
                    {:broadcast_room, new_room.id,
                     {:player_entered, ctx.player_id, ctx.player_name}}
                  ] ++ Enum.map(quest_events, fn e -> {:event, e.text} end)
              )

            {:ok, result}

          {:error, :not_found} ->
            {:error, "The path #{direction} leads nowhere..."}
        end
    end
  end

  # =============================================================================
  # Serialization (private - for building events)
  # =============================================================================

  defp serialize_room(room) do
    %{
      id: room.id,
      title: room.title,
      description: room.description,
      exits: Enum.map(room.exits, &serialize_exit/1),
      entities: Enum.map(room.entities || [], &serialize_entity/1),
      items: Enum.map(room.items || [], &serialize_item/1),
      tags: room.tags || []
    }
  end

  defp serialize_exit(exit) do
    %{
      direction: exit.direction,
      destination_id: exit.destination_id,
      description: Map.get(exit, :description)
    }
  end

  defp serialize_entity(entity) do
    %{
      id: entity.id,
      key: Map.get(entity, :key),
      name: entity.name,
      type: Map.get(entity, :type, :npc),
      long_desc: Map.get(entity, :long_desc) || "",
      description: entity.description || Map.get(entity, :extra_desc),
      primary_keyword: Map.get(entity, :primary_keyword)
    }
  end

  defp serialize_entity_context(entity, game_state, room) do
    components = Map.get(entity, :components) || %{}
    component_keys = components |> Map.keys() |> Enum.map(&to_string/1)

    # Convert entity to the map format expected by the Resolver
    entity_map = %{
      type: Map.get(entity, :type, :npc),
      components: components,
      tags: Map.get(entity, :tags) || []
    }

    # Resolve available actions for this entity based on player state
    actions =
      entity_map
      |> ActionResolver.resolve(game_state, room)
      |> ActionResolver.serialize()

    %{
      id: entity.id,
      name: entity.name,
      type: Map.get(entity, :type, :npc),
      long_desc: Map.get(entity, :long_desc) || "",
      description: entity.description || Map.get(entity, :extra_desc),
      primary_keyword: Map.get(entity, :primary_keyword),
      components: component_keys,
      tags: Map.get(entity, :tags) || [],
      actions: actions
    }
  end

  defp serialize_item(item) do
    %{
      id: item.id,
      key: Map.get(item, :key),
      name: item.name,
      long_desc: Map.get(item, :long_desc) || "",
      description: item.description || Map.get(item, :desc),
      primary_keyword: Map.get(item, :primary_keyword)
    }
  end
end
