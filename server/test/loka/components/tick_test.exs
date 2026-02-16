defmodule Loka.Components.TickTest do
  use ExUnit.Case, async: true

  alias Loka.Components.Tick
  alias Loka.Engine.Entity

  defp entity(components \\ %{}) do
    Entity.new(type: :system, key: "test", components: components)
  end

  test "get/has?/put/component_key" do
    assert Tick.component_key() == "tick"
    refute Tick.has?(entity())

    e = Tick.put(entity(), %{"interval" => 1000})
    assert Tick.has?(e)
  end

  test "interval/1" do
    e = entity(%{"tick" => %{"interval" => 3000}})
    assert Tick.interval(e) == 3000
  end

  test "interval defaults to 5000" do
    assert Tick.interval(entity()) == 5000
  end
end
