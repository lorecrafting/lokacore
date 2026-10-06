defmodule Loka.Core.Fuel do
  @moduledoc "Bounded exact-instance fuel rows for portable composition."
  @max 9_007_199_254_740_991
  @spec valid?(term(), map() | nil, integer()) :: boolean()
  def valid?(%{"remaining" => remaining, "at" => at, "lit" => lit} = row, spec, now)
      when is_map(spec) do
    declared?(spec) and map_size(row) == 3 and bounded?(remaining, spec["capacity"]) and
      bounded?(at, now) and is_boolean(lit) and (spec["kind"] == "source" or not lit)
  end

  def valid?(_, _, _), do: false

  defp declared?(spec),
    do:
      spec["kind"] in ~w(source supply) and bounded?(spec["capacity"], @max) and
        spec["capacity"] > 0

  defp bounded?(n, max), do: is_integer(n) and n >= 0 and n <= max and n <= @max
end
