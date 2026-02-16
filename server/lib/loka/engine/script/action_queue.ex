defmodule Loka.Engine.Script.ActionQueue do
  @moduledoc """
  Scripts queue actions, don't execute directly.

  This ensures transactional safety and rate limiting. All actions from a script
  are collected during execution and then executed atomically after the script
  completes successfully.

  ## Rate Limits

  To prevent abuse, scripts have per-execution limits:

  - spawns: 10 entities per script
  - despawns: 20 entities per script
  - messages: 50 messages per script
  - damage_total: 1000 total damage per script
  - teleports: 5 teleports per script

  ## Usage

      # In script execution context
      ActionQueue.init()

      # Script queues actions via bindings
      say("Hello!")  # Queues {:say, entity, "Hello!"}

      # After script completes
      actions = ActionQueue.get()
      ActionQueue.execute_all(actions, context)
  """

  require Logger

  alias Loka.Engine.{Event, EventBus}

  @type action_type ::
          :say
          | :emote
          | :message
          | :announce_room
          | :set_flag
          | :set_attribute
          | :give_item
          | :remove_item
          | :spawn_entity
          | :despawn_entity
          | :move_entity
          | :teleport
          | :damage
          | :heal
          | :apply_effect
          | :remove_effect
          | :start_quest
          | :complete_objective
          | :set_room_attr
          | :lock_exit
          | :unlock_exit
          | :schedule
          | :emit_event
          | :set_trait_state
          | :set_cooldown
          | :signal
          | :create_room

  @type action :: {action_type(), term()}

  # Rate limits per script execution
  @limits %{
    spawns: 10,
    despawns: 20,
    messages: 50,
    damage_total: 1000,
    teleports: 5,
    room_changes: 10,
    effects: 20,
    schedules: 5,
    signals: 10,
    room_creates: 3
  }

  @doc """
  Initialize the action queue for the current process.
  Must be called before script execution.
  """
  @spec init() :: :ok
  def init do
    Process.put(:script_action_queue, [])
    Process.put(:script_action_counts, %{})
    :ok
  end

  @doc """
  Clear the action queue.
  """
  @spec clear() :: :ok
  def clear do
    Process.delete(:script_action_queue)
    Process.delete(:script_action_counts)
    :ok
  end

  @doc """
  Queue an action for later execution.

  Returns `:ok` if the action was queued, `{:error, :rate_limited}` if
  the rate limit for this action type has been exceeded.
  """
  @spec queue(action()) :: :ok | {:error, :rate_limited}
  def queue(action) do
    case check_limit(action) do
      :ok ->
        current = Process.get(:script_action_queue, [])
        Process.put(:script_action_queue, [action | current])
        increment_count(action)
        :ok

      {:error, _} = error ->
        error
    end
  end

  @doc """
  Get all queued actions in execution order.
  """
  @spec get() :: [action()]
  def get do
    Process.get(:script_action_queue, [])
    |> Enum.reverse()
  end

  @doc """
  Get the count of actions by type.
  """
  @spec get_counts() :: map()
  def get_counts do
    Process.get(:script_action_counts, %{})
  end

  @doc """
  Execute all queued actions.

  Actions are executed in order. If an action fails, execution continues
  with the remaining actions (fail-soft). Returns a summary of results.
  """
  @spec execute_all([action()], map()) :: {:ok, map()} | {:error, term()}
  def execute_all(actions, context \\ %{}) do
    results =
      Enum.reduce(actions, %{success: 0, failed: 0, errors: []}, fn action, acc ->
        case execute_action(action, context) do
          :ok ->
            %{acc | success: acc.success + 1}

          {:ok, _result} ->
            %{acc | success: acc.success + 1}

          {:error, reason} ->
            Logger.warning(
              "[ActionQueue] Action failed: #{inspect(action)}, reason: #{inspect(reason)}"
            )

            %{acc | failed: acc.failed + 1, errors: [{action, reason} | acc.errors]}
        end
      end)

    {:ok, results}
  end

  @doc """
  Check if an action would exceed rate limits.
  """
  @spec check_limit(action()) :: :ok | {:error, :rate_limited}
  def check_limit(action) do
    category = action_category(action)
    limit = Map.get(@limits, category)
    current = get_count(category)

    # For damage/heal, we need to check current + amount, not just current
    increment = action_increment(action)
    new_total = current + increment

    if limit && new_total > limit do
      Logger.warning("[ActionQueue] Rate limit exceeded for #{category}")
      {:error, :rate_limited}
    else
      :ok
    end
  end

  # Calculate how much an action will increment the counter
  defp action_increment({:damage, %{amount: amount}}), do: amount
  defp action_increment({:heal, %{amount: amount}}), do: amount
  defp action_increment(_), do: 1

  @doc """
  Returns the rate limits.
  """
  @spec limits() :: map()
  def limits, do: @limits

  # Categorize actions for rate limiting
  defp action_category({:spawn_entity, _}), do: :spawns
  defp action_category({:despawn_entity, _}), do: :despawns
  defp action_category({:say, _}), do: :messages
  defp action_category({:emote, _}), do: :messages
  defp action_category({:message, _}), do: :messages
  defp action_category({:announce_room, _}), do: :messages
  defp action_category({:damage, _}), do: :damage_total
  defp action_category({:heal, _}), do: :damage_total
  defp action_category({:teleport, _}), do: :teleports
  defp action_category({:move_entity, _}), do: :teleports
  defp action_category({:set_room_attr, _}), do: :room_changes
  defp action_category({:lock_exit, _}), do: :room_changes
  defp action_category({:unlock_exit, _}), do: :room_changes
  defp action_category({:apply_effect, _}), do: :effects
  defp action_category({:remove_effect, _}), do: :effects
  defp action_category({:schedule, _}), do: :schedules
  defp action_category({:signal, _}), do: :signals
  defp action_category({:create_room, _}), do: :room_creates
  defp action_category(_), do: :other

  defp get_count(category) do
    Map.get(Process.get(:script_action_counts, %{}), category, 0)
  end

  defp increment_count(action) do
    category = action_category(action)
    counts = Process.get(:script_action_counts, %{})

    # For damage, track total amount
    increment =
      case action do
        {:damage, %{amount: amount}} -> amount
        {:heal, %{amount: amount}} -> amount
        _ -> 1
      end

    updated = Map.update(counts, category, increment, &(&1 + increment))
    Process.put(:script_action_counts, updated)
  end

  # Execute individual actions
  defp execute_action({:say, %{entity: entity, message: message}}, _context) do
    event =
      Event.new(:say, %{
        source: entity.id,
        source_name: entity.short_desc || "Someone",
        payload: %{text: message}
      })

    EventBus.emit(event)
    :ok
  end

  defp execute_action({:emote, %{entity: entity, action: action}}, _context) do
    event =
      Event.new(:emote, %{
        source: entity.id,
        source_name: entity.short_desc || "Someone",
        payload: %{action: action}
      })

    EventBus.emit(event)
    :ok
  end

  defp execute_action({:message, %{target_id: target_id, text: text}}, _context) do
    event =
      Event.new(:message, %{
        target: target_id,
        payload: %{text: text}
      })

    EventBus.emit(event)
    :ok
  end

  defp execute_action({:announce_room, %{room_id: room_id, text: text}}, _context) do
    event =
      Event.new(:room_message, %{
        room_id: room_id,
        payload: %{text: text}
      })

    EventBus.emit(event)
    :ok
  end

  defp execute_action({:set_flag, %{player_id: player_id, flag: flag, value: value}}, _context) do
    event =
      Event.new(:set_flag, %{
        target: player_id,
        payload: %{flag: flag, value: value}
      })

    EventBus.emit(event)
    :ok
  end

  defp execute_action(
         {:give_item, %{player_id: player_id, item_key: item_key} = params},
         _context
       ) do
    count = Map.get(params, :count, 1)

    event =
      Event.new(:give_item, %{
        target: player_id,
        payload: %{item_key: item_key, count: count}
      })

    EventBus.emit(event)
    :ok
  end

  defp execute_action({:remove_item, %{player_id: player_id, item_key: item_key}}, _context) do
    event =
      Event.new(:remove_item, %{
        target: player_id,
        payload: %{item_key: item_key}
      })

    EventBus.emit(event)
    :ok
  end

  defp execute_action({:spawn_entity, %{prototype_key: key, room_id: room_id} = params}, _context) do
    attrs = Map.get(params, :attrs, %{})

    event =
      Event.new(:spawn_entity, %{
        payload: %{prototype_key: key, room_id: room_id, attrs: attrs}
      })

    EventBus.emit(event)
    :ok
  end

  defp execute_action({:despawn_entity, %{entity_id: entity_id}}, _context) do
    event =
      Event.new(:despawn_entity, %{
        target: entity_id
      })

    EventBus.emit(event)
    :ok
  end

  defp execute_action({:move_entity, %{entity_id: entity_id, room_id: room_id}}, _context) do
    event =
      Event.new(:move_entity, %{
        target: entity_id,
        payload: %{room_id: room_id}
      })

    EventBus.emit(event)
    :ok
  end

  defp execute_action({:teleport, %{entity_id: entity_id, room_id: room_id}}, _context) do
    event =
      Event.new(:teleport, %{
        target: entity_id,
        payload: %{room_id: room_id, instant: true}
      })

    EventBus.emit(event)
    :ok
  end

  defp execute_action({:damage, %{target_id: target_id, amount: amount} = params}, _context) do
    damage_type = Map.get(params, :type, :physical)

    event =
      Event.new(:damage, %{
        target: target_id,
        payload: %{amount: amount, type: damage_type}
      })

    EventBus.emit(event)
    :ok
  end

  defp execute_action({:heal, %{target_id: target_id, amount: amount}}, _context) do
    event =
      Event.new(:heal, %{
        target: target_id,
        payload: %{amount: amount}
      })

    EventBus.emit(event)
    :ok
  end

  defp execute_action(
         {:apply_effect, %{target_id: target_id, effect_key: effect_key} = params},
         _context
       ) do
    duration = Map.get(params, :duration)

    event =
      Event.new(:apply_effect, %{
        target: target_id,
        payload: %{effect_key: effect_key, duration: duration}
      })

    EventBus.emit(event)
    :ok
  end

  defp execute_action({:remove_effect, %{target_id: target_id, effect_key: effect_key}}, _context) do
    event =
      Event.new(:remove_effect, %{
        target: target_id,
        payload: %{effect_key: effect_key}
      })

    EventBus.emit(event)
    :ok
  end

  defp execute_action({:start_quest, %{player_id: player_id, quest_id: quest_id}}, _context) do
    event =
      Event.new(:start_quest, %{
        target: player_id,
        payload: %{quest_id: quest_id}
      })

    EventBus.emit(event)
    :ok
  end

  defp execute_action(
         {:complete_objective, %{player_id: player_id, quest_id: quest_id, objective_id: obj_id}},
         _context
       ) do
    event =
      Event.new(:complete_objective, %{
        target: player_id,
        payload: %{quest_id: quest_id, objective_id: obj_id}
      })

    EventBus.emit(event)
    :ok
  end

  defp execute_action({:set_room_attr, %{room_id: room_id, key: key, value: value}}, _context) do
    event =
      Event.new(:set_room_attr, %{
        target: room_id,
        payload: %{key: key, value: value}
      })

    EventBus.emit(event)
    :ok
  end

  defp execute_action({:lock_exit, %{room_id: room_id, direction: direction}}, _context) do
    event =
      Event.new(:lock_exit, %{
        target: room_id,
        payload: %{direction: direction}
      })

    EventBus.emit(event)
    :ok
  end

  defp execute_action({:unlock_exit, %{room_id: room_id, direction: direction}}, _context) do
    event =
      Event.new(:unlock_exit, %{
        target: room_id,
        payload: %{direction: direction}
      })

    EventBus.emit(event)
    :ok
  end

  defp execute_action(
         {:schedule, %{delay: delay, script_key: script_key, entity_id: entity_id, context: ctx}},
         _context
       ) do
    # Schedule script execution via the Timers system
    case Loka.Timers.Server.schedule_script(entity_id, delay, script_key, ctx) do
      {:ok, _ref} ->
        :ok

      {:error, reason} ->
        Logger.warning("[ActionQueue] Failed to schedule script: #{inspect(reason)}")
        {:error, reason}
    end
  end

  # Legacy format without entity_id (for backwards compatibility)
  defp execute_action(
         {:schedule, %{delay: delay, script_key: script_key, context: ctx}},
         context
       ) do
    # Try to extract entity_id from context
    entity_id = Map.get(context, :entity_id)

    if entity_id do
      execute_action(
        {:schedule, %{delay: delay, script_key: script_key, entity_id: entity_id, context: ctx}},
        context
      )
    else
      Logger.warning("[ActionQueue] Cannot schedule script without entity_id")
      {:error, :missing_entity_id}
    end
  end

  # New emit_event format with entity context for emotes chain
  defp execute_action(
         {:emit_event,
          %{event_name: event_name, entity: entity, emotes: emotes, scripts: scripts}},
         _context
       ) do
    event_key = if is_atom(event_name), do: event_name, else: String.to_atom(event_name)
    event_string = Atom.to_string(event_key)

    # 1. Check emotes for this event
    emote_text = get_emote(emotes, event_key) || get_emote(emotes, event_string)

    if emote_text do
      # Say the emote text
      emote_event =
        Event.new(:say, %{
          source: entity[:id],
          source_name: entity[:short_desc] || "Someone",
          payload: %{text: emote_text}
        })

      EventBus.emit(emote_event)
    end

    # 2. Check for on_{event} script
    script_key = get_event_script(scripts, event_key) || get_event_script(scripts, event_string)

    if script_key do
      # Run the script asynchronously
      Task.start(fn ->
        run_event_script(entity, script_key)
      end)
    end

    # 3. Also emit to EventBus for other subscribers
    event = Event.new(event_key, %{source: entity[:id], payload: %{}})
    EventBus.emit(event)

    :ok
  end

  # Legacy emit_event format (backwards compatibility)
  defp execute_action({:emit_event, %{event_name: name, data: data}}, _context) do
    event_name = if is_binary(name), do: String.to_atom(name), else: name
    event = Event.new(event_name, %{payload: data})
    EventBus.emit(event)
    :ok
  end

  defp execute_action(
         {:set_trait_state,
          %{entity_id: entity_id, trait_key: trait_key, state_key: state_key, value: value}},
         _context
       ) do
    # Emit event to update entity's trait state
    # The EntityServer will handle storing this in the entity
    event =
      Event.new(:set_trait_state, %{
        target: entity_id,
        payload: %{
          trait_key: trait_key,
          state_key: state_key,
          value: value
        }
      })

    EventBus.emit(event)
    :ok
  end

  # Legacy backward compatibility
  defp execute_action(
         {:set_behavior_state,
          %{entity_id: entity_id, behavior_key: bk, state_key: sk, value: v}},
         context
       ) do
    execute_action(
      {:set_trait_state, %{entity_id: entity_id, trait_key: bk, state_key: sk, value: v}},
      context
    )
  end

  defp execute_action(
         {:set_cooldown, %{entity_id: entity_id, key: key, duration: duration}},
         _context
       ) do
    Loka.Engine.Cooldowns.set(entity_id, to_string(key), duration)
    :ok
  end

  defp execute_action(
         {:create_room, %{attrs: attrs, source_room_id: source_room_id, creator_id: creator_id}},
         _context
       ) do
    alias Loka.Engine.Spawner

    name = Map.get(attrs, "name") || Map.get(attrs, :name)
    description = Map.get(attrs, "description") || Map.get(attrs, :description, "")
    user_tags = Map.get(attrs, "tags") || Map.get(attrs, :tags, [])
    exit_to = Map.get(attrs, "exit_to") || Map.get(attrs, :exit_to)
    tags = ["script_created", "dynamic"] ++ user_tags

    room_attrs = [
      short_desc: name,
      long_desc: description,
      tags: tags,
      components: %{
        "metadata" => %{"created_by_script" => true, "creator_id" => creator_id}
      }
    ]

    case Spawner.create_room(room_attrs) do
      {:ok, room} ->
        # Create bidirectional exits if exit_to specified
        maybe_create_exits(room, exit_to, source_room_id)
        {:ok, room.id}

      {:error, reason} ->
        Logger.warning("[ActionQueue] create_room failed: #{inspect(reason)}")
        {:error, reason}
    end
  end

  defp execute_action(
         {:signal, %{source_id: source_id, target_id: target_id, signal_name: name, data: data}},
         _context
       ) do
    event =
      Event.new(:signal, %{
        source: source_id,
        target: target_id,
        payload: %{signal_name: name, data: data}
      })

    EventBus.emit(event)
    :ok
  end

  defp execute_action(action, _context) do
    Logger.warning("[ActionQueue] Unknown action: #{inspect(action)}")
    {:error, :unknown_action}
  end

  # =============================================================================
  # Room Creation Helpers
  # =============================================================================

  defp maybe_create_exits(room, exit_to, source_room_id) when is_map(exit_to) do
    alias Loka.Engine.Spawner

    direction = Map.get(exit_to, "direction") || Map.get(exit_to, :direction)
    connect_room_id = Map.get(exit_to, "room_id") || Map.get(exit_to, :room_id) || source_room_id

    if direction && connect_room_id do
      reverse = reverse_direction(direction)

      # Create exit from connected room to new room
      Spawner.create_exit(
        direction: direction,
        source_id: connect_room_id,
        destination_id: room.id
      )

      # Create reverse exit from new room back to connected room (bidirectional)
      if reverse do
        Spawner.create_exit(
          direction: reverse,
          source_id: room.id,
          destination_id: connect_room_id
        )
      end
    end
  end

  defp maybe_create_exits(_, _, _), do: :ok

  @direction_opposites %{
    "north" => "south",
    "south" => "north",
    "east" => "west",
    "west" => "east",
    "up" => "down",
    "down" => "up",
    "northeast" => "southwest",
    "northwest" => "southeast",
    "southeast" => "northwest",
    "southwest" => "northeast"
  }

  defp reverse_direction(dir) when is_binary(dir) do
    Map.get(@direction_opposites, String.downcase(dir))
  end

  defp reverse_direction(dir) when is_atom(dir) do
    reverse_direction(Atom.to_string(dir))
  end

  defp reverse_direction(_), do: nil

  # =============================================================================
  # Emit Event Helpers
  # =============================================================================

  # Get emote text from emotes map (supports atom and string keys)
  defp get_emote(emotes, key) when is_map(emotes) do
    Map.get(emotes, key) || Map.get(emotes, to_string(key))
  end

  defp get_emote(_, _), do: nil

  # Get on_{event} script key from scripts map
  defp get_event_script(scripts, event_key) when is_map(scripts) do
    on_key = :"on_#{event_key}"
    on_string = "on_#{event_key}"

    Map.get(scripts, on_key) || Map.get(scripts, on_string)
  end

  defp get_event_script(_, _), do: nil

  # Run a script for an emit event
  defp run_event_script(entity, script_key) do
    alias Loka.Engine.Script.Executor

    case Executor.run_by_key(script_key, entity, %{triggered_by: :emit}) do
      {:ok, _result} ->
        Logger.debug("[ActionQueue] Emit script #{script_key} completed")

      {:error, reason} ->
        Logger.warning("[ActionQueue] Emit script #{script_key} failed: #{inspect(reason)}")
    end
  end
end
