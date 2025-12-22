defmodule Exmud.Tui.Handlers do
  @moduledoc """
  RPC method dispatcher for TUI requests.

  Routes JSON-RPC method calls to the appropriate handler module based on
  the method prefix (e.g., "entities.list" -> Entities.handle("list", params)).
  """

  alias Exmud.Tui.Handlers.{System, Entities, Rooms, Scripts, Players, Prototypes}

  @doc """
  Dispatches an RPC method call to the appropriate handler.

  Returns `{:ok, result}` on success, or `{:error, reason}` on failure.

  ## Examples

      iex> Handlers.dispatch("system.info", %{})
      {:ok, %{version: "0.1.0", ...}}

      iex> Handlers.dispatch("entities.list", %{"type" => "room"})
      {:ok, %{entities: [...], total: 5}}

      iex> Handlers.dispatch("unknown.method", %{})
      {:error, :method_not_found}
  """
  @spec dispatch(String.t(), map()) :: {:ok, term()} | {:error, atom() | {atom(), String.t()}}
  def dispatch(method, params) when is_binary(method) and is_map(params) do
    case String.split(method, ".", parts: 2) do
      ["system", action] -> System.handle(action, params)
      ["entities", action] -> Entities.handle(action, params)
      ["rooms", action] -> Rooms.handle(action, params)
      ["scripts", action] -> Scripts.handle(action, params)
      ["players", action] -> Players.handle(action, params)
      ["prototypes", action] -> Prototypes.handle(action, params)
      [_domain] -> {:error, :method_not_found}
      _ -> {:error, :method_not_found}
    end
  end

  def dispatch(_method, _params), do: {:error, :invalid_params}
end
