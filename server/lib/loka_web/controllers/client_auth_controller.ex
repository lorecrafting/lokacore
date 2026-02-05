defmodule LokaWeb.ClientAuthController do
  @moduledoc """
  Handles game client authentication via magic link.

  Flow:
  1. Game client opens browser to /client/auth/login
  2. User enters email, receives magic link
  3. Magic link logs user in, redirects to /client/auth/callback
  4. Callback generates JWT and redirects to app via deep link (loka://auth?token=xxx)
  """
  use LokaWeb, :controller

  alias Loka.Auth.Guardian

  @doc """
  Redirects to the login page with client callback flag.
  After successful login, PlayerAuth will redirect here.
  """
  def login(conn, _params) do
    # Store client callback flag in session
    conn
    |> put_session(:client_auth_callback, true)
    |> redirect(to: ~p"/players/log-in")
  end

  @doc """
  Called after successful login when client_auth_callback is set.
  Generates a JWT token and redirects to the game client via deep link.
  """
  def callback(conn, _params) do
    player = conn.assigns.current_scope.player

    # Generate JWT for game client
    {:ok, token, _claims} = Guardian.encode_and_sign(player, %{}, token_type: "access")

    # Clear the client callback flag
    conn = delete_session(conn, :client_auth_callback)

    # Build deep link URL for the game client
    deep_link_url = "loka://auth?token=#{token}&player_id=#{player.id}"

    # Render a page that redirects to the app
    # This handles cases where automatic redirect doesn't work
    conn
    |> put_layout(false)
    |> render(:callback, deep_link_url: deep_link_url, token: token, player: player)
  end
end
