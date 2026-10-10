defmodule Loka.Core.CalendarResourceTest do
  use ExUnit.Case, async: true
  alias Loka.Core.{Compose, Invariants, Resource}

  # Breaks: portable legacy gain ignores its authored interval or changes fractional M2 recovery.
  test "authored gain boundary and opted fractional recovery have independent answers" do
    spec = %{"minimum" => 0, "maximum" => 20, "start" => 4, "gain" => 2, "gain_every" => 100}
    row = %{"value" => 4, "at" => 95}
    assert Resource.current(row, spec, 205) == 8

    opted = Map.put(spec, "regen", %{"every" => 60, "by_position" => %{"standing" => 2}})
    assert Resource.current(Map.merge(row, %{"rate" => 2, "remainder" => 0}), opted, 205) == 7
  end

  # Breaks: hourly invariant replay rejects an authored-interval debit and accepts a forged stale from-value.
  test "independent resource replay honors authored gain boundaries" do
    %{"resource" => resource, "target" => target} =
      JSON.decode!(File.read!("protocol/fixtures/resource_recovery.json"))

    spec = %{"minimum" => 0, "maximum" => 20, "start" => 4, "gain" => 2, "gain_every" => 100}

    state = %{
      "clock" => 205,
      "resource_specs" => %{Compose.key(resource) => spec},
      "resources" => %{Compose.key(target) => %{"value" => 4, "at" => 95}}
    }

    op = %{
      "op" => "resource.adjust",
      "writer_group" => 0,
      "resource" => resource,
      "entity_id" => target["entity_id"],
      "from" => 8,
      "to" => 7
    }

    delta = %{"ops" => [op]}
    result = %{"changes" => [%{"target" => target, "value" => %{"value" => 7, "at" => 205}}]}
    assert Compose.compose(state, delta) == result
    observation = %{"state" => state, "delta" => delta, "result" => result}
    forged = %{"ops" => [%{op | "from" => 4}]}

    assert [
             Invariants.check("delta_preconditions_hold", observation),
             Invariants.check("delta_preconditions_hold", %{observation | "delta" => forged})
           ] == [true, false]
  end

  # Breaks: composition or the independent replay keeps the authored maximum 10 when
  # resource_maxima moves it (derived hp_max, mechanics.md resource@1): a raised write above 10 or
  # a row stored above a lowered maximum faults instead of settling there with no fraction.
  test "a resource_maxima entry replaces the maximum and caps a row stored above it" do
    fixture = JSON.decode!(File.read!("protocol/fixtures/resource_recovery.json"))
    at = Compose.key(fixture["target"])
    row = &%{"value" => &1, "at" => &2, "rate" => 2, "remainder" => &3}

    # raised to 14: 10 s at rate 2 per 10 s gains 2 past the authored 10; lowered to 6: the
    # stored 9 with fraction 3 reads as 6 with none; lowered to 9: it keeps no fraction at 9.
    for {maximum, clock, stored, from, to, written} <- [
          {14, 110, row.(10, 100, 0), 12, 13, row.(13, 110, 0)},
          {6, 100, row.(9, 95, 3), 6, 5, row.(5, 100, 0)},
          {9, 100, row.(9, 95, 3), 9, 8, row.(8, 100, 0)}
        ] do
      state = %{
        "clock" => clock,
        "resource_specs" => %{Compose.key(fixture["resource"]) => fixture["spec"]},
        "resource_maxima" => %{at => maximum},
        "resources" => %{at => stored}
      }

      op = %{
        "op" => "resource.adjust",
        "writer_group" => 0,
        "resource" => fixture["resource"],
        "entity_id" => fixture["target"]["entity_id"],
        "from" => from,
        "to" => to
      }

      delta = %{"ops" => [op]}
      result = %{"changes" => [%{"target" => fixture["target"], "value" => written}]}
      assert Compose.compose(state, delta) == result, "maximum #{maximum}"
      observation = %{"state" => state, "delta" => delta, "result" => result}
      assert Invariants.check("delta_preconditions_hold", observation), "replay #{maximum}"
    end
  end
end
