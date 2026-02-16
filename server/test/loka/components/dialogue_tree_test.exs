defmodule Loka.Components.DialogueTreeTest do
  use ExUnit.Case, async: true

  alias Loka.Components.DialogueTree
  alias Loka.Engine.Entity

  defp entity(components \\ %{}) do
    Entity.new(type: :dialogue, key: "test", components: components)
  end

  test "get/has?/put/component_key" do
    assert DialogueTree.component_key() == "dialogue_tree"
    refute DialogueTree.has?(entity())

    e = DialogueTree.put(entity(), %{"nodes" => %{"start" => %{}}})
    assert DialogueTree.has?(e)
  end

  test "nodes/options" do
    e =
      entity(%{
        "dialogue_tree" => %{
          "nodes" => %{"start" => %{"text" => "Hello"}},
          "options" => [%{"label" => "Hi"}]
        }
      })

    assert DialogueTree.nodes(e) == %{"start" => %{"text" => "Hello"}}
    assert DialogueTree.options(e) == [%{"label" => "Hi"}]
  end

  test "defaults" do
    e = entity()
    assert DialogueTree.nodes(e) == %{}
    assert DialogueTree.options(e) == []
  end
end
