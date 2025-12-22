defmodule Exmud.Tui.ClientHandler do
  @moduledoc """
  Handles an individual TUI client connection.

  Each connected TUI client gets its own ClientHandler process that:
  - Receives JSON-RPC requests from the client
  - Dispatches to appropriate RPC handlers
  - Sends responses back to the client
  - Receives broadcasts from the server for real-time updates
  """

  use GenServer
  require Logger

  alias Exmud.Tui.{Handlers, Protocol, Server}

  # Client API

  @doc """
  Starts a client handler for the given socket.
  """
  def start_link(socket) do
    GenServer.start_link(__MODULE__, socket)
  end

  # Server Callbacks

  @impl true
  def init(socket) do
    # Register with the server for broadcasts
    Server.register_client(self())

    Logger.debug("[TuiClient] Connected")
    # Socket will be activated when we receive :socket_ready
    {:ok, %{socket: socket, active: false}}
  end

  @impl true
  def handle_info(:socket_ready, state) do
    # Now we own the socket, set it to active mode
    :inet.setopts(state.socket, active: true)
    {:noreply, %{state | active: true}}
  end

  @impl true
  def handle_info({:tcp, socket, data}, state) do
    handle_request(socket, String.trim(data))
    {:noreply, state}
  end

  @impl true
  def handle_info({:tcp_closed, _socket}, state) do
    Logger.debug("[TuiClient] Disconnected")
    {:stop, :normal, state}
  end

  @impl true
  def handle_info({:tcp_error, _socket, reason}, state) do
    Logger.warning("[TuiClient] Socket error: #{inspect(reason)}")
    {:stop, reason, state}
  end

  @impl true
  def handle_cast({:broadcast, message}, state) do
    # Send notification to client
    json = Protocol.encode_notification(message.method, message.params)
    send_response(state.socket, json)
    {:noreply, state}
  end

  @impl true
  def terminate(_reason, _state) do
    Server.unregister_client(self())
    :ok
  end

  # Private Functions

  defp handle_request(socket, data) do
    case Protocol.decode_request(data) do
      {:ok, request} ->
        response = dispatch_request(request)
        send_rpc_response(socket, request.id, response)

      {:error, reason} ->
        error_code = Protocol.error_code(reason)
        error_msg = format_error_message(reason)
        json = Protocol.encode_error(nil, error_code, error_msg)
        send_response(socket, json)
    end
  end

  defp dispatch_request(%{method: method, params: params}) do
    Handlers.dispatch(method, params)
  end

  defp send_rpc_response(socket, id, response) do
    json =
      case response do
        {:ok, result} ->
          Protocol.encode_response(id, result)

        {:error, :method_not_found} ->
          Protocol.encode_error(id, Protocol.error_code(:method_not_found), "Method not found")

        {:error, {:method_not_found, message}} ->
          Protocol.encode_error(id, Protocol.error_code(:method_not_found), message)

        {:error, {:invalid_params, message}} ->
          Protocol.encode_error(id, Protocol.error_code(:invalid_params), message)

        {:error, {:not_found, message}} ->
          # Use a custom error code for not found (32001)
          Protocol.encode_error(id, -32001, message)

        {:error, {:validation_error, message}} ->
          Protocol.encode_error(id, Protocol.error_code(:invalid_params), message)

        {:error, {:incompatible, message}} ->
          Protocol.encode_error(id, -32002, message)

        {:error, {_error_type, message}} when is_binary(message) ->
          Protocol.encode_error(id, Protocol.error_code(:internal_error), message)

        {:error, message} when is_binary(message) ->
          Protocol.encode_error(id, Protocol.error_code(:internal_error), message)

        {:error, reason} ->
          Protocol.encode_error(id, Protocol.error_code(:internal_error), inspect(reason))
      end

    send_response(socket, json)
  end

  defp send_response(socket, json) do
    :gen_tcp.send(socket, json <> "\n")
  end

  defp format_error_message(:parse_error), do: "Parse error: invalid JSON"

  defp format_error_message(:invalid_request),
    do: "Invalid Request: not a valid JSON-RPC 2.0 request"

  defp format_error_message(reason), do: inspect(reason)
end
