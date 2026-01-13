defmodule Loka.Content.QuestTest do
  use ExUnit.Case, async: false

  alias Loka.Content.Quest
  alias Loka.Engine.TypedObject
  alias Loka.Engine.TypedObject.Registry

  setup do
    Registry.init()
    Registry.clear()
    :ok
  end

  describe "get/1" do
    test "returns quest by key" do
      {:ok, quest} =
        TypedObject.new(
          key: "test_quest",
          type: :quest,
          data: %{
            "quest_type" => "main",
            "objectives" => [%{"id" => "obj1", "type" => "kill"}]
          }
        )

      Registry.put("test_quest", quest)

      assert {:ok, fetched} = Quest.get("test_quest")
      assert fetched.key == "test_quest"
    end

    test "returns error for non-quest" do
      {:ok, entity} = TypedObject.new(key: "not_quest", type: :entity)
      Registry.put("not_quest", entity)

      assert {:error, :not_found} = Quest.get("not_quest")
    end

    test "returns error for missing key" do
      assert {:error, :not_found} = Quest.get("missing")
    end
  end

  describe "quest_type/1" do
    test "returns quest type" do
      {:ok, quest} =
        TypedObject.new(
          key: "typed_quest",
          type: :quest,
          data: %{"quest_type" => "daily", "objectives" => [%{"id" => "o1"}]}
        )

      assert Quest.quest_type(quest) == :daily
    end

    test "defaults to side" do
      {:ok, quest} =
        TypedObject.new(
          key: "no_type",
          type: :quest,
          data: %{"objectives" => [%{"id" => "o1"}]}
        )

      assert Quest.quest_type(quest) == :side
    end
  end

  describe "objectives/1" do
    test "returns objectives list" do
      objectives = [
        %{"id" => "find_item", "type" => "collect"},
        %{"id" => "kill_boss", "type" => "kill"}
      ]

      {:ok, quest} =
        TypedObject.new(
          key: "multi_obj",
          type: :quest,
          data: %{"objectives" => objectives}
        )

      assert Quest.objectives(quest) == objectives
    end

    test "returns empty list when no objectives" do
      {:ok, quest} =
        TypedObject.new(
          key: "empty_obj",
          type: :quest,
          data: %{}
        )

      assert Quest.objectives(quest) == []
    end
  end

  describe "rewards/1" do
    test "returns rewards map" do
      rewards = %{"xp" => 1000, "gold" => 500}

      {:ok, quest} =
        TypedObject.new(
          key: "rewarded",
          type: :quest,
          data: %{"rewards" => rewards, "objectives" => [%{"id" => "o1"}]}
        )

      assert Quest.rewards(quest) == rewards
    end
  end

  describe "repeatable?/1" do
    test "returns true for daily quests" do
      {:ok, quest} =
        TypedObject.new(
          key: "daily",
          type: :quest,
          data: %{"quest_type" => "daily", "objectives" => [%{"id" => "o1"}]}
        )

      assert Quest.repeatable?(quest)
    end

    test "returns false for main quests" do
      {:ok, quest} =
        TypedObject.new(
          key: "main",
          type: :quest,
          data: %{"quest_type" => "main", "objectives" => [%{"id" => "o1"}]}
        )

      refute Quest.repeatable?(quest)
    end
  end

  describe "validate/1" do
    test "passes for valid quest" do
      {:ok, quest} =
        TypedObject.new(
          key: "valid_quest",
          type: :quest,
          data: %{
            "objectives" => [
              %{"id" => "obj1", "type" => "kill"},
              %{"id" => "obj2", "type" => "collect"}
            ]
          }
        )

      assert :ok = Quest.validate(quest)
    end

    test "fails for quest without objectives" do
      {:ok, quest} =
        TypedObject.new(
          key: "no_objectives",
          type: :quest,
          data: %{}
        )

      assert {:error, errors} = Quest.validate(quest)
      assert "quest must have at least one objective" in errors
    end

    test "fails for objectives without ids" do
      {:ok, quest} =
        TypedObject.new(
          key: "missing_ids",
          type: :quest,
          data: %{"objectives" => [%{"type" => "kill"}]}
        )

      assert {:error, errors} = Quest.validate(quest)
      assert "all objectives must have an id" in errors
    end
  end
end
