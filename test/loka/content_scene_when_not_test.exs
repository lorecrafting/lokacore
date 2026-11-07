defmodule Loka.ContentSceneWhenNotTest do
  # `when: not <fact>`, and `once` and `asked` written twice (docs/guides/writing-the-game.md).
  use ExUnit.Case, async: true

  @moduletag :tmp_dir

  defp facts do
    {"facts.json",
     fn file ->
       met = %{
         "version" => 1,
         "value_type" => %{"type" => "bool", "default" => false},
         "scopes" => ["player"],
         "meaning" => "~"
       }

       update_in(file, ["facts"], &Map.put(&1, "met", met))
     end}
  end

  defp compile(text) do
    dir = Loka.ContentSource.copy("cartridges/scene_sampler")
    File.write!(Path.join(dir, "scenes/scene.scene"), text)
    Loka.ContentSource.compile(dir, [facts()])
  end

  # Break: `when: not` reads as a fact named "not met" or lowers to the plain fact.
  test "when: not lowers to the negated fact" do
    assert {:ok, out, []} = compile("npc: bram\nwhen: not met\nbram: ~\n- Go\n  bram: ~\n")
    scene = JSON.decode!(out)["cartridge"]["dialogues"]["scene_sampler@0.0.1:dialogue/scene"]

    assert %{"op" => "not", "item" => %{"op" => "fact_compare", "equals" => true}} =
             scene["policy"]
  end

  # Break: the opposite-condition check takes `when: not met` for `when: met`, or misses it.
  test "a needs against when: not warns; one agreeing does not" do
    head = "npc: bram\nwhen: not met\nbram: ~\n- Go\n"
    assert {:ok, _, [warned]} = compile(head <> "  needs: met\n  bram: ~\n")
    assert warned["data"]["why"] == "unreachable"
    assert {:ok, _, []} = compile(head <> "  needs: not met\n  bram: ~\n")
  end

  # Break: a doubled word compiles as if written once, hiding a slip.
  test "once or asked twice under a choice is refused at the second line" do
    for {word, why} <- [{"once", "bad_once"}, {"asked", "bad_asked"}] do
      text = "npc: bram\nbram: ~\n- Go\n  bram: ~\n  #{word}\n  #{word}\n"
      assert {:error, [%{"data" => %{"why" => ^why, "line" => 6}}]} = compile(text)
    end
  end

  # Break (dialogue_once.ex): `once` replaces the choice's `sets:` step or runs before it.
  test "once adds its fact after a written sets" do
    assert {:ok, out, []} = compile("npc: bram\nbram: ~\n- Go\n  bram: ~\n  once\n  sets: met\n")
    scene = JSON.decode!(out)["cartridge"]["dialogues"]["scene_sampler@0.0.1:dialogue/scene"]

    assert [met, done] = scene["choices"]["go"]["steps"]
    assert met["fact"]["key"] == "met"
    assert done["fact"]["key"] == "scene_go_done"
  end
end
