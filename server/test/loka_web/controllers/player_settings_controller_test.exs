defmodule LokaWeb.PlayerSettingsControllerTest do
  use LokaWeb.ConnCase

  alias Loka.Accounts
  import Loka.AccountsFixtures

  setup :register_and_log_in_player

  describe "GET /players/settings" do
    test "renders settings page", %{conn: conn} do
      conn = get(conn, ~p"/players/settings")
      response = html_response(conn, 200)
      assert response =~ "Settings"
    end

    test "redirects if player is not logged in" do
      conn = build_conn()
      conn = get(conn, ~p"/players/settings")
      assert redirected_to(conn) == ~p"/players/log-in"
    end

    @tag token_authenticated_at: DateTime.add(DateTime.utc_now(:second), -11, :minute)
    test "redirects if player is not in sudo mode", %{conn: conn} do
      conn = get(conn, ~p"/players/settings")
      assert redirected_to(conn) == ~p"/players/log-in"

      assert Phoenix.Flash.get(conn.assigns.flash, :error) ==
               "You must re-authenticate to access this page."
    end
  end

  describe "PUT /players/settings (change password form)" do
    test "updates the player password and resets tokens", %{conn: conn, player: player} do
      new_password_conn =
        put(conn, ~p"/players/settings", %{
          "action" => "update_password",
          "player" => %{
            "password" => "new valid password",
            "password_confirmation" => "new valid password"
          }
        })

      assert redirected_to(new_password_conn) == ~p"/players/settings"

      assert get_session(new_password_conn, :player_token) != get_session(conn, :player_token)

      assert Phoenix.Flash.get(new_password_conn.assigns.flash, :info) =~
               "Password updated successfully"

      assert Accounts.get_player_by_email_and_password(player.email, "new valid password")
    end

    test "does not update password on invalid data", %{conn: conn} do
      old_password_conn =
        put(conn, ~p"/players/settings", %{
          "action" => "update_password",
          "player" => %{
            "password" => "too short",
            "password_confirmation" => "does not match"
          }
        })

      response = html_response(old_password_conn, 200)
      assert response =~ "Settings"
      assert response =~ "should be at least 12 character(s)"
      assert response =~ "does not match password"

      assert get_session(old_password_conn, :player_token) == get_session(conn, :player_token)
    end
  end

  describe "PUT /players/settings (change email form)" do
    @tag :capture_log
    test "updates the player email", %{conn: conn, player: player} do
      conn =
        put(conn, ~p"/players/settings", %{
          "action" => "update_email",
          "player" => %{"email" => unique_player_email()}
        })

      assert redirected_to(conn) == ~p"/players/settings"

      assert Phoenix.Flash.get(conn.assigns.flash, :info) =~
               "A link to confirm your email"

      assert Accounts.get_player_by_email(player.email)
    end

    test "does not update email on invalid data", %{conn: conn} do
      conn =
        put(conn, ~p"/players/settings", %{
          "action" => "update_email",
          "player" => %{"email" => "with spaces"}
        })

      response = html_response(conn, 200)
      assert response =~ "Settings"
      assert response =~ "must have the @ sign and no spaces"
    end
  end

  describe "GET /players/settings/confirm-email/:token" do
    setup %{player: player} do
      email = unique_player_email()

      token =
        extract_player_token(fn url ->
          Accounts.deliver_player_update_email_instructions(
            %{player | email: email},
            player.email,
            url
          )
        end)

      %{token: token, email: email}
    end

    test "updates the player email once", %{
      conn: conn,
      player: player,
      token: token,
      email: email
    } do
      conn = get(conn, ~p"/players/settings/confirm-email/#{token}")
      assert redirected_to(conn) == ~p"/players/settings"

      assert Phoenix.Flash.get(conn.assigns.flash, :info) =~
               "Email changed successfully"

      refute Accounts.get_player_by_email(player.email)
      assert Accounts.get_player_by_email(email)

      conn = get(conn, ~p"/players/settings/confirm-email/#{token}")

      assert redirected_to(conn) == ~p"/players/settings"

      assert Phoenix.Flash.get(conn.assigns.flash, :error) =~
               "Email change link is invalid or it has expired"
    end

    test "does not update email with invalid token", %{conn: conn, player: player} do
      conn = get(conn, ~p"/players/settings/confirm-email/oops")
      assert redirected_to(conn) == ~p"/players/settings"

      assert Phoenix.Flash.get(conn.assigns.flash, :error) =~
               "Email change link is invalid or it has expired"

      assert Accounts.get_player_by_email(player.email)
    end

    test "redirects if player is not logged in", %{token: token} do
      conn = build_conn()
      conn = get(conn, ~p"/players/settings/confirm-email/#{token}")
      assert redirected_to(conn) == ~p"/players/log-in"
    end
  end
end
