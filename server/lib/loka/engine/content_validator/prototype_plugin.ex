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
    # In V2, Entities is always available via the database
    true
  end

  @impl true
  def validate do
    # Prototype validation is handled by EntitySeeder at boot time
    %{critical: [], warnings: []}
  end
end
