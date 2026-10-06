defmodule Loka.Core.InvariantsFuel do
  @moduledoc "Independent fuel precondition evidence, separate from the portable composer."
  def valid?(op, s) do
    spec = get_in(s, ["fuel_specs", op["item_id"]])

    is_map(spec) and spec["kind"] in ~w(source supply) and
      fuel_integer?(spec["capacity"], 9_007_199_254_740_991) and spec["capacity"] > 0 and
      fuel_row?(op["from"], spec, s["clock"]) and fuel_row?(op["to"], spec, s["clock"]) and
      op["to"]["at"] == s["clock"]
  end

  defp fuel_row?(r, spec, clock) do
    is_map(r) and map_size(r) == 3 and fuel_integer?(r["remaining"], spec["capacity"]) and
      fuel_integer?(r["at"], clock) and is_boolean(r["lit"]) and
      (spec["kind"] == "source" or not r["lit"])
  end

  defp fuel_integer?(n, max),
    do: is_integer(n) and n >= 0 and n <= max and n <= 9_007_199_254_740_991
end
