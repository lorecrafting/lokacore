defmodule Loka.Content.QuestTest do
  use Loka.DataCase, async: false

  alias Loka.Content.Quest
  alias Loka.Engine.{Entity, Entities}

  defp create_quest(key, data, opts \\ []) do
    entity =
      Entity.new(
        type: :quest,
        key: key,
        short_desc: opts[:name] || key,
        is_prototype: true,
        components: %{"data" => data}
      )

    {:ok, saved} = Entities.save(entity)
    saved
  end

  describe "get/1" do
    test "returns quest by key" do
      create_quest("test_quest", %{
        "quest_type" => "main",
        "objectives" => [%{"id" => "obj1", "type" => "kill"}]
      })

      assert {:ok, fetched} = Quest.get("test_quest")
      assert fetched.key == "test_quest"
    end

    test "returns error for non-quest" do
      entity =
        Entity.new(
          type: :npc,
          key: "not_quest",
          short_desc: "Not a quest",
          is_prototype: true,
          components: %{}
        )

      {:ok, _} = Entities.save(entity)

      assert {:error, :not_found} = Quest.get("not_quest")
    end

    test "returns error for missing key" do
      assert {:error, :not_found} = Quest.get("missing")
    end
  end

  describe "quest_type/1" do
    test "returns quest type" do
      entity =
        create_quest("typed_quest", %{"quest_type" => "daily", "objectives" => [%{"id" => "o1"}]})

      {:ok, quest} = Entity.to_typed_object(entity)

      assert Quest.quest_type(quest) == :daily
    end

    test "defaults to side" do
      entity = create_quest("no_type", %{"objectives" => [%{"id" => "o1"}]})
      {:ok, quest} = Entity.to_typed_object(entity)

      assert Quest.quest_type(quest) == :side
    end
  end

  describe "objectives/1" do
    test "returns objectives list" do
      objectives = [
        %{"id" => "find_item", "type" => "collect"},
        %{"id" => "kill_boss", "type" => "kill"}
      ]

      entity = create_quest("multi_obj", %{"objectives" => objectives})
      {:ok, quest} = Entity.to_typed_object(entity)

      assert Quest.objectives(quest) == objectives
    end

    test "returns empty list when no objectives" do
      entity = create_quest("empty_obj", %{})
      {:ok, quest} = Entity.to_typed_object(entity)

      assert Quest.objectives(quest) == []
    end
  end

  describe "rewards/1" do
    test "returns rewards map" do
      rewards = %{"xp" => 1000, "gold" => 500}

      entity =
        create_quest("rewarded", %{"rewards" => rewards, "objectives" => [%{"id" => "o1"}]})

      {:ok, quest} = Entity.to_typed_object(entity)

      assert Quest.rewards(quest) == rewards
    end
  end

  describe "repeatable?/1" do
    test "returns true for daily quests" do
      entity =
        create_quest("daily", %{"quest_type" => "daily", "objectives" => [%{"id" => "o1"}]})

      {:ok, quest} = Entity.to_typed_object(entity)

      assert Quest.repeatable?(quest)
    end

    test "returns false for main quests" do
      entity = create_quest("main", %{"quest_type" => "main", "objectives" => [%{"id" => "o1"}]})
      {:ok, quest} = Entity.to_typed_object(entity)

      refute Quest.repeatable?(quest)
    end
  end

  describe "validate/1" do
    test "passes for valid quest" do
      entity =
        create_quest("valid_quest", %{
          "objectives" => [
            %{"id" => "obj1", "type" => "kill"},
            %{"id" => "obj2", "type" => "collect"}
          ]
        })

      {:ok, quest} = Entity.to_typed_object(entity)

      assert :ok = Quest.validate(quest)
    end

    test "fails for quest without objectives" do
      entity = create_quest("no_objectives", %{})
      {:ok, quest} = Entity.to_typed_object(entity)

      assert {:error, errors} = Quest.validate(quest)
      assert "quest must have at least one objective" in errors
    end

    test "fails for objectives without ids" do
      entity = create_quest("missing_ids", %{"objectives" => [%{"type" => "kill"}]})
      {:ok, quest} = Entity.to_typed_object(entity)

      assert {:error, errors} = Quest.validate(quest)
      assert "all objectives must have an id" in errors
    end
  end
end
