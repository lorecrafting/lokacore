defmodule LokaWeb.DevController do
  @moduledoc """
  Dev-only HTTP endpoints for game testing via Claude Code.

  Allows running game commands against the running server without a browser.

  ## Usage (from bash / Claude Code)

      # Run a command
      curl -s http://localhost:4000/dev/cmd \\
        -H "Content-Type: application/json" \\
        -d '{"command": "look"}' | jq -r '.output'

      # Navigate
      curl -s http://localhost:4000/dev/cmd \\
        -H "Content-Type: application/json" \\
        -d '{"command": "north"}' | jq -r '.output'

      # Teleport
      curl -s http://localhost:4000/dev/cmd \\
        -H "Content-Type: application/json" \\
        -d '{"command": "goto awakening_clearing"}' | jq -r '.output'

  ## Stateless Design

  Each request loads the player's current state fresh from the database.
  This means:
  - Navigation persists (character.location_id is updated in DB)
  - Dialogue state does NOT persist across requests
  - For multi-step dialogue testing, use `mix loka.console` instead

  ## Routes (dev only)

  - POST /dev/cmd — Run a game command
  - POST /dev/reset — Reset character to starting room
  """

  use LokaWeb, :controller

  alias Loka.Dev.GameConsole

  @default_email "admin@loka.local"

  @doc """
  Run a single game command.

  Body: `{"command": "look", "email": "admin@loka.local"}`
  Response: `{"success": true, "output": "room description..."}`
  """
  @spec cmd(Plug.Conn.t(), map()) :: Plug.Conn.t()
  def cmd(conn, %{"command" => command} = params) do
    email = params["email"] || @default_email

    case GameConsole.start(email) do
      {:ok, session} ->
        {output, _session} = GameConsole.run(session, command)
        json(conn, %{success: true, output: output})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{success: false, error: reason})
    end
  end

  def cmd(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{success: false, error: "Missing required field: command"})
  end

  @doc """
  Reset character to the starting room and return a look.

  Body: `{"email": "admin@loka.local"}` (optional)
  Response: `{"success": true, "output": "starting room description..."}`
  """
  @spec reset(Plug.Conn.t(), map()) :: Plug.Conn.t()
  def reset(conn, params) do
    email = params["email"] || @default_email

    case GameConsole.start(email) do
      {:ok, session} ->
        starting_key =
          Application.get_env(:loka, :game, [])[:starting_room_key] || "awakening_clearing"

        {output, _session} = GameConsole.run(session, "goto #{starting_key}")
        json(conn, %{success: true, output: output})

      {:error, reason} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{success: false, error: reason})
    end
  end
end
