defmodule LokaRuntime do
  @moduledoc """
  OTP world, session and scheduler authority for online play.

  Dependency rules: spec document 02 §1.
  """
  use Boundary, deps: [LokaCore, LokaContent], exports: []
end
