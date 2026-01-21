defmodule Loka.Framework.Spark.SparkEvent do
  @moduledoc """
  Ecto schema for Spark events - tracks world events for "while you were away" summaries.

  Events are recorded when significant things happen in the game world,
  then delivered to the player via their Spark when they return.
  """
  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query

  alias Loka.Repo
  alias Loka.Accounts.Player

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  # Event types
  @event_types ~w(
    time_event
    weather_event
    npc_activity
    quest_update
    zone_event
    world_event
    message
    achievement
  )

  schema "spark_events" do
    belongs_to :player, Player

    # Event classification
    field :event_type, :string
    field :event_key, :string
    field :summary, :string

    # Flexible event data
    field :details, :map, default: %{}

    # Timing
    field :occurred_at, :utc_datetime

    # Delivery tracking
    field :delivered, :boolean, default: false
    field :delivered_at, :utc_datetime

    timestamps()
  end

  def event_types, do: @event_types

  @doc """
  Create a new event for a player.
  """
  def create_changeset(attrs) do
    %__MODULE__{}
    |> cast(attrs, [:player_id, :event_type, :event_key, :summary, :details, :occurred_at])
    |> validate_required([:player_id, :event_type, :occurred_at])
    |> validate_inclusion(:event_type, @event_types)
    |> put_default_occurred_at()
  end

  defp put_default_occurred_at(changeset) do
    if get_field(changeset, :occurred_at) do
      changeset
    else
      put_change(changeset, :occurred_at, DateTime.utc_now() |> DateTime.truncate(:second))
    end
  end

  @doc """
  Mark an event as delivered.
  """
  def mark_delivered_changeset(event) do
    event
    |> change(%{
      delivered: true,
      delivered_at: DateTime.utc_now() |> DateTime.truncate(:second)
    })
  end

  # ============================================================================
  # Queries
  # ============================================================================

  @doc """
  Get undelivered events for a player, ordered by occurrence time.
  """
  def get_pending(player_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 20)
    since = Keyword.get(opts, :since)

    query =
      __MODULE__
      |> where([e], e.player_id == ^player_id)
      |> where([e], e.delivered == false)
      |> order_by([e], asc: e.occurred_at)
      |> limit(^limit)

    query =
      if since do
        where(query, [e], e.occurred_at > ^since)
      else
        query
      end

    Repo.all(query)
  end

  @doc """
  Count pending events for a player.
  """
  def count_pending(player_id) do
    __MODULE__
    |> where([e], e.player_id == ^player_id)
    |> where([e], e.delivered == false)
    |> Repo.aggregate(:count)
  end

  @doc """
  Get events by type for a player.
  """
  def get_by_type(player_id, event_type, opts \\ []) do
    limit = Keyword.get(opts, :limit, 10)
    delivered = Keyword.get(opts, :delivered)

    query =
      __MODULE__
      |> where([e], e.player_id == ^player_id)
      |> where([e], e.event_type == ^event_type)
      |> order_by([e], desc: e.occurred_at)
      |> limit(^limit)

    query =
      case delivered do
        nil -> query
        val -> where(query, [e], e.delivered == ^val)
      end

    Repo.all(query)
  end

  @doc """
  Mark all pending events as delivered for a player.
  Returns the number of events marked.
  """
  def mark_all_delivered(player_id) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    {count, _} =
      __MODULE__
      |> where([e], e.player_id == ^player_id)
      |> where([e], e.delivered == false)
      |> Repo.update_all(set: [delivered: true, delivered_at: now])

    count
  end

  @doc """
  Delete old delivered events (cleanup).
  """
  def cleanup_old_events(days_old \\ 30) do
    cutoff = DateTime.utc_now() |> DateTime.add(-days_old * 24 * 60 * 60, :second)

    {count, _} =
      __MODULE__
      |> where([e], e.delivered == true)
      |> where([e], e.delivered_at < ^cutoff)
      |> Repo.delete_all()

    count
  end

  # ============================================================================
  # Event Creation Helpers
  # ============================================================================

  @doc """
  Record a time event (dawn, dusk, etc.)
  """
  def record_time_event(player_id, phase, details \\ %{}) do
    create_event(player_id, %{
      event_type: "time_event",
      event_key: to_string(phase),
      summary: time_event_summary(phase),
      details: details
    })
  end

  @doc """
  Record a quest-related event.
  """
  def record_quest_event(player_id, quest_id, action, details \\ %{}) do
    create_event(player_id, %{
      event_type: "quest_update",
      event_key: "#{quest_id}:#{action}",
      summary: quest_event_summary(quest_id, action),
      details: Map.put(details, :quest_id, quest_id)
    })
  end

  @doc """
  Record a world event.
  """
  def record_world_event(player_id, event_key, summary, details \\ %{}) do
    create_event(player_id, %{
      event_type: "world_event",
      event_key: event_key,
      summary: summary,
      details: details
    })
  end

  @doc """
  Record an NPC activity event.
  """
  def record_npc_event(player_id, npc_key, activity, details \\ %{}) do
    create_event(player_id, %{
      event_type: "npc_activity",
      event_key: "#{npc_key}:#{activity}",
      summary: npc_event_summary(npc_key, activity),
      details: Map.put(details, :npc_key, npc_key)
    })
  end

  defp create_event(player_id, attrs) do
    attrs
    |> Map.put(:player_id, player_id)
    |> Map.put(:occurred_at, DateTime.utc_now() |> DateTime.truncate(:second))
    |> create_changeset()
    |> Repo.insert()
  end

  # Default summaries (can be overridden with custom summary)
  defp time_event_summary(:dawn), do: "Dawn broke over the mountains."
  defp time_event_summary(:dusk), do: "Dusk settled across the land."
  defp time_event_summary(:night), do: "Night fell, and the stars emerged."
  defp time_event_summary(:morning), do: "Morning light spread across the valley."
  defp time_event_summary(phase), do: "The time shifted to #{phase}."

  defp quest_event_summary(quest_id, :available), do: "A new opportunity awaits: #{quest_id}."
  defp quest_event_summary(quest_id, :updated), do: "Progress on #{quest_id}."
  defp quest_event_summary(quest_id, :completable), do: "#{quest_id} is ready to complete."
  defp quest_event_summary(quest_id, action), do: "#{quest_id}: #{action}."

  defp npc_event_summary(npc_key, :arrived), do: "#{npc_key} arrived."
  defp npc_event_summary(npc_key, :departed), do: "#{npc_key} departed."
  defp npc_event_summary(npc_key, activity), do: "#{npc_key}: #{activity}."
end
