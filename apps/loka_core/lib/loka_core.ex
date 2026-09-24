defmodule LokaCore do
  @moduledoc """
  Pure domain types, rules and capability contracts. No Phoenix, Ecto, filesystem, network or processes.

  Dependency rules: spec document 02 §1.
  """
  use Boundary, deps: [], exports: []
end
