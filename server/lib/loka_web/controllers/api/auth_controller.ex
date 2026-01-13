defmodule LokaWeb.Api.AuthController do
  @moduledoc """
  API authentication controller for mobile clients.
  Handles login/registration and returns JWT tokens.

  ## Token Types

  - `access`: Short-lived token (1 hour) for API requests
  - `refresh`: Longer-lived token (7 days) for obtaining new access tokens

  Clients should use the refresh token to obtain new access tokens
  before the current access token expires.
  """
  use LokaWeb, :controller

  alias Loka.Accounts
  alias Loka.Auth.Guardian

  action_fallback LokaWeb.Api.FallbackController

  # Token type for standard API access
  @access_token_type "access"

  @doc """
  Registers a new player and returns a JWT token.
  """
  def register(conn, %{"email" => email, "password" => password}) do
    case Accounts.register_player(%{email: email, password: password}) do
      {:ok, player} ->
        {:ok, token, claims} =
          Guardian.encode_and_sign(player, %{}, token_type: @access_token_type)

        conn
        |> put_status(:created)
        |> json(%{
          token: token,
          token_type: "Bearer",
          expires_at: claims["exp"],
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
        {:ok, token, claims} =
          Guardian.encode_and_sign(player, %{}, token_type: @access_token_type)

        conn
        |> put_status(:ok)
        |> json(%{
          token: token,
          token_type: "Bearer",
          expires_at: claims["exp"],
          player: %{
            id: player.id,
            email: player.email
          }
        })
    end
  end

  @doc """
  Refreshes an access token using a valid token.

  Returns a new access token with refreshed expiration.
  """
  def refresh(conn, _params) do
    with {:ok, _old_stuff, {new_token, new_claims}} <-
           Guardian.refresh(Guardian.Plug.current_token(conn)) do
      conn
      |> put_status(:ok)
      |> json(%{
        token: new_token,
        token_type: "Bearer",
        expires_at: new_claims["exp"]
      })
    else
      {:error, _reason} ->
        conn
        |> put_status(:unauthorized)
        |> json(%{error: "Invalid or expired token"})
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
        email: player.email,
        name: player.name
      }
    })
  end

  @doc """
  Creates or retrieves a guest player by device ID.
  Returns a JWT token for the guest.
  """
  def guest(conn, %{"device_id" => device_id} = params) do
    name = params["name"]

    case Accounts.get_or_create_guest(device_id, name) do
      {:ok, player} ->
        {:ok, token, claims} =
          Guardian.encode_and_sign(player, %{}, token_type: @access_token_type)

        conn
        |> put_status(:ok)
        |> json(%{
          token: token,
          token_type: "Bearer",
          expires_at: claims["exp"],
          player: %{
            id: player.id,
            name: player.name
          }
        })

      {:error, changeset} ->
        {:error, changeset}
    end
  end

  @doc """
  Updates the current player's name.
  """
  def update_name(conn, %{"name" => name}) do
    player = Guardian.Plug.current_resource(conn)

    case Accounts.update_player_name(player, name) do
      {:ok, updated_player} ->
        conn
        |> put_status(:ok)
        |> json(%{
          player: %{
            id: updated_player.id,
            name: updated_player.name
          }
        })

      {:error, changeset} ->
        {:error, changeset}
    end
  end
end
