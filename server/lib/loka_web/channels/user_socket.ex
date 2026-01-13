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

  def connect(_params, _socket, _connect_info) do
    :error
  end

  @impl true
  def id(socket), do: "user_socket:#{socket.assigns.player.id}"
end
