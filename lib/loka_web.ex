defmodule LokaWeb do
  @moduledoc """
  Phoenix HTTP, channels, admin and MCP transport adapter. Never a source of game or commerce truth.

  Dependency rules: spec document 02 §1.
  """
  use Boundary, deps: [Loka.Core, Loka.Platform, Loka.Runtime, Loka.Builder], exports: []
end
