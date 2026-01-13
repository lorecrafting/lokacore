defmodule Loka.Repo.Migrations.AddPrimaryKeywordToEntities do
  use Ecto.Migration

  def change do
    alter table(:entities) do
      add :primary_keyword, :string
    end
  end
end
