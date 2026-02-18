defmodule Loka.Framework.Progression do
  @moduledoc """
  Character level-up logic.

  Computes the current level from total XP using the formula defined in
  `priv/config/balance.yml` (`progression.xp_base` and `progression.xp_exponent`),
  and applies both the XP gain and any resulting level-ups to a character entity.

  ## Formula

      xp_to_reach_level(n) = xp_base * (n - 1)^xp_exponent

  With defaults (xp_base: 100, xp_exponent: 1.8):

      Level 1 → 2: 100 XP total
      Level 2 → 3: 287 XP total
      Level 3 → 4: 535 XP total

  ## Usage

      {:ok, entity, events} = Progression.apply_xp(entity, 150)
      # events may include {:level_up, old_level, new_level}
  """

  alias Loka.Config.Balance
  alias Loka.Engine.Entity

  require Logger

  @default_xp_base 100
  @default_xp_exponent 1.8
  @default_max_level 50

  @type level_up_event :: {:level_up, old_level :: pos_integer(), new_level :: pos_integer()}

  @doc """
  Applies `xp` to the character entity, incrementing stats["level"] for each
  threshold crossed. Returns the updated entity and a list of level-up events.
  """
  @spec apply_xp(Entity.t(), non_neg_integer()) :: {:ok, Entity.t(), [level_up_event()]}
  def apply_xp(%Entity{} = entity, 0), do: {:ok, entity, []}

  def apply_xp(%Entity{} = entity, xp) when xp > 0 do
    stats = Entity.get_component(entity, "stats") || %{}
    current_xp = Map.get(stats, "xp", 0)
    current_level = Map.get(stats, "level", 1)
    max_level = Balance.get([:progression, :max_level], default: @default_max_level)

    new_xp = current_xp + xp
    new_level = min(level_for_xp(new_xp), max_level)

    events =
      if new_level > current_level do
        [{:level_up, current_level, new_level}]
      else
        []
      end

    new_stats =
      stats
      |> Map.put("xp", new_xp)
      |> Map.put("level", new_level)

    {:ok, Entity.add_component(entity, "stats", new_stats), events}
  end

  @doc """
  Returns the level a character should be at for the given total XP.
  Level is always at least 1.
  """
  @spec level_for_xp(non_neg_integer()) :: pos_integer()
  def level_for_xp(total_xp) when total_xp >= 0 do
    xp_base = Balance.get([:progression, :xp_base], default: @default_xp_base)
    xp_exponent = Balance.get([:progression, :xp_exponent], default: @default_xp_exponent)
    max_level = Balance.get([:progression, :max_level], default: @default_max_level)

    # Find highest level where cumulative XP threshold is met.
    # xp_to_reach_level(n) = xp_base * (n-1)^xp_exponent  (level 1 needs 0 XP)
    Enum.reduce_while(1..max_level, 1, fn level, acc ->
      threshold = round(xp_base * :math.pow(level - 1, xp_exponent))

      if total_xp >= threshold do
        {:cont, level}
      else
        {:halt, acc}
      end
    end)
  end

  @doc """
  Emits a log and broadcasts a level-up message to the character's session.
  Call after apply_xp/2 when events contains {:level_up, _, _}.
  """
  @spec broadcast_level_ups(Entity.t(), [level_up_event()]) :: :ok
  def broadcast_level_ups(_entity, []), do: :ok

  def broadcast_level_ups(%Entity{} = entity, events) do
    Enum.each(events, fn {:level_up, old_level, new_level} ->
      Logger.info("[Progression] #{entity.key} leveled up: #{old_level} → #{new_level}")

      Phoenix.PubSub.broadcast(
        Loka.PubSub,
        "entity:#{entity.id}",
        {:level_up, %{entity_id: entity.id, old_level: old_level, new_level: new_level}}
      )
    end)
  end
end
