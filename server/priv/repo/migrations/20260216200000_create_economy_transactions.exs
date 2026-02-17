defmodule Loka.Repo.Migrations.CreateEconomyTransactions do
  use Ecto.Migration

  def change do
    create table(:economy_transactions) do
      add :type, :string, null: false
      add :category, :string, null: false
      add :entity_id, :binary_id, null: false
      add :amount, :integer, null: false
      add :meta, :text, default: "{}"
      timestamps(type: :utc_datetime, updated_at: false)
    end

    create index(:economy_transactions, [:type])
    create index(:economy_transactions, [:category])
    create index(:economy_transactions, [:entity_id])
    create index(:economy_transactions, [:inserted_at])
    create index(:economy_transactions, [:entity_id, :inserted_at])
  end
end
