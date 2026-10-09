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

  @spec resource_after(map(), map(), term(), integer()) :: map() | nil
  def resource_after(op, s, stored, horizon) do
    maximum = get_in(s, ["resource_maxima", Compose.key(Compose.target(op))])
    {spec, row} = effective(spec(op, s), stored, maximum)
    now = Map.get(op, "at", s["clock"])

    valid =
      spec != nil and valid_time?(op, now, s["clock"], horizon) and row_time?(row, now)

    if valid do
      if spec["regen"] != nil,
        do: recovered(op, spec, row, now),
        else:
          legacy(
            op,
            spec,
            row,
            now,
            get_in(s, ["entity_resource_specs", Compose.key(Compose.target(op))])
          )
    end
  end

  defp valid_time?(op, now, clock, horizon),
    do: safe?(now) and (not Map.has_key?(op, "at") or (now >= clock and now <= horizon))

  defp row_time?(row, now),
    do: row == nil or (safe?(row["at"]) and row["at"] >= 0 and row["at"] <= now)

  defp legacy(op, spec, row, now, required) do
    valid =
      (required == nil or override_row?(row, spec, now)) and
        not Map.has_key?(op, "next_rate") and bounded?(op["to"], spec)

    before = row || %{"value" => spec["start"], "at" => 0}

    if valid and is_integer(before["value"]) and is_integer(before["at"]) do
      every = Map.get(spec, "gain_every", 3600)
      ticks = Integer.floor_div(now, every) - Integer.floor_div(before["at"], every)
      value = min(spec["maximum"], before["value"] + spec["gain"] * ticks)
      if value == op["from"], do: %{"value" => op["to"], "at" => now}
    end
  end

  # A resource_maxima entry replaces the maximum; a row above it reads as it with no fraction.
  defp effective(spec, row, maximum) when spec == nil or maximum == nil, do: {spec, row}
  defp effective(spec, row, maximum), do: {Map.put(spec, "maximum", maximum), cap(row, maximum)}

  defp cap(%{"value" => v} = row, maximum) when is_integer(v) and v > maximum do
    row = Map.put(row, "value", maximum)
    if is_map_key(row, "remainder"), do: Map.put(row, "remainder", 0), else: row
  end

  defp cap(row, _), do: row

  defp spec(op, s),
    do:
      get_in(s, ["entity_resource_specs", Compose.key(Compose.target(op))]) ||
        get_in(s, ["resource_specs", Compose.key(op["resource"])])

  defp override_row?(%{"value" => v, "at" => at} = row, spec, now),
    do:
      map_size(row) == 2 and is_integer(v) and v >= spec["minimum"] and v <= spec["maximum"] and
        is_integer(at) and at >= 0 and at <= 9_007_199_254_740_991 and at <= now

  defp override_row?(_, _, _), do: false
end
