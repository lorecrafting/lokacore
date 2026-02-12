defmodule Loka.Repo.Migrations.MigratePlayersToEntities do
  @moduledoc """
  Migrates player_game_states data to character entities.

  For each player_game_states row with a character_name, creates a character
  entity in the entities table with components derived from the game state fields.

  Pre-production: fresh DBs will have no data to migrate.
  """
  use Ecto.Migration

  def up do
    # Read all player_game_states with character names
    rows =
      repo().query!("""
      SELECT gs.id, gs.player_id, gs.character_name, gs.gender, gs.background,
             gs.inventory, gs.equipment, gs.quests, gs.flags, gs.stats,
             gs.health, gs.resources, gs.skills, gs.settings, gs.current_room_id
      FROM player_game_states gs
      WHERE gs.character_name IS NOT NULL AND gs.character_name != ''
      """)

    now =
      DateTime.utc_now()
      |> DateTime.truncate(:second)
      |> DateTime.to_iso8601()

    for row <- rows.rows do
      [
        _gs_id,
        player_id,
        character_name,
        gender,
        background,
        inventory_json,
        equipment_json,
        quests_json,
        flags_json,
        stats_json,
        health_json,
        resources_json,
        skills_json,
        settings_json,
        current_room_id
      ] = row

      entity_id = Ecto.UUID.generate()

      components =
        Jason.encode!(%{
          "player" => %{
            "settings" => safe_decode(settings_json),
            "gender" => gender,
            "background" => background
          },
          "combatant" => build_combatant(health_json, resources_json),
          "stats" => safe_decode(stats_json),
          "quest_progress" => safe_decode(quests_json),
          "resources" => safe_decode(resources_json),
          "skills" => safe_decode(skills_json),
          "equipment" => safe_decode(equipment_json),
          "inventory" => safe_decode(inventory_json),
          "flags" => safe_decode(flags_json)
        })

      repo().query!(
        """
        INSERT INTO entities (id, type, key, short_desc, account_id, location_id,
                              is_prototype, version, components, behaviors, scripts,
                              metadata, keywords, inserted_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
        """,
        [
          entity_id,
          "character",
          "player_#{String.downcase(character_name)}",
          character_name,
          player_id,
          current_room_id,
          false,
          1,
          components,
          "[]",
          "{}",
          Jason.encode!(%{"migrated_from" => "player_game_states"}),
          Jason.encode!([String.downcase(character_name)]),
          now,
          now
        ]
      )

      # Add "playable" tag
      repo().query!(
        "INSERT INTO entity_tags (entity_id, tag) VALUES (?1, ?2)",
        [entity_id, "playable"]
      )
    end
  end

  def down do
    # Remove migrated character entities
    repo().query!("""
    DELETE FROM entities
    WHERE type = 'character' AND metadata LIKE '%migrated_from%player_game_states%'
    """)
  end

  defp safe_decode(nil), do: %{}
  defp safe_decode(""), do: %{}

  defp safe_decode(json) when is_binary(json) do
    case Jason.decode(json) do
      {:ok, data} -> data
      _ -> %{}
    end
  end

  defp safe_decode(data) when is_map(data), do: data
  defp safe_decode(data) when is_list(data), do: data
  defp safe_decode(_), do: %{}

  defp build_combatant(health_json, resources_json) do
    health = safe_decode(health_json)
    resources = safe_decode(resources_json)
    resource_health = resources["health"] || %{}

    %{
      "health" => resource_health["current"] || health["current"] || 100,
      "max_health" => resource_health["max"] || health["max"] || 100
    }
  end
end
