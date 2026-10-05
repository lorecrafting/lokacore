defmodule Loka.Core.Fuel do
  @moduledoc "Bounded exact-instance fuel rows for portable composition."
  @max 9_007_199_254_740_991
  @spec valid?(term(), map() | nil, integer()) :: boolean()
  def valid?(%{"remaining" => remaining, "at" => at, "lit" => lit} = row, spec, now)
      when is_map(spec) do
    spec["kind"] in ~w(source supply) and is_integer(spec["capacity"]) and
      spec["capacity"] > 0 and spec["capacity"] <= @max and
      map_size(row) == 3 and is_integer(remaining) and remaining >= 0 and
      remaining <= spec["capacity"] and remaining <= @max and is_integer(at) and
      at >= 0 and at <= now and at <= @max and is_boolean(lit) and
      (spec["kind"] == "source" or not lit)
  end

  def valid?(_, _, _), do: false
end
