defmodule Loka.Repo.Migrations.RenameBehaviorsToTraits do
  use Ecto.Migration

  def change do
    rename table(:entities), :behaviors, to: :traits
  end
end
