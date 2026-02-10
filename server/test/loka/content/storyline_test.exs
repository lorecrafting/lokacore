defmodule Loka.Content.StorylineTest do
  use ExUnit.Case, async: false

  alias Loka.Content.Storyline
  alias Loka.Engine.TypedObject
  alias Loka.Engine.TypedObject.Registry

  setup do
    Loka.TypedObjectSandbox.checkout()
    :ok
  end

  describe "get/1" do
    test "returns storyline by key" do
      {:ok, storyline} =
        TypedObject.new(
          key: "test_storyline",
          type: :storyline,
          name: "Test Storyline",
          data: %{
            "main_quests" => ["quest_a", "quest_b"],
            "side_quests" => ["sq_1"]
          }
        )

      Registry.put("test_storyline", storyline)

      assert {:ok, fetched} = Storyline.get("test_storyline")
      assert fetched.key == "test_storyline"
    end

    test "returns error for non-storyline" do
      {:ok, entity} = TypedObject.new(key: "not_storyline", type: :entity)
      Registry.put("not_storyline", entity)

      assert {:error, :not_found} = Storyline.get("not_storyline")
    end

    test "returns error for missing key" do
      assert {:error, :not_found} = Storyline.get("missing")
    end
  end

  describe "acts/1" do
    test "returns acts list" do
      acts = [
        %{"id" => "act_1", "name" => "The Beginning", "quests" => ["q1", "q2"]},
        %{"id" => "act_2", "name" => "The Middle", "quests" => ["q3"]}
      ]

      {:ok, storyline} =
        TypedObject.new(
          key: "acts_storyline",
          type: :storyline,
          data: %{"acts" => acts}
        )

      assert Storyline.acts(storyline) == acts
    end

    test "returns empty list when no acts" do
      {:ok, storyline} =
        TypedObject.new(
          key: "no_acts",
          type: :storyline,
          data: %{}
        )

      assert Storyline.acts(storyline) == []
    end
  end

  describe "side_quests/1" do
    test "returns side quests list" do
      {:ok, storyline} =
        TypedObject.new(
          key: "side_storyline",
          type: :storyline,
          data: %{"side_quests" => ["sq_1", "sq_2", "sq_3"]}
        )

      assert Storyline.side_quests(storyline) == ["sq_1", "sq_2", "sq_3"]
    end

    test "returns empty list when no side quests" do
      {:ok, storyline} =
        TypedObject.new(
          key: "no_side",
          type: :storyline,
          data: %{}
        )

      assert Storyline.side_quests(storyline) == []
    end
  end

  describe "main_quests/1" do
    test "returns main quests list" do
      {:ok, storyline} =
        TypedObject.new(
          key: "main_storyline",
          type: :storyline,
          data: %{"main_quests" => ["mq_1", "mq_2"]}
        )

      assert Storyline.main_quests(storyline) == ["mq_1", "mq_2"]
    end

    test "returns empty list when no main quests" do
      {:ok, storyline} =
        TypedObject.new(
          key: "no_main",
          type: :storyline,
          data: %{}
        )

      assert Storyline.main_quests(storyline) == []
    end
  end
end
