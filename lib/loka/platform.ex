defmodule Loka.Platform do
  @moduledoc """
  Accounts, catalog, entitlements, purchase and restore. No world simulation or cartridge mechanics.

  Dependency rules: spec document 02 §1.
  """
  use Boundary, deps: [Loka.Core, Loka.Store], exports: []
end
