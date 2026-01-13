defmodule Loka.Repo.Migrations.AddSettingsToPlayerGameStates do
  use Ecto.Migration

  @default_settings Jason.encode!(%{
                      reduced_motion: false,
                      high_contrast: false,
                      font_size: "normal",
                      auto_combat: false
                    })

  def change do
    alter table(:player_game_states) do
      add :settings, :text, default: @default_settings
    end
  end
end
