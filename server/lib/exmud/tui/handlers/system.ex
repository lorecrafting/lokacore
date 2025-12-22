defmodule Exmud.Tui.Handlers.System do
  @moduledoc """
  RPC handlers for system operations.

  Provides server stats, prototype/script reloading, and world export/import.
  """

  alias Exmud.Engine.{Entities, Scripts, PrototypeLoader, WorldExporter, WorldImporter}

  @protocol_version "1.0"

  @doc """
  Handles system RPC methods.
  """
  def handle("ping", _params) do
    {:ok, %{pong: true, timestamp: System.system_time(:millisecond)}}
  end

  def handle("info", _params) do
    {:ok,
     %{
       version: Application.spec(:exmud, :vsn) |> to_string(),
       protocol_version: @protocol_version,
       node: to_string(node()),
       uptime_ms: :erlang.statistics(:wall_clock) |> elem(0),
       rooms: Entities.count_by_type(:room),
       npcs: Entities.count_by_type(:npc),
       items: Entities.count_by_type(:item),
       exits: Entities.count_by_type(:exit),
       scripts: Scripts.count_scripts(),
       players: Exmud.Accounts.count_players()
     }}
  end

  def handle("handshake", %{"version" => client_version}) do
    if compatible?(client_version) do
      {:ok,
       %{
         version: @protocol_version,
         server: "exmud",
         compatible: true
       }}
    else
      {:error, {:incompatible, "Incompatible protocol version: #{client_version}"}}
    end
  end

  def handle("handshake", _params) do
    {:error, {:invalid_params, "Missing version parameter"}}
  end

  def handle("reload_prototypes", _params) do
    PrototypeLoader.reload()
    count = PrototypeLoader.count()
    {:ok, %{reloaded: true, count: count}}
  end

  def handle("export_world", %{"path" => path}) do
    case WorldExporter.export_all(path) do
      {:ok, stats} -> {:ok, stats}
      {:error, reason} -> {:error, {:export_failed, inspect(reason)}}
    end
  end

  def handle("export_world", _params) do
    {:error, {:invalid_params, "Missing path parameter"}}
  end

  def handle("import_world", %{"path" => path} = params) do
    opts = [
      clear_existing: Map.get(params, "clear_existing", false),
      link_exits: Map.get(params, "link_exits", true)
    ]

    case WorldImporter.import_all(path, opts) do
      {:ok, stats} -> {:ok, stats}
      {:error, reason} -> {:error, {:import_failed, inspect(reason)}}
    end
  end

  def handle("import_world", _params) do
    {:error, {:invalid_params, "Missing path parameter"}}
  end

  def handle(action, _params) do
    {:error, {:method_not_found, "Unknown system action: #{action}"}}
  end

  # Private

  defp compatible?(client_version) do
    # For now, accept version 1.x
    String.starts_with?(client_version, "1.")
  end
end
