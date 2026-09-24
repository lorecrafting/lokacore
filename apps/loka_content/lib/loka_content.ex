defmodule LokaContent do
  @moduledoc """
  Cartridge parsing, compiler and definition registry. Compile-time definitions, not runtime authority.

  Dependency rules: spec document 02 §1.
  """
  use Boundary, deps: [LokaCore], exports: []
end
