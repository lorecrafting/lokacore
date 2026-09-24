defmodule Loka.Builder do
  @moduledoc """
  Workspaces, Builder API, Lab and certification. Production runtime never depends on it.

  Dependency rules: spec document 02 §1.
  """
  use Boundary, deps: [Loka.Core, Loka.Content, Loka.Runtime], exports: []
end
