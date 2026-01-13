defmodule Loka.Timers do
  @moduledoc """
  Persistent timer service for crafting queues, offline progression, and more.

  Timers scheduled through this module survive server restarts and continue
  running while players are offline. When a timer completes:

  - If player is online → delivered immediately via Session
  - If player is offline → delivered when they reconnect

  ## Timer Types

  | Type | Description |
  |------|-------------|
  | `:crafting` | Item crafting with duration |
  | `:gathering` | Offline resource gathering |
  | `:quest` | Quest-related timers |
  | `:cooldown` | Ability/action cooldowns |

  ## Examples

      # Schedule a crafting timer (30 seconds)
      {:ok, timer} = Loka.Timers.schedule(player_id, :crafting, 30_000, %{
        recipe_key: "iron_sword",
        outputs: [%{item: "iron_sword", quantity: 1}]
      })

      # Cancel a timer
      :ok = Loka.Timers.cancel(timer.id)

      # Get active timers for UI
      timers = Loka.Timers.get_active(player_id)

      # On reconnect, get offline completions
      completed = Loka.Timers.get_completed_undelivered(player_id)
      Loka.Timers.mark_delivered(completed)

  ## Integration with GameChannel

  GameChannel should call `get_completed_undelivered/1` on join and push
  any completed timers to the client, then call `mark_delivered/1`.

  The timer completion message format is:
  ```
  {:timer_completed, %{
    timer_id: "...",
    timer_type: :crafting,
    data: %{recipe_key: "iron_sword", outputs: [...]},
    scheduled_at: ~U[...],
    completed_at: ~U[...]
  }}
  ```
  """

  alias Loka.Timers.{Server, Timer}

  @type timer_type :: :crafting | :gathering | :quest | :cooldown

  @doc """
  Schedule a new timer.

  ## Parameters

  - `player_id` - The player's ID
  - `timer_type` - Type of timer
  - `duration_ms` - How long until completion (milliseconds)
  - `data` - Timer-specific data (optional)

  ## Examples

      # 30-second crafting timer
      Loka.Timers.schedule(player_id, :crafting, 30_000, %{recipe_key: "iron_sword"})

      # 5-minute gathering timer
      Loka.Timers.schedule(player_id, :gathering, 300_000, %{resource: "iron_ore", amount: 10})
  """
  @spec schedule(String.t(), timer_type(), integer(), map()) ::
          {:ok, Timer.t()} | {:error, term()}
  defdelegate schedule(player_id, timer_type, duration_ms, data \\ %{}), to: Server

  @doc """
  Cancel a timer by ID.

  Returns `:ok` if cancelled, `{:error, :not_found}` if timer doesn't exist.
  """
  @spec cancel(String.t()) :: :ok | {:error, :not_found}
  defdelegate cancel(timer_id), to: Server

  @doc """
  Get all active (pending) timers for a player.

  Returns timers sorted by completion time.
  """
  @spec get_active(String.t()) :: [Timer.t()]
  defdelegate get_active(player_id), to: Server

  @doc """
  Get completed but undelivered timers for a player.

  Use this when a player reconnects to catch them up on offline progress.
  """
  @spec get_completed_undelivered(String.t()) :: [Timer.t()]
  defdelegate get_completed_undelivered(player_id), to: Server

  @doc """
  Mark timers as delivered to the player.

  Call this after successfully pushing timer completions to the client.
  """
  @spec mark_delivered([Timer.t()]) :: :ok
  defdelegate mark_delivered(timers), to: Server
end
