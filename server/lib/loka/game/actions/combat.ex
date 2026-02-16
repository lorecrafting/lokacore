defmodule Loka.Game.Actions.Combat do
  @moduledoc """
  Combat-related game actions.

  Uses Loka.Mechanics.Damage for damage calculations and
  Loka.Primitives.ResourcePool for health management.

  ## Actions

  - `:attack` - Initiate combat with entity
  - `:flee` - Attempt to escape combat
  - `:combat_tick` - Process combat round (called by timer)
  """

  require Logger

  alias Loka.Game.Actions.{Context, Result}
  alias Loka.Framework.Combat
  alias Loka.Framework.Combat.RespawnManager
  alias Loka.Framework.Quest.Listeners, as: QuestListeners
  alias Loka.Engine.{Entity, Entities}
  alias Loka.Mechanics.Damage

  @doc """
  Initiate combat with an entity.
  """
  @spec attack(Context.t(), String.t(), map()) :: {:ok, Result.t()} | {:error, String.t()}
  def attack(ctx, entity_id, entity) do
    Logger.info(
      "[COMBAT] Attack initiated: player_id=#{ctx.player_id} target=#{entity_id} target_name=#{entity.short_desc}"
    )

    case Combat.start_combat(entity_id, ctx.character) do
      {:ok, combat_state} ->
        Logger.info(
          "[COMBAT] Combat started: player_id=#{ctx.player_id} enemy=#{entity.short_desc} enemy_hp=#{inspect(combat_state.enemy.health)}"
        )

        result =
          Result.new(
            state: %{combat: combat_state},
            events: [
              {:combat_start,
               %{
                 enemy: %{
                   id: entity_id,
                   name: entity.short_desc,
                   health: combat_state.enemy.health
                 }
               }},
              {:schedule_timer, :combat_tick, 3000}
            ]
          )

        {:ok, result}

      {:error, :not_combatant} ->
        Logger.debug(
          "[COMBAT] Attack refused - not combatant: player_id=#{ctx.player_id} target=#{entity_id}"
        )

        {:error, "The #{entity.short_desc} doesn't want to fight."}

      {:error, reason} ->
        Logger.warning(
          "[COMBAT] Attack failed: player_id=#{ctx.player_id} target=#{entity_id} reason=#{inspect(reason)}"
        )

        {:error, "You can't attack that."}
    end
  end

  @doc """
  Attempt to flee from combat.
  """
  @spec flee(Context.t()) :: {:ok, Result.t()} | {:error, String.t()}
  def flee(ctx) do
    combat = ctx.combat
    Logger.debug("[COMBAT] Flee attempted: player_id=#{ctx.player_id}")

    if combat do
      case Combat.player_action(combat, :flee, ctx.character) do
        {:ok, _combat, %{success: true}} ->
          Logger.info(
            "[COMBAT] Flee succeeded: player_id=#{ctx.player_id} enemy=#{combat.enemy.name}"
          )

          result =
            Result.new(
              state: %{combat: nil},
              events: [
                {:event, "You fled from the #{combat.enemy.name}!"},
                {:combat_end, %{reason: "fled"}},
                {:cancel_timer, :combat_tick}
              ]
            )

          {:ok, result}

        {:ok, new_combat, %{success: false}} ->
          Logger.info(
            "[COMBAT] Flee blocked: player_id=#{ctx.player_id} enemy=#{combat.enemy.name}"
          )

          result =
            Result.new(
              state: %{combat: new_combat},
              events: [
                {:event, "You try to flee but #{combat.enemy.name} blocks your escape!"}
              ]
            )

          {:ok, result}

        {:error, :on_cooldown} ->
          Logger.debug("[COMBAT] Flee on cooldown: player_id=#{ctx.player_id}")
          {:error, "You must wait before trying to flee again."}

        {:error, reason} ->
          Logger.warning(
            "[COMBAT] Flee failed: player_id=#{ctx.player_id} reason=#{inspect(reason)}"
          )

          {:error, "Failed to flee."}
      end
    else
      Logger.debug("[COMBAT] Flee attempted but not in combat: player_id=#{ctx.player_id}")
      {:error, "You're not in combat."}
    end
  end

  @doc """
  Process a combat tick (round).

  Returns victory, defeat, or continue result.
  """
  @spec process_tick(Context.t()) :: {:ok, Result.t()} | {:error, String.t()}
  def process_tick(ctx) do
    combat = ctx.combat
    Logger.debug("[COMBAT] Processing tick: player_id=#{ctx.player_id}")

    if combat do
      case Combat.execute_combat_tick(combat, ctx.character) do
        {:victory, new_combat, rewards, updated_character} ->
          Logger.info(
            "[COMBAT] Victory: player_id=#{ctx.player_id} enemy=#{new_combat.enemy.name} xp=#{rewards.xp} gold=#{rewards.gold}"
          )

          handle_victory(ctx, new_combat, rewards, updated_character)

        {:ok, new_combat, player_damage, updated_character} ->
          Logger.debug(
            "[COMBAT] Tick continues: player_id=#{ctx.player_id} player_damage=#{player_damage} enemy_hp=#{inspect(new_combat.enemy.health)}"
          )

          handle_combat_continues(ctx, new_combat, player_damage, updated_character)
      end
    else
      Logger.debug("[COMBAT] Tick skipped - not in combat: player_id=#{ctx.player_id}")
      {:error, "Not in combat."}
    end
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp handle_victory(_ctx, combat, rewards, character) do
    Logger.debug("[COMBAT] Handling victory: enemy_id=#{combat.enemy_id}")

    # Despawn the mob
    RespawnManager.despawn_mob(combat.enemy_id)

    # Check kill quest objectives
    enemy_entity = Entities.get_entity(combat.enemy_id)

    {new_character, quest_events} =
      if enemy_entity do
        QuestListeners.check_entity_death(character, enemy_entity.key)
      else
        {character, []}
      end

    events = [
      {:event,
       "Victory! You defeated the #{combat.enemy.name}. Gained #{rewards.xp} XP and #{rewards.gold} gold."},
      {:combat_end, %{reason: "victory", rewards: rewards}},
      {:cancel_timer, :combat_tick}
    ]

    events = events ++ Enum.map(quest_events, fn e -> {:event, e.text} end)

    stats = Entity.get_component(new_character, "stats")

    events =
      if stats do
        events ++ [{:stats_update, %{stats: stats}}]
      else
        events
      end

    result =
      Result.new(
        state: %{combat: nil, character: new_character},
        events: events
      )

    {:ok, result}
  end

  defp handle_combat_continues(ctx, combat, player_damage, character) do
    # Get health from resources component
    resources = Entity.get_component(character, "resources") || %{}
    current_health = resources["health"] || %{"current" => 100, "max" => 100}
    max_hp = current_health["max"] || current_health[:max] || 100

    {:ok, new_health_map, damage_result} =
      Damage.apply_to_map(current_health, player_damage)

    # Update health in character's resources component
    new_resources = Map.put(resources, "health", new_health_map)
    new_character = Entity.add_component(character, "resources", new_resources)

    if damage_result.is_fatal do
      Logger.info(
        "[COMBAT] Defeat: player_id=#{ctx.player_id} enemy=#{combat.enemy.name} fatal_damage=#{player_damage}"
      )

      handle_defeat(ctx, combat, new_character)
    else
      new_current = new_health_map[:current] || new_health_map["current"]

      Logger.debug(
        "[COMBAT] Combat continues: player_id=#{ctx.player_id} player_hp=#{new_current}/#{max_hp}"
      )

      result =
        Result.new(
          state: %{combat: combat, character: new_character},
          events: [
            {:combat_update,
             %{
               player_health: %{current: new_current, max: max_hp},
               enemy_health: combat.enemy.health
             }},
            {:schedule_timer, :combat_tick, 3000}
          ]
        )

      {:ok, result}
    end
  end

  defp handle_defeat(_ctx, combat, character) do
    result =
      Result.new(
        state: %{combat: nil, character: character},
        events: [
          {:combat_end, %{reason: "defeat"}},
          {:cancel_timer, :combat_tick},
          {:die, combat.enemy.name}
        ]
      )

    {:ok, result}
  end
end
