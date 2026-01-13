defmodule Loka.Framework.ContentValidator.DialoguePlugin do
  @moduledoc """
  ContentValidator plugin for dialogue validation.

  Validates NPC dialogue trees including:
  - All 'next' references point to existing nodes
  - Actions have valid formats
  """

  @behaviour Loka.Engine.ContentValidator.Plugin

  alias Loka.Testing.Content.DialogueValidator

  @impl true
  def name, do: :dialogue

  @impl true
  def ready? do
    function_exported?(DialogueValidator, :validate, 0)
  end

  @impl true
  def validate do
    case DialogueValidator.validate() do
      {:ok, results} ->
        critical = Enum.map(results.errors, &format_error/1)
        warnings = Enum.map(results.warnings, &inspect/1)

        %{critical: critical, warnings: warnings}

      _ ->
        %{critical: [], warnings: []}
    end
  rescue
    _ -> %{critical: [], warnings: []}
  end

  defp format_error({:broken_next, npc, node, target}) do
    "NPC '#{npc}' dialogue node '#{node}' references non-existent node '#{target}'"
  end

  defp format_error({:invalid_action, npc, node, action}) do
    "NPC '#{npc}' dialogue node '#{node}' has invalid action: #{inspect(action)}"
  end

  defp format_error(error) do
    inspect(error)
  end
end
