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

  describe "state machine" do
    alias Loka.Engine.StateMachine

    test "machine/0 returns a StateMachine struct" do
      machine = QuestProgress.machine()
      assert %StateMachine{} = machine
      assert machine.initial == "available"
    end

    test "valid quest transitions" do
      machine = QuestProgress.machine()
      assert {:ok, "accepted"} = StateMachine.transition(machine, "available", "accepted")
      assert {:ok, "in_progress"} = StateMachine.transition(machine, "accepted", "in_progress")

      assert {:ok, "objectives_complete"} =
               StateMachine.transition(machine, "in_progress", "objectives_complete")

      assert {:ok, "turned_in"} =
               StateMachine.transition(machine, "objectives_complete", "turned_in")
    end

    test "invalid quest transitions rejected" do
      machine = QuestProgress.machine()
      assert {:error, _} = StateMachine.transition(machine, "available", "turned_in")
      assert {:error, _} = StateMachine.transition(machine, "in_progress", "accepted")
    end

    test "abandon and re-accept" do
      machine = QuestProgress.machine()
      assert {:ok, "abandoned"} = StateMachine.transition(machine, "in_progress", "abandoned")
      assert {:ok, "accepted"} = StateMachine.transition(machine, "abandoned", "accepted")
    end
  end
end
