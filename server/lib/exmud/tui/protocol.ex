defmodule Exmud.Tui.Protocol do
  @moduledoc """
  JSON-RPC 2.0 protocol encoder/decoder for TUI communication.

  Handles encoding and decoding of JSON-RPC 2.0 messages between the Elixir
  server and the Go TUI client over Unix socket.

  ## Message Formats

  Request:
      {"jsonrpc": "2.0", "id": 1, "method": "entities.list", "params": {"type": "room"}}

  Success Response:
      {"jsonrpc": "2.0", "id": 1, "result": {...}}

  Error Response:
      {"jsonrpc": "2.0", "id": 1, "error": {"code": -32600, "message": "Invalid Request"}}

  Notification (server push, no id):
      {"jsonrpc": "2.0", "method": "entity.changed", "params": {...}}
  """

  @doc """
  Decode a JSON-RPC request from binary.

  Returns `{:ok, request}` with a map containing `:method`, `:id`, and `:params` keys,
  or `{:error, reason}` if the request is invalid.

  ## Examples

      iex> Protocol.decode_request(~s({"jsonrpc": "2.0", "id": 1, "method": "test"}))
      {:ok, %{method: "test", id: 1, params: %{}}}

      iex> Protocol.decode_request(~s({"jsonrpc": "2.0", "method": "notify"}))
      {:ok, %{method: "notify", id: nil, params: %{}}}

      iex> Protocol.decode_request("invalid json")
      {:error, :parse_error}
  """
  @spec decode_request(binary()) :: {:ok, map()} | {:error, :parse_error | :invalid_request}
  def decode_request(json) when is_binary(json) do
    case Jason.decode(json) do
      {:ok, %{"jsonrpc" => "2.0", "method" => method, "id" => id} = req} ->
        {:ok, %{method: method, id: id, params: Map.get(req, "params", %{})}}

      {:ok, %{"jsonrpc" => "2.0", "method" => method} = req} ->
        {:ok, %{method: method, id: nil, params: Map.get(req, "params", %{})}}

      {:ok, _} ->
        {:error, :invalid_request}

      {:error, _} ->
        {:error, :parse_error}
    end
  end

  @doc """
  Encode a success response.

  ## Examples

      iex> Protocol.encode_response(1, %{status: "ok"})
      ~s({"id":1,"jsonrpc":"2.0","result":{"status":"ok"}})
  """
  @spec encode_response(integer() | nil, term()) :: binary()
  def encode_response(id, result) do
    Jason.encode!(%{"jsonrpc" => "2.0", "id" => id, "result" => result})
  end

  @doc """
  Encode an error response.

  ## Examples

      iex> Protocol.encode_error(1, -32600, "Invalid Request")
      ~s({"error":{"code":-32600,"message":"Invalid Request"},"id":1,"jsonrpc":"2.0"})
  """
  @spec encode_error(integer() | nil, integer(), binary()) :: binary()
  def encode_error(id, code, message) do
    Jason.encode!(%{
      "jsonrpc" => "2.0",
      "id" => id,
      "error" => %{"code" => code, "message" => message}
    })
  end

  @doc """
  Encode a notification (server push, no id).

  Notifications are one-way messages from server to client.

  ## Examples

      iex> Protocol.encode_notification("entity.changed", %{id: "abc123"})
      ~s({"jsonrpc":"2.0","method":"entity.changed","params":{"id":"abc123"}})
  """
  @spec encode_notification(binary(), term()) :: binary()
  def encode_notification(method, params) do
    Jason.encode!(%{"jsonrpc" => "2.0", "method" => method, "params" => params})
  end

  @doc """
  Get the standard JSON-RPC 2.0 error code for a given error type.

  ## Standard Error Codes

  - `:parse_error` (-32700) - Invalid JSON
  - `:invalid_request` (-32600) - Not a valid JSON-RPC request
  - `:method_not_found` (-32601) - Method does not exist
  - `:invalid_params` (-32602) - Invalid method parameters
  - `:internal_error` (-32603) - Internal server error

  ## Examples

      iex> Protocol.error_code(:parse_error)
      -32700

      iex> Protocol.error_code(:method_not_found)
      -32601
  """
  @spec error_code(atom()) :: integer()
  def error_code(:parse_error), do: -32700
  def error_code(:invalid_request), do: -32600
  def error_code(:method_not_found), do: -32601
  def error_code(:invalid_params), do: -32602
  def error_code(:internal_error), do: -32603
end
