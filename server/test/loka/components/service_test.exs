defmodule Loka.Components.ServiceTest do
  use ExUnit.Case, async: true

  alias Loka.Components.Service
  alias Loka.Engine.Entity

  defp entity(components \\ %{}) do
    Entity.new(type: :system, key: "test", components: components)
  end

  test "get/has?/put/component_key" do
    assert Service.component_key() == "service"
    refute Service.has?(entity())

    e = Service.put(entity(), %{"boot_priority" => 10})
    assert Service.has?(e)
  end

  test "boot_priority/1" do
    e = entity(%{"service" => %{"boot_priority" => 5}})
    assert Service.boot_priority(e) == 5
  end

  test "boot_priority defaults to 100" do
    assert Service.boot_priority(entity()) == 100
  end
end
