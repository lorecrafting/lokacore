defmodule LokaWeb.TestSessionController do
  @moduledoc """
  Test-only session controller for E2E testing.

  Provides a browser-based login endpoint that properly sets signed cookies,
  bypassing the magic link flow for automated testing.

  ## Security

  This controller is ONLY available in dev/test environments.
  The router conditionally mounts these routes based on Mix.env().
  Additionally, a runtime check prevents access in production.
  """

  use LokaWeb, :controller

  plug :require_non_production

  alias Loka.Accounts
  alias Loka.Engine.Entity
  alias Loka.Engine.Entities
  alias LokaWeb.PlayerAuth

  # Dedicated test email for E2E tests
  @test_email "e2e-test@loka.test"

  # Default test character name
  @test_character_name "TestHero"

  # Starting room for test player
  @starting_room_key "awakening_clearing"

  # Test player stats for faster combat (bosses are level 4 with attack 14-18)
  @test_player_stats %{
    "str" => 30,
    "dex" => 20,
    "sta" => 30,
    "level" => 5,
    "xp" => 0,
    "skill_points" => 0
  }
  @test_player_health %{"current" => 200, "max" => 200}

  @doc """
  Resets and logs in the test player with a ready-to-play character.

  GET /test/login

  This:
  1. Creates the test player if it doesn't exist
  2. Deletes existing character entity (resets progress)
  3. Creates a new character entity (bypassing character creation screen)
  4. Logs the player in with proper session cookies
  5. Redirects to /game

  The response sets the proper signed session cookie that Phoenix expects.
  """
  def login(conn, _params) do
    # Get or create the dedicated test player
    player = get_or_create_test_player()

    # Delete existing character entity (resets all progress)
    delete_character_entity(player.id)

    # Reset world items to their original locations (for repeatable tests)
    reset_world_items()

    # Create fresh character entity with test stats
    create_test_character(player)

    # Log in using Phoenix's proper session handling (sets signed cookies)
    PlayerAuth.log_in_player(conn, player, %{"remember_me" => "true"})
  end

  # Creates a test character entity with boosted stats for faster E2E testing.
  # Also skips the intro cutscene by setting the seen_intro flag
  # And places the player at the starting room (awakening_clearing)
  defp create_test_character(player) do
    starting_room_id =
      case Entities.get_entity_by_key(@starting_room_key) do
        %{id: id} -> id
        nil -> nil
      end

    entity =
      Entity.new(
        type: :character,
        key: "player_#{String.downcase(@test_character_name)}",
        short_desc: @test_character_name,
        account_id: player.id,
        location_id: starting_room_id,
        components: %{
          "player" => %{
            "settings" => %{},
            "gender" => "they/them",
            "background" => "pilgrim"
          },
          "combatant" => %{"health" => 200, "max_health" => 200},
          "stats" => @test_player_stats,
          "quest_progress" => %{},
          "resources" => %{"health" => @test_player_health},
          "skills" => %{},
          "equipment" => %{},
          "inventory" => [],
          "flags" => %{"seen_intro" => true}
        },
        tags: ["playable"],
        keywords: [String.downcase(@test_character_name)]
      )

    Entities.save(entity)
  end

  # Delete existing character entity for a player
  defp delete_character_entity(player_id) do
    case Entities.find_one(account_id: player_id) do
      {:ok, character} -> Entities.delete_entity(character.id)
      {:error, :not_found} -> :ok
    end
  end

  # Resets quest items to their original room locations for repeatable E2E tests
  # This is needed because picking up items sets their location_id to nil
  defp reset_world_items do
    # Map of item_key -> room_key (items that need to be reset)
    item_locations = %{}

    Enum.each(item_locations, fn {item_key, room_key} ->
      case {Entities.get_entity_by_key(item_key), Entities.get_entity_by_key(room_key)} do
        {%{id: item_id}, %{id: room_id}} ->
          # Update item's location directly in DB
          Loka.Repo.query!(
            "UPDATE entities SET location_id = $1 WHERE id = $2",
            [room_id, item_id]
          )

        _ ->
          :ok
      end
    end)
  end

  # Handles race condition where multiple parallel tests try to create the same player
  defp get_or_create_test_player do
    case Accounts.get_player_by_email(@test_email) do
      nil ->
        case Accounts.register_player(%{email: @test_email}) do
          {:ok, player} ->
            player

          {:error, _changeset} ->
            # Race condition - another process created it first, just fetch
            Accounts.get_player_by_email(@test_email)
        end

      existing ->
        existing
    end
  end

  defp require_non_production(conn, _opts) do
    env = Application.get_env(:loka, :env)

    if env == :prod do
      conn
      |> put_resp_content_type("text/plain")
      |> send_resp(403, "Test endpoints are not available in production")
      |> halt()
    else
      conn
    end
  end
end
