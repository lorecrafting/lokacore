defmodule LokaWeb.PlayController do
  @moduledoc """
  Controller for the text-based MUD web client.

  Serves a simple HTML page that connects to the game via Phoenix Channels.
  Uses the same magic link authentication as /game.
  """
  use LokaWeb, :controller

  alias Loka.Auth.Guardian

  def index(conn, _params) do
    # Get the authenticated player from the session (set by magic link auth)
    player = conn.assigns.current_scope.player

    # Generate a JWT token for the channel connection
    {:ok, token, _claims} = Guardian.encode_and_sign(player, %{}, token_type: "access")

    conn
    |> put_layout(false)
    |> render(:play, token: token, player: player)
  end
end
