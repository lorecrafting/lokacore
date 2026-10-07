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
end
