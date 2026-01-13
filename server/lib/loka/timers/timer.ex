defmodule Loka.Timers.Timer do
  @moduledoc """
  Ecto schema for persistent game timers.

  Timers are stored in the database so they survive server restarts and
  continue running while players are offline. When a player reconnects,
  any completed but undelivered timers are sent to them.

  ## Timer Types

  - `:crafting` - Item crafting queue
  - `:gathering` - Offline resource gathering
  - `:quest` - Quest-related timers (cooldowns, delays)
  - `:cooldown` - Ability/action cooldowns

  ## Lifecycle

  1. Timer scheduled → stored in DB with `completes_at`
  2. Timer completes → `completed_at` set, try to deliver
  3. If player online → push event, set `delivered: true`
  4. If player offline → stays `delivered: false`
  5. On reconnect → deliver all undelivered completed timers
  """

  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query

  alias Loka.Repo

  @type timer_type :: :crafting | :gathering | :quest | :cooldown | atom()

  @primary_key {:id, :binary_id, autogenerate: true}
  schema "timers" do
    field :player_id, :integer
    field :timer_type, Ecto.Enum, values: [:crafting, :gathering, :quest, :cooldown]
    field :duration_ms, :integer
    field :scheduled_at, :utc_datetime_usec
    field :completes_at, :utc_datetime_usec
    field :completed_at, :utc_datetime_usec
    field :delivered, :boolean, default: false
    field :cancelled, :boolean, default: false
    field :data, :map, default: %{}

    timestamps(type: :utc_datetime_usec)
  end

  @doc """
  Creates a changeset for a new timer.
  """
  def changeset(timer, attrs) do
    timer
    |> cast(attrs, [
      :player_id,
      :timer_type,
      :duration_ms,
      :scheduled_at,
      :completes_at,
      :data
    ])
    |> validate_required([:player_id, :timer_type, :duration_ms, :scheduled_at, :completes_at])
  end

  @doc """
  Creates a new timer record.
  """
  def create(player_id, timer_type, duration_ms, data \\ %{}) do
    now = DateTime.utc_now()
    completes_at = DateTime.add(now, duration_ms, :millisecond)

    attrs = %{
      player_id: player_id,
      timer_type: timer_type,
      duration_ms: duration_ms,
      scheduled_at: now,
      completes_at: completes_at,
      data: data
    }

    %__MODULE__{}
    |> changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Marks a timer as completed.
  """
  def mark_completed(timer) do
    timer
    |> change(%{completed_at: DateTime.utc_now()})
    |> Repo.update()
  end

  @doc """
  Marks a timer as delivered to the player.
  """
  def mark_delivered(timer) do
    timer
    |> change(%{delivered: true})
    |> Repo.update()
  end

  @doc """
  Marks a timer as cancelled.
  """
  def mark_cancelled(timer) do
    timer
    |> change(%{cancelled: true})
    |> Repo.update()
  end

  @doc """
  Gets all pending (not completed, not cancelled) timers for a player.
  """
  def get_pending(player_id) do
    from(t in __MODULE__,
      where: t.player_id == ^player_id,
      where: is_nil(t.completed_at),
      where: t.cancelled == false,
      order_by: [asc: t.completes_at]
    )
    |> Repo.all()
  end

  @doc """
  Gets all pending timers across all players (for server startup).
  """
  def get_all_pending do
    from(t in __MODULE__,
      where: is_nil(t.completed_at),
      where: t.cancelled == false,
      order_by: [asc: t.completes_at]
    )
    |> Repo.all()
  end

  @doc """
  Gets completed but undelivered timers for a player.
  Used when player reconnects to catch up on offline progress.
  """
  def get_completed_undelivered(player_id) do
    from(t in __MODULE__,
      where: t.player_id == ^player_id,
      where: not is_nil(t.completed_at),
      where: t.delivered == false,
      where: t.cancelled == false,
      order_by: [asc: t.completed_at]
    )
    |> Repo.all()
  end

  @doc """
  Gets a timer by ID.
  """
  def get(timer_id) do
    Repo.get(__MODULE__, timer_id)
  end

  @doc """
  Calculates remaining time in milliseconds until completion.
  Returns 0 if already completed or past due.
  """
  def remaining_ms(%__MODULE__{completes_at: completes_at}) do
    now = DateTime.utc_now()
    diff = DateTime.diff(completes_at, now, :millisecond)
    max(0, diff)
  end

  @doc """
  Checks if a timer is past its completion time.
  """
  def past_due?(%__MODULE__{completes_at: completes_at}) do
    DateTime.compare(DateTime.utc_now(), completes_at) != :lt
  end
end
