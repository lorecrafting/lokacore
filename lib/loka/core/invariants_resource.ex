defmodule Loka.Core.InvariantsResource do
  @moduledoc "Independent resource precondition and metadata replay."
  # Independent opted-row arithmetic; never call Compose.current/3 or its settlement.
  alias Loka.Core.Compose

  def recovered(op, spec, row, now) when is_map(row) do
    next_rate = Map.get(op, "next_rate", row["rate"])

    valid =
      valid_row?(row, spec, now) and bounded?(op["to"], spec) and
        is_integer(next_rate) and next_rate in Map.values(spec["regen"]["by_position"])

    if valid, do: replay(op, spec, row, now, next_rate)
  end

  def recovered(_, _, _, _), do: nil

  defp replay(op, spec, row, now, next_rate) do
    {settled_value, residual} = settle(spec, row, now)

    if settled_value == op["from"] do
      %{
        "value" => op["to"],
        "at" => now,
        "rate" => next_rate,
        "remainder" => if(op["to"] == spec["maximum"], do: 0, else: residual)
      }
    end
  end

  defp settle(spec, row, now) do
    every = spec["regen"]["every"]
    intervals = div(now - row["at"], every)
    space = spec["maximum"] - row["value"]
    rate = row["rate"]

    if space == 0 or (rate > 0 and intervals >= div(space + rate - 1, rate)),
      do: {spec["maximum"], 0},
      else: credit(spec, row, now, intervals)
  end

  defp credit(spec, row, now, intervals) do
    every = spec["regen"]["every"]
    credit = row["remainder"] + rem(now - row["at"], every) * row["rate"]
    gained = row["value"] + intervals * row["rate"] + div(credit, every)
    {min(spec["maximum"], gained), if(gained >= spec["maximum"], do: 0, else: rem(credit, every))}
  end

  defp valid_row?(row, spec, now) do
    safe?(now) and now >= 0 and safe?(row["at"]) and row["at"] >= 0 and row["at"] <= now and
      bounded?(row["value"], spec) and valid_credit?(row, spec)
  end

  defp bounded?(n, spec), do: is_integer(n) and n >= spec["minimum"] and n <= spec["maximum"]

  defp valid_credit?(row, spec) do
    is_integer(row["rate"]) and row["rate"] in Map.values(spec["regen"]["by_position"]) and
      safe?(row["remainder"]) and row["remainder"] >= 0 and
      row["remainder"] < spec["regen"]["every"] and
      (row["value"] != spec["maximum"] or row["remainder"] == 0)
  end

  defp safe?(n), do: is_integer(n) and n >= -9_007_199_254_740_991 and n <= 9_007_199_254_740_991

  def initial(%{"op" => "resource.adjust"} = op, s) do
    spec = spec(op, s)
    row = get_in(s, ["resources", Compose.key(Compose.target(op))])

    required = get_in(s, ["entity_resource_specs", Compose.key(Compose.target(op))])

    if spec != nil and spec["regen"] == nil and
         (required == nil or override_row?(row, spec, s["clock"])) do
      row = row || %{"value" => spec["start"], "at" => 0}

      if is_integer(row["value"]) and is_integer(row["at"]) do
        ticks = Integer.floor_div(s["clock"], 3600) - Integer.floor_div(row["at"], 3600)
        min(spec["maximum"], row["value"] + spec["gain"] * ticks)
      end
    end
  end

  def legacy_valid?(op, s) do
    spec = spec(op, s)

    spec != nil and not Map.has_key?(op, "next_rate") and is_integer(op["to"]) and
      op["to"] >= spec["minimum"] and op["to"] <= spec["maximum"]
  end

  def spec(op, s),
    do:
      get_in(s, ["entity_resource_specs", Compose.key(Compose.target(op))]) ||
        get_in(s, ["resource_specs", Compose.key(op["resource"])])

  defp override_row?(%{"value" => v, "at" => at} = row, spec, now),
    do:
      map_size(row) == 2 and is_integer(v) and v >= spec["minimum"] and v <= spec["maximum"] and
        is_integer(at) and at >= 0 and at <= 9_007_199_254_740_991 and at <= now

  defp override_row?(_, _, _), do: false
end
