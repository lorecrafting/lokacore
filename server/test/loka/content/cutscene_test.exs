defmodule Loka.Content.CutsceneTest do
  use Loka.DataCase, async: false

  alias Loka.Content.Cutscene
  alias Loka.Engine.{Entity, Entities}

  defp create_cutscene(key, data, opts \\ []) do
    entity =
      Entity.new(
        type: :cutscene,
        key: key,
        short_desc: opts[:name] || key,
        is_prototype: true,
        components: %{"data" => data}
      )

    {:ok, saved} = Entities.save(entity)
    saved
  end

  describe "get/1" do
    test "returns cutscene by key" do
      create_cutscene(
        "test_cutscene",
        %{
          "scenes" => [%{"id" => "scene_1", "text" => "A dark room..."}],
          "speakers" => ["narrator"]
        }, name: "Test Cutscene")

      assert {:ok, fetched} = Cutscene.get("test_cutscene")
      assert fetched.key == "test_cutscene"
    end

    test "returns error for non-cutscene" do
      entity =
        Entity.new(
          type: :npc,
          key: "not_cutscene",
          short_desc: "Not a cutscene",
          is_prototype: true,
          components: %{}
        )

      {:ok, _} = Entities.save(entity)

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

      entity = create_cutscene("multi_scene", %{"scenes" => scenes})
      {:ok, cutscene} = Entity.to_typed_object(entity)

      assert Cutscene.scenes(cutscene) == scenes
    end

    test "returns empty list when no scenes" do
      entity = create_cutscene("no_scenes", %{})
      {:ok, cutscene} = Entity.to_typed_object(entity)

      assert Cutscene.scenes(cutscene) == []
    end
  end

  describe "speakers/1" do
    test "returns speakers list" do
      entity =
        create_cutscene("speakers_cutscene", %{
          "speakers" => ["elder_pema", "narrator", "mysterious_voice"]
        })

      {:ok, cutscene} = Entity.to_typed_object(entity)

      assert Cutscene.speakers(cutscene) == ["elder_pema", "narrator", "mysterious_voice"]
    end

    test "returns empty list when no speakers" do
      entity = create_cutscene("no_speakers", %{})
      {:ok, cutscene} = Entity.to_typed_object(entity)

      assert Cutscene.speakers(cutscene) == []
    end
  end
end
