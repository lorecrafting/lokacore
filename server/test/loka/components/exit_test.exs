defmodule Loka.Components.ExitTest do
  use ExUnit.Case, async: true

  alias Loka.Components.Exit
  alias Loka.Engine.Entity

  defp entity(components \\ %{}) do
    Entity.new(type: :exit, key: "test", components: components)
  end

  test "get/has?/put/component_key" do
    assert Exit.component_key() == "exit"
    refute Exit.has?(entity())

    e = Exit.put(entity(), %{"direction" => "north"})
    assert Exit.has?(e)
  end

  test "direction/destination_id/destination_key" do
    e =
      entity(%{
        "exit" => %{
          "direction" => "north",
          "destination_id" => "uuid-1",
          "destination_key" => "town_square"
        }
      })

    assert Exit.direction(e) == "north"
    assert Exit.destination_id(e) == "uuid-1"
    assert Exit.destination_key(e) == "town_square"
  end

  test "defaults to nil" do
    e = entity()
    assert Exit.direction(e) == nil
    assert Exit.destination_id(e) == nil
    assert Exit.destination_key(e) == nil
  end
end
