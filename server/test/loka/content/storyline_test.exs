defmodule Loka.Content.StorylineTest do
  use Loka.DataCase, async: false

  alias Loka.Content.Storyline
  alias Loka.Engine.{Entity, Entities}

  defp create_storyline(key, data, opts \\ []) do
    entity =
      Entity.new(
        type: :storyline,
        key: key,
        short_desc: opts[:name] || key,
        is_prototype: true,
        components: %{"data" => data}
      )

    {:ok, saved} = Entities.save(entity)
    saved
  end

  describe "get/1" do
    test "returns storyline by key" do
      create_storyline(
        "test_storyline",
        %{
          "main_quests" => ["quest_a", "quest_b"],
          "side_quests" => ["sq_1"]
        }, name: "Test Storyline")

      assert {:ok, fetched} = Storyline.get("test_storyline")
      assert fetched.key == "test_storyline"
    end

    test "returns error for non-storyline" do
      entity =
        Entity.new(
          type: :npc,
          key: "not_storyline",
          short_desc: "Not a storyline",
          is_prototype: true,
          components: %{}
        )

      {:ok, _} = Entities.save(entity)

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

      entity = create_storyline("acts_storyline", %{"acts" => acts})
      {:ok, storyline} = Entity.to_typed_object(entity)

      assert Storyline.acts(storyline) == acts
    end

    test "returns empty list when no acts" do
      entity = create_storyline("no_acts", %{})
      {:ok, storyline} = Entity.to_typed_object(entity)

      assert Storyline.acts(storyline) == []
    end
  end

  describe "side_quests/1" do
    test "returns side quests list" do
      entity = create_storyline("side_storyline", %{"side_quests" => ["sq_1", "sq_2", "sq_3"]})
      {:ok, storyline} = Entity.to_typed_object(entity)

      assert Storyline.side_quests(storyline) == ["sq_1", "sq_2", "sq_3"]
    end

    test "returns empty list when no side quests" do
      entity = create_storyline("no_side", %{})
      {:ok, storyline} = Entity.to_typed_object(entity)

      assert Storyline.side_quests(storyline) == []
    end
  end

  describe "main_quests/1" do
    test "returns main quests list" do
      entity = create_storyline("main_storyline", %{"main_quests" => ["mq_1", "mq_2"]})
      {:ok, storyline} = Entity.to_typed_object(entity)

      assert Storyline.main_quests(storyline) == ["mq_1", "mq_2"]
    end

    test "returns empty list when no main quests" do
      entity = create_storyline("no_main", %{})
      {:ok, storyline} = Entity.to_typed_object(entity)

      assert Storyline.main_quests(storyline) == []
    end
  end
end
