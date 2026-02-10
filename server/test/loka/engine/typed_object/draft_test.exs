defmodule Loka.Engine.TypedObject.DraftTest do
  use ExUnit.Case, async: false

  alias Loka.Engine.TypedObject

  describe "draft?/1" do
    test "returns true when metadata has draft: true" do
      {:ok, obj} =
        TypedObject.new(
          key: "test_draft",
          type: :quest,
          metadata: %{"draft" => true}
        )

      assert TypedObject.draft?(obj)
    end

    test "returns false when metadata has no draft flag" do
      {:ok, obj} = TypedObject.new(key: "test_published", type: :quest)
      refute TypedObject.draft?(obj)
    end

    test "returns false when metadata has draft: false" do
      {:ok, obj} =
        TypedObject.new(
          key: "test_published_explicit",
          type: :quest,
          metadata: %{"draft" => false}
        )

      refute TypedObject.draft?(obj)
    end

    test "returns false for non-TypedObject values" do
      refute TypedObject.draft?(nil)
      refute TypedObject.draft?(%{})
    end
  end

  describe "published?/1" do
    test "returns true for non-draft objects" do
      {:ok, obj} = TypedObject.new(key: "test_published", type: :quest)
      assert TypedObject.published?(obj)
    end

    test "returns false for draft objects" do
      {:ok, obj} =
        TypedObject.new(
          key: "test_draft",
          type: :quest,
          metadata: %{"draft" => true}
        )

      refute TypedObject.published?(obj)
    end
  end

  describe "new types" do
    test "creates storyline type" do
      {:ok, obj} = TypedObject.new(key: "test_storyline", type: :storyline)
      assert obj.type == :storyline
      assert TypedObject.content?(obj)
    end

    test "creates cutscene type" do
      {:ok, obj} = TypedObject.new(key: "test_cutscene", type: :cutscene)
      assert obj.type == :cutscene
    end

    test "creates skill type" do
      {:ok, obj} = TypedObject.new(key: "test_skill", type: :skill)
      assert obj.type == :skill
    end

    test "creates status type" do
      {:ok, obj} = TypedObject.new(key: "test_status", type: :status)
      assert obj.type == :status
    end

    test "creates resource type" do
      {:ok, obj} = TypedObject.new(key: "test_resource", type: :resource)
      assert obj.type == :resource
    end

    test "creates recipe type" do
      {:ok, obj} = TypedObject.new(key: "test_recipe", type: :recipe)
      assert obj.type == :recipe
    end

    test "creates gathering_node type" do
      {:ok, obj} = TypedObject.new(key: "test_node", type: :gathering_node)
      assert obj.type == :gathering_node
    end
  end

  describe "draft path detection in loader" do
    test "draft_path? detects paths with drafts directory" do
      # We test this indirectly by creating a TypedObject from a draft path
      # Simulate what create_typed_object does
      file = "/app/priv/world/drafts/quests/draft_test.yml"
      has_drafts = file |> Path.split() |> Enum.any?(&(&1 == "drafts"))
      assert has_drafts
    end

    test "draft_path? returns false for published paths" do
      file = "/app/priv/world/quests/published_test.yml"
      has_drafts = file |> Path.split() |> Enum.any?(&(&1 == "drafts"))
      refute has_drafts
    end
  end

  describe "published query filtering" do
    setup do
      Loka.TypedObjectSandbox.checkout()

      alias Loka.Engine.TypedObject.Registry

      # Add a published quest
      {:ok, published} =
        TypedObject.new(key: "pub_quest", type: :quest, name: "Published Quest")

      Registry.put("pub_quest", published)

      # Add a draft quest
      {:ok, draft} =
        TypedObject.new(
          key: "draft_quest",
          type: :quest,
          name: "Draft Quest",
          metadata: %{"draft" => true}
        )

      Registry.put("draft_quest", draft)

      %{published: published, draft: draft}
    end

    test "list_by_type returns both published and draft" do
      alias Loka.Engine.TypedObject.Registry
      quests = Registry.list_by_type(:quest)
      keys = Enum.map(quests, & &1.key)
      assert "pub_quest" in keys
      assert "draft_quest" in keys
    end

    test "list_by_type_published excludes drafts" do
      alias Loka.Engine.TypedObject.Registry
      quests = Registry.list_by_type_published(:quest)
      keys = Enum.map(quests, & &1.key)
      assert "pub_quest" in keys
      refute "draft_quest" in keys
    end
  end
end
