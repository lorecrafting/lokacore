defmodule Loka.Testing.Bot.ChannelBot do
  @moduledoc """
  Channel-based testing bot that executes actions through Phoenix Channels.

  This bot uses the **hybrid approach**:
  - **Actions**: Execute through Phoenix channels (tests the real code path)
  - **Inspection**: Direct state access via StateInspector (for debugging/assertions)

  ## Why Hybrid?

  Channel events only show what the server serializes to clients. Internal state may contain:
  - Hidden quest flags
  - Exact numeric values (vs "low"/"high" labels)
  - Internal timers and cooldowns
  - Debug information

  By using StateInspector alongside channel testing, you get realistic action execution
  AND full visibility into server state for assertions.

  ## Usage

  ChannelBot runs synchronously in the test process (required for Phoenix.ChannelTest):

      # In your test
      use Loka.ChannelCase

      test "bot can complete quest" do
        # Create a test player
        player = create_test_player()

        # Initialize bot with strategy
        {:ok, bot} = ChannelBot.start(player, strategy: RandomWalker)

        # Run for N ticks
        {:ok, bot} = ChannelBot.run(bot, ticks: 50)

        # Assert via channel state (what client sees)
        assert bot.room.title == "Village Square"

        # Assert via StateInspector (server truth)
        StateInspector.assert_quest_completed(player.id, "first_quest")
        StateInspector.assert_in_room(player.id, "village_square")
      end

  ## Step-by-Step Control

      {:ok, bot} = ChannelBot.start(player, strategy: RandomWalker)

      # Run one tick at a time for debugging
      {:ok, bot} = ChannelBot.tick(bot)
      IO.inspect(bot.last_action)

      {:ok, bot} = ChannelBot.tick(bot)
      StateInspector.inspect_game_state(player.id) |> IO.inspect()

  ## Architecture

      ┌─────────────────────────────────────────────────────────────┐
      │                      TEST PROCESS                           │
      │                                                             │
      │  ChannelBot.tick(bot)                                       │
      │       │                                                     │
      │       ▼                                                     │
      │  ┌─────────────────────────────────────────────────────┐   │
      │  │ Strategy.decide(context, state)                      │   │
      │  │   → Returns action like {:move, "north"}             │   │
      │  └─────────────────────────────────────────────────────┘   │
      │       │                                                     │
      │       ▼                                                     │
      │  ┌─────────────────────────────────────────────────────┐   │
      │  │ Phoenix.ChannelTest.push(socket, event, payload)     │   │
      │  │   → Sends to GameChannel (REAL CODE PATH)            │   │
      │  └─────────────────────────────────────────────────────┘   │
      │       │                                                     │
      │       ▼                                                     │
      │  ┌─────────────────────────────────────────────────────┐   │
      │  │ GameChannel.handle_in/3                              │   │
      │  │   → ActionBridge.execute/3                           │   │
      │  │   → Loka.Game.Actions                                │   │
      │  └─────────────────────────────────────────────────────┘   │
      │       │                                                     │
      │       ▼                                                     │
      │  ┌─────────────────────────────────────────────────────┐   │
      │  │ assert_push / receive events                         │   │
      │  │   → Bot updates internal state from events           │   │
      │  └─────────────────────────────────────────────────────┘   │
      │                                                             │
      │  For assertions: StateInspector.assert_*(player_id, ...)   │
      │    → Direct access to server state                         │
      └─────────────────────────────────────────────────────────────┘
  """

  import Phoenix.ChannelTest

  alias Loka.Testing.Bot.Strategy
  alias Loka.Auth.Guardian

  @endpoint LokaWeb.Endpoint

  defstruct [
    :player,
    :socket,
    :strategy,
    :strategy_state,
    :started_at,
    # State built from channel events (client view)
    :room,
    :inventory,
    :equipped,
    :stats,
    :health,
    :combat,
    :dialogue,
    :quests,
    :nearby_entities,
    :other_players,
    # Tracking
    :last_action,
    :tick_count,
    :metrics
  ]

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Starts a new channel bot for the given player.

  Must be called from a test process (ExUnit) because it uses Phoenix.ChannelTest.

  ## Options

  - `:strategy` - (required) Strategy module to use
  - `:strategy_opts` - Options passed to strategy's init/1 (default: [])

  ## Example

      {:ok, bot} = ChannelBot.start(player, strategy: RandomWalker)
  """
  def start(player, opts \\ []) do
    strategy = Keyword.fetch!(opts, :strategy)
    strategy_opts = Keyword.get(opts, :strategy_opts, [])

    # Initialize strategy
    {:ok, strategy_state} = strategy.init(strategy_opts)

    # Connect to channel via Phoenix.ChannelTest
    case connect_and_join(player) do
      {:ok, socket, initial_state} ->
        bot = %__MODULE__{
          player: player,
          socket: socket,
          strategy: strategy,
          strategy_state: strategy_state,
          started_at: DateTime.utc_now(),
          room: initial_state[:room],
          inventory: initial_state[:inventory] || [],
          equipped: initial_state[:equipped] || %{},
          stats: initial_state[:stats] || %{},
          health: initial_state[:health] || %{current: 100, max: 100},
          combat: nil,
          dialogue: nil,
          quests: initial_state[:quests] || %{active: [], completed: []},
          nearby_entities: extract_entities(initial_state[:room]),
          other_players: initial_state[:other_players] || [],
          last_action: nil,
          tick_count: 0,
          metrics: %{
            actions_taken: 0,
            moves: 0,
            combats_won: 0,
            combats_lost: 0,
            items_collected: 0,
            dialogues_started: 0,
            events_received: 0
          }
        }

        {:ok, bot}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Runs a single tick of the bot.

  1. Strategy decides next action based on current state
  2. Action is pushed through the channel
  3. Bot receives and processes channel events
  4. Returns updated bot state

  ## Example

      {:ok, bot} = ChannelBot.tick(bot)
      IO.puts("Last action: \#{inspect(bot.last_action)}")
  """
  def tick(bot) do
    # Receive pending channel events FIRST to get latest game state
    bot = receive_events(bot)

    # Build context for strategy with fresh data
    context = build_context(bot)

    # Ask strategy for action
    {action, new_strategy_state} = bot.strategy.decide(context, bot.strategy_state)

    # Execute action via channel
    bot = execute_action(action, bot)

    # Update tracking
    bot = %{
      bot
      | strategy_state: new_strategy_state,
        last_action: action,
        tick_count: bot.tick_count + 1,
        metrics: update_metrics(bot.metrics, action)
    }

    {:ok, bot}
  end

  @doc """
  Runs the bot for multiple ticks.

  ## Options

  - `:ticks` - Number of ticks to run (default: 10)
  - `:delay_ms` - Delay between ticks in ms (default: 0)
  - `:until` - Function that returns true to stop early (optional)

  ## Examples

      # Run 50 ticks
      {:ok, bot} = ChannelBot.run(bot, ticks: 50)

      # Run until quest completed (max 100 ticks)
      {:ok, bot} = ChannelBot.run(bot, ticks: 100, until: fn bot ->
        StateInspector.quest_completed?(bot.player.id, "first_quest")
      end)
  """
  def run(bot, opts \\ []) do
    ticks = Keyword.get(opts, :ticks, 10)
    delay_ms = Keyword.get(opts, :delay_ms, 0)
    until_fn = Keyword.get(opts, :until, fn _ -> false end)

    do_run(bot, ticks, delay_ms, until_fn)
  end

  @doc """
  Gets summary info about the bot.
  """
  def get_info(bot) do
    %{
      player_id: bot.player.id,
      room: bot.room && %{id: bot.room.id, title: bot.room.title},
      in_combat: not is_nil(bot.combat),
      in_dialogue: not is_nil(bot.dialogue),
      tick_count: bot.tick_count,
      last_action: bot.last_action,
      strategy_state: bot.strategy_state,
      metrics: bot.metrics
    }
  end

  @doc """
  Leaves the channel and cleans up.
  """
  def stop(bot) do
    # Leave channel
    leave(bot.socket)
    :ok
  end

  # =============================================================================
  # Channel Connection (Phoenix.ChannelTest)
  # =============================================================================

  defp connect_and_join(player) do
    # Generate JWT token
    {:ok, token, _claims} = Guardian.encode_and_sign(player, %{})

    # Connect to UserSocket (Phoenix.ChannelTest)
    {:ok, socket} = connect(LokaWeb.UserSocket, %{"token" => token})

    # Join game channel
    {:ok, reply, socket} = subscribe_and_join(socket, LokaWeb.GameChannel, "game:lobby", %{})

    # Wait for game_state push after join
    initial_state = receive_initial_state(reply)

    {:ok, socket, initial_state}
  rescue
    e -> {:error, e}
  end

  defp receive_initial_state(join_reply) do
    # The join reply might have some state, and game_state comes as a push
    base_quests = normalize_quests(join_reply["quests"] || join_reply[:quests])

    base_state = %{
      room: join_reply["room"] || join_reply[:room],
      inventory: join_reply["inventory"] || join_reply[:inventory],
      equipped: join_reply["equipped"] || join_reply[:equipped],
      stats: join_reply["stats"] || join_reply[:stats],
      health: join_reply["health"] || join_reply[:health],
      quests: base_quests
    }

    # Try to receive game_state push (with timeout)
    receive do
      %Phoenix.Socket.Broadcast{event: "game_state", payload: payload} ->
        quests = normalize_quests(payload["quests"] || payload[:quests] || base_state.quests)

        Map.merge(base_state, %{
          room: payload["room"] || payload[:room] || base_state.room,
          inventory: payload["inventory"] || payload[:inventory] || base_state.inventory,
          equipped: payload["equipped"] || payload[:equipped] || base_state.equipped,
          stats: payload["stats"] || payload[:stats] || base_state.stats,
          health: payload["health"] || payload[:health] || base_state.health,
          quests: quests
        })
    after
      100 -> base_state
    end
  end

  # =============================================================================
  # Action Execution
  # =============================================================================

  defp execute_action(:idle, bot), do: bot
  defp execute_action({:wait, _ms}, bot), do: bot

  defp execute_action({:move, direction}, bot) do
    push(bot.socket, "navigate", %{"direction" => direction})
    bot
  end

  defp execute_action({:attack, entity_id}, bot) do
    push(bot.socket, "action", %{"action" => "attack", "entity_id" => entity_id})
    bot
  end

  defp execute_action({:combat_action, :attack}, bot) do
    # Combat ticks automatically, but we can wait for events
    bot
  end

  defp execute_action({:combat_action, :defend}, bot) do
    bot
  end

  defp execute_action({:combat_action, :flee}, bot) do
    push(bot.socket, "combat_action", %{"action" => "flee"})
    bot
  end

  defp execute_action({:start_dialogue, npc_id}, bot) do
    push(bot.socket, "action", %{"action" => "talk", "entity_id" => npc_id})
    bot
  end

  defp execute_action({:dialogue_choice, choice_index}, bot) do
    push(bot.socket, "dialogue_select", %{"choice_index" => choice_index})
    bot
  end

  defp execute_action({:interact, entity_id}, bot) do
    entity = find_entity_by_id(bot.nearby_entities, entity_id)

    cond do
      entity && entity.type == :item ->
        push(bot.socket, "action", %{"action" => "get", "entity_id" => entity_id})

      entity && entity.type == :npc ->
        push(bot.socket, "action", %{"action" => "talk", "entity_id" => entity_id})

      true ->
        push(bot.socket, "action", %{"action" => "get", "entity_id" => entity_id})
    end

    bot
  end

  defp execute_action({:use_item, item_id}, bot) do
    push(bot.socket, "use_item", %{"item_id" => item_id})
    bot
  end

  defp execute_action({:equip, item_id, _slot}, bot) do
    push(bot.socket, "inventory", %{"action" => "equip", "item_id" => item_id})
    bot
  end

  defp execute_action({:unequip, slot}, bot) do
    push(bot.socket, "inventory", %{"action" => "unequip", "slot" => to_string(slot)})
    bot
  end

  defp execute_action({:gather, node_type}, bot) do
    push(bot.socket, "gather", %{"node_type" => node_type})
    bot
  end

  defp execute_action({:craft, recipe_key, tool_id}, bot) do
    push(bot.socket, "craft", %{"recipe_key" => recipe_key, "tool_id" => tool_id})
    bot
  end

  defp execute_action(_action, bot), do: bot

  # =============================================================================
  # Event Receiving
  # =============================================================================

  defp receive_events(bot) do
    receive_events_loop(bot, 20)
  end

  defp receive_events_loop(bot, 0), do: bot

  defp receive_events_loop(bot, remaining) do
    receive do
      %Phoenix.Socket.Broadcast{event: event, payload: payload} ->
        bot = handle_event(event, payload, bot)
        receive_events_loop(bot, remaining - 1)

      %Phoenix.Socket.Message{event: event, payload: payload} ->
        bot = handle_event(event, payload, bot)
        receive_events_loop(bot, remaining - 1)

      %Phoenix.Socket.Reply{} ->
        # Ignore replies
        receive_events_loop(bot, remaining - 1)
    after
      10 -> bot
    end
  end

  defp handle_event("game_state", payload, bot) do
    require Logger
    quests = payload["quests"] || payload[:quests] || bot.quests

    Logger.info(
      "[ChannelBot] game_state event: quests type=#{if is_map(quests), do: "map", else: if(is_list(quests), do: "list", else: "other")}"
    )

    normalized_quests = normalize_quests(quests)

    # Track completed quests: if a quest was in active but is now gone, it's completed
    old_active_ids = Map.keys(bot.quests[:active] || bot.quests["active"] || %{})
    new_active_ids = Map.keys(normalized_quests.active)
    newly_completed = old_active_ids -- new_active_ids

    # Merge with existing completed list
    existing_completed = bot.quests[:completed] || bot.quests["completed"] || []
    all_completed = Enum.uniq(existing_completed ++ newly_completed)

    # Update normalized_quests with the completed tracking
    normalized_quests = %{normalized_quests | completed: all_completed}

    Logger.info(
      "[ChannelBot] normalized_quests: active keys=#{inspect(Map.keys(normalized_quests.active))}, completed=#{inspect(all_completed)}, sample quest=#{inspect(Map.values(normalized_quests.active) |> List.first())}"
    )

    # Only update nearby_entities if payload has room data
    # Otherwise preserve existing nearby_entities
    room_data = payload["room"] || payload[:room]
    new_nearby_entities = if room_data, do: extract_entities(room_data), else: bot.nearby_entities

    %{
      bot
      | room: room_data || bot.room,
        inventory: payload["inventory"] || payload[:inventory] || bot.inventory,
        equipped: payload["equipped"] || payload[:equipped] || bot.equipped,
        stats: payload["stats"] || payload[:stats] || bot.stats,
        health: payload["health"] || payload[:health] || bot.health,
        quests: normalized_quests,
        other_players: payload["other_players"] || payload[:other_players] || bot.other_players,
        nearby_entities: new_nearby_entities,
        metrics: increment_events(bot.metrics)
    }
  end

  defp handle_event("room_update", payload, bot) do
    room = payload["room"] || payload[:room]

    %{
      bot
      | room: room,
        nearby_entities: extract_entities(room),
        other_players: payload["other_players"] || payload[:other_players] || bot.other_players,
        metrics: increment_events(bot.metrics)
    }
  end

  defp handle_event("inventory_update", payload, bot) do
    %{
      bot
      | inventory: payload["inventory"] || payload[:inventory] || bot.inventory,
        metrics: increment_events(bot.metrics)
    }
  end

  defp handle_event("equipment_update", payload, bot) do
    %{
      bot
      | equipped: payload["equipped"] || payload[:equipped] || bot.equipped,
        metrics: increment_events(bot.metrics)
    }
  end

  defp handle_event("stats_update", payload, bot) do
    %{
      bot
      | stats: payload["stats"] || payload[:stats] || bot.stats,
        metrics: increment_events(bot.metrics)
    }
  end

  defp handle_event("combat_start", payload, bot) do
    %{bot | combat: payload, metrics: increment_events(bot.metrics)}
  end

  defp handle_event("combat_update", payload, bot) do
    %{bot | combat: Map.merge(bot.combat || %{}, payload), metrics: increment_events(bot.metrics)}
  end

  defp handle_event("combat_end", payload, bot) do
    result = payload["result"] || payload[:result]

    metrics =
      bot.metrics
      |> increment_events()
      |> then(fn m ->
        case result do
          "victory" -> %{m | combats_won: m.combats_won + 1}
          "defeat" -> %{m | combats_lost: m.combats_lost + 1}
          _ -> m
        end
      end)

    %{bot | combat: nil, metrics: metrics}
  end

  defp handle_event("dialogue_start", payload, bot) do
    require Logger
    Logger.info("[ChannelBot] dialogue_start event received: #{inspect(Map.keys(payload))}")

    Logger.info(
      "[ChannelBot] current_node: #{inspect(payload["current_node"] || payload[:current_node])}"
    )

    metrics = %{bot.metrics | dialogues_started: bot.metrics.dialogues_started + 1}
    %{bot | dialogue: payload, metrics: increment_events(metrics)}
  end

  defp handle_event("dialogue_update", payload, bot) do
    require Logger
    Logger.info("[ChannelBot] dialogue_update event received")
    %{bot | dialogue: payload, metrics: increment_events(bot.metrics)}
  end

  defp handle_event("dialogue_end", _payload, bot) do
    require Logger
    Logger.info("[ChannelBot] dialogue_end event received")
    %{bot | dialogue: nil, metrics: increment_events(bot.metrics)}
  end

  defp handle_event("quest_accepted", payload, bot) do
    require Logger
    quest_id = payload["quest_id"] || payload[:quest_id]
    Logger.info("[ChannelBot] quest_accepted event: #{quest_id}")

    # Add new quest to active list
    quests = bot.quests
    active = quests[:active] || quests["active"] || %{}

    # Get quest definition to build proper objective structure
    quest_def = Loka.Content.Quest.definition(quest_id)

    objectives_map =
      if quest_def do
        # Build objectives map, marking first talk objective as complete
        # (since quest was accepted via dialogue, we already talked to the giver)
        first_talk_found = false

        quest_def.objectives
        |> Enum.reduce({%{}, first_talk_found}, fn obj, {acc, found_first} ->
          obj_id = obj.id || to_string(obj.id)
          is_talk = obj.type == :talk

          # Mark the first talk objective as completed (quest giver talk)
          completed = is_talk && !found_first

          obj_progress = %{
            "id" => obj_id,
            "type" => obj.type,
            "completed" => completed,
            "progress" => if(completed, do: 1, else: 0),
            "target_count" => 1
          }

          {Map.put(acc, obj_id, obj_progress), found_first || is_talk}
        end)
        |> elem(0)
      else
        %{}
      end

    new_active =
      Map.put(active, quest_id, %{
        "id" => quest_id,
        "name" => payload["name"] || payload[:name] || quest_id,
        "objectives" => objectives_map
      })

    %{bot | quests: %{quests | active: new_active}, metrics: increment_events(bot.metrics)}
  end

  defp handle_event("quest_completed", payload, bot) do
    require Logger
    quest_id = payload["quest_id"] || payload[:quest_id]
    Logger.info("[ChannelBot] quest_completed event: #{quest_id}")

    # Move quest from active to completed
    quests = bot.quests
    active = quests[:active] || quests["active"] || %{}
    completed = quests[:completed] || quests["completed"] || []

    new_active = Map.delete(active, quest_id)
    new_completed = Enum.uniq([quest_id | completed])

    %{
      bot
      | quests: %{active: new_active, completed: new_completed},
        metrics: increment_events(bot.metrics)
    }
  end

  defp handle_event("quest_progress", payload, bot) do
    require Logger
    Logger.info("[ChannelBot] quest_progress event received")

    # Update quests with new progress data
    quests = payload["quests"] || payload[:quests]

    if quests do
      normalized = normalize_quests(quests)

      Logger.info(
        "[ChannelBot] quest_progress: updated quests, active=#{inspect(Map.keys(normalized.active))}"
      )

      %{bot | quests: normalized, metrics: increment_events(bot.metrics)}
    else
      %{bot | metrics: increment_events(bot.metrics)}
    end
  end

  defp handle_event(_event, _payload, bot) do
    %{bot | metrics: increment_events(bot.metrics)}
  end

  # =============================================================================
  # Helpers
  # =============================================================================

  defp do_run(bot, 0, _delay_ms, _until_fn), do: {:ok, bot}

  defp do_run(bot, remaining, delay_ms, until_fn) do
    if until_fn.(bot) do
      {:ok, bot}
    else
      {:ok, bot} = tick(bot)

      if delay_ms > 0, do: Process.sleep(delay_ms)

      do_run(bot, remaining - 1, delay_ms, until_fn)
    end
  end

  defp build_context(bot) do
    game_state = %{
      id: bot.player.id,
      player_id: bot.player.id,
      inventory: bot.inventory,
      equipment: bot.equipped,
      quests: bot.quests,
      flags: %{},
      stats: bot.stats,
      health: bot.health,
      current_room_id: bot.room && (bot.room.id || bot.room["id"])
    }

    Strategy.build_context(
      bot: %{id: bot.player.id, name: bot.player.name},
      game_state: game_state,
      room: bot.room,
      nearby_entities: bot.nearby_entities,
      in_combat: not is_nil(bot.combat),
      combat_state: bot.combat,
      dialogue_state: bot.dialogue,
      bot_state: %{dialogue_state: bot.dialogue}
    )
  end

  defp extract_entities(nil), do: []

  defp extract_entities(room) when is_map(room) do
    entities = room["entities"] || room[:entities] || room.entities || []
    items = room["items"] || room[:items] || room.items || []

    require Logger

    if not Enum.empty?(entities) do
      Logger.info("[ChannelBot] extract_entities: entities=#{inspect(entities)}")
    end

    entity_structs =
      Enum.map(entities, fn e ->
        # Extract key with explicit logging
        entity_key = e["key"] || e[:key]
        entity_id = e["id"] || e[:id] || e.id
        entity_name = e["name"] || e[:name]

        if is_nil(entity_key) do
          Logger.warning(
            "[ChannelBot] Entity missing key: id=#{inspect(entity_id)}, name=#{inspect(entity_name)}, keys=#{inspect(Map.keys(e))}"
          )
        end

        %{
          id: entity_id,
          type: :npc,
          key: entity_key,
          name: entity_name,
          tags: e["tags"] || e[:tags] || [],
          components: e["components"] || e[:components] || %{}
        }
      end)

    item_structs =
      Enum.map(items, fn i ->
        item_key = i["key"] || i[:key]
        item_name = i["name"] || i[:name]

        if is_nil(item_key) do
          Logger.warning(
            "[ChannelBot] Item missing key: name=#{inspect(item_name)}, keys=#{inspect(Map.keys(i))}"
          )
        else
          Logger.info("[ChannelBot] Found item: key=#{item_key}, name=#{item_name}")
        end

        %{
          id: i["id"] || i[:id] || i.id,
          type: :item,
          key: item_key,
          name: item_name,
          tags: i["tags"] || i[:tags] || []
        }
      end)

    entity_structs ++ item_structs
  rescue
    _ -> []
  end

  defp find_entity_by_id(entities, id) do
    Enum.find(entities, fn e -> e.id == id || e[:id] == id end)
  end

  defp update_metrics(metrics, action) do
    metrics = %{metrics | actions_taken: metrics.actions_taken + 1}

    case action do
      {:move, _} -> %{metrics | moves: metrics.moves + 1}
      {:interact, _} -> %{metrics | items_collected: metrics.items_collected + 1}
      _ -> metrics
    end
  end

  defp increment_events(metrics) do
    %{metrics | events_received: metrics.events_received + 1}
  end

  # Normalize quest structure from channel list format to internal map format
  defp normalize_quests(quests) when is_list(quests) do
    active_quests_map =
      quests
      |> Enum.reduce(%{}, fn quest, acc ->
        quest_id = quest["id"] || quest[:id]

        if quest_id do
          # Normalize objectives from list to map (keyed by objective ID)
          objectives = quest["objectives"] || quest[:objectives] || []

          objectives_map =
            objectives
            |> Enum.reduce(%{}, fn obj, obj_acc ->
              obj_id = obj["id"] || obj[:id] || obj.id
              if obj_id, do: Map.put(obj_acc, obj_id, obj), else: obj_acc
            end)

          # Update quest with normalized objectives
          normalized_quest = Map.put(quest, "objectives", objectives_map)
          Map.put(acc, quest_id, normalized_quest)
        else
          acc
        end
      end)

    %{active: active_quests_map, completed: []}
  end

  defp normalize_quests(%{active: _, completed: _} = quests), do: quests
  defp normalize_quests(_), do: %{active: %{}, completed: []}
end
