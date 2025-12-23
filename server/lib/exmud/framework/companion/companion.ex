defmodule Exmud.Framework.Companion do
  @moduledoc """
  Companion and pet system.

  Allows players to have NPC followers that can:
  - Follow the player between rooms
  - Assist in combat
  - Carry items
  - Provide passive bonuses
  - Have their own needs (hunger, happiness)

  ## Companion Configuration (YAML - NPC Prototype)

      key: wolf_companion
      name: "Wolf"
      type: npc
      components:
        companion:
          loyalty_max: 100
          can_carry: true
          carry_capacity: 10
          combat_assist: true
          attack_power: 15
          passive_bonuses:
            perception: 2
          needs:
            hunger: true
            happiness: true
          commands:
            - follow
            - stay
            - attack
            - guard
          description_suffix: "A loyal wolf follows at your side."

  ## Usage

      alias Exmud.Framework.Companion

      # Summon/acquire a companion
      {:ok, companion} = Companion.acquire(game_state, "wolf_companion")

      # Command companion
      :ok = Companion.command(game_state, :follow)
      :ok = Companion.command(game_state, :attack, target_id)

      # Feed companion
      {:ok, state} = Companion.feed(game_state, "meat")
  """

  alias Exmud.Framework.Player.GameState
  alias Exmud.Utils.MapHelpers

  @type companion_state :: %{
          key: String.t(),
          name: String.t(),
          loyalty: integer(),
          hunger: integer(),
          happiness: integer(),
          mode: :following | :staying | :guarding | :attacking,
          inventory: [String.t()],
          summoned_at: integer()
        }

  @default_loyalty 50
  @default_hunger 100
  @default_happiness 100

  # =============================================================================
  # Companion Management
  # =============================================================================

  @doc """
  Gets the player's active companion.
  """
  def get_companion(%GameState{stats: stats}) do
    MapHelpers.get_flexible(stats, :companion, nil)
  end

  @doc """
  Acquires a new companion.
  """
  def acquire(%GameState{} = game_state, companion_key, companion_name \\ nil) do
    if get_companion(game_state) do
      {:error, :already_have_companion}
    else
      companion_state = %{
        key: companion_key,
        name: companion_name || companion_key,
        loyalty: @default_loyalty,
        hunger: @default_hunger,
        happiness: @default_happiness,
        mode: :following,
        inventory: [],
        summoned_at: System.system_time(:second)
      }

      {:ok, set_companion(game_state, companion_state)}
    end
  end

  @doc """
  Dismisses the current companion.
  """
  def dismiss(%GameState{} = game_state) do
    case get_companion(game_state) do
      nil -> {:error, :no_companion}
      _ -> {:ok, set_companion(game_state, nil)}
    end
  end

  @doc """
  Renames the companion.
  """
  def rename(%GameState{} = game_state, new_name) do
    case get_companion(game_state) do
      nil -> {:error, :no_companion}
      companion ->
        updated = Map.put(companion, :name, new_name)
        {:ok, set_companion(game_state, updated)}
    end
  end

  # =============================================================================
  # Commands
  # =============================================================================

  @doc """
  Issues a command to the companion.
  """
  def command(%GameState{} = game_state, :follow) do
    update_mode(game_state, :following)
  end

  def command(%GameState{} = game_state, :stay) do
    update_mode(game_state, :staying)
  end

  def command(%GameState{} = game_state, :guard) do
    update_mode(game_state, :guarding)
  end

  def command(%GameState{} = game_state, :attack, _target_id) do
    update_mode(game_state, :attacking)
  end

  defp update_mode(game_state, mode) do
    case get_companion(game_state) do
      nil -> {:error, :no_companion}
      companion ->
        updated = Map.put(companion, :mode, mode)
        {:ok, set_companion(game_state, updated)}
    end
  end

  # =============================================================================
  # Needs Management
  # =============================================================================

  @doc """
  Feeds the companion, restoring hunger.
  """
  def feed(%GameState{} = game_state, _food_item) do
    case get_companion(game_state) do
      nil ->
        {:error, :no_companion}

      companion ->
        new_hunger = min(100, companion.hunger + 30)
        new_happiness = min(100, companion.happiness + 10)

        updated =
          companion
          |> Map.put(:hunger, new_hunger)
          |> Map.put(:happiness, new_happiness)

        {:ok, set_companion(game_state, updated), "Your companion happily eats the food."}
    end
  end

  @doc """
  Plays with the companion, increasing happiness.
  """
  def play(%GameState{} = game_state) do
    case get_companion(game_state) do
      nil ->
        {:error, :no_companion}

      companion ->
        new_happiness = min(100, companion.happiness + 20)
        new_loyalty = min(100, companion.loyalty + 5)

        updated =
          companion
          |> Map.put(:happiness, new_happiness)
          |> Map.put(:loyalty, new_loyalty)

        {:ok, set_companion(game_state, updated), "Your companion enjoys playing with you!"}
    end
  end

  @doc """
  Processes companion needs decay over time.
  """
  def tick_needs(%GameState{} = game_state, decay_amount \\ 1) do
    case get_companion(game_state) do
      nil ->
        {:ok, game_state}

      companion ->
        new_hunger = max(0, companion.hunger - decay_amount)
        new_happiness = max(0, companion.happiness - div(decay_amount, 2))

        # Loyalty decays if needs not met
        loyalty_decay = if new_hunger < 20 or new_happiness < 20, do: 1, else: 0
        new_loyalty = max(0, companion.loyalty - loyalty_decay)

        updated =
          companion
          |> Map.put(:hunger, new_hunger)
          |> Map.put(:happiness, new_happiness)
          |> Map.put(:loyalty, new_loyalty)

        {:ok, set_companion(game_state, updated)}
    end
  end

  # =============================================================================
  # Inventory
  # =============================================================================

  @doc """
  Gives an item to the companion to carry.
  """
  def give_item(%GameState{} = game_state, item_id, capacity \\ 10) do
    case get_companion(game_state) do
      nil ->
        {:error, :no_companion}

      companion ->
        if length(companion.inventory) >= capacity do
          {:error, :companion_inventory_full}
        else
          updated = Map.update!(companion, :inventory, &[item_id | &1])
          {:ok, set_companion(game_state, updated)}
        end
    end
  end

  @doc """
  Takes an item from the companion.
  """
  def take_item(%GameState{} = game_state, item_id) do
    case get_companion(game_state) do
      nil ->
        {:error, :no_companion}

      companion ->
        if item_id in companion.inventory do
          updated = Map.update!(companion, :inventory, &List.delete(&1, item_id))
          {:ok, set_companion(game_state, updated), item_id}
        else
          {:error, :item_not_found}
        end
    end
  end

  # =============================================================================
  # Combat Assist
  # =============================================================================

  @doc """
  Gets companion's combat contribution.
  """
  def get_combat_assist(%GameState{} = game_state) do
    case get_companion(game_state) do
      nil -> nil
      companion ->
        if companion.mode in [:following, :attacking] and companion.loyalty > 20 do
          # Return combat assist info
          %{
            attack_power: 10,
            loyalty_modifier: companion.loyalty / 100
          }
        else
          nil
        end
    end
  end

  # =============================================================================
  # Helpers
  # =============================================================================

  defp set_companion(%GameState{stats: stats} = game_state, companion) do
    %{game_state | stats: Map.put(stats, :companion, companion)}
  end
end
