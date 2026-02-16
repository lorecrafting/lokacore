defmodule Loka.Components.QuestProgressTest do
  use ExUnit.Case, async: true

  alias Loka.Components.QuestProgress
  alias Loka.Engine.Entity

  defp entity(components \\ %{}) do
    Entity.new(type: :character, key: "test", components: components)
  end

  test "get/has?/put/component_key" do
    assert QuestProgress.component_key() == "quest_progress"
    refute QuestProgress.has?(entity())

    e = QuestProgress.put(entity(), %{"active" => %{"q1" => %{}}})
    assert QuestProgress.has?(e)
  end

  test "active/completed/failed" do
    e =
      entity(%{
        "quest_progress" => %{
          "active" => %{"q1" => %{"status" => "in_progress"}},
          "completed" => ["q2"],
          "failed" => ["q3"]
        }
      })

    assert QuestProgress.active(e) == %{"q1" => %{"status" => "in_progress"}}
    assert QuestProgress.completed(e) == ["q2"]
    assert QuestProgress.failed(e) == ["q3"]
  end

  test "defaults" do
    e = entity()
    assert QuestProgress.active(e) == %{}
    assert QuestProgress.completed(e) == []
    assert QuestProgress.failed(e) == []
  end
end
