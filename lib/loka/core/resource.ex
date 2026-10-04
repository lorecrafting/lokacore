defmodule Loka.Core.Resource do
  @moduledoc "Resource arithmetic for the portable delta algebra."
  @doc """
  A resource's current value at `now` (ResourceSpec regeneration): the stored value (`start` at
  time 0 when unset) plus `gain` for each hour boundary crossed since it was stored, stopping at
  `maximum` for legacy rows. Opted recovery settles the old stored rate and exact fraction
  (active mechanics.md resource@1); nil for a malformed row (TypeScript's is NaN).
  """
  @spec current(map() | nil, map(), integer()) :: integer() | nil
  def current(row, %{"regen" => _} = spec, now) do
    case settled(row, spec, now) do
      nil -> nil
      row -> row["value"]
    end
  end

  def current(nil, spec, now), do: current(%{"value" => spec["start"], "at" => 0}, spec, now)

  def current(%{"value" => v, "at" => at}, spec, now) when is_integer(v) and is_integer(at) do
    ticks = Integer.floor_div(now, 3600) - Integer.floor_div(at, 3600)
    min(spec["maximum"], v + spec["gain"] * ticks)
  end

  def current(_, _, _), do: nil

  defp settled(row, spec, now) when is_map(row) do
    if value?(row["value"], spec) and clock?(row["at"], now) and metadata?(row, spec),
      do: advance(row, spec, now)
  end

  defp settled(_, _, _), do: nil

  defp value?(v, spec), do: is_integer(v) and v >= spec["minimum"] and v <= spec["maximum"]
  defp clock?(at, now), do: safe?(now) and now >= 0 and safe?(at) and at >= 0 and at <= now

  defp metadata?(row, spec) do
    rate = row["rate"]
    remainder = row["remainder"]
    regen = spec["regen"]

    is_integer(rate) and rate in Map.values(regen["by_position"]) and
      safe?(remainder) and remainder >= 0 and remainder < regen["every"] and
      (row["value"] != spec["maximum"] or remainder == 0)
  end

  defp advance(row, spec, now) do
    whole = div(now - row["at"], spec["regen"]["every"])
    room = spec["maximum"] - row["value"]
    rate = row["rate"]

    {value, fraction} =
      if room == 0 or (rate > 0 and whole >= div(room + rate - 1, rate)),
        do: {spec["maximum"], 0},
        else: uncapped(row, spec, now, whole)

    %{"value" => value, "at" => now, "rate" => rate, "remainder" => fraction}
  end

  defp uncapped(row, spec, now, whole) do
    every = spec["regen"]["every"]
    numerator = row["remainder"] + rem(now - row["at"], every) * row["rate"]
    next = row["value"] + whole * row["rate"] + div(numerator, every)
    residual = if next >= spec["maximum"], do: 0, else: rem(numerator, every)
    {min(spec["maximum"], next), residual}
  end

  defp safe?(n), do: is_integer(n) and n >= -9_007_199_254_740_991 and n <= 9_007_199_254_740_991

  def adjusted(%{"from" => from, "to" => to} = op, row, spec, now) do
    cond do
      spec == nil or not value?(to, spec) ->
        {:error, "precondition_failed"}

      spec["regen"] != nil ->
        recovered_adjustment(op, row, spec, now)

      not Map.has_key?(op, "next_rate") and current(row, spec, now) == from ->
        {:ok, %{"value" => to, "at" => now}}

      true ->
        {:error, "precondition_failed"}
    end
  end

  defp recovered_adjustment(op, row, spec, now) do
    before = settled(row, spec, now)
    next_rate = Map.get(op, "next_rate", before && before["rate"])
    valid_rate = is_integer(next_rate) and next_rate in Map.values(spec["regen"]["by_position"])

    if before != nil and before["value"] == op["from"] and valid_rate do
      remainder = if op["to"] == spec["maximum"], do: 0, else: before["remainder"]
      {:ok, %{"value" => op["to"], "at" => now, "rate" => next_rate, "remainder" => remainder}}
    else
      {:error, "precondition_failed"}
    end
  end

  def valid_override_row?(%{"value" => value, "at" => at} = row, spec, now),
    do:
      map_size(row) == 2 and is_integer(value) and value >= spec["minimum"] and
        value <= spec["maximum"] and is_integer(at) and at >= 0 and at <= 9_007_199_254_740_991 and
        at <= now

  def valid_override_row?(_, _, _), do: false
end
