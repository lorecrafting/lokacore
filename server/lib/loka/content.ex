defmodule Loka.Content do
  @moduledoc """
  Content modules that wrap TypedObject with domain-specific APIs.

  Provides convenient, type-safe access to YAML-defined game content:

  - `Content.Quest` - Quest definitions and objectives
  - `Content.Dialogue` - Dialogue trees and NPC conversations
  - `Content.Script` - Elixir script content
  - `Content.Zone` - Zone definitions and metadata
  - `Content.Validator` - Content validation

  ## Boundary Rules

  Content depends on Engine (for TypedObject.Loader) and Framework
  (for quest/dialogue domain types).
  """

  use Boundary, top_level?: true, deps: [Loka.Engine, Loka.Framework], exports: :all
end
