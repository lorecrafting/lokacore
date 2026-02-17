defmodule Loka.Framework.Quest.Progress.Rewards do
  @moduledoc """
  Quest reward application logic.

  Handles applying XP, gold, and item rewards to a character entity.
  Extracted from Progress module for better organization.

  ## Reward Types

  - `:xp` - Experience points (added to player stats)
  - `:gold` - Gold currency (stored in wallet component via Economy module)
  - `:items` - List of item IDs (added to inventory)

  ## Usage

      alias Loka.Framework.Quest.Progress.Rewards

      # Apply all rewards from a quest
      {:ok, entity} = Rewards.apply(entity, %{xp: 100, gold: 50, items: ["sword"]})

      # Apply specific reward types
      {:ok, entity} = Rewards.apply_xp(entity, 100)
      {:ok, entity} = Rewards.apply_gold(entity, 50)
      {:ok, entity} = Rewards.apply_items(entity, ["sword", "shield"])
  """

  alias Loka.Engine.Entity
  alias Loka.Framework.Economy

  @doc """
  Applies all rewards from a rewards map.

  Accepts rewards with either atom or string keys (for DB compatibility).
  """
  @spec apply(Entity.t(), map()) :: {:ok, Entity.t()} | {:error, term()}
  def apply(entity, rewards) when is_map(rewards) do
    # Support both atom and string keys from DB
    xp = Map.get(rewards, "xp") || Map.get(rewards, :xp, 0)
    gold = Map.get(rewards, "gold") || Map.get(rewards, :gold, 0)
    items = Map.get(rewards, "items") || Map.get(rewards, :items, [])

    with {:ok, entity} <- apply_xp(entity, xp),
         {:ok, entity} <- apply_gold(entity, gold),
         {:ok, entity} <- apply_items(entity, items) do
      {:ok, entity}
    end
  end

  def apply(entity, nil), do: {:ok, entity}

  @doc """
  Applies XP reward to player stats component.
  """
  @spec apply_xp(Entity.t(), non_neg_integer()) :: {:ok, Entity.t()} | {:error, term()}
  def apply_xp(entity, 0), do: {:ok, entity}

  def apply_xp(%Entity{} = entity, xp) when xp > 0 do
    stats = Entity.get_component(entity, "stats") || %{}
    current_xp = Map.get(stats, "xp") || Map.get(stats, :xp, 0)
    new_xp = current_xp + xp
    new_stats = Map.put(stats, "xp", new_xp)
    {:ok, Entity.add_component(entity, "stats", new_stats)}
  end

  @doc """
  Applies gold reward via Economy module (credits wallet component in memory).
  """
  @spec apply_gold(Entity.t(), non_neg_integer()) :: {:ok, Entity.t()} | {:error, term()}
  def apply_gold(entity, 0), do: {:ok, entity}

  def apply_gold(%Entity{} = entity, gold) when gold > 0 do
    Economy.credit(entity, gold, :quest_reward)
  end

  @doc """
  Applies item rewards to player inventory component.
  """
  @spec apply_items(Entity.t(), [String.t()]) :: {:ok, Entity.t()} | {:error, term()}
  def apply_items(entity, []), do: {:ok, entity}

  def apply_items(%Entity{} = entity, items) when is_list(items) do
    inventory = Entity.get_component(entity, "inventory") || []
    new_inventory = inventory ++ items
    {:ok, Entity.add_component(entity, "inventory", new_inventory)}
  end
end
