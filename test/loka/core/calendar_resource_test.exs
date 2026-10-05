defmodule Loka.Core.CalendarResourceTest do
  use ExUnit.Case, async: true
  alias Loka.Core.Resource

  # Breaks: portable legacy gain ignores its authored interval or changes fractional M2 recovery.
  test "authored gain boundary and opted fractional recovery have independent answers" do
    spec = %{"minimum" => 0, "maximum" => 20, "start" => 4, "gain" => 2, "gain_every" => 100}
    row = %{"value" => 4, "at" => 95}
    assert Resource.current(row, spec, 205) == 8

    opted = Map.put(spec, "regen", %{"every" => 60, "by_position" => %{"standing" => 2}})
    assert Resource.current(Map.merge(row, %{"rate" => 2, "remainder" => 0}), opted, 205) == 7
  end
end
