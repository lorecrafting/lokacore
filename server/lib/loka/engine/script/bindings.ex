defmodule Loka.Engine.Script.Bindings do
  @moduledoc """
  API functions available to builder scripts.

  These are the ONLY functions builders can use. They provide a safe,
  controlled interface for querying game state and queuing actions.

  ## Categories

  ### Context (Read-Only)
  - `entity` - The entity being scripted
  - `player` - The current player (if applicable)
  - `context` - Additional event context
  - `config` - Behavior configuration (for behavior scripts)
  - `room()` - Current room data

  ### Query Functions
  - `quest_active?/1`, `quest_complete?/1` - Quest state
  - `has_item?/1`, `has_flag?/1` - Player inventory/flags
  - `get_stat/1`, `get_attribute/1` - Stats and attributes
  - `entities_in_room/0`, `find_entity/1` - Entity queries

  ### Action Functions (Queued)
  - `say/1`, `emote/1`, `message/2` - Communication
  - `damage/2`, `heal/2` - Combat
  - `give_item/1`, `remove_item/1` - Inventory
  - `spawn_at/2`, `despawn/1` - Spawning
  - `set_flag/2`, `set_attribute/2` - State changes

  ### Utility
  - `chance?/1`, `roll/1`, `pick/1` - Randomness
  - `log/1` - Debugging

  ### Control Flow
  - `deny/0`, `deny/1` - Block actions
  """

  require Logger

  alias Loka.Engine.Script.ActionQueue

  @doc """
  Build bindings for script execution.

  ## Parameters

  - `entity` - The entity the script is attached to
  - `context` - Event context (includes player, trigger, etc.)
  - `extra` - Additional bindings to merge

  ## Returns

  Keyword list of bindings for Code.eval_string
  """
  @spec build(map(), map(), keyword()) :: keyword()
  def build(entity, context, extra \\ []) do
    player = Map.get(context, :player)
    game_state = Map.get(context, :game_state, %{})

    base_bindings() ++
      context_bindings(entity, player, context) ++
      query_bindings(player, game_state) ++
      action_bindings(entity, player) ++
      utility_bindings() ++
      control_bindings() ++
      extra
  end

  # Base bindings that are always available
  defp base_bindings do
    [
      # Nil placeholder for undefined values
      nil: nil,
      true: true,
      false: false
    ]
  end

  # Context bindings - read-only data
  defp context_bindings(entity, player, context) do
    # Extract behavior config from context (for behavior scripts)
    config = Map.get(context, :config, %{})

    [
      # Entity being scripted (read-only map)
      entity: safe_entity_map(entity),

      # Current player (read-only map)
      player: safe_player_map(player),

      # Event context
      context: safe_context_map(context),

      # Behavior config (read-only, for behaviors)
      # Scripts access via config.route, config.interval, etc.
      config: safe_config_map(config),

      # Room query function
      room: fn -> get_room(entity) end
    ]
  end

  # Query bindings - read-only state checks
  defp query_bindings(player, game_state) do
    [
      # Quest state queries
      quest_active?: fn quest_id -> quest_active?(game_state, quest_id) end,
      quest_complete?: fn quest_id -> quest_complete?(game_state, quest_id) end,
      quest_objective_done?: fn quest_id, obj_id ->
        quest_objective_done?(game_state, quest_id, obj_id)
      end,

      # Player state queries
      has_item?: fn item_key -> has_item?(game_state, item_key) end,
      has_flag?: fn flag_name -> has_flag?(game_state, flag_name) end,
      get_flag: fn flag_name -> get_flag(game_state, flag_name, nil) end,
      get_stat: fn stat_name -> get_stat(game_state, stat_name) end,
      get_skill: fn skill_name -> get_skill(game_state, skill_name) end,
      get_attribute: fn attr_name -> get_attribute(game_state, attr_name) end,

      # Entity queries
      entities_in_room: fn -> entities_in_room(player) end,
      players_in_room: fn -> players_in_room(player) end,
      entity_present?: fn entity_key -> entity_present?(player, entity_key) end,
      find_entity: fn opts -> find_entity(player, opts) end,
      find_entities_by_tag: fn tag -> find_entities_by_tag(player, tag) end,

      # World state queries
      time_of_day: fn -> time_of_day() end,
      current_hour: fn -> current_hour() end,
      current_weather: fn -> current_weather(player) end,
      is_outdoor?: fn -> is_outdoor?(player) end,
      is_dark?: fn -> is_dark?(player) end
    ]
  end

  # Action bindings - queue actions for later execution
  defp action_bindings(entity, player) do
    [
      # Communication actions
      say: fn message -> queue_say(entity, message) end,
      emote: fn action -> queue_emote(entity, action) end,
      message: fn text -> queue_message(player, text) end,
      announce_room: fn text -> queue_announce_room(entity, text) end,

      # State change actions
      set_flag: fn flag, value -> queue_set_flag(player, flag, value) end,
      complete_objective: fn quest_id, obj_id ->
        queue_complete_objective(player, quest_id, obj_id)
      end,
      start_quest: fn quest_id -> queue_start_quest(player, quest_id) end,

      # Inventory actions
      give_item: fn item_key -> queue_give_item(player, item_key) end,
      remove_item: fn item_key -> queue_remove_item(player, item_key) end,

      # Entity spawning
      spawn_at: fn prototype_key, room_id -> queue_spawn(prototype_key, room_id, %{}) end,
      spawn_npc: fn prototype_key -> queue_spawn(prototype_key, get_location(entity), %{}) end,
      spawn_item: fn item_key -> queue_spawn(item_key, get_location(entity), %{}) end,
      despawn: fn entity_id -> queue_despawn(entity_id) end,

      # Movement
      move_entity: fn entity_id, room_id -> queue_move(entity_id, room_id) end,
      teleport: fn entity_id, room_id -> queue_teleport(entity_id, room_id) end,

      # Combat
      damage: fn target_id, amount -> queue_damage(target_id, amount, :physical) end,
      heal: fn target_id, amount -> queue_heal(target_id, amount) end,

      # Effects
      apply_effect: fn target_id, effect_key -> queue_apply_effect(target_id, effect_key, nil) end,
      remove_effect: fn target_id, effect_key -> queue_remove_effect(target_id, effect_key) end,

      # Room manipulation
      set_room_attr: fn key, value -> queue_set_room_attr(entity, key, value) end,
      lock_exit: fn direction -> queue_lock_exit(entity, direction) end,
      unlock_exit: fn direction -> queue_unlock_exit(entity, direction) end,

      # Scheduling (capture entity for later execution)
      after: fn delay, script_key -> queue_schedule(entity, delay, script_key, %{}) end,

      # Events (captures entity for emotes lookup)
      # emit(:waking_up) or emit(:patrol_arrive, %{location: "market"})
      emit: fn
        event_name when is_atom(event_name) ->
          queue_emit(entity, event_name, %{})

        event_name when is_binary(event_name) ->
          queue_emit(entity, String.to_atom(event_name), %{})
      end
    ]
  end

  # Utility bindings
  defp utility_bindings do
    [
      # Randomness
      chance?: fn percentage -> :rand.uniform(100) <= percentage end,
      roll: fn dice_str -> roll_dice(dice_str) end,
      random: fn min, max -> :rand.uniform(max - min + 1) + min - 1 end,
      pick: fn list -> Enum.random(list) end,

      # String helpers (safe subset)
      contains?: fn text, substring ->
        String.contains?(String.downcase(text), String.downcase(substring))
      end,
      downcase: fn text -> String.downcase(text) end,
      upcase: fn text -> String.upcase(text) end,

      # List helpers (safe subset)
      any?: fn list, func -> Enum.any?(list, func) end,
      all?: fn list, func -> Enum.all?(list, func) end,
      find: fn list, func -> Enum.find(list, func) end,
      count: fn list -> length(list) end,
      first: fn list -> List.first(list) end,
      last: fn list -> List.last(list) end,

      # Debugging
      log: fn message -> Logger.info("[Script] #{message}") end
    ]
  end

  # Control flow bindings
  defp control_bindings do
    [
      # Action control (for "before" hooks)
      deny: fn -> :deny end,

      # Return values
      default: fn -> :default end,
      handled: fn -> :handled end,
      continue: fn -> :continue end,
      allow: fn -> :allow end
    ]
  end

  # =============================================================================
  # Safe Map Builders
  # =============================================================================

  defp safe_entity_map(nil), do: %{}

  defp safe_entity_map(entity) when is_map(entity) do
    %{
      id: Map.get(entity, :id),
      key: Map.get(entity, :key),
      type: Map.get(entity, :type),
      short_desc: Map.get(entity, :short_desc) || Map.get(entity, :name),
      long_desc: Map.get(entity, :long_desc) || Map.get(entity, :description),
      extra_desc: Map.get(entity, :extra_desc),
      name: Map.get(entity, :name) || Map.get(entity, :short_desc),
      description: Map.get(entity, :description) || Map.get(entity, :long_desc),
      mood: Map.get(entity, :mood),
      location: Map.get(entity, :location_id),
      tags: Map.get(entity, :tags, []),
      attributes: Map.get(entity, :attributes, %{})
    }
  end

  defp safe_player_map(nil), do: nil

  defp safe_player_map(player) when is_map(player) do
    %{
      id: Map.get(player, :id),
      name: Map.get(player, :short_desc) || Map.get(player, :name),
      level: get_in(player, [:components, :character, :level]) || 1,
      location: Map.get(player, :location_id)
    }
  end

  defp safe_context_map(context) when is_map(context) do
    Map.take(context, [:trigger, :message, :target, :room, :time, :args])
  end

  defp safe_context_map(_), do: %{}

  # Safe config map for behavior scripts
  # Converts all keys to atoms for consistent access (config.route vs config["route"])
  defp safe_config_map(config) when is_map(config) do
    config
    |> Enum.map(fn
      {key, value} when is_binary(key) -> {String.to_atom(key), value}
      {key, value} when is_atom(key) -> {key, value}
      {key, value} -> {key, value}
    end)
    |> Map.new()
  end

  defp safe_config_map(_), do: %{}

  # =============================================================================
  # Query Function Implementations
  # =============================================================================

  defp get_room(entity) do
    room_id = Map.get(entity, :location_id)
    if room_id, do: get_room_data(room_id), else: nil
  end

  # NOTE: Stub awaiting framework integration
  # This function will be integrated with Loka.Engine.Registry once room
  # entities are fully implemented. For now, returns placeholder data.
  defp get_room_data(_room_id) do
    # TODO: Integrate with Loka.Engine.Registry.get/1
    %{id: nil, name: "Unknown", exits: %{}}
  end

  defp get_location(entity) do
    Map.get(entity, :location_id)
  end

  defp quest_active?(game_state, quest_id) do
    active = get_in(game_state, [:quests, :active]) || %{}
    Map.has_key?(active, quest_id) || Map.has_key?(active, String.to_atom(quest_id))
  end

  defp quest_complete?(game_state, quest_id) do
    completed = get_in(game_state, [:quests, :completed]) || []
    quest_id in completed || String.to_atom(quest_id) in completed
  end

  defp quest_objective_done?(game_state, quest_id, objective_id) do
    case get_in(game_state, [:quests, :active, quest_id]) do
      nil ->
        false

      quest_progress ->
        objectives = Map.get(quest_progress, :objectives, %{})
        Map.get(objectives, objective_id, %{}) |> Map.get(:complete, false)
    end
  end

  defp has_item?(game_state, item_key) do
    inventory = Map.get(game_state, :inventory, [])

    Enum.any?(inventory, fn item ->
      (Map.get(item, :key) || Map.get(item, "key")) == item_key
    end)
  end

  defp has_flag?(game_state, flag_name) do
    flags = Map.get(game_state, :flags, %{})
    Map.get(flags, flag_name, false) || Map.get(flags, String.to_atom(flag_name), false)
  end

  defp get_flag(game_state, flag_name, default) do
    flags = Map.get(game_state, :flags, %{})
    Map.get(flags, flag_name) || Map.get(flags, String.to_atom(flag_name), default)
  end

  defp get_stat(game_state, stat_name) do
    stats = Map.get(game_state, :stats, %{})
    Map.get(stats, stat_name) || Map.get(stats, String.to_atom(stat_name), 0)
  end

  defp get_skill(game_state, skill_name) do
    skills = Map.get(game_state, :skills, %{})

    case Map.get(skills, skill_name) || Map.get(skills, String.to_atom(skill_name)) do
      nil -> 0
      level when is_number(level) -> level
      %{level: level} -> level
      %{"level" => level} -> level
      _ -> 0
    end
  end

  defp get_attribute(game_state, attr_name) do
    attrs = Map.get(game_state, :attributes, %{})
    Map.get(attrs, attr_name) || Map.get(attrs, String.to_atom(attr_name))
  end

  # NOTE: Stub awaiting framework integration
  # These entity query functions will be integrated with Loka.Engine.Registry
  # once the entity spawning and room containment systems are fully connected
  # to the scripting layer. For now, they return empty/placeholder data.
  #
  # Integration tasks:
  # - Connect to Registry.list_by_location/1 for room queries
  # - Filter by TypedObject.subtype for player vs NPC distinction
  # - Implement tag-based queries via TypedObject.has_tag?/2

  defp entities_in_room(_player) do
    # TODO: Integrate with Loka.Engine.Registry.list_by_location/1
    []
  end

  defp players_in_room(_player) do
    # TODO: Filter entities_in_room by subtype: :character
    []
  end

  defp entity_present?(_player, _entity_key) do
    # TODO: Check Registry for entity with matching key in same room
    false
  end

  defp find_entity(_player, _opts) do
    # TODO: Query Registry with filtering options
    nil
  end

  defp find_entities_by_tag(_player, _tag) do
    # TODO: Query Registry and filter by TypedObject.has_tag?/2
    []
  end

  defp time_of_day do
    hour = current_hour()

    cond do
      hour >= 5 and hour < 7 -> :dawn
      hour >= 7 and hour < 12 -> :morning
      hour >= 12 and hour < 14 -> :noon
      hour >= 14 and hour < 18 -> :afternoon
      hour >= 18 and hour < 21 -> :evening
      true -> :night
    end
  end

  defp current_hour do
    # TODO: Integrate with game time system
    DateTime.utc_now().hour
  end

  defp current_weather(_player) do
    # TODO: Integrate with weather system
    :clear
  end

  defp is_outdoor?(_player) do
    # TODO: Check room tags
    true
  end

  defp is_dark?(_player) do
    # TODO: Check room lighting
    time_of_day() == :night
  end

  # =============================================================================
  # Action Queue Functions
  # =============================================================================

  defp queue_say(entity, message) do
    ActionQueue.queue({:say, %{entity: entity, message: message}})
    :ok
  end

  defp queue_emote(entity, action) do
    ActionQueue.queue({:emote, %{entity: entity, action: action}})
    :ok
  end

  defp queue_message(player, text) do
    if player do
      ActionQueue.queue({:message, %{target_id: player.id, text: text}})
    end

    :ok
  end

  defp queue_announce_room(entity, text) do
    room_id = Map.get(entity, :location_id)

    if room_id do
      ActionQueue.queue({:announce_room, %{room_id: room_id, text: text}})
    end

    :ok
  end

  defp queue_set_flag(player, flag, value) do
    if player do
      ActionQueue.queue({:set_flag, %{player_id: player.id, flag: flag, value: value}})
    end

    :ok
  end

  defp queue_complete_objective(player, quest_id, obj_id) do
    if player do
      ActionQueue.queue(
        {:complete_objective, %{player_id: player.id, quest_id: quest_id, objective_id: obj_id}}
      )
    end

    :ok
  end

  defp queue_start_quest(player, quest_id) do
    if player do
      ActionQueue.queue({:start_quest, %{player_id: player.id, quest_id: quest_id}})
    end

    :ok
  end

  defp queue_give_item(player, item_key) do
    if player do
      ActionQueue.queue({:give_item, %{player_id: player.id, item_key: item_key}})
    end

    :ok
  end

  defp queue_remove_item(player, item_key) do
    if player do
      ActionQueue.queue({:remove_item, %{player_id: player.id, item_key: item_key}})
    end

    :ok
  end

  defp queue_spawn(prototype_key, room_id, attrs) do
    ActionQueue.queue(
      {:spawn_entity, %{prototype_key: prototype_key, room_id: room_id, attrs: attrs}}
    )

    :ok
  end

  defp queue_despawn(entity_id) do
    ActionQueue.queue({:despawn_entity, %{entity_id: entity_id}})
    :ok
  end

  defp queue_move(entity_id, room_id) do
    ActionQueue.queue({:move_entity, %{entity_id: entity_id, room_id: room_id}})
    :ok
  end

  defp queue_teleport(entity_id, room_id) do
    ActionQueue.queue({:teleport, %{entity_id: entity_id, room_id: room_id}})
    :ok
  end

  defp queue_damage(target_id, amount, type) do
    ActionQueue.queue({:damage, %{target_id: target_id, amount: amount, type: type}})
    :ok
  end

  defp queue_heal(target_id, amount) do
    ActionQueue.queue({:heal, %{target_id: target_id, amount: amount}})
    :ok
  end

  defp queue_apply_effect(target_id, effect_key, duration) do
    ActionQueue.queue(
      {:apply_effect, %{target_id: target_id, effect_key: effect_key, duration: duration}}
    )

    :ok
  end

  defp queue_remove_effect(target_id, effect_key) do
    ActionQueue.queue({:remove_effect, %{target_id: target_id, effect_key: effect_key}})
    :ok
  end

  defp queue_set_room_attr(entity, key, value) do
    room_id = Map.get(entity, :location_id)

    if room_id do
      ActionQueue.queue({:set_room_attr, %{room_id: room_id, key: key, value: value}})
    end

    :ok
  end

  defp queue_lock_exit(entity, direction) do
    room_id = Map.get(entity, :location_id)

    if room_id do
      ActionQueue.queue({:lock_exit, %{room_id: room_id, direction: direction}})
    end

    :ok
  end

  defp queue_unlock_exit(entity, direction) do
    room_id = Map.get(entity, :location_id)

    if room_id do
      ActionQueue.queue({:unlock_exit, %{room_id: room_id, direction: direction}})
    end

    :ok
  end

  defp queue_schedule(entity, delay, script_key, ctx) do
    entity_id = Map.get(entity, :id)

    if entity_id do
      ActionQueue.queue(
        {:schedule, %{delay: delay, script_key: script_key, entity_id: entity_id, context: ctx}}
      )
    else
      Logger.warning("[Bindings] Cannot schedule script without entity id")
    end

    :ok
  end

  defp queue_emit(entity, event_name, data) do
    entity_id = Map.get(entity, :id)
    # Get emotes from entity for the action handler to check
    emotes = Map.get(entity, :emotes, %{})
    # Get scripts from entity for on_{event} script lookup
    scripts = Map.get(entity, :scripts, %{}) || Map.get(entity, :builder_scripts, %{})

    ActionQueue.queue(
      {:emit_event,
       %{
         event_name: event_name,
         entity_id: entity_id,
         entity: entity,
         emotes: emotes,
         scripts: scripts,
         data: data
       }}
    )

    :ok
  end

  # =============================================================================
  # Utility Functions
  # =============================================================================

  # Parse dice notation like "2d6+3" and roll
  defp roll_dice(dice_str) when is_binary(dice_str) do
    case Regex.run(~r/(\d+)d(\d+)(?:\+(\d+))?(?:\-(\d+))?/, dice_str) do
      [_, count, sides] ->
        roll_multiple(String.to_integer(count), String.to_integer(sides), 0)

      [_, count, sides, bonus] ->
        roll_multiple(
          String.to_integer(count),
          String.to_integer(sides),
          String.to_integer(bonus)
        )

      [_, count, sides, _, penalty] ->
        roll_multiple(
          String.to_integer(count),
          String.to_integer(sides),
          -String.to_integer(penalty)
        )

      _ ->
        # Default to d20
        :rand.uniform(20)
    end
  end

  defp roll_dice(sides) when is_integer(sides) do
    :rand.uniform(sides)
  end

  defp roll_multiple(count, sides, modifier) do
    total = Enum.reduce(1..count, 0, fn _, acc -> acc + :rand.uniform(sides) end)
    max(1, total + modifier)
  end
end
