defmodule Loka.Engine.ContentValidator.PrototypePlugin do
  @moduledoc """
  ContentValidator plugin for prototype validation.

  Validates that all prototypes have valid parent references and no cycles.
  """

  @behaviour Loka.Engine.ContentValidator.Plugin

  @impl true
  def name, do: :prototype

  @impl true
  def ready? do
    Process.whereis(Loka.Engine.TypedObject.Loader) != nil
  end

  @impl true
  def validate do
    case Loka.Engine.TypedObject.Loader.validate_all() do
      :ok ->
        %{critical: [], warnings: []}

      {:error, errors} ->
        critical =
          Enum.map(errors, fn error ->
            format_error(error)
          end)

        %{critical: critical, warnings: []}
    end
  end

  defp format_error({:broken_parent_ref, key, parent}) do
    "Prototype '#{key}' references non-existent parent '#{parent}'"
  end

  defp format_error({:cycle_detected, cycle}) do
    "Circular parent reference detected: #{inspect(cycle)}"
  end

  defp format_error(error) do
    inspect(error)
  end
end
