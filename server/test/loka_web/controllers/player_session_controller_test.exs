defmodule LokaWeb.PlayerSessionControllerTest do
  use LokaWeb.ConnCase

  import Loka.AccountsFixtures
  alias Loka.Accounts
  alias Loka.Framework.Player.GameState

  setup do
    player = player_fixture()
    unconfirmed_player = unconfirmed_player_fixture()

    # Helper to create character for a player
    create_character = fn player_id ->
      {:ok, game_state} = GameState.create_state(player_id)

      random_suffix =
        :crypto.strong_rand_bytes(6)
        |> Base.encode32()
        |> String.replace(~r/[^A-Za-z]/, "")
        |> String.slice(0, 6)

      changeset =
        GameState.character_creation_changeset(game_state, %{
          character_name: "TestPlayer#{random_suffix}",
          gender: "they/them",
          background: "scholar"
        })

      {:ok, _game_state} = Loka.Repo.update(changeset)
    end

    # Create character for both players
    create_character.(player.id)
    create_character.(unconfirmed_player.id)

    %{unconfirmed_player: unconfirmed_player, player: player}
  end

  describe "GET /players/log-in" do
    test "renders login page", %{conn: conn} do
      conn = get(conn, ~p"/players/log-in")
      response = html_response(conn, 200)
      assert response =~ "Enter the World"
      assert response =~ ~p"/players/register"
      assert response =~ "Send magic link"
    end

    test "renders login page with email filled in (sudo mode)", %{conn: conn, player: player} do
      html =
        conn
        |> log_in_player(player)
        |> get(~p"/players/log-in")
        |> html_response(200)

      assert html =~ "You need to reauthenticate"
      refute html =~ "Register"
      assert html =~ "Send magic link"

      assert html =~
               ~s(<input type="email" name="player[email]" value="#{player.email}")
    end

    test "renders login page (magic link mode)", %{conn: conn} do
      conn = get(conn, ~p"/players/log-in")
      response = html_response(conn, 200)
      assert response =~ "Enter the World"
      assert response =~ ~p"/players/register"
      assert response =~ "Send magic link"
    end
  end

  describe "GET /players/log-in/:token" do
    test "auto-logs in and confirms unconfirmed player", %{
      conn: conn,
      unconfirmed_player: player
    } do
      refute player.confirmed_at

      token =
        extract_player_token(fn url ->
          Accounts.deliver_login_instructions(player, url)
        end)

      conn = get(conn, ~p"/players/log-in/#{token}")
      # Mobile-first design: login redirects back to login page
      assert redirected_to(conn) == ~p"/players/log-in"
      assert get_session(conn, :player_token)
      assert Phoenix.Flash.get(conn.assigns.flash, :info) =~ "Account confirmed successfully"

      # Player should now be confirmed
      assert Accounts.get_player!(player.id).confirmed_at
    end

    test "auto-logs in confirmed player with remember_me", %{conn: conn, player: player} do
      token =
        extract_player_token(fn url ->
          Accounts.deliver_login_instructions(player, url)
        end)

      conn = get(conn, ~p"/players/log-in/#{token}")
      # Mobile-first design: login redirects back to login page
      assert redirected_to(conn) == ~p"/players/log-in"
      assert get_session(conn, :player_token)
      assert conn.resp_cookies["_loka_web_player_remember_me"]
      assert Phoenix.Flash.get(conn.assigns.flash, :info) =~ "Welcome back!"
    end

    test "raises error for invalid token", %{conn: conn} do
      conn = get(conn, ~p"/players/log-in/invalid-token")
      assert redirected_to(conn) == ~p"/players/log-in"

      assert Phoenix.Flash.get(conn.assigns.flash, :error) ==
               "Magic link is invalid or it has expired."
    end
  end

  describe "POST /players/log-in - email and password" do
    test "logs the player in", %{conn: conn, player: player} do
      player = set_password(player)

      conn =
        post(conn, ~p"/players/log-in", %{
          "player" => %{"email" => player.email, "password" => valid_player_password()}
        })

      assert get_session(conn, :player_token)
      # Mobile-first design: login redirects back to login page
      assert redirected_to(conn) == ~p"/players/log-in"
    end

    test "logs the player in with remember me", %{conn: conn, player: player} do
      player = set_password(player)

      conn =
        post(conn, ~p"/players/log-in", %{
          "player" => %{
            "email" => player.email,
            "password" => valid_player_password(),
            "remember_me" => "true"
          }
        })

      assert conn.resp_cookies["_loka_web_player_remember_me"]
      # Mobile-first design: login redirects back to login page
      assert redirected_to(conn) == ~p"/players/log-in"
    end

    test "logs the player in with return to", %{conn: conn, player: player} do
      player = set_password(player)

      conn =
        conn
        |> init_test_session(player_return_to: "/foo/bar")
        |> post(~p"/players/log-in", %{
          "player" => %{
            "email" => player.email,
            "password" => valid_player_password()
          }
        })

      assert redirected_to(conn) == "/foo/bar"
      assert Phoenix.Flash.get(conn.assigns.flash, :info) =~ "Welcome back!"
    end

    test "emits error message with invalid credentials", %{conn: conn, player: player} do
      conn =
        post(conn, ~p"/players/log-in", %{
          "player" => %{"email" => player.email, "password" => "invalid_password"}
        })

      response = html_response(conn, 200)
      assert response =~ "Enter the World"
      assert response =~ "Invalid email or password"
    end
  end

  describe "POST /players/log-in - magic link" do
    test "sends magic link email when player exists", %{conn: conn, player: player} do
      conn =
        post(conn, ~p"/players/log-in", %{
          "player" => %{"email" => player.email}
        })

      assert Phoenix.Flash.get(conn.assigns.flash, :info) =~ "If your email is in our system"
      assert Loka.Repo.get_by!(Accounts.PlayerToken, player_id: player.id).context == "login"
    end

    test "logs the player in", %{conn: conn, player: player} do
      {token, _hashed_token} = generate_player_magic_link_token(player)

      conn =
        post(conn, ~p"/players/log-in", %{
          "player" => %{"token" => token}
        })

      assert get_session(conn, :player_token)
      # Mobile-first design: login redirects back to login page
      assert redirected_to(conn) == ~p"/players/log-in"
    end

    test "confirms unconfirmed player", %{conn: conn, unconfirmed_player: player} do
      {token, _hashed_token} = generate_player_magic_link_token(player)
      refute player.confirmed_at

      conn =
        post(conn, ~p"/players/log-in", %{
          "player" => %{"token" => token},
          "_action" => "confirmed"
        })

      assert get_session(conn, :player_token)
      # Mobile-first design: login redirects back to login page
      assert redirected_to(conn) == ~p"/players/log-in"
      assert Phoenix.Flash.get(conn.assigns.flash, :info) =~ "Player confirmed successfully."

      assert Accounts.get_player!(player.id).confirmed_at
    end

    test "emits error message when magic link is invalid", %{conn: conn} do
      conn =
        post(conn, ~p"/players/log-in", %{
          "player" => %{"token" => "invalid"}
        })

      assert html_response(conn, 200) =~ "The link is invalid or it has expired."
    end
  end

  describe "DELETE /players/log-out" do
    test "logs the player out", %{conn: conn, player: player} do
      conn = conn |> log_in_player(player) |> delete(~p"/players/log-out")
      assert redirected_to(conn) == ~p"/"
      refute get_session(conn, :player_token)
      assert Phoenix.Flash.get(conn.assigns.flash, :info) =~ "Logged out successfully"
    end

    test "succeeds even if the player is not logged in", %{conn: conn} do
      conn = delete(conn, ~p"/players/log-out")
      assert redirected_to(conn) == ~p"/"
      refute get_session(conn, :player_token)
      assert Phoenix.Flash.get(conn.assigns.flash, :info) =~ "Logged out successfully"
    end
  end
end
