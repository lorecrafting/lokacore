defmodule Loka.Primitives.Timer do
  @moduledoc """
  Pure data structure for duration and expiration tracking.

  This is a primitive - no game logic, just data operations with audit trails.
  Timer tracks start time, duration, and provides expiration checking.

  ## Structure

      %Timer{
        started_at: 1704067200000,  # milliseconds
        duration_ms: 5000,           # 5 seconds
        paused_at: nil               # nil if running
      }

  ## Usage

      alias Loka.Primitives.Timer

      # Create a timer
      timer = Timer.new(5000)  # 5 second timer
      timer = Timer.new_seconds(30)
      timer = Timer.new_minutes(5)

      # Check status
      Timer.expired?(timer)         # => false
      Timer.remaining_ms(timer)     # => 4500
      Timer.elapsed_ms(timer)       # => 500
      Timer.progress(timer)         # => 0.1

      # Pause/resume
      {:ok, timer, audit} = Timer.pause(timer)
      {:ok, timer, audit} = Timer.resume(timer)

      # Reset
      {:ok, timer, audit} = Timer.reset(timer)
      {:ok, timer, audit} = Timer.reset(timer, 10000)  # new duration
  """

  @type t :: %__MODULE__{
          started_at: integer(),
          duration_ms: integer(),
          paused_at: integer() | nil
        }

  @type audit :: %{
          operation: atom(),
          timer_state: :running | :paused | :expired,
          remaining_ms: integer(),
          timestamp: integer()
        }

  defstruct started_at: 0, duration_ms: 0, paused_at: nil

  # =============================================================================
  # Construction
  # =============================================================================

  @doc """
  Creates a new Timer with the given duration in milliseconds.

  ## Examples

      Timer.new(5000)  # 5 second timer, starts immediately
  """
  @spec new(integer()) :: t()
  def new(duration_ms) when is_integer(duration_ms) and duration_ms >= 0 do
    %__MODULE__{
      started_at: now(),
      duration_ms: duration_ms,
      paused_at: nil
    }
  end

  @doc """
  Creates a Timer with duration in seconds.
  """
  @spec new_seconds(number()) :: t()
  def new_seconds(seconds) do
    new(trunc(seconds * 1000))
  end

  @doc """
  Creates a Timer with duration in minutes.
  """
  @spec new_minutes(number()) :: t()
  def new_minutes(minutes) do
    new(trunc(minutes * 60 * 1000))
  end

  @doc """
  Creates a Timer that expires at a specific timestamp.
  """
  @spec new_until(integer()) :: t()
  def new_until(expires_at) when is_integer(expires_at) do
    current = now()
    duration = max(0, expires_at - current)

    %__MODULE__{
      started_at: current,
      duration_ms: duration,
      paused_at: nil
    }
  end

  @doc """
  Creates an already-expired timer (useful for "instant" or "no cooldown").
  """
  @spec expired() :: t()
  def expired do
    %__MODULE__{
      started_at: 0,
      duration_ms: 0,
      paused_at: nil
    }
  end

  @doc """
  Creates a Timer from a map (for loading from database).
  """
  @spec from_map(map()) :: t()
  def from_map(data) when is_map(data) do
    %__MODULE__{
      started_at: get_flexible(data, :started_at, now()),
      duration_ms: get_flexible(data, :duration_ms, 0),
      paused_at: get_flexible(data, :paused_at, nil)
    }
  end

  # =============================================================================
  # Operations
  # =============================================================================

  @doc """
  Pauses the timer.

  When paused, remaining time is frozen until resumed.
  """
  @spec pause(t()) :: {:ok, t(), audit()}
  def pause(%__MODULE__{paused_at: nil} = timer) do
    paused_timer = %{timer | paused_at: now()}

    audit = %{
      operation: :pause,
      timer_state: :paused,
      remaining_ms: remaining_ms(paused_timer),
      timestamp: now()
    }

    {:ok, paused_timer, audit}
  end

  def pause(%__MODULE__{} = timer) do
    # Already paused
    audit = %{
      operation: :pause,
      timer_state: :paused,
      remaining_ms: remaining_ms(timer),
      timestamp: now()
    }

    {:ok, timer, audit}
  end

  @doc """
  Resumes a paused timer.

  The timer continues from where it was paused.
  """
  @spec resume(t()) :: {:ok, t(), audit()}
  def resume(%__MODULE__{paused_at: paused_at} = timer) when not is_nil(paused_at) do
    # Calculate how long we were paused and adjust started_at
    pause_duration = now() - paused_at
    resumed_timer = %{timer | started_at: timer.started_at + pause_duration, paused_at: nil}

    state = if expired?(resumed_timer), do: :expired, else: :running

    audit = %{
      operation: :resume,
      timer_state: state,
      remaining_ms: remaining_ms(resumed_timer),
      timestamp: now()
    }

    {:ok, resumed_timer, audit}
  end

  def resume(%__MODULE__{} = timer) do
    # Not paused
    state = if expired?(timer), do: :expired, else: :running

    audit = %{
      operation: :resume,
      timer_state: state,
      remaining_ms: remaining_ms(timer),
      timestamp: now()
    }

    {:ok, timer, audit}
  end

  @doc """
  Resets the timer, optionally with a new duration.
  """
  @spec reset(t(), integer() | nil) :: {:ok, t(), audit()}
  def reset(%__MODULE__{} = timer, new_duration_ms \\ nil) do
    duration = new_duration_ms || timer.duration_ms

    reset_timer = %__MODULE__{
      started_at: now(),
      duration_ms: duration,
      paused_at: nil
    }

    audit = %{
      operation: :reset,
      timer_state: :running,
      remaining_ms: duration,
      timestamp: now()
    }

    {:ok, reset_timer, audit}
  end

  @doc """
  Extends the timer by adding more time.
  """
  @spec extend(t(), integer()) :: {:ok, t(), audit()}
  def extend(%__MODULE__{} = timer, additional_ms) when additional_ms >= 0 do
    extended_timer = %{timer | duration_ms: timer.duration_ms + additional_ms}

    state = if expired?(extended_timer), do: :expired, else: :running

    audit = %{
      operation: :extend,
      timer_state: state,
      remaining_ms: remaining_ms(extended_timer),
      timestamp: now()
    }

    {:ok, extended_timer, audit}
  end

  @doc """
  Reduces the timer by removing time.
  """
  @spec reduce(t(), integer()) :: {:ok, t(), audit()}
  def reduce(%__MODULE__{} = timer, reduce_ms) when reduce_ms >= 0 do
    new_duration = max(0, timer.duration_ms - reduce_ms)
    reduced_timer = %{timer | duration_ms: new_duration}

    state = if expired?(reduced_timer), do: :expired, else: :running

    audit = %{
      operation: :reduce,
      timer_state: state,
      remaining_ms: remaining_ms(reduced_timer),
      timestamp: now()
    }

    {:ok, reduced_timer, audit}
  end

  # =============================================================================
  # Queries
  # =============================================================================

  @doc """
  Returns true if the timer has expired.
  """
  @spec expired?(t()) :: boolean()
  def expired?(%__MODULE__{paused_at: paused_at} = timer) when not is_nil(paused_at) do
    # When paused, check if it was expired at pause time
    elapsed = paused_at - timer.started_at
    elapsed >= timer.duration_ms
  end

  def expired?(%__MODULE__{} = timer) do
    elapsed_ms(timer) >= timer.duration_ms
  end

  @doc """
  Returns true if the timer is currently running (not paused, not expired).
  """
  @spec running?(t()) :: boolean()
  def running?(%__MODULE__{} = timer) do
    not paused?(timer) and not expired?(timer)
  end

  @doc """
  Returns true if the timer is paused.
  """
  @spec paused?(t()) :: boolean()
  def paused?(%__MODULE__{paused_at: paused_at}) do
    not is_nil(paused_at)
  end

  @doc """
  Returns elapsed time in milliseconds.
  """
  @spec elapsed_ms(t()) :: integer()
  def elapsed_ms(%__MODULE__{paused_at: paused_at} = timer) when not is_nil(paused_at) do
    paused_at - timer.started_at
  end

  def elapsed_ms(%__MODULE__{} = timer) do
    now() - timer.started_at
  end

  @doc """
  Returns remaining time in milliseconds (0 if expired).
  """
  @spec remaining_ms(t()) :: integer()
  def remaining_ms(%__MODULE__{} = timer) do
    max(0, timer.duration_ms - elapsed_ms(timer))
  end

  @doc """
  Returns remaining time in seconds.
  """
  @spec remaining_seconds(t()) :: float()
  def remaining_seconds(%__MODULE__{} = timer) do
    remaining_ms(timer) / 1000
  end

  @doc """
  Returns the progress as a float from 0.0 to 1.0.
  """
  @spec progress(t()) :: float()
  def progress(%__MODULE__{duration_ms: 0}), do: 1.0

  def progress(%__MODULE__{} = timer) do
    min(1.0, elapsed_ms(timer) / timer.duration_ms)
  end

  @doc """
  Returns the expiration timestamp (started_at + duration_ms).
  """
  @spec expires_at(t()) :: integer()
  def expires_at(%__MODULE__{} = timer) do
    timer.started_at + timer.duration_ms
  end

  @doc """
  Returns the current state of the timer.
  """
  @spec state(t()) :: :running | :paused | :expired
  def state(%__MODULE__{} = timer) do
    cond do
      paused?(timer) -> :paused
      expired?(timer) -> :expired
      true -> :running
    end
  end

  @doc """
  Converts the timer to a map (for serialization).
  """
  @spec to_map(t()) :: map()
  def to_map(%__MODULE__{} = timer) do
    %{
      "started_at" => timer.started_at,
      "duration_ms" => timer.duration_ms,
      "paused_at" => timer.paused_at,
      "remaining_ms" => remaining_ms(timer),
      "state" => to_string(state(timer))
    }
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp now do
    System.system_time(:millisecond)
  end

  defp get_flexible(map, key, default) when is_atom(key) do
    Map.get(map, key) || Map.get(map, to_string(key)) || default
  end
end
