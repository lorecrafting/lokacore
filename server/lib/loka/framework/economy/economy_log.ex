defmodule Loka.Framework.Economy.EconomyLog do
  @moduledoc """
  Append-only transaction log for the economy system.

  Every mint, burn, and transfer is recorded here for auditing,
  reporting, and economic monitoring. Records are never updated or deleted.

  ## Schema

      economy_transactions
      ├── id (auto-increment)
      ├── type ("faucet" | "sink" | "transfer")
      ├── category (e.g., "mob_kill", "quest_reward", "repair", "trade")
      ├── entity_id (UUID of the entity whose wallet changed)
      ├── amount (positive integer)
      ├── meta (JSON — extra context like mob key, quest key, etc.)
      └── inserted_at (UTC timestamp)
  """

  use Ecto.Schema
  import Ecto.Query
  require Logger

  alias Loka.Repo

  @type transaction_type :: :faucet | :sink | :transfer

  schema "economy_transactions" do
    field :type, :string
    field :category, :string
    field :entity_id, :binary_id
    field :amount, :integer
    field :meta, :map, default: %{}
    timestamps(type: :utc_datetime, updated_at: false)
  end

  @doc """
  Appends a transaction to the log. Fire-and-forget — errors are logged, not raised.
  """
  @spec append(transaction_type(), atom() | String.t(), String.t(), pos_integer(), map()) :: :ok
  def append(type, category, entity_id, amount, meta \\ %{}) do
    %__MODULE__{
      type: to_string(type),
      category: to_string(category),
      entity_id: entity_id,
      amount: amount,
      meta: meta
    }
    |> Repo.insert()
    |> case do
      {:ok, _} ->
        :ok

      {:error, reason} ->
        Logger.warning("Economy log insert failed: #{inspect(reason)}")
        :ok
    end
  end

  @doc """
  Returns a daily summary for the given date.

  Returns `%{faucets: %{category => total}, sinks: %{category => total},
            total_minted: integer, total_burned: integer, net_flow: integer}`.
  """
  @spec daily_summary(Date.t()) :: map()
  def daily_summary(date \\ Date.utc_today()) do
    start_of_day = DateTime.new!(date, ~T[00:00:00], "Etc/UTC")
    end_of_day = DateTime.new!(Date.add(date, 1), ~T[00:00:00], "Etc/UTC")

    rows =
      from(t in __MODULE__,
        where: t.inserted_at >= ^start_of_day and t.inserted_at < ^end_of_day,
        group_by: [t.type, t.category],
        select: {t.type, t.category, sum(t.amount)}
      )
      |> Repo.all()

    faucets =
      rows
      |> Enum.filter(fn {type, _, _} -> type == "faucet" end)
      |> Map.new(fn {_, cat, total} -> {cat, total} end)

    sinks =
      rows
      |> Enum.filter(fn {type, _, _} -> type == "sink" end)
      |> Map.new(fn {_, cat, total} -> {cat, total} end)

    total_minted = faucets |> Map.values() |> Enum.sum()
    total_burned = sinks |> Map.values() |> Enum.sum()

    %{
      date: date,
      faucets: faucets,
      sinks: sinks,
      total_minted: total_minted,
      total_burned: total_burned,
      net_flow: total_minted - total_burned
    }
  end

  @doc """
  Returns total money ever minted and burned across all time.
  """
  @spec totals() :: %{total_minted: integer(), total_burned: integer(), net: integer()}
  def totals do
    minted =
      from(t in __MODULE__, where: t.type == "faucet", select: sum(t.amount))
      |> Repo.one() || 0

    burned =
      from(t in __MODULE__, where: t.type == "sink", select: sum(t.amount))
      |> Repo.one() || 0

    %{total_minted: minted, total_burned: burned, net: minted - burned}
  end

  @doc """
  Returns recent transactions for an entity (most recent first).
  """
  @spec recent(String.t(), pos_integer()) :: [%__MODULE__{}]
  def recent(entity_id, limit \\ 20) do
    from(t in __MODULE__,
      where: t.entity_id == ^entity_id,
      order_by: [desc: t.inserted_at],
      limit: ^limit
    )
    |> Repo.all()
  end
end
