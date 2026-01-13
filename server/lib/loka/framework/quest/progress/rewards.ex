defmodule Loka.Framework.Quest.Progress.Rewards do
  @moduledoc """
  Quest reward application logic.

  Handles applying XP, gold, and item rewards to player state.
  Extracted from Progress module for better organization.

  ## Reward Types

  - `:xp` - Experience points (added to player stats)
  - `:gold` - Gold currency (stored in player flags)
  - `:items` - List of item IDs (added to inventory)

  ## Usage

      alias Loka.Framework.Quest.Progress.Rewards

      # Apply all rewards from a quest
      {:ok, state} = Rewards.apply(state, %{xp: 100, gold: 50, items: ["sword"]})

      # Apply specific reward types
      {:ok, state} = Rewards.apply_xp(state, 100)
      {:ok, state} = Rewards.apply_gold(state, 50)
      {:ok, state} = Rewards.apply_items(state, ["sword", "shield"])
  """

  alias Loka.Framework.Player.GameState

  @doc """
  Applies all rewards from a rewards map.

  Accepts rewards with either atom or string keys (for DB compatibility).

  ## Examples

      iex> apply(state, %{xp: 100, gold: 50, items: ["sword"]})
      {:ok, %GameState{}}

      iex> apply(state, %{"xp" => 100, "gold" => 50})
      {:ok, %GameState{}}
  """
  @spec apply(GameState.t(), map()) :: {:ok, GameState.t()} | {:error, term()}
  def apply(state, rewards) when is_map(rewards) do
    # Support both atom and string keys from DB
    xp = Map.get(rewards, "xp") || Map.get(rewards, :xp, 0)
    gold = Map.get(rewards, "gold") || Map.get(rewards, :gold, 0)
    items = Map.get(rewards, "items") || Map.get(rewards, :items, [])

    with {:ok, state} <- apply_xp(state, xp),
         {:ok, state} <- apply_gold(state, gold),
         {:ok, state} <- apply_items(state, items) do
      {:ok, state}
    end
  end

  def apply(state, nil), do: {:ok, state}

  @doc """
  Applies XP reward to player stats.

  ## Examples

      iex> apply_xp(state, 100)
      {:ok, %GameState{stats: %{xp: 100}}}
  """
  @spec apply_xp(GameState.t(), non_neg_integer()) :: {:ok, GameState.t()} | {:error, term()}
  def apply_xp(state, 0), do: {:ok, state}

  def apply_xp(%GameState{stats: stats} = state, xp) when xp > 0 do
    current_xp = Map.get(stats, "xp") || Map.get(stats, :xp, 0)
    new_xp = current_xp + xp
    new_stats = Map.put(stats, "xp", new_xp)
    GameState.update_state(state, %{stats: new_stats})
  end

  @doc """
  Applies gold reward to player flags.

  Gold is stored in the flags map for flexibility.

  ## Examples

      iex> apply_gold(state, 50)
      {:ok, %GameState{flags: %{gold: 50}}}
  """
  @spec apply_gold(GameState.t(), non_neg_integer()) :: {:ok, GameState.t()} | {:error, term()}
  def apply_gold(state, 0), do: {:ok, state}

  def apply_gold(%GameState{flags: flags} = state, gold) when gold > 0 do
    current_gold = Map.get(flags, "gold") || Map.get(flags, :gold, 0)
    new_gold = current_gold + gold
    new_flags = Map.put(flags, "gold", new_gold)
    GameState.update_state(state, %{flags: new_flags})
  end

  @doc """
  Applies item rewards to player inventory.

  ## Examples

      iex> apply_items(state, ["sword", "shield"])
      {:ok, %GameState{inventory: ["sword", "shield"]}}
  """
  @spec apply_items(GameState.t(), [String.t()]) :: {:ok, GameState.t()} | {:error, term()}
  def apply_items(state, []), do: {:ok, state}

  def apply_items(%GameState{inventory: inventory} = state, items) when is_list(items) do
    new_inventory = inventory ++ items
    GameState.update_state(state, %{inventory: new_inventory})
  end
end
