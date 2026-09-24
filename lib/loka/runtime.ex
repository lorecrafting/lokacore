defmodule Loka.Runtime do
  @moduledoc """
  OTP world, session and scheduler authority for online play.

  Dependency rules: spec document 02 §1.
  """
  use Boundary, deps: [Loka.Core, Loka.Content], exports: []
end
