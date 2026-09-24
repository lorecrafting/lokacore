defmodule Loka.Store do
  @moduledoc """
  Ecto/PostgreSQL persistence adapters implementing the core persistence ports. No game rules.

  Dependency rules: spec document 02 §1.
  """
  use Boundary, deps: [Loka.Core], exports: []
end
