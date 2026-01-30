defmodule Loka.Admin.AuditLog do
  @moduledoc """
  Ecto schema for audit log entries.

  Tracks admin actions in World Builder with before/after state snapshots
  for compliance and debugging purposes.

  ## Fields

  - `:player_id` - The admin who performed the action
  - `:action` - The action type (create, update, delete, batch_*)
  - `:entity_type` - Type of entity affected (room, npc, item, etc.)
  - `:entity_key` - The unique key of the affected entity
  - `:before_state` - State snapshot before the change (nil for creates)
  - `:after_state` - State snapshot after the change (nil for deletes)
  - `:metadata` - Additional context (batch size, tool name, etc.)
  - `:ip_address` - Request IP for security audit
  - `:user_agent` - Browser/client info

  ## Query Helpers

      # Get recent logs
      AuditLog.recent(50)

      # Filter by entity
      AuditLog.by_entity(:room, "tavern_main")

      # Filter by player
      AuditLog.by_player(player_id)

      # Chain queries
      AuditLog
      |> AuditLog.by_entity(:npc)
      |> AuditLog.recent(20)
      |> Repo.all()
  """
  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :id

  @actions ~w(create update delete batch_create batch_update batch_delete)
  @entity_types ~w(room npc item quest dialogue script cutscene template zone)

  schema "audit_logs" do
    belongs_to :player, Loka.Accounts.Player
    field :action, :string
    field :entity_type, :string
    field :entity_key, :string
    field :before_state, :map
    field :after_state, :map
    field :metadata, :map, default: %{}
    field :ip_address, :string
    field :user_agent, :string

    timestamps(type: :utc_datetime_usec, updated_at: false)
  end

  @doc """
  Creates a changeset for inserting a new audit log entry.
  """
  def changeset(audit_log, attrs) do
    audit_log
    |> cast(attrs, [
      :player_id,
      :action,
      :entity_type,
      :entity_key,
      :before_state,
      :after_state,
      :metadata,
      :ip_address,
      :user_agent
    ])
    |> validate_required([:action, :entity_type])
    |> validate_inclusion(:action, @actions)
    |> validate_inclusion(:entity_type, @entity_types)
    |> foreign_key_constraint(:player_id)
  end

  @doc """
  Returns allowed action types.
  """
  def actions, do: @actions

  @doc """
  Returns allowed entity types.
  """
  def entity_types, do: @entity_types

  # Query Helpers

  @doc """
  Filters logs by player ID.

  ## Examples

      AuditLog.by_player(player_id) |> Repo.all()
  """
  def by_player(query \\ __MODULE__, player_id) do
    from(a in query, where: a.player_id == ^player_id)
  end

  @entity_type_atoms [:room, :npc, :item, :quest, :dialogue, :script, :cutscene, :template, :zone]

  @doc """
  Filters logs by entity type and optionally entity key.

  ## Examples

      AuditLog.by_entity(:room) |> Repo.all()
      AuditLog.by_entity(:npc, "guard_captain") |> Repo.all()
      AuditLog |> AuditLog.by_entity(:room) |> Repo.all()
  """
  def by_entity(entity_type) when entity_type in @entity_type_atoms do
    by_entity(__MODULE__, entity_type, nil)
  end

  def by_entity(entity_type, entity_key)
      when entity_type in @entity_type_atoms and is_binary(entity_key) do
    by_entity(__MODULE__, entity_type, entity_key)
  end

  def by_entity(query, entity_type) when entity_type in @entity_type_atoms do
    by_entity(query, entity_type, nil)
  end

  def by_entity(query, entity_type, entity_key) do
    entity_type_str = to_string(entity_type)

    query = from(a in query, where: a.entity_type == ^entity_type_str)

    if entity_key do
      from(a in query, where: a.entity_key == ^entity_key)
    else
      query
    end
  end

  @doc """
  Filters logs by action type.

  ## Examples

      AuditLog.by_action(:create) |> Repo.all()
      AuditLog.by_action(:delete) |> Repo.all()
  """
  def by_action(query \\ __MODULE__, action) do
    action_str = to_string(action)
    from(a in query, where: a.action == ^action_str)
  end

  @doc """
  Returns recent logs, ordered by inserted_at descending.

  ## Examples

      AuditLog.recent(50) |> Repo.all()
      AuditLog.recent() |> Repo.all()  # defaults to 100
      AuditLog |> AuditLog.recent(10) |> Repo.all()
  """
  def recent do
    recent(__MODULE__, 100)
  end

  def recent(limit) when is_integer(limit) do
    recent(__MODULE__, limit)
  end

  def recent(query, limit) when is_integer(limit) do
    from(a in query,
      order_by: [desc: a.inserted_at],
      limit: ^limit
    )
  end

  @doc """
  Filters logs between two dates (inclusive).

  ## Examples

      start_date = ~U[2026-01-01 00:00:00Z]
      end_date = ~U[2026-01-31 23:59:59Z]
      AuditLog.between_dates(start_date, end_date) |> Repo.all()
  """
  def between_dates(query \\ __MODULE__, start_date, end_date) do
    from(a in query,
      where: a.inserted_at >= ^start_date and a.inserted_at <= ^end_date
    )
  end

  @doc """
  Preloads the player association.

  ## Examples

      AuditLog.recent(10) |> AuditLog.with_player() |> Repo.all()
  """
  def with_player(query \\ __MODULE__) do
    from(a in query, preload: [:player])
  end
end
