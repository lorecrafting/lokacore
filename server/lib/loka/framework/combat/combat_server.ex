defmodule Loka.Framework.Combat.CombatServer do
  @moduledoc """
  GenServer that persists combat state across LiveView disconnections.

  Combat state is stored per-player and survives connection drops.
  Players can reconnect and resume combat within the timeout window.

  ## Architecture

  - Each active combat gets its own GenServer process
  - Process is registered via Registry with player_id as key
  - Auto-terminates after 10 minutes of inactivity
  - Combat state survives LiveView crashes/disconnections

  ## Usage

      # Start combat (creates GenServer)
      {:ok, combat_state} = CombatServer.start_combat(player_id, entity_id, character)

      # Get existing combat state (for reconnection)
      combat_state = CombatServer.get_state(player_id)

      # Execute player action
      {:ok, new_state, result} = CombatServer.player_action(player_id, :attack)

      # Check if player is in combat
      CombatServer.in_combat?(player_id)

      # End combat
      CombatServer.end_combat(player_id)
  """

  use GenServer
  require Logger

  alias Loka.Framework.Combat
  alias Loka.Engine.Entity

  @registry Loka.CombatRegistry
  # 10 minutes idle timeout
  @timeout 10 * 60 * 1_000

  # =============================================================================
  # Client API
  # =============================================================================

  @doc """
  Starts a new combat session for a player.

  Creates a GenServer process to track combat state.
  Returns the initial combat state.
  """
  def start_combat(player_id, entity_id, %Entity{} = character) do
    # First check if already in combat
    if in_combat?(player_id) do
      {:error, :already_in_combat}
    else
      case DynamicSupervisor.start_child(
             Loka.CombatSupervisor,
             {__MODULE__, {player_id, entity_id, character, :pve}}
           ) do
        {:ok, _pid} ->
          # Return the initial combat state
          {:ok, get_state(player_id)}

        {:error, {:already_started, _pid}} ->
          {:error, :already_in_combat}

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  @doc """
  Starts a PvP combat session.
  """
  def start_pvp_combat(player_id, target_player_id, target_name, %Entity{} = character) do
    if in_combat?(player_id) do
      {:error, :already_in_combat}
    else
      case DynamicSupervisor.start_child(
             Loka.CombatSupervisor,
             {__MODULE__, {player_id, target_player_id, target_name, character, :pvp}}
           ) do
        {:ok, _pid} ->
          {:ok, get_state(player_id)}

        {:error, {:already_started, _pid}} ->
          {:error, :already_in_combat}

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  @doc """
  Gets the current combat state for a player.

  Returns nil if player is not in combat.
  """
  def get_state(player_id) do
    case Registry.lookup(@registry, player_id) do
      [{pid, _}] ->
        try do
          GenServer.call(pid, :get_state, 5_000)
        catch
          :exit, _ -> nil
        end

      [] ->
        nil
    end
  end

  @doc """
  Checks if a player is currently in combat.
  """
  def in_combat?(player_id) do
    case Registry.lookup(@registry, player_id) do
      [{_pid, _}] -> true
      [] -> false
    end
  end

  @doc """
  Executes a player action in combat.

  Actions: :attack, :defend, :flee
  """
  def player_action(player_id, action) do
    case Registry.lookup(@registry, player_id) do
      [{pid, _}] ->
        try do
          GenServer.call(pid, {:player_action, action}, 5_000)
        catch
          :exit, _ -> {:error, :combat_ended}
        end

      [] ->
        {:error, :not_in_combat}
    end
  end

  @doc """
  Ends combat for a player (normal end or forced).
  """
  def end_combat(player_id) do
    case Registry.lookup(@registry, player_id) do
      [{pid, _}] ->
        GenServer.stop(pid, :normal)
        :ok

      [] ->
        :ok
    end
  end

  @doc """
  Updates the character reference for a player's combat.

  Called when character entity changes (e.g., health updated).
  """
  def update_character(player_id, %Entity{} = character) do
    case Registry.lookup(@registry, player_id) do
      [{pid, _}] ->
        GenServer.cast(pid, {:update_character, character})
        :ok

      [] ->
        :ok
    end
  end

  # =============================================================================
  # GenServer Implementation
  # =============================================================================

  def start_link({player_id, entity_id, character, :pve}) do
    GenServer.start_link(__MODULE__, {:pve, player_id, entity_id, character},
      name: {:via, Registry, {@registry, player_id}}
    )
  end

  def start_link({player_id, target_player_id, target_name, character, :pvp}) do
    GenServer.start_link(__MODULE__, {:pvp, player_id, target_player_id, target_name, character},
      name: {:via, Registry, {@registry, player_id}}
    )
  end

  @impl true
  def init({:pve, player_id, entity_id, character}) do
    case Combat.start_combat(entity_id, character) do
      {:ok, combat_state} ->
        Logger.debug("[CombatServer] Started PvE combat for player #{player_id}")

        state = %{
          player_id: player_id,
          combat: combat_state,
          character: character,
          last_action: System.monotonic_time(:millisecond)
        }

        schedule_timeout_check()
        {:ok, state}

      {:error, reason} ->
        {:stop, reason}
    end
  end

  @impl true
  def init({:pvp, player_id, target_player_id, target_name, character}) do
    case Combat.start_pvp_combat(target_player_id, target_name, character) do
      {:ok, combat_state} ->
        Logger.debug("[CombatServer] Started PvP combat for player #{player_id}")

        state = %{
          player_id: player_id,
          combat: combat_state,
          character: character,
          last_action: System.monotonic_time(:millisecond)
        }

        schedule_timeout_check()
        {:ok, state}

      {:error, reason} ->
        {:stop, reason}
    end
  end

  @impl true
  def handle_call(:get_state, _from, state) do
    {:reply, state.combat, state}
  end

  @impl true
  def handle_call({:player_action, action}, _from, state) do
    case Combat.player_action(state.combat, action, state.character) do
      {:ok, new_combat, result} ->
        new_state = %{
          state
          | combat: new_combat,
            last_action: System.monotonic_time(:millisecond)
        }

        {:reply, {:ok, new_combat, result}, new_state}

      {:error, reason} ->
        {:reply, {:error, reason}, state}
    end
  end

  @impl true
  def handle_cast({:update_character, character}, state) do
    {:noreply, %{state | character: character}}
  end

  @impl true
  def handle_info(:check_timeout, state) do
    idle_time = System.monotonic_time(:millisecond) - state.last_action

    if idle_time > @timeout do
      Logger.info("[CombatServer] Combat timeout for player #{state.player_id}")
      {:stop, :normal, state}
    else
      schedule_timeout_check()
      {:noreply, state}
    end
  end

  @impl true
  def terminate(reason, state) do
    Logger.debug("[CombatServer] Combat ended for player #{state.player_id}: #{inspect(reason)}")
    :ok
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp schedule_timeout_check do
    # Check every minute
    Process.send_after(self(), :check_timeout, 60_000)
  end
end
