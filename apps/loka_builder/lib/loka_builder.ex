defmodule LokaBuilder do
  @moduledoc """
  Workspaces, Builder API, Lab and certification. Production runtime never depends on it.

  Dependency rules: spec document 02 §1.
  """
  use Boundary, deps: [LokaCore, LokaContent, LokaRuntime], exports: []
end
