defmodule Loka.Content.Floors do
  @moduledoc """
  The toolbox rows' kernel_api floors that take the manifest, definitions and settings: W25
  (Exposure), W6 (Variants) and W2 (ScopedFacts), in that order; one call from the compiler.
  """
  alias Loka.Content.{Exposure, ScopedFacts, Variants}

  def check(m, defs, located),
    do: Enum.flat_map([Exposure, Variants, ScopedFacts], & &1.check(m, defs, located))
end
