defmodule Loka.Testing.Bot.Strategies.RandomWalker do
  @moduledoc """
  A simple bot strategy that randomly explores the world.

  The RandomWalker will:
  - Move randomly through available exits
  - Occasionally interact with items and NPCs
  - Attack hostile NPCs when encountered
  - Use healing items when health is low

  ## Options

  - `:max_steps` - Maximum actions before stopping (default: infinite)
  - `:explore_chance` - Chance to move vs interact (default: 70%)
  - `:attack_hostiles` - Whether to attack hostile NPCs (default: true)
  - `:pickup_items` - Whether to pick up items (default: true)
  - `:health_threshold` - HP% to trigger healing (default: 30)

  ## Usage

      {:ok, pid} = BotSupervisor.spawn_bot(
        strategy: Loka.Testing.Bot.Strategies.RandomWalker,
        strategy_opts: [max_steps: 100, attack_hostiles: true]
      )
  """

  @behaviour Loka.Testing.Bot.Strategy

  alias Loka.Testing.Bot.Strategy

  @default_explore_chance 70
  @default_health_threshold 30

  # =============================================================================
  # Strategy Callbacks
  # =============================================================================

  @impl true
  def init(opts) do
    state = %{
      step_count: 0,
      max_steps: Keyword.get(opts, :max_steps, :infinity),
      explore_chance: Keyword.get(opts, :explore_chance, @default_explore_chance),
      attack_hostiles: Keyword.get(opts, :attack_hostiles, true),
      pickup_items: Keyword.get(opts, :pickup_items, true),
      health_threshold: Keyword.get(opts, :health_threshold, @default_health_threshold),
      visited_rooms: MapSet.new(),
      last_direction: nil
    }

    {:ok, state}
  end

  @impl true
  def decide(context, state) do
    # Check max steps
    if state.max_steps != :infinity and state.step_count >= state.max_steps do
      {:idle, state}
    else
      # Increment step count
      state = %{state | step_count: state.step_count + 1}

      # Track visited rooms
      state =
        if context.room do
          %{state | visited_rooms: MapSet.put(state.visited_rooms, context.room.id)}
        else
          state
        end

      # Decide action based on context
      {action, state} = choose_action(context, state)
      {action, state}
    end
  end

  @impl true
  def handle_event(_event, state) do
    # RandomWalker doesn't react to events specially
    {:ok, state}
  end

  # =============================================================================
  # Decision Logic
  # =============================================================================

  defp choose_action(context, state) do
    cond do
      # If in combat, fight
      context.in_combat ->
        choose_combat_action(context, state)

      # If health is low, try to heal
      Strategy.health_below?(context.game_state, state.health_threshold) ->
        try_heal(context, state)

      # If there are hostile NPCs and we attack them
      state.attack_hostiles and has_hostile_npc?(context) ->
        attack_hostile(context, state)

      # If there are items to pick up
      state.pickup_items and has_pickable_item?(context) ->
        pickup_item(context, state)

      # Otherwise, explore based on chance
      :rand.uniform(100) <= state.explore_chance ->
        explore(context, state)

      # Interact with friendly NPCs
      has_friendly_npc?(context) ->
        interact_friendly(context, state)

      # Default to exploring
      true ->
        explore(context, state)
    end
  end

  # =============================================================================
  # Combat Actions
  # =============================================================================

  defp choose_combat_action(context, state) do
    game_state = context.game_state

    cond do
      # Flee if very low health
      Strategy.health_below?(game_state, 15) ->
        {{:combat_action, :flee}, state}

      # Defend occasionally when health is low
      Strategy.health_below?(game_state, 40) and :rand.uniform(100) <= 30 ->
        {{:combat_action, :defend}, state}

      # Usually attack
      true ->
        {{:combat_action, :attack}, state}
    end
  end

  defp attack_hostile(context, state) do
    hostiles = Strategy.find_combatants(context.nearby_entities)

    if Enum.empty?(hostiles) do
      explore(context, state)
    else
      target = Enum.random(hostiles)
      {{:attack, target.id}, state}
    end
  end

  # =============================================================================
  # Healing
  # =============================================================================

  defp try_heal(context, state) do
    inventory = context.game_state.inventory || []

    # Look for healing items in inventory
    healing_item = find_healing_item(inventory)

    if healing_item do
      {{:use_item, healing_item}, state}
    else
      # Can't heal, try to flee if in combat
      if context.in_combat do
        {{:combat_action, :flee}, state}
      else
        explore(context, state)
      end
    end
  end

  defp find_healing_item(inventory) do
    # In a real implementation, we'd check item components
    # For now, just return the first item (if any) that might be a potion
    Enum.find(inventory, fn item_id ->
      String.contains?(item_id, "potion") or String.contains?(item_id, "heal")
    end)
  end

  # =============================================================================
  # Exploration
  # =============================================================================

  defp explore(context, state) do
    exits = Strategy.get_available_exits(context.room)

    if Enum.empty?(exits) do
      # No exits, wait
      {{:wait, 1000}, state}
    else
      # Prefer unvisited directions, avoid going back
      direction = choose_direction(exits, context.room, state)
      {{:move, direction}, %{state | last_direction: direction}}
    end
  end

  defp choose_direction(exits, _room, state) do
    # Try to find exits leading to unvisited rooms
    # For now, just pick randomly, avoiding the reverse of last direction
    reverse = reverse_direction(state.last_direction)

    preferred =
      exits
      |> Enum.reject(&(&1 == reverse and length(exits) > 1))

    if Enum.empty?(preferred) do
      Enum.random(exits)
    else
      Enum.random(preferred)
    end
  end

  defp reverse_direction(nil), do: nil
  defp reverse_direction("north"), do: "south"
  defp reverse_direction("south"), do: "north"
  defp reverse_direction("east"), do: "west"
  defp reverse_direction("west"), do: "east"
  defp reverse_direction("up"), do: "down"
  defp reverse_direction("down"), do: "up"
  defp reverse_direction(_), do: nil

  # =============================================================================
  # Interaction
  # =============================================================================

  defp pickup_item(context, state) do
    items =
      context.nearby_entities
      |> Enum.filter(&(&1.type == :item))

    if Enum.empty?(items) do
      explore(context, state)
    else
      item = Enum.random(items)
      {{:interact, item.id}, state}
    end
  end

  defp interact_friendly(context, state) do
    friendlies =
      context.nearby_entities
      |> Enum.filter(fn entity ->
        entity.type == :npc and
          not Map.has_key?(entity.components || %{}, "combatant")
      end)

    if Enum.empty?(friendlies) do
      explore(context, state)
    else
      npc = Enum.random(friendlies)
      {{:interact, npc.id}, state}
    end
  end

  # =============================================================================
  # Helpers
  # =============================================================================

  defp has_hostile_npc?(context) do
    context.nearby_entities
    |> Strategy.find_combatants()
    |> Enum.any?(fn npc ->
      # Check for hostile tag
      tags = npc.tags || []
      Enum.member?(tags, "hostile") or Enum.member?(tags, :hostile)
    end)
  end

  defp has_pickable_item?(context) do
    context.nearby_entities
    |> Enum.any?(&(&1.type == :item))
  end

  defp has_friendly_npc?(context) do
    context.nearby_entities
    |> Enum.any?(fn entity ->
      entity.type == :npc and
        Map.has_key?(entity.components || %{}, "dialogue_tree")
    end)
  end
end
