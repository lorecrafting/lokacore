defmodule LokaWeb.MobileAuthController do
  @moduledoc """
  Handles mobile app authentication via magic link.

  Flow:
  1. Mobile app opens browser to /mobile/auth/login
  2. User enters email, receives magic link
  3. Magic link logs user in, redirects to /mobile/auth/callback
  4. Callback generates JWT and redirects to app via deep link (loka://auth?token=xxx)
  """
  use LokaWeb, :controller

  alias Loka.Auth.Guardian

  @doc """
  Redirects to the login page with mobile callback flag.
  After successful login, PlayerAuth will redirect here.
  """
  def login(conn, _params) do
    # Store mobile callback flag in session
    conn
    |> put_session(:mobile_auth_callback, true)
    |> redirect(to: ~p"/players/log-in")
  end

  @doc """
  Called after successful login when mobile_auth_callback is set.
  Generates a JWT token and redirects to the mobile app via deep link.
  """
  def callback(conn, _params) do
    player = conn.assigns.current_scope.player

    # Generate JWT for mobile app
    {:ok, token, _claims} = Guardian.encode_and_sign(player, %{}, token_type: "access")

    # Clear the mobile callback flag
    conn = delete_session(conn, :mobile_auth_callback)

    # Build deep link URL for the mobile app
    deep_link_url = "loka://auth?token=#{token}&player_id=#{player.id}"

    # Render a page that redirects to the app
    # This handles cases where automatic redirect doesn't work
    conn
    |> put_layout(false)
    |> render(:callback, deep_link_url: deep_link_url, token: token, player: player)
  end
end
