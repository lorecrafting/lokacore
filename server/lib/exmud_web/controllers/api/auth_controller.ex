defmodule ExmudWeb.Api.AuthController do
  @moduledoc """
  API authentication controller for mobile clients.
  Handles login/registration and returns JWT tokens.
  """
  use ExmudWeb, :controller

  alias Exmud.Accounts
  alias Exmud.Auth.Guardian

  action_fallback ExmudWeb.Api.FallbackController

  @doc """
  Registers a new player and returns a JWT token.
  """
  def register(conn, %{"email" => email, "password" => password}) do
    case Accounts.register_player(%{email: email, password: password}) do
      {:ok, player} ->
        {:ok, token, _claims} = Guardian.encode_and_sign(player)

        conn
        |> put_status(:created)
        |> json(%{
          token: token,
          player: %{
            id: player.id,
            email: player.email
          }
        })

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  @doc """
  Logs in a player and returns a JWT token.
  """
  def login(conn, %{"email" => email, "password" => password}) do
    case Accounts.get_player_by_email_and_password(email, password) do
      nil ->
        conn
        |> put_status(:unauthorized)
        |> json(%{error: "Invalid email or password"})

      player ->
        {:ok, token, _claims} = Guardian.encode_and_sign(player)

        conn
        |> put_status(:ok)
        |> json(%{
          token: token,
          player: %{
            id: player.id,
            email: player.email
          }
        })
    end
  end

  @doc """
  Returns the current player from a valid JWT token.
  """
  def me(conn, _params) do
    player = Guardian.Plug.current_resource(conn)

    conn
    |> put_status(:ok)
    |> json(%{
      player: %{
        id: player.id,
        email: player.email
      }
    })
  end
end
