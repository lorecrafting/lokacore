defmodule ExmudWeb.Api.AuthControllerTest do
  use ExmudWeb.ConnCase

  import Exmud.AccountsFixtures

  describe "POST /api/v1/auth/register" do
    test "registers a new player and returns token", %{conn: conn} do
      email = unique_player_email()

      conn =
        post(conn, ~p"/api/v1/auth/register", %{
          email: email,
          password: "validpassword123"
        })

      assert %{
               "token" => token,
               "player" => %{
                 "id" => _id,
                 "email" => ^email
               }
             } = json_response(conn, 201)

      assert is_binary(token)
      assert String.length(token) > 0
    end

    test "returns error for invalid registration", %{conn: conn} do
      conn =
        post(conn, ~p"/api/v1/auth/register", %{
          email: "invalid",
          password: "short"
        })

      assert %{"errors" => _errors} = json_response(conn, 422)
    end
  end

  describe "POST /api/v1/auth/login" do
    test "logs in existing player and returns token", %{conn: conn} do
      # Phoenix 1.8 uses magic link auth by default - need to set password separately
      player = player_fixture() |> set_password()
      password = valid_player_password()

      conn =
        post(conn, ~p"/api/v1/auth/login", %{
          email: player.email,
          password: password
        })

      assert %{
               "token" => token,
               "player" => %{
                 "id" => _id,
                 "email" => email
               }
             } = json_response(conn, 200)

      assert email == player.email
      assert is_binary(token)
    end

    test "returns error for invalid credentials", %{conn: conn} do
      conn =
        post(conn, ~p"/api/v1/auth/login", %{
          email: "wrong@example.com",
          password: "wrongpassword"
        })

      assert %{"error" => "Invalid email or password"} = json_response(conn, 401)
    end
  end

  describe "GET /api/v1/auth/me" do
    test "returns current player when authenticated", %{conn: conn} do
      player = player_fixture()
      {:ok, token, _claims} = Exmud.Auth.Guardian.encode_and_sign(player)

      conn =
        conn
        |> put_req_header("authorization", "Bearer #{token}")
        |> get(~p"/api/v1/auth/me")

      assert %{
               "player" => %{
                 "id" => _id,
                 "email" => email
               }
             } = json_response(conn, 200)

      assert email == player.email
    end

    test "returns error when not authenticated", %{conn: conn} do
      conn = get(conn, ~p"/api/v1/auth/me")
      assert json_response(conn, 401)
    end
  end
end
