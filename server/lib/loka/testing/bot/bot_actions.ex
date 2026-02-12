defmodule Loka.Testing.Bot.BotActions do
  @moduledoc """
  Action execution layer for testing bots.

  Translates high-level bot actions into framework module calls.
  This module operates at the framework layer (not LiveView) for
  performance and scalability in load testing.

  ## Supported Actions

  ### Movement
  - `{:move, direction}` - Move in a direction ("north", "south", etc.)

  ### Combat
  - `{:attack, entity_id}` - Start combat with an entity
  - `{:combat_action, :attack | :defend | :flee}` - Basic combat action
  - `{:use_ability, ability_key}` - Use a combat ability (e.g., "power_strike")

  ### Dialogue
  - `{:start_dialogue, npc_id}` - Start talking to an NPC
  - `{:dialogue_choice, choice_index}` - Select a dialogue option (0-indexed)
  - `{:dialogue_action, action}` - Execute a dialogue action (accept_quest, etc.)

  ### Gathering & Crafting
  - `{:gather, node_id}` - Gather from a resource node
  - `{:craft, recipe_key, tool_id}` - Craft a recipe using a tool

  ### Inventory
  - `{:interact, entity_id}` - Pick up item or interact with entity
  - `{:use_item, item_id}` - Use an item
  - `{:equip, item_id, slot}` - Equip an item
  - `{:unequip, slot}` - Unequip from a slot

  ### Utility
  - `:idle` - Do nothing
  - `{:wait, duration_ms}` - Wait for a duration

  ## Usage

      alias Loka.Testing.Bot.BotActions

      # Execute a move action
      {:ok, updated_bot} = BotActions.execute({:move, "north"}, bot_state)

      # Use an ability in combat
      {:ok, updated_bot} = BotActions.execute({:use_ability, "power_strike"}, bot_state)

      # Navigate dialogue
      {:ok, updated_bot} = BotActions.execute({:dialogue_choice, 0}, bot_state)

      # Gather resources
      {:ok, updated_bot} = BotActions.execute({:gather, node_id}, bot_state)
  """

  require Logger

  alias Loka.Engine.{Entities, Entity, Hooks, Spawner}
  alias Loka.Framework.Combat
  alias Loka.Framework.Player.GameState
  alias Loka.Framework.World.RoomLoader
  alias Loka.Framework.Dialogue
  alias Loka.Utils.MapHelpers

  @type bot_state :: %{
          id: String.t(),
          name: String.t(),
          game_state: GameState.t(),
          room: Entity.t() | nil,
          nearby_entities: [Entity.t()],
          combat_state: map() | nil
        }

  @type action :: Loka.Testing.Bot.Strategy.action()
  @type result :: {:ok, bot_state()} | {:error, atom()}

  # =============================================================================
  # Action Execution
  # =============================================================================

  @doc """
  Executes an action for a bot.

  Returns `{:ok, updated_bot_state}` or `{:error, reason}`.
  """
  @spec execute(action(), bot_state()) :: result()
  def execute(action, bot_state)

  def execute(:idle, bot_state) do
    {:ok, bot_state}
  end

  def execute({:wait, _duration_ms}, bot_state) do
    # Wait is handled by the Bot GenServer's tick timing
    {:ok, bot_state}
  end

  def execute({:move, direction}, bot_state) do
    execute_move(direction, bot_state)
  end

  def execute({:attack, entity_id}, bot_state) do
    execute_attack(entity_id, bot_state)
  end

  def execute({:combat_action, action}, bot_state) do
    execute_combat_action(action, bot_state)
  end

  # Dialogue actions
  def execute({:start_dialogue, npc_id}, bot_state) do
    execute_start_dialogue(npc_id, bot_state)
  end

  def execute({:dialogue_choice, choice_index}, bot_state) do
    execute_dialogue_choice(choice_index, bot_state)
  end

  def execute({:dialogue_action, action}, bot_state) do
    execute_dialogue_action(action, bot_state)
  end

  # Gathering and crafting actions
  def execute({:gather, node_data}, bot_state) do
    execute_gather(node_data, bot_state)
  end

  def execute({:craft, recipe_key, tool_id}, bot_state) do
    execute_craft(recipe_key, tool_id, bot_state)
  end

  def execute({:interact, entity_id}, bot_state) do
    execute_interact(entity_id, bot_state)
  end

  def execute({:use_item, item_id}, bot_state) do
    execute_use_item(item_id, bot_state)
  end

  def execute({:equip, item_id, slot}, bot_state) do
    execute_equip(item_id, slot, bot_state)
  end

  def execute({:unequip, slot}, bot_state) do
    execute_unequip(slot, bot_state)
  end

  def execute({:update_game_state, new_game_state}, bot_state) do
    {:ok, %{bot_state | game_state: new_game_state}}
  end

  def execute(unknown, bot_state) do
    Logger.warning("Bot #{bot_state.id}: Unknown action #{inspect(unknown)}")
    {:error, :unknown_action}
  end

  # =============================================================================
  # Movement
  # =============================================================================

  defp execute_move(direction, bot_state) do
    room = bot_state.room
    game_state = bot_state.game_state

    case find_exit(room, direction) do
      nil ->
        Logger.debug("Bot #{bot_state.id}: No exit in direction #{direction}")
        {:error, :no_exit}

      exit ->
        destination_id = get_exit_destination(exit)

        if is_nil(destination_id) do
          {:error, :invalid_exit}
        else
          do_move(bot_state, destination_id, direction, game_state)
        end
    end
  end

  defp find_exit(nil, _direction), do: nil

  # sobelow_skip ["DOS.StringToAtom"] - direction from internal bot logic with known values
  defp find_exit(%Entity{} = room, direction) do
    # Check room's exits attribute
    exits = Map.get(room.components || %{}, "exits", %{})
    exit_data = Map.get(exits, direction) || Map.get(exits, String.to_atom(direction))

    if exit_data do
      # Return a map with destination_id
      %{
        destination_id:
          Map.get(exit_data, "destination_id") || Map.get(exit_data, :destination_id)
      }
    else
      # Check for exit entities in the room
      find_exit_entity(room.id, direction)
    end
  end

  # Handle plain map room format (from Room.load_for_display)
  defp find_exit(%{exits: exits}, direction) when is_list(exits) do
    find_exit_in_list(exits, direction)
  end

  defp find_exit(%{"exits" => exits}, direction) when is_list(exits) do
    find_exit_in_list(exits, direction)
  end

  defp find_exit(_, _direction), do: nil

  defp find_exit_in_list(exits, direction) do
    dir_str = to_string(direction)

    Enum.find_value(exits, fn exit ->
      exit_dir = exit[:direction] || exit["direction"]

      if to_string(exit_dir) == dir_str do
        %{destination_id: exit[:destination_id] || exit["destination_id"]}
      end
    end)
  end

  defp find_exit_entity(room_id, direction) do
    Entities.list_entities(type: :exit, location_id: room_id)
    |> Enum.find(fn exit ->
      exit_dir =
        Map.get(exit.attributes || %{}, "direction") ||
          Map.get(exit.attributes || %{}, :direction) ||
          exit.name

      to_string(exit_dir) == to_string(direction)
    end)
    |> case do
      nil -> nil
      exit -> %{destination_id: Map.get(exit.attributes || %{}, "destination_id")}
    end
  end

  defp get_exit_destination(%{destination_id: dest}), do: dest
  defp get_exit_destination(_), do: nil

  defp do_move(bot_state, destination_id, direction, game_state) do
    old_room = bot_state.room

    # Run before move hook
    bot_context = %{
      player_id: bot_state.id,
      player_name: bot_state.name,
      type: :bot
    }

    case Hooks.run_until_halt(:at_before_move, [
           bot_context,
           %{destination_id: destination_id, direction: direction}
         ]) do
      {:halt, reason} ->
        Logger.debug("Bot #{bot_state.id}: Move blocked - #{reason}")
        {:error, :blocked}

      :ok ->
        # Run leave room hook
        if old_room do
          Hooks.run(:at_leave_room, [bot_context, %{room_id: old_room.id, direction: direction}])
        end

        # Update game state with new room (in-memory for bots, no DB persist)
        {:ok, new_game_state} =
          update_bot_game_state(game_state, %{current_room_id: destination_id})

        # Load new room
        case RoomLoader.load_room_for_display(destination_id) do
          {:ok, new_room} ->
            # Run enter room hook
            Hooks.run(:at_enter_room, [bot_context, %{room_id: new_room.id}])

            # Update quest progress for room entry (go_to objectives) - in-memory for bots
            room_key = new_room[:key] || new_room["key"] || new_room.key

            updated_game_state =
              update_quest_progress_in_memory(new_game_state, %{type: :go_to, target_id: room_key})

            # Load nearby entities
            nearby = load_nearby_entities(new_room.id)

            Logger.debug("Bot #{bot_state.id}: Moved #{direction} to #{new_room.title}")

            {:ok,
             %{
               bot_state
               | game_state: updated_game_state,
                 room: new_room,
                 nearby_entities: nearby
             }}

          {:error, :not_found} ->
            Logger.warning("Bot #{bot_state.id}: Destination room not found")
            {:error, :room_not_found}
        end
    end
  end

  # Updates a bot's game state in memory (no DB persist)
  # Returns {:ok, updated_state} to match GameState.update_state API
  defp update_bot_game_state(game_state, attrs) do
    updated =
      Enum.reduce(attrs, game_state, fn {key, value}, acc ->
        Map.put(acc, key, value)
      end)

    {:ok, updated}
  end

  # Accepts a quest in-memory without DB persist
  defp accept_quest_in_memory(game_state, quest_id) do
    alias Loka.Framework.Quest.Definitions

    quests = game_state.quests || %{}
    active = Map.get(quests, "active", %{})

    if Map.has_key?(active, quest_id) do
      {:error, :already_active}
    else
      case Definitions.get_quest_definition(quest_id) do
        nil ->
          {:error, :quest_not_found}

        quest_def ->
          # Initialize objectives
          objectives =
            quest_def.objectives
            |> Enum.map(fn obj -> {obj.id, %{"completed" => false, "progress" => 0}} end)
            |> Map.new()

          quest_progress = %{
            "objectives" => objectives,
            "accepted_at" => DateTime.utc_now()
          }

          new_active = Map.put(active, quest_id, quest_progress)
          new_quests = Map.put(quests, "active", new_active)

          update_bot_game_state(game_state, %{quests: new_quests})
      end
    end
  end

  # Completes a quest in-memory without DB persist
  defp complete_quest_in_memory(game_state, quest_id) do
    quests = game_state.quests || %{}
    active = Map.get(quests, "active", %{})
    completed = Map.get(quests, "completed", [])

    if Map.has_key?(active, quest_id) do
      # Move from active to completed
      new_active = Map.delete(active, quest_id)
      new_completed = [quest_id | completed]

      new_quests =
        quests
        |> Map.put("active", new_active)
        |> Map.put("completed", new_completed)

      update_bot_game_state(game_state, %{quests: new_quests})
    else
      {:error, :quest_not_active}
    end
  end

  # Updates quest progress in-memory without DB persist
  # Similar to QuestProgress.update_progress but doesn't persist
  defp update_quest_progress_in_memory(game_state, event) do
    alias Loka.Framework.Quest.Progress.Tracking
    require Logger

    quests = game_state.quests || %{}
    active = Map.get(quests, "active", %{})
    player_id = game_state.player_id

    Logger.info(
      "[BOT] update_quest_progress_in_memory: event=#{inspect(event)}, active_quests=#{inspect(Map.keys(active))}"
    )

    # Use the existing Tracking module to update objectives
    new_active =
      Enum.reduce(active, %{}, fn {quest_id, quest_data}, acc ->
        objectives = Map.get(quest_data, "objectives", %{})

        Logger.info("[BOT] Checking quest #{quest_id} objectives: #{inspect(objectives)}")

        {updated_objectives, completed_list} =
          Tracking.update_objectives(objectives, event, quest_id, player_id)

        Logger.info(
          "[BOT] Updated objectives for #{quest_id}: #{inspect(updated_objectives)}, completed=#{inspect(completed_list)}"
        )

        new_quest_data = Map.put(quest_data, "objectives", updated_objectives)
        Map.put(acc, quest_id, new_quest_data)
      end)

    new_quests = Map.put(quests, "active", new_active)
    Map.put(game_state, :quests, new_quests)
  end

  # Track talk objective in-memory without DB persist
  # Similar to QuestListeners.check_talk but doesn't persist
  defp check_talk_in_memory(game_state, npc_key, dialogue_topic) when is_binary(npc_key) do
    alias Loka.Framework.Quest.Definitions

    quests = game_state.quests || %{}
    active = Map.get(quests, "active", %{})

    # Find matching talk objectives in active quests
    updated_active =
      Enum.reduce(active, active, fn {quest_id, quest_progress}, acc ->
        case Definitions.get_quest_definition(quest_id) do
          nil ->
            acc

          quest_def ->
            # Find talk objectives that match this NPC
            matching_objectives =
              Enum.filter(quest_def.objectives, fn obj ->
                obj.type == :talk and
                  obj.target_id == npc_key and
                  (is_nil(obj.dialogue_topic) or obj.dialogue_topic == "" or
                     obj.dialogue_topic == dialogue_topic)
              end)

            # Update matching objectives
            if Enum.any?(matching_objectives) do
              objectives = Map.get(quest_progress, "objectives", %{})

              updated_objectives =
                Enum.reduce(matching_objectives, objectives, fn obj, obj_acc ->
                  obj_data = Map.get(obj_acc, obj.id, %{})

                  if Map.get(obj_data, "completed", false) do
                    obj_acc
                  else
                    Map.put(obj_acc, obj.id, %{
                      "completed" => true,
                      "progress" => 1
                    })
                  end
                end)

              updated_quest_progress = Map.put(quest_progress, "objectives", updated_objectives)
              Map.put(acc, quest_id, updated_quest_progress)
            else
              acc
            end
        end
      end)

    new_quests = Map.put(quests, "active", updated_active)
    %{game_state | quests: new_quests}
  end

  defp check_talk_in_memory(game_state, _npc_key, _dialogue_topic), do: game_state

  # =============================================================================
  # Combat
  # =============================================================================

  defp execute_attack(entity_id, bot_state) do
    game_state = bot_state.game_state

    case Combat.start_combat(entity_id, game_state) do
      {:ok, combat_state} ->
        Logger.debug("Bot #{bot_state.id}: Started combat with #{combat_state.enemy.name}")
        {:ok, %{bot_state | combat_state: combat_state}}

      {:error, reason} ->
        Logger.debug("Bot #{bot_state.id}: Failed to start combat - #{reason}")
        {:error, reason}
    end
  end

  defp execute_combat_action(action, bot_state) when action in [:attack, :defend, :flee] do
    combat_state = bot_state.combat_state
    game_state = bot_state.game_state

    Logger.info(
      "[BOT] execute_combat_action: action=#{action}, has_combat_state=#{not is_nil(combat_state)}"
    )

    if is_nil(combat_state) do
      Logger.info("[BOT] execute_combat_action: NO combat state, returning error")
      {:error, :not_in_combat}
    else
      case Combat.player_action(combat_state, action, game_state) do
        {:ok, new_combat_state, result} ->
          Logger.info("[BOT] player_action returned: result=#{inspect(result)}")

          enemy_hp =
            get_in(new_combat_state.enemy.health, ["current"]) ||
              get_in(new_combat_state.enemy.health, [:current]) || 0

          Logger.info("[BOT] After attack: enemy_hp=#{enemy_hp}")

          # Check if combat ended
          combat_end_result = Combat.check_combat_end(new_combat_state, game_state)
          Logger.info("[BOT] check_combat_end returned: #{inspect(combat_end_result)}")

          case combat_end_result do
            {:victory, rewards} ->
              Logger.info("[BOT] VICTORY! Applying rewards: #{inspect(rewards)}")
              {:ok, updated_game_state} = Combat.apply_rewards(game_state, rewards)
              Logger.info("Bot #{bot_state.id}: Won combat, got #{rewards.xp} XP")

              # Update quest progress for kill objectives
              enemy_key = combat_state[:enemy_key]

              final_game_state =
                if enemy_key do
                  kill_event = %{type: :kill, target_id: enemy_key, count: 1}
                  Logger.info("[BOT] Combat victory: updating kill objective for #{enemy_key}")
                  update_quest_progress_in_memory(updated_game_state, kill_event)
                else
                  updated_game_state
                end

              {:ok, %{bot_state | combat_state: nil, game_state: final_game_state}}

            {:defeat} ->
              Logger.debug("Bot #{bot_state.id}: Lost combat")
              {:ok, %{bot_state | combat_state: nil}}

            {:fled} ->
              Logger.debug("Bot #{bot_state.id}: Fled combat")
              {:ok, %{bot_state | combat_state: nil}}

            :ongoing ->
              # In LegendMUD-style auto-combat, enemy attacks as part of combat tick
              # For bot testing, we simulate this with execute_combat_tick
              case Combat.execute_combat_tick(new_combat_state, game_state) do
                {:victory, _after_tick_state, _rewards, updated_game_state} ->
                  Logger.info("Bot #{bot_state.id}: Won combat during tick")
                  {:ok, %{bot_state | combat_state: nil, game_state: updated_game_state}}

                {:ok, after_tick_state, player_damage, _updated_game_state} ->
                  # Apply damage from enemy attack to bot's game state
                  updated_game_state = apply_damage_to_bot(game_state, player_damage)

                  # Check for defeat after enemy attack
                  case Combat.check_combat_end(after_tick_state, updated_game_state) do
                    {:defeat} ->
                      Logger.debug("Bot #{bot_state.id}: Lost combat")
                      {:ok, %{bot_state | combat_state: nil, game_state: updated_game_state}}

                    _ ->
                      {:ok,
                       %{
                         bot_state
                         | combat_state: after_tick_state,
                           game_state: updated_game_state
                       }}
                  end
              end
          end

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  defp apply_damage_to_bot(game_state, damage) do
    current_health = game_state.health || %{}
    current_hp = Map.get(current_health, "current") || Map.get(current_health, :current) || 100
    new_hp = max(0, current_hp - damage)

    new_health = Map.put(current_health, "current", new_hp)

    case update_bot_game_state(game_state, %{health: new_health}) do
      {:ok, updated} -> updated
      _ -> game_state
    end
  end

  # =============================================================================
  # Interaction
  # =============================================================================

  defp execute_interact(entity_id, bot_state) do
    case Entities.get_entity(entity_id) do
      nil ->
        {:error, :entity_not_found}

      entity_schema ->
        entity = Entities.to_entity(entity_schema)

        case entity.type do
          :item ->
            # Pick up item - add to inventory
            pickup_item(entity, bot_state)

          :npc ->
            # Start dialogue (simplified - just record interaction)
            Logger.debug("Bot #{bot_state.id}: Interacted with NPC #{entity.short_desc}")
            {:ok, bot_state}

          _ ->
            {:error, :cannot_interact}
        end
    end
  end

  defp pickup_item(item, bot_state) do
    game_state = bot_state.game_state
    inventory = game_state.inventory || []
    new_inventory = inventory ++ [item.id]

    case update_bot_game_state(game_state, %{inventory: new_inventory}) do
      {:ok, updated_game_state} ->
        # Remove item from room (update its location)
        Entities.update_entity(Entities.get_entity!(item.id), %{location_id: nil})
        Logger.debug("Bot #{bot_state.id}: Picked up #{item.name}")

        # Update quest progress for get_item objectives
        event = %{type: :get_item, target_id: item.key}
        updated_game_state = update_quest_progress_in_memory(updated_game_state, event)

        {:ok, %{bot_state | game_state: updated_game_state}}

      _ ->
        {:error, :pickup_failed}
    end
  end

  # =============================================================================
  # Inventory
  # =============================================================================

  defp execute_use_item(item_id, bot_state) do
    game_state = bot_state.game_state
    inventory = game_state.inventory || []

    if item_id in inventory do
      case Entities.get_entity(item_id) do
        nil ->
          {:error, :item_not_found}

        item_schema ->
          item = Entities.to_entity(item_schema)
          useable = Map.get(item.components || %{}, "useable", %{})

          case Map.get(useable, "effect") do
            "heal" ->
              heal_amount = Map.get(useable, "amount", 20)
              heal_bot(bot_state, heal_amount, item_id)

            _ ->
              Logger.debug("Bot #{bot_state.id}: Used item #{item.name}")
              {:ok, bot_state}
          end
      end
    else
      {:error, :item_not_in_inventory}
    end
  end

  defp heal_bot(bot_state, amount, item_id) do
    game_state = bot_state.game_state
    health = game_state.health || %{}
    current = Map.get(health, "current") || Map.get(health, :current) || 100
    max_hp = Map.get(health, "max") || Map.get(health, :max) || 100
    new_hp = min(max_hp, current + amount)

    new_health = Map.put(health, "current", new_hp)

    # Remove item from inventory after use
    inventory = (game_state.inventory || []) -- [item_id]

    case update_bot_game_state(game_state, %{health: new_health, inventory: inventory}) do
      {:ok, updated_game_state} ->
        Logger.debug("Bot #{bot_state.id}: Healed for #{amount}")
        {:ok, %{bot_state | game_state: updated_game_state}}

      _ ->
        {:error, :heal_failed}
    end
  end

  defp execute_equip(item_id, slot, bot_state) do
    game_state = bot_state.game_state
    inventory = game_state.inventory || []

    if item_id in inventory do
      equipment = game_state.equipment || %{}
      new_equipment = Map.put(equipment, to_string(slot), item_id)

      case update_bot_game_state(game_state, %{equipment: new_equipment}) do
        {:ok, updated_game_state} ->
          Logger.debug("Bot #{bot_state.id}: Equipped #{item_id} to #{slot}")
          {:ok, %{bot_state | game_state: updated_game_state}}

        _ ->
          {:error, :equip_failed}
      end
    else
      {:error, :item_not_in_inventory}
    end
  end

  defp execute_unequip(slot, bot_state) do
    game_state = bot_state.game_state
    equipment = game_state.equipment || %{}
    new_equipment = Map.put(equipment, to_string(slot), nil)

    case update_bot_game_state(game_state, %{equipment: new_equipment}) do
      {:ok, updated_game_state} ->
        Logger.debug("Bot #{bot_state.id}: Unequipped #{slot}")
        {:ok, %{bot_state | game_state: updated_game_state}}

      _ ->
        {:error, :unequip_failed}
    end
  end

  # =============================================================================
  # Helpers
  # =============================================================================

  # =============================================================================
  # Dialogue
  # =============================================================================

  defp execute_start_dialogue(npc_id, bot_state) do
    game_state = bot_state.game_state
    player_quests = game_state.quests || %{}

    case Dialogue.start_conversation(npc_id, player_quests: player_quests) do
      {:ok, dialogue_node} ->
        Logger.debug("Bot #{bot_state.id}: Started dialogue with NPC #{npc_id}")

        # Get NPC key for quest tracking
        npc_key = get_entity_key(npc_id)

        # Track talk objective in-memory (for objectives without dialogue_topic requirement)
        updated_game_state = check_talk_in_memory(game_state, npc_key, nil)

        # Store dialogue state in bot_state for navigation
        # Use the actual node id returned from start_conversation (may be start_ready_to_turn_in, etc.)
        actual_node_id = Map.get(dialogue_node, :id, "start")

        dialogue_state = %{
          npc_id: npc_id,
          npc_key: npc_key,
          current_node_id: actual_node_id,
          current_node: dialogue_node
        }

        bot_state = %{bot_state | game_state: updated_game_state}
        bot_state = Map.put(bot_state, :dialogue_state, dialogue_state)

        # Execute action from start node if present (e.g., complete_quest on intro quests)
        start_action = Map.get(dialogue_node, :action)

        if start_action do
          Logger.debug(
            "Bot #{bot_state.id}: Executing start node action: #{inspect(start_action)}"
          )

          execute_dialogue_action_internal(start_action, bot_state)
        else
          {:ok, bot_state}
        end

      {:error, reason} ->
        Logger.debug("Bot #{bot_state.id}: Failed to start dialogue - #{inspect(reason)}")
        {:error, reason}
    end
  end

  defp get_entity_key(entity_id) do
    case Entities.get_entity(entity_id) do
      nil -> nil
      entity -> entity.key
    end
  end

  defp execute_dialogue_choice(choice_index, bot_state) do
    dialogue_state = Map.get(bot_state, :dialogue_state)

    if is_nil(dialogue_state) do
      {:error, :not_in_dialogue}
    else
      npc_id = dialogue_state.npc_id
      npc_key = dialogue_state.npc_key
      current_node_id = dialogue_state.current_node_id
      game_state = bot_state.game_state
      player_quests = game_state.quests || %{}

      active = Map.get(player_quests, "active", %{}) |> Map.keys()
      completed = Map.get(player_quests, "completed", [])

      Logger.info(
        "[BOT] dialogue_choice #{choice_index} from #{current_node_id}: active=#{inspect(active)}, completed=#{inspect(completed)}"
      )

      case Dialogue.choose_option(npc_id, choice_index, current_node_id,
             player_quests: player_quests
           ) do
        {:ok, :end, %{action: action}} ->
          # Dialogue ended, possibly with an action
          bot_state = Map.delete(bot_state, :dialogue_state)

          if action do
            execute_dialogue_action_internal(action, bot_state)
          else
            Logger.debug("Bot #{bot_state.id}: Dialogue ended")
            {:ok, bot_state}
          end

        {:ok, next_node, %{action: next_action}} ->
          # Continue dialogue, possibly with an action
          next_node_id = Map.get(next_node, :id, "unknown")
          Logger.debug("Bot #{bot_state.id}: Advanced dialogue to node #{next_node_id}")

          # Track talk objective in-memory with specific dialogue topic
          updated_game_state = check_talk_in_memory(game_state, npc_key, next_node_id)

          new_dialogue_state = %{
            dialogue_state
            | current_node_id: next_node_id,
              current_node: next_node
          }

          bot_state = %{bot_state | game_state: updated_game_state}
          bot_state = Map.put(bot_state, :dialogue_state, new_dialogue_state)

          # Execute any action from this choice, or from the node we're entering
          # Choice action takes priority, but also check node action (e.g., complete_quest on turn-in nodes)
          node_action = Map.get(next_node, :action)
          action_to_execute = next_action || node_action

          if action_to_execute do
            execute_dialogue_action_internal(action_to_execute, bot_state)
          else
            {:ok, bot_state}
          end

        {:error, reason} ->
          Logger.debug("Bot #{bot_state.id}: Dialogue choice failed - #{inspect(reason)}")
          {:error, reason}
      end
    end
  end

  defp execute_dialogue_action(action, bot_state) do
    execute_dialogue_action_internal(action, bot_state)
  end

  defp execute_dialogue_action_internal(nil, bot_state), do: {:ok, bot_state}

  defp execute_dialogue_action_internal({:accept_quest, quest_id}, bot_state) do
    game_state = bot_state.game_state

    # Accept quest in-memory without DB persist
    case accept_quest_in_memory(game_state, quest_id) do
      {:ok, updated_game_state} ->
        Logger.debug("Bot #{bot_state.id}: Accepted quest #{quest_id}")
        {:ok, %{bot_state | game_state: updated_game_state}}

      {:error, reason} ->
        Logger.debug("Bot #{bot_state.id}: Failed to accept quest - #{inspect(reason)}")
        {:error, reason}
    end
  end

  defp execute_dialogue_action_internal({:complete_quest, quest_id}, bot_state) do
    game_state = bot_state.game_state
    quests = game_state.quests || %{}
    active = Map.get(quests, "active", %{})
    Logger.info("[BOT] complete_quest #{quest_id}: active_quests=#{inspect(Map.keys(active))}")

    # Complete quest in-memory without DB persist
    case complete_quest_in_memory(game_state, quest_id) do
      {:ok, updated_game_state} ->
        new_completed = Map.get(updated_game_state.quests || %{}, "completed", [])
        Logger.info("[BOT] Completed quest #{quest_id}, completed_list=#{inspect(new_completed)}")
        {:ok, %{bot_state | game_state: updated_game_state}}

      {:error, reason} ->
        Logger.info("[BOT] Failed to complete quest #{quest_id}: #{inspect(reason)}")
        {:error, reason}
    end
  end

  defp execute_dialogue_action_internal({:give_item, item_key}, bot_state) do
    game_state = bot_state.game_state

    # Spawn item and add to inventory
    case Spawner.spawn(item_key) do
      {:ok, item} ->
        inventory = game_state.inventory || []
        new_inventory = inventory ++ [item.id]

        case update_bot_game_state(game_state, %{inventory: new_inventory}) do
          {:ok, updated_game_state} ->
            Logger.debug("Bot #{bot_state.id}: Received item #{item_key}")
            {:ok, %{bot_state | game_state: updated_game_state}}

          _ ->
            {:error, :inventory_update_failed}
        end

      {:error, reason} ->
        Logger.debug("Bot #{bot_state.id}: Failed to receive item - #{inspect(reason)}")
        {:error, reason}
    end
  end

  defp execute_dialogue_action_internal({:set_flag, flag_name}, bot_state) do
    game_state = bot_state.game_state
    flags = game_state.flags || %{}
    new_flags = Map.put(flags, flag_name, true)

    case update_bot_game_state(game_state, %{flags: new_flags}) do
      {:ok, updated_game_state} ->
        Logger.debug("Bot #{bot_state.id}: Set flag #{flag_name}")
        {:ok, %{bot_state | game_state: updated_game_state}}

      _ ->
        {:error, :flag_update_failed}
    end
  end

  defp execute_dialogue_action_internal(action, bot_state) do
    Logger.debug("Bot #{bot_state.id}: Unhandled dialogue action #{inspect(action)}")
    {:ok, bot_state}
  end

  # =============================================================================
  # Gathering
  # =============================================================================

  defp execute_gather(node_key, bot_state) do
    game_state = bot_state.game_state
    room = bot_state.room

    if is_nil(room) do
      {:error, :no_room}
    else
      alias Loka.Framework.Gathering

      case Gathering.gather(game_state, room, node_key) do
        {:ok, result} ->
          # Add gathered items to inventory
          updated_game_state =
            Enum.reduce(result.items, game_state, fn %{item: item_key, quantity: qty},
                                                     acc_state ->
              add_items_to_inventory(acc_state, item_key, qty)
            end)

          # Apply XP if any
          updated_game_state =
            if result.xp do
              apply_gathering_xp(updated_game_state, result.xp)
            else
              updated_game_state
            end

          Logger.debug(
            "Bot #{bot_state.id}: Gathered from #{node_key} - #{length(result.items)} items"
          )

          {:ok, %{bot_state | game_state: updated_game_state}}

        {:error, reason} ->
          Logger.debug("Bot #{bot_state.id}: Gathering failed - #{inspect(reason)}")
          {:error, reason}
      end
    end
  end

  defp add_items_to_inventory(game_state, item_key, quantity) do
    # Spawn items and add to inventory
    inventory = game_state.inventory || []

    new_items =
      Enum.reduce(1..quantity, [], fn _, acc ->
        case Spawner.spawn(item_key) do
          {:ok, item} -> [item.id | acc]
          {:error, _} -> acc
        end
      end)

    new_inventory = inventory ++ new_items

    case update_bot_game_state(game_state, %{inventory: new_inventory}) do
      {:ok, updated} -> updated
      _ -> game_state
    end
  end

  defp apply_gathering_xp(game_state, xp_reward) do
    # xp_reward is a map like %{skill: "herbalism", amount: 10}
    skill = MapHelpers.get_flexible(xp_reward, :skill, nil)
    amount = MapHelpers.get_flexible(xp_reward, :amount, 0)

    if skill && amount > 0 do
      skills = game_state.stats[:skills] || %{}
      current_xp = Map.get(skills, skill, 0)
      new_skills = Map.put(skills, skill, current_xp + amount)
      stats = Map.put(game_state.stats || %{}, :skills, new_skills)

      case update_bot_game_state(game_state, %{stats: stats}) do
        {:ok, updated} -> updated
        _ -> game_state
      end
    else
      game_state
    end
  end

  # =============================================================================
  # Crafting
  # =============================================================================

  defp execute_craft(recipe_key, _tool_id, bot_state) do
    game_state = bot_state.game_state
    room = bot_state.room

    alias Loka.Framework.Crafting

    case Crafting.craft(game_state, recipe_key, room: room) do
      {:ok, state_after_consume, result} ->
        # Add crafted items to inventory
        updated_game_state =
          Enum.reduce(result.items, state_after_consume, fn %{item: item_key, quantity: qty},
                                                            acc_state ->
            add_items_to_inventory(acc_state, item_key, qty)
          end)

        # Apply XP if successful
        updated_game_state =
          if result.success && result.xp do
            apply_crafting_xp(updated_game_state, result.xp)
          else
            updated_game_state
          end

        Logger.debug("Bot #{bot_state.id}: Crafted #{recipe_key} - success: #{result.success}")
        {:ok, %{bot_state | game_state: updated_game_state}}

      {:error, reason} ->
        Logger.debug("Bot #{bot_state.id}: Crafting failed - #{inspect(reason)}")
        {:error, reason}
    end
  end

  defp apply_crafting_xp(game_state, xp_reward) do
    # xp_reward is a map like %{skill: "alchemy", amount: 15}
    skill = MapHelpers.get_flexible(xp_reward, :skill, nil)
    amount = MapHelpers.get_flexible(xp_reward, :amount, 0)

    if skill && amount > 0 do
      skills = game_state.stats[:skills] || %{}
      current_xp = Map.get(skills, skill, 0)
      new_skills = Map.put(skills, skill, current_xp + amount)
      stats = Map.put(game_state.stats || %{}, :skills, new_skills)

      case update_bot_game_state(game_state, %{stats: stats}) do
        {:ok, updated} -> updated
        _ -> game_state
      end
    else
      game_state
    end
  end

  # =============================================================================
  # Helpers
  # =============================================================================

  @doc """
  Loads nearby entities in a room (NPCs, items, exits).
  """
  def load_nearby_entities(nil), do: []

  def load_nearby_entities(room_id) do
    Entities.list_entities(location_id: room_id)
    |> Enum.map(&Entities.to_entity/1)
  end

  @doc """
  Refreshes a bot's view of the current room and nearby entities.
  """
  def refresh_room(bot_state) do
    room_id = bot_state.game_state.current_room_id

    case RoomLoader.load_room_for_display(room_id) do
      {:ok, room} ->
        nearby = load_nearby_entities(room_id)
        {:ok, %{bot_state | room: room, nearby_entities: nearby}}

      {:error, _} ->
        {:ok, bot_state}
    end
  end
end
