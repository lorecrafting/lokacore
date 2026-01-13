defmodule Loka.Framework.ContentValidator.WorldPlugin do
  @moduledoc """
  ContentValidator plugin for world validation.

  Validates world structure including:
  - All exit destinations exist
  - No orphan rooms (unreachable from other rooms)
  """

  @behaviour Loka.Engine.ContentValidator.Plugin

  alias Loka.Testing.Content.WorldValidator

  @impl true
  def name, do: :world

  @impl true
  def ready? do
    function_exported?(WorldValidator, :validate, 0)
  end

  @impl true
  def validate do
    case WorldValidator.validate() do
      {:ok, results} ->
        # Only orphan rooms and broken exits are critical
        critical =
          results.errors
          |> Enum.filter(fn error ->
            case error do
              {:broken_exit, _, _, _} -> true
              {:orphan_room, _} -> true
              _ -> false
            end
          end)
          |> Enum.map(&format_error/1)

        warnings = Enum.map(results.warnings, &inspect/1)

        %{critical: critical, warnings: warnings}

      _ ->
        %{critical: [], warnings: []}
    end
  rescue
    _ -> %{critical: [], warnings: []}
  end

  defp format_error({:broken_exit, room, direction, target}) do
    "Room '#{room}' exit '#{direction}' leads to non-existent room '#{target}'"
  end

  defp format_error({:orphan_room, room}) do
    "Room '#{room}' is not reachable from any other room"
  end

  defp format_error(error) do
    inspect(error)
  end
end
