defmodule ExmudWeb.PlayerSessionControllerTest do
  use ExmudWeb.ConnCase

  import Exmud.AccountsFixtures
  alias Exmud.Accounts

  setup do
    %{unconfirmed_player: unconfirmed_player_fixture(), player: player_fixture()}
  end

  describe "GET /players/log-in" do
    test "renders login page", %{conn: conn} do
      conn = get(conn, ~p"/players/log-in")
      response = html_response(conn, 200)
      assert response =~ "Log in"
      assert response =~ ~p"/players/register"
      assert response =~ "Log in with email"
    end

    test "renders login page with email filled in (sudo mode)", %{conn: conn, player: player} do
      html =
        conn
        |> log_in_player(player)
        |> get(~p"/players/log-in")
        |> html_response(200)

      assert html =~ "You need to reauthenticate"
      refute html =~ "Register"
      assert html =~ "Log in with email"

      assert html =~
               ~s(<input type="email" name="player[email]" id="login_form_magic_email" value="#{player.email}")
    end

    test "renders login page (email + password)", %{conn: conn} do
      conn = get(conn, ~p"/players/log-in?mode=password")
      response = html_response(conn, 200)
      assert response =~ "Log in"
      assert response =~ ~p"/players/register"
      assert response =~ "Log in with email"
    end
  end

  describe "GET /players/log-in/:token" do
    test "renders confirmation page for unconfirmed player", %{
      conn: conn,
      unconfirmed_player: player
    } do
      token =
        extract_player_token(fn url ->
          Accounts.deliver_login_instructions(player, url)
        end)

      conn = get(conn, ~p"/players/log-in/#{token}")
      assert html_response(conn, 200) =~ "Confirm and stay logged in"
    end

    test "renders login page for confirmed player", %{conn: conn, player: player} do
      token =
        extract_player_token(fn url ->
          Accounts.deliver_login_instructions(player, url)
        end)

      conn = get(conn, ~p"/players/log-in/#{token}")
      html = html_response(conn, 200)
      refute html =~ "Confirm my account"
      assert html =~ "Log in"
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
      assert redirected_to(conn) == ~p"/"

      # Now do a logged in request and assert on the game page
      conn = get(conn, ~p"/game")
      response = html_response(conn, 200)
      assert response =~ "ExMUD"
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

      assert conn.resp_cookies["_exmud_web_player_remember_me"]
      assert redirected_to(conn) == ~p"/"
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
        post(conn, ~p"/players/log-in?mode=password", %{
          "player" => %{"email" => player.email, "password" => "invalid_password"}
        })

      response = html_response(conn, 200)
      assert response =~ "Log in"
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
      assert Exmud.Repo.get_by!(Accounts.PlayerToken, player_id: player.id).context == "login"
    end

    test "logs the player in", %{conn: conn, player: player} do
      {token, _hashed_token} = generate_player_magic_link_token(player)

      conn =
        post(conn, ~p"/players/log-in", %{
          "player" => %{"token" => token}
        })

      assert get_session(conn, :player_token)
      assert redirected_to(conn) == ~p"/"

      # Now do a logged in request and assert on the game page
      conn = get(conn, ~p"/game")
      response = html_response(conn, 200)
      assert response =~ "ExMUD"
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
      assert redirected_to(conn) == ~p"/"
      assert Phoenix.Flash.get(conn.assigns.flash, :info) =~ "Player confirmed successfully."

      assert Accounts.get_player!(player.id).confirmed_at

      # Now do a logged in request and assert on the game page
      conn = get(conn, ~p"/game")
      response = html_response(conn, 200)
      assert response =~ "ExMUD"
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
