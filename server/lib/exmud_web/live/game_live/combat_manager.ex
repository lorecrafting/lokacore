defmodule ExmudWeb.GameLive.CombatManager do
  @moduledoc """
  Combat event handlers for GameLive.

  Handles:
  - Starting combat (PvE and PvP)
  - Combat actions (attack, defend, flee)
  - Enemy turns
  - Combat outcomes (victory, defeat, fled)
  """

  import Phoenix.Component, only: [assign: 3, update: 3]

  alias Exmud.Framework.Player.GameState, as: PlayerGameState
  alias Exmud.Framework.World.RoomLoader
  alias Exmud.Framework.Combat
  alias Exmud.Framework.Combat.Spawner
  alias Exmud.Utils.MapHelpers

  alias ExmudWeb.GameLive.RoomManager

  @combat_actions %{"attack" => :attack, "defend" => :defend, "flee" => :flee}

  @doc """
  Starts combat with an NPC entity.
  """
  def start_combat(socket, entity) do
    game_state = socket.assigns.game_state

    case Combat.start_combat(entity.id, game_state) do
      {:ok, combat_state} ->
        {:noreply,
         socket
         |> assign(:combat, combat_state)
         |> update_ui(%{context_entity: nil})}

      {:error, :not_combatant} ->
        event = %{
          text: "The #{entity.name} doesn't want to fight.",
          timestamp: DateTime.utc_now()
        }

        {:noreply,
         socket
         |> update_ui(%{context_entity: nil})
         |> update_events([event])}

      {:error, _reason} ->
        {:noreply, update_ui(socket, %{context_entity: nil})}
    end
  end

  @doc """
  Starts PvP combat with another player.
  """
  def start_pvp_combat(socket, entity) do
    player = socket.assigns.current_scope.player
    player_name = RoomManager.player_display_name(player)
    game_state = socket.assigns.game_state
    room = socket.assigns.room

    case Combat.start_pvp_combat(entity.id, entity.name, game_state) do
      {:ok, combat_state} ->
        if room.id do
          Phoenix.PubSub.broadcast(
            Exmud.PubSub,
            "room:#{room.id}",
            {:player_attacks, player.id, player_name, entity.id, entity.name}
          )
        end

        {:noreply,
         socket
         |> assign(:combat, combat_state)
         |> update_ui(%{context_entity: nil})}

      {:error, :player_not_found} ->
        event = %{
          text: "#{entity.name} is no longer here.",
          timestamp: DateTime.utc_now()
        }

        {:noreply,
         socket
         |> update_ui(%{context_entity: nil})
         |> update_events([event])}

      {:error, _reason} ->
        {:noreply, update_ui(socket, %{context_entity: nil})}
    end
  end

  @doc """
  Handles a combat action (attack, defend, flee).
  """
  def handle_action(socket, action_string) do
    combat = socket.assigns.combat
    game_state = socket.assigns.game_state

    action_atom = Map.get(@combat_actions, action_string, :attack)

    case Combat.player_action(combat, action_atom, game_state) do
      {:ok, new_combat, _result} ->
        case Combat.check_combat_end(new_combat, game_state) do
          {:victory, rewards} ->
            handle_victory(socket, new_combat, rewards)

          {:fled} ->
            handle_fled(socket, new_combat)

          :ongoing ->
            send(self(), {:enemy_turn, new_combat})
            {:noreply, assign(socket, :combat, new_combat)}
        end

      {:error, _reason} ->
        {:noreply, socket}
    end
  end

  @doc """
  Handles the enemy's turn in combat.
  """
  def handle_enemy_turn(socket, combat) do
    game_state = socket.assigns.game_state

    case Combat.enemy_turn(combat, game_state) do
      {:ok, new_combat, %{action: :attack, damage: damage}} ->
        current_health = socket.assigns.health
        current_hp = MapHelpers.get_flexible(current_health, :current, 100)
        new_hp = max(0, current_hp - damage)
        new_health = Map.put(current_health, "current", new_hp)

        {:ok, new_game_state} = PlayerGameState.update_state(game_state, %{health: new_health})

        case Combat.check_combat_end(new_combat, new_game_state) do
          {:defeat} ->
            handle_defeat(socket, new_combat, new_game_state)

          :ongoing ->
            {:noreply,
             socket
             |> assign(:combat, new_combat)
             |> assign(:health, new_health)
             |> assign(:game_state, new_game_state)}
        end

      {:ok, new_combat, _result} ->
        {:noreply, assign(socket, :combat, new_combat)}

      {:error, _reason} ->
        {:noreply, socket}
    end
  end

  @doc """
  Handles combat victory.
  """
  def handle_victory(socket, combat, rewards) do
    game_state = socket.assigns.game_state
    room = socket.assigns.room
    is_pvp = Map.get(combat, :pvp, false)

    if is_pvp do
      player = socket.assigns.current_scope.player
      player_name = RoomManager.player_display_name(player)

      if room.id do
        Phoenix.PubSub.broadcast(
          Exmud.PubSub,
          "room:#{room.id}",
          {:player_defeated, player.id, player_name, combat.enemy_id, combat.enemy.name}
        )
      end
    else
      Spawner.despawn_mob(combat.enemy_id)
    end

    {new_game_state, level_up_event} =
      case Combat.apply_rewards(game_state, rewards) do
        {:ok, updated_state} ->
          {updated_state, nil}

        {:ok, updated_state, level_up_info} ->
          level_event = %{
            text:
              "LEVEL UP! You are now level #{level_up_info.new_level}. Gained #{level_up_info.skill_points_gained} skill points!",
            timestamp: DateTime.utc_now()
          }

          {updated_state, level_event}
      end

    {:ok, updated_room} = RoomLoader.load_room_for_display(room.id)

    victory_event =
      if is_pvp do
        %{
          text: "Victory! You defeated #{combat.enemy.name}. Gained #{rewards.xp} XP.",
          timestamp: DateTime.utc_now()
        }
      else
        %{
          text:
            "Victory! You defeated the #{combat.enemy.name}. Gained #{rewards.xp} XP and #{rewards.gold} gold.",
          timestamp: DateTime.utc_now()
        }
      end

    events = [victory_event] ++ if(level_up_event, do: [level_up_event], else: [])

    {:noreply,
     socket
     |> assign(:combat, nil)
     |> assign(:game_state, new_game_state)
     |> assign(:stats, new_game_state.stats)
     |> assign(:health, new_game_state.health)
     |> assign(:room, updated_room)
     |> update(:events, fn e -> e ++ events end)}
  end

  @doc """
  Handles successfully fleeing from combat.
  """
  def handle_fled(socket, combat) do
    event = %{
      text: "You fled from the #{combat.enemy.name}!",
      timestamp: DateTime.utc_now()
    }

    {:noreply,
     socket
     |> assign(:combat, nil)
     |> update(:events, fn events -> events ++ [event] end)}
  end

  @doc """
  Handles player defeat in combat.
  """
  def handle_defeat(socket, combat, game_state) do
    current_health = game_state.health
    max_hp = MapHelpers.get_flexible(current_health, :max, 100)
    new_health = Map.put(current_health, "current", max_hp)

    {:ok, new_game_state} = PlayerGameState.update_state(game_state, %{health: new_health})

    event = %{
      text: "You were defeated by the #{combat.enemy.name}... You wake up feeling disoriented.",
      timestamp: DateTime.utc_now()
    }

    {:noreply,
     socket
     |> assign(:combat, nil)
     |> assign(:health, new_health)
     |> assign(:game_state, new_game_state)
     |> update(:events, fn events -> events ++ [event] end)}
  end

  # Private helpers

  defp update_ui(socket, updates) do
    update(socket, :ui, fn ui -> Map.merge(ui, updates) end)
  end

  defp update_events(socket, new_events) do
    update(socket, :events, fn events -> events ++ new_events end)
  end
end
