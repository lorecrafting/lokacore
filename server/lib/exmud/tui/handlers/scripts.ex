defmodule Exmud.Tui.Handlers.Scripts do
  @moduledoc """
  RPC handlers for Lua script operations.
  """

  alias Exmud.Engine.Scripts
  alias Exmud.Tui.Server

  @doc """
  Handles script RPC methods.
  """
  def handle("list", params) do
    limit = Map.get(params, "limit", 50)
    offset = Map.get(params, "offset", 0)

    scripts =
      Scripts.list_scripts()
      |> Enum.drop(offset)
      |> Enum.take(limit)
      |> Enum.map(&serialize/1)

    {:ok, %{scripts: scripts, total: length(scripts)}}
  end

  def handle("get", %{"id" => id}) do
    case Scripts.get_script(id) do
      nil -> {:error, {:not_found, "Script not found: #{id}"}}
      script -> {:ok, serialize(script)}
    end
  end

  def handle("get", %{"name" => name}) do
    case Scripts.get_script_by_name(name) do
      nil -> {:error, {:not_found, "Script not found: #{name}"}}
      script -> {:ok, serialize(script)}
    end
  end

  def handle("get", _params) do
    {:error, {:invalid_params, "Missing id or name parameter"}}
  end

  def handle("create", %{"name" => name, "source" => source} = params) do
    attrs = %{
      name: name,
      source: source,
      description: Map.get(params, "description", ""),
      hook: Map.get(params, "hook"),
      enabled: Map.get(params, "enabled", true)
    }

    case Scripts.create_script(attrs) do
      {:ok, script} ->
        broadcast_change("created", script)
        {:ok, serialize(script)}

      {:error, changeset} ->
        {:error, {:validation_error, format_errors(changeset)}}
    end
  end

  def handle("create", _params) do
    {:error, {:invalid_params, "Missing name or source parameter"}}
  end

  def handle("update", %{"id" => id} = params) do
    case Scripts.get_script(id) do
      nil ->
        {:error, {:not_found, "Script not found: #{id}"}}

      script ->
        attrs = Map.take(params, ["name", "source", "description", "hook", "enabled"])
        attrs = for {k, v} <- attrs, into: %{}, do: {String.to_existing_atom(k), v}

        case Scripts.update_script(script, attrs) do
          {:ok, updated} ->
            broadcast_change("updated", updated)
            {:ok, serialize(updated)}

          {:error, changeset} ->
            {:error, {:validation_error, format_errors(changeset)}}
        end
    end
  end

  def handle("update", _params) do
    {:error, {:invalid_params, "Missing id parameter"}}
  end

  def handle("delete", %{"id" => id}) do
    case Scripts.get_script(id) do
      nil ->
        {:error, {:not_found, "Script not found: #{id}"}}

      script ->
        case Scripts.delete_script(script) do
          {:ok, _} ->
            broadcast_change("deleted", script)
            {:ok, %{deleted: true, id: id}}

          {:error, reason} ->
            {:error, {:delete_failed, inspect(reason)}}
        end
    end
  end

  def handle("delete", _params) do
    {:error, {:invalid_params, "Missing id parameter"}}
  end

  def handle("toggle", %{"id" => id}) do
    case Scripts.get_script(id) do
      nil ->
        {:error, {:not_found, "Script not found: #{id}"}}

      script ->
        case Scripts.toggle_script(script) do
          {:ok, updated} ->
            broadcast_change("updated", updated)
            {:ok, serialize(updated)}

          {:error, reason} ->
            {:error, {:toggle_failed, inspect(reason)}}
        end
    end
  end

  def handle("toggle", _params) do
    {:error, {:invalid_params, "Missing id parameter"}}
  end

  def handle("test", %{"id" => id}) do
    case Scripts.get_script(id) do
      nil ->
        {:error, {:not_found, "Script not found: #{id}"}}

      script ->
        case Scripts.test_script(script) do
          {:ok, result} ->
            {:ok, %{success: true, result: inspect(result, pretty: true)}}

          {:error, reason} ->
            {:ok, %{success: false, error: inspect(reason, pretty: true)}}
        end
    end
  end

  def handle("test", %{"source" => source}) do
    case Scripts.test_script(source) do
      {:ok, result} ->
        {:ok, %{success: true, result: inspect(result, pretty: true)}}

      {:error, reason} ->
        {:ok, %{success: false, error: inspect(reason, pretty: true)}}
    end
  end

  def handle("test", _params) do
    {:error, {:invalid_params, "Missing id or source parameter"}}
  end

  def handle("count", _params) do
    {:ok,
     %{
       total: Scripts.count_scripts(),
       enabled: Scripts.count_enabled_scripts()
     }}
  end

  def handle(action, _params) do
    {:error, {:method_not_found, "Unknown scripts action: #{action}"}}
  end

  # Private

  defp serialize(script) do
    %{
      id: script.id,
      name: script.name,
      description: script.description,
      source: script.source,
      hook: script.hook,
      enabled: script.enabled,
      inserted_at: script.inserted_at && DateTime.to_iso8601(script.inserted_at),
      updated_at: script.updated_at && DateTime.to_iso8601(script.updated_at)
    }
  end

  defp broadcast_change(action, script) do
    Server.broadcast(%{
      method: "script.changed",
      params: %{action: action, id: script.id, name: script.name}
    })
  end

  defp format_errors(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Regex.replace(~r"%{(\w+)}", msg, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
    |> Enum.map(fn {field, errors} -> "#{field}: #{Enum.join(errors, ", ")}" end)
    |> Enum.join("; ")
  end
end
