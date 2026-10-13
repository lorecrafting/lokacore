defmodule Loka.Content.Floors do
  @moduledoc """
  The toolbox rows' kernel_api floors that take the manifest, definitions and settings: W25
  (Exposure), W6 (Variants), W2 (ScopedFacts), rows 15 and G11 (Standing) and G7 (Locks), in that order; one call from the compiler.
  """
  alias Loka.Content.{Exposure, Locks, ScopedFacts, Standing, Variants}

  def check(m, defs, located),
    do:
      Enum.flat_map(
        [Exposure, Variants, ScopedFacts, Standing, Locks],
        & &1.check(m, defs, located)
      )
end
