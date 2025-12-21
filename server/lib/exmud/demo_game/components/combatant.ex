defmodule Exmud.DemoGame.Components.Combatant do
  @moduledoc """
  Component for entities that can participate in combat.

  Stores health, stats, level, experience, and combat-related flags.

  ## Fields

  - `health` - Map with `:current` and `:max` health values
  - `stats` - Map with `:str`, `:dex`, `:sta` base stats
  - `level` - Current level (integer)
  - `xp` - Current experience points (integer)
  - `combat_flags` - Map of combat-related flags (stunned, poisoned, etc.)

  ## Example

      %Combatant{
        health: %{current: 100, max: 100},
        stats: %{str: 12, dex: 10, sta: 8},
        level: 3,
        xp: 450,
        combat_flags: %{poisoned: true}
      }
  """

  @type t :: %__MODULE__{
          health: %{current: non_neg_integer(), max: pos_integer()},
          stats: %{str: non_neg_integer(), dex: non_neg_integer(), sta: non_neg_integer()},
          level: pos_integer(),
          xp: non_neg_integer(),
          combat_flags: map()
        }

  defstruct health: %{current: 100, max: 100},
            stats: %{str: 10, dex: 10, sta: 10},
            level: 1,
            xp: 0,
            combat_flags: %{}

  @doc """
  Creates a new Combatant with the given attributes.
  """
  def new(attrs \\ %{}) do
    struct(__MODULE__, attrs)
  end

  @doc """
  Returns true if the combatant is alive (health > 0).
  """
  def alive?(%__MODULE__{health: %{current: current}}), do: current > 0

  @doc """
  Returns true if the combatant is dead (health <= 0).
  """
  def dead?(%__MODULE__{} = combatant), do: not alive?(combatant)

  @doc """
  Applies damage to the combatant, returning the updated component.
  """
  def take_damage(%__MODULE__{health: health} = combatant, amount) when amount >= 0 do
    new_current = max(0, health.current - amount)
    %{combatant | health: %{health | current: new_current}}
  end

  @doc """
  Heals the combatant, capped at max health.
  """
  def heal(%__MODULE__{health: health} = combatant, amount) when amount >= 0 do
    new_current = min(health.max, health.current + amount)
    %{combatant | health: %{health | current: new_current}}
  end

  @doc """
  Adds experience and returns the updated combatant (does not handle leveling).
  """
  def add_xp(%__MODULE__{xp: xp} = combatant, amount) when amount >= 0 do
    %{combatant | xp: xp + amount}
  end
end
