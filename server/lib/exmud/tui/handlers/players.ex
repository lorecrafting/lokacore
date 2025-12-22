defmodule Exmud.Tui.Handlers.Players do
  @moduledoc """
  RPC handlers for player management.
  """

  alias Exmud.Accounts

  @doc """
  Handles player RPC methods.
  """
  def handle("list", params) do
    limit = Map.get(params, "limit", 50)
    offset = Map.get(params, "offset", 0)

    players =
      Accounts.list_players()
      |> Enum.drop(offset)
      |> Enum.take(limit)
      |> Enum.map(&serialize/1)

    {:ok, %{players: players, total: length(players)}}
  end

  def handle("get", %{"id" => id}) do
    case Accounts.get_player(id) do
      nil -> {:error, {:not_found, "Player not found: #{id}"}}
      player -> {:ok, serialize(player)}
    end
  end

  def handle("get", %{"email" => email}) do
    case Accounts.get_player_by_email(email) do
      nil -> {:error, {:not_found, "Player not found: #{email}"}}
      player -> {:ok, serialize(player)}
    end
  end

  def handle("get", _params) do
    {:error, {:invalid_params, "Missing id or email parameter"}}
  end

  def handle("toggle_admin", %{"id" => id}) do
    case Accounts.get_player(id) do
      nil ->
        {:error, {:not_found, "Player not found: #{id}"}}

      player ->
        case Accounts.toggle_admin(player) do
          {:ok, updated} ->
            {:ok, serialize(updated)}

          {:error, reason} ->
            {:error, {:update_failed, inspect(reason)}}
        end
    end
  end

  def handle("toggle_admin", _params) do
    {:error, {:invalid_params, "Missing id parameter"}}
  end

  def handle("set_admin", %{"id" => id, "is_admin" => is_admin}) when is_boolean(is_admin) do
    case Accounts.get_player(id) do
      nil ->
        {:error, {:not_found, "Player not found: #{id}"}}

      player ->
        case Accounts.set_admin(player, is_admin) do
          {:ok, updated} ->
            {:ok, serialize(updated)}

          {:error, reason} ->
            {:error, {:update_failed, inspect(reason)}}
        end
    end
  end

  def handle("set_admin", _params) do
    {:error, {:invalid_params, "Missing id or is_admin parameter"}}
  end

  def handle("delete", %{"id" => id}) do
    case Accounts.get_player(id) do
      nil ->
        {:error, {:not_found, "Player not found: #{id}"}}

      player ->
        case Accounts.delete_player(player) do
          {:ok, _} ->
            {:ok, %{deleted: true, id: id}}

          {:error, reason} ->
            {:error, {:delete_failed, inspect(reason)}}
        end
    end
  end

  def handle("delete", _params) do
    {:error, {:invalid_params, "Missing id parameter"}}
  end

  def handle("count", _params) do
    {:ok, %{count: Accounts.count_players()}}
  end

  def handle(action, _params) do
    {:error, {:method_not_found, "Unknown players action: #{action}"}}
  end

  # Private

  defp serialize(player) do
    %{
      id: player.id,
      email: player.email,
      is_admin: player.is_admin,
      confirmed_at: player.confirmed_at && DateTime.to_iso8601(player.confirmed_at),
      inserted_at: player.inserted_at && DateTime.to_iso8601(player.inserted_at)
    }
  end
end
