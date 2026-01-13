defmodule LokaWeb.Channels.GameChannel.Handlers.Combat do
  @moduledoc """
  Handles combat-related channel events.

  Processes attack initiation, flee attempts, and combat ticks.
  Returns results that GameChannel uses to update socket state.
  """

  import Phoenix.Channel, only: [push: 3]

  alias Loka.Engine.Entities
  alias Loka.Framework.Combat
  alias Loka.Framework.Combat.RespawnManager
  alias Loka.Framework.Player.GameState, as: PlayerGameState
  alias Loka.Framework.Quest.Listeners, as: QuestListeners

  @doc """
  Initiate combat with an entity.
  Returns {:ok, combat_state} or {:error, reason} with appropriate pushes.
  """
  def start_attack(socket, entity_id, entity) do
    game_state = socket.assigns.game_state

    case Combat.start_combat(entity_id, game_state) do
      {:ok, combat_state} ->
        push(socket, "combat_start", %{
          enemy: %{
            id: entity_id,
            name: entity.name,
            health: combat_state.enemy.health
          }
        })

        {:ok, combat_state}

      {:error, :not_combatant} ->
        push(socket, "event", %{text: "The #{entity.name} doesn't want to fight."})
        {:error, :not_combatant}

      {:error, reason} ->
        push(socket, "event", %{text: "You can't attack that."})
        {:error, reason}
    end
  end

  @doc """
  Attempt to flee from combat.
  Returns {:fled, socket} or {:blocked, new_combat, socket}.
  """
  def attempt_flee(socket) do
    combat = socket.assigns[:combat]
    game_state = socket.assigns.game_state

    if combat do
      case Combat.player_action(combat, :flee, game_state) do
        {:ok, _combat, %{success: true}} ->
          push(socket, "event", %{text: "You fled from the #{combat.enemy.name}!"})
          push(socket, "combat_end", %{reason: "fled"})
          {:fled, socket}

        {:ok, new_combat, %{success: false}} ->
          push(socket, "event", %{
            text: "You try to flee but #{combat.enemy.name} blocks your escape!"
          })

          {:blocked, new_combat}

        {:error, :on_cooldown} ->
          push(socket, "event", %{text: "You must wait before trying to flee again."})
          {:cooldown, socket}

        {:error, _} ->
          {:error, socket}
      end
    else
      {:not_in_combat, socket}
    end
  end

  @doc """
  Process a combat tick. Returns one of:
  - {:victory, rewards, new_game_state, quest_events}
  - {:continue, new_combat, new_game_state, player_health}
  - {:defeat, killer_name, new_game_state}
  - {:no_combat}
  """
  def process_tick(socket) do
    combat = socket.assigns[:combat]
    game_state = socket.assigns.game_state

    if combat do
      case Combat.execute_combat_tick(combat, game_state) do
        {:victory, new_combat, rewards, updated_game_state} ->
          # Enemy defeated
          RespawnManager.despawn_mob(new_combat.enemy_id)

          # Check kill quest objectives
          enemy_entity = Entities.get_entity(new_combat.enemy_id)

          {new_game_state, quest_events} =
            if enemy_entity do
              QuestListeners.check_entity_death(updated_game_state, enemy_entity.key)
            else
              {updated_game_state, []}
            end

          push(socket, "event", %{
            text:
              "Victory! You defeated the #{new_combat.enemy.name}. Gained #{rewards.xp} XP and #{rewards.gold} gold."
          })

          push(socket, "combat_end", %{reason: "victory", rewards: rewards})

          Enum.each(quest_events, fn event ->
            push(socket, "event", %{text: event.text})
          end)

          if new_game_state.stats do
            push(socket, "stats_update", %{stats: new_game_state.stats})
          end

          {:victory, rewards, new_game_state, quest_events}

        {:ok, new_combat, player_damage, updated_game_state} ->
          # Combat continues
          current_health = PlayerGameState.get_health(updated_game_state)
          current_hp = current_health[:current] || current_health["current"] || 100
          max_hp = current_health[:max] || current_health["max"] || 100
          new_hp = max(0, current_hp - player_damage)
          new_health = %{current: new_hp, max: max_hp}

          {:ok, new_game_state} = PlayerGameState.set_health(updated_game_state, new_health)

          if new_hp <= 0 do
            # Player defeated
            {:defeat, new_combat.enemy.name, new_game_state}
          else
            push(socket, "combat_update", %{
              player_health: new_health,
              enemy_health: new_combat.enemy.health
            })

            {:continue, new_combat, new_game_state, new_health}
          end
      end
    else
      {:no_combat}
    end
  end
end
