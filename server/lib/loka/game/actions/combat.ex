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

  alias Loka.Game.Actions.{Context, Result}
  alias Loka.Framework.Combat
  alias Loka.Framework.Combat.RespawnManager
  alias Loka.Framework.Player.GameState, as: PlayerGameState
  alias Loka.Framework.Quest.Listeners, as: QuestListeners
  alias Loka.Engine.Entities
  alias Loka.Mechanics.Damage

  @doc """
  Initiate combat with an entity.
  """
  @spec attack(Context.t(), String.t(), map()) :: {:ok, Result.t()} | {:error, String.t()}
  def attack(ctx, entity_id, entity) do
    case Combat.start_combat(entity_id, ctx.game_state) do
      {:ok, combat_state} ->
        result =
          Result.new(
            state: %{combat: combat_state},
            events: [
              {:combat_start,
               %{
                 enemy: %{
                   id: entity_id,
                   name: entity.name,
                   health: combat_state.enemy.health
                 }
               }},
              {:schedule_timer, :combat_tick, 3000}
            ]
          )

        {:ok, result}

      {:error, :not_combatant} ->
        {:error, "The #{entity.name} doesn't want to fight."}

      {:error, _reason} ->
        {:error, "You can't attack that."}
    end
  end

  @doc """
  Attempt to flee from combat.
  """
  @spec flee(Context.t()) :: {:ok, Result.t()} | {:error, String.t()}
  def flee(ctx) do
    combat = ctx.combat

    if combat do
      case Combat.player_action(combat, :flee, ctx.game_state) do
        {:ok, _combat, %{success: true}} ->
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
          result =
            Result.new(
              state: %{combat: new_combat},
              events: [
                {:event, "You try to flee but #{combat.enemy.name} blocks your escape!"}
              ]
            )

          {:ok, result}

        {:error, :on_cooldown} ->
          {:error, "You must wait before trying to flee again."}

        {:error, _} ->
          {:error, "Failed to flee."}
      end
    else
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

    if combat do
      case Combat.execute_combat_tick(combat, ctx.game_state) do
        {:victory, new_combat, rewards, updated_game_state} ->
          handle_victory(ctx, new_combat, rewards, updated_game_state)

        {:ok, new_combat, player_damage, updated_game_state} ->
          handle_combat_continues(ctx, new_combat, player_damage, updated_game_state)
      end
    else
      {:error, "Not in combat."}
    end
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp handle_victory(_ctx, combat, rewards, game_state) do
    # Despawn the mob
    RespawnManager.despawn_mob(combat.enemy_id)

    # Check kill quest objectives
    enemy_entity = Entities.get_entity(combat.enemy_id)

    {new_game_state, quest_events} =
      if enemy_entity do
        QuestListeners.check_entity_death(game_state, enemy_entity.key)
      else
        {game_state, []}
      end

    events = [
      {:event,
       "Victory! You defeated the #{combat.enemy.name}. Gained #{rewards.xp} XP and #{rewards.gold} gold."},
      {:combat_end, %{reason: "victory", rewards: rewards}},
      {:cancel_timer, :combat_tick}
    ]

    events = events ++ Enum.map(quest_events, fn e -> {:event, e.text} end)

    events =
      if new_game_state.stats do
        events ++ [{:stats_update, %{stats: new_game_state.stats}}]
      else
        events
      end

    result =
      Result.new(
        state: %{combat: nil, game_state: new_game_state},
        events: events
      )

    {:ok, result}
  end

  defp handle_combat_continues(ctx, combat, player_damage, game_state) do
    # Calculate new health using Mechanics.Damage
    current_health = PlayerGameState.get_health(game_state)
    max_hp = current_health[:max] || current_health["max"] || 100

    {:ok, new_health_map, damage_result} =
      Damage.apply_to_map(current_health, player_damage)

    {:ok, new_game_state} = PlayerGameState.set_health(game_state, new_health_map)

    if damage_result.is_fatal do
      handle_defeat(ctx, combat, new_game_state)
    else
      new_current = new_health_map[:current] || new_health_map["current"]

      result =
        Result.new(
          state: %{combat: combat, game_state: new_game_state},
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

  defp handle_defeat(_ctx, combat, game_state) do
    result =
      Result.new(
        state: %{combat: nil, game_state: game_state},
        events: [
          {:combat_end, %{reason: "defeat"}},
          {:cancel_timer, :combat_tick},
          {:enter_bardo, combat.enemy.name}
        ]
      )

    {:ok, result}
  end
end
