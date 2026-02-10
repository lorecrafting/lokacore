defmodule Loka.Content.CutsceneTest do
  use ExUnit.Case, async: false

  alias Loka.Content.Cutscene
  alias Loka.Engine.TypedObject
  alias Loka.Engine.TypedObject.Registry

  setup do
    Loka.TypedObjectSandbox.checkout()
    :ok
  end

  describe "get/1" do
    test "returns cutscene by key" do
      {:ok, cutscene} =
        TypedObject.new(
          key: "test_cutscene",
          type: :cutscene,
          name: "Test Cutscene",
          data: %{
            "scenes" => [%{"id" => "scene_1", "text" => "A dark room..."}],
            "speakers" => ["narrator"]
          }
        )

      Registry.put("test_cutscene", cutscene)

      assert {:ok, fetched} = Cutscene.get("test_cutscene")
      assert fetched.key == "test_cutscene"
    end

    test "returns error for non-cutscene" do
      {:ok, entity} = TypedObject.new(key: "not_cutscene", type: :entity)
      Registry.put("not_cutscene", entity)

      assert {:error, :not_found} = Cutscene.get("not_cutscene")
    end

    test "returns error for missing key" do
      assert {:error, :not_found} = Cutscene.get("missing")
    end
  end

  describe "scenes/1" do
    test "returns scenes list" do
      scenes = [
        %{"id" => "scene_1", "text" => "The ground shakes..."},
        %{"id" => "scene_2", "text" => "A light appears..."},
        %{"id" => "scene_3", "text" => "Silence falls."}
      ]

      {:ok, cutscene} =
        TypedObject.new(
          key: "multi_scene",
          type: :cutscene,
          data: %{"scenes" => scenes}
        )

      assert Cutscene.scenes(cutscene) == scenes
    end

    test "returns empty list when no scenes" do
      {:ok, cutscene} =
        TypedObject.new(
          key: "no_scenes",
          type: :cutscene,
          data: %{}
        )

      assert Cutscene.scenes(cutscene) == []
    end
  end

  describe "speakers/1" do
    test "returns speakers list" do
      {:ok, cutscene} =
        TypedObject.new(
          key: "speakers_cutscene",
          type: :cutscene,
          data: %{"speakers" => ["elder_pema", "narrator", "mysterious_voice"]}
        )

      assert Cutscene.speakers(cutscene) == ["elder_pema", "narrator", "mysterious_voice"]
    end

    test "returns empty list when no speakers" do
      {:ok, cutscene} =
        TypedObject.new(
          key: "no_speakers",
          type: :cutscene,
          data: %{}
        )

      assert Cutscene.speakers(cutscene) == []
    end
  end
end
