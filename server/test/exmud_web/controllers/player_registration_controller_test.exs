defmodule ExmudWeb.PlayerRegistrationControllerTest do
  use ExmudWeb.ConnCase

  import Exmud.AccountsFixtures

  describe "GET /players/register" do
    test "renders registration page", %{conn: conn} do
      conn = get(conn, ~p"/players/register")
      response = html_response(conn, 200)
      assert response =~ "Begin Your Journey"
      assert response =~ ~p"/players/log-in"
      assert response =~ "Create account"
    end

    test "redirects if already logged in", %{conn: conn} do
      conn = conn |> log_in_player(player_fixture()) |> get(~p"/players/register")

      assert redirected_to(conn) == ~p"/"
    end
  end

  describe "POST /players/register" do
    @tag :capture_log
    test "creates account but does not log in", %{conn: conn} do
      email = unique_player_email()

      conn =
        post(conn, ~p"/players/register", %{
          "player" => valid_player_attributes(email: email)
        })

      refute get_session(conn, :player_token)
      assert redirected_to(conn) == ~p"/players/log-in"

      assert conn.assigns.flash["info"] =~
               ~r/An email was sent to .*, please access it to confirm your account/
    end

    test "render errors for invalid data", %{conn: conn} do
      conn =
        post(conn, ~p"/players/register", %{
          "player" => %{"email" => "with spaces"}
        })

      response = html_response(conn, 200)
      assert response =~ "Begin Your Journey"
      assert response =~ "must have the @ sign and no spaces"
    end
  end
end
