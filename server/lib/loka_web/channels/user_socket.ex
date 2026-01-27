defmodule LokaWeb.UserSocket do
  @moduledoc """
  Socket for mobile/native app connections using JWT authentication.

  Mobile clients connect with their JWT token and can then join game channels.
  """
  use Phoenix.Socket

  alias Loka.Auth.Guardian

  # Channels
  channel "game:*", LokaWeb.GameChannel

  @impl true
  def connect(%{"token" => token}, socket, _connect_info) do
    case Guardian.decode_and_verify(token) do
      {:ok, claims} ->
        case Guardian.resource_from_claims(claims) do
          {:ok, player} ->
            {:ok, assign(socket, :player, player)}

          {:error, _reason} ->
            :error
        end

      {:error, _reason} ->
        :error
    end
  end

  # Allow guest connections in dev mode for testing
  def connect(_params, socket, _connect_info) do
    if Application.get_env(:loka, :allow_guest_websocket, false) do
      # Create a guest player for testing
      {:ok, assign(socket, :player, %{id: "guest-#{:rand.uniform(10000)}", name: "Guest"})}
    else
      :error
    end
  end

  @impl true
  def id(socket), do: "user_socket:#{socket.assigns.player.id}"
end
