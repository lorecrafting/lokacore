defmodule Loka.ContentTrainingTest do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir
  @source "cartridges/ashmere_missing_child"

  # Breaks: new short references remain short, so the compiler emits an unloadable training consumer.
  test "skills, lessons and equipment expand their real source references" do
    {:ok, bytes, _} = Loka.Content.compile(@source)
    c = JSON.decode!(bytes)["cartridge"]
    prefix = "#{c["manifest"]["id"]}@#{c["manifest"]["version"]}"

    ref = fn kind, key ->
      %{
        "cartridge_id" => c["manifest"]["id"],
        "cartridge_version" => c["manifest"]["version"],
        "kind" => kind,
        "key" => key
      }
    end

    assert c["skills"][prefix <> ":skill/swords"]["qualification"]["root"]["attribute"] ==
             ref.("attribute", "str")

    assert c["items"][prefix <> ":item/rusty_sword"]["weapon"]["skill"] == ref.("skill", "swords")
    choice = c["dialogues"][prefix <> ":dialogue/tobin_swords"]["choices"]["learn"]
    assert choice["sequence"] == [%{"op" => "skill.acquire", "skill" => ref.("skill", "swords")}]
    assert choice["lesson_payment"]["resource"] == ref.("resource", "pennies")
    assert c["world"]["combat"]["dodge"]["skill"] == ref.("skill", "dodge")
  end

  # Breaks: content can counterfeit acquisition or author teaching with no funds/fee or invalid combat custody.
  test "training rejects counterfeit writes, missing qualification/funding and wrong slots", %{
    tmp_dir: dir
  } do
    File.cp_r!(@source, dir)

    for {path, change} <- [
          {"dialogues/tobin_swords.json",
           &put_in(&1, ["choices", "learn", "sequence"], [
             %{"op" => "fact.assign", "fact" => "skill_swords", "value" => true}
           ])},
          {"scenes/epilogue_lost_prior.json",
           &update_in(&1, ["on_end", "assign"], fn [first | rest] ->
             [Map.merge(first, %{"fact" => "skill_swords", "value" => true}) | rest]
           end)},
          {"cartridge.json",
           &update_in(&1, ["world", "combat", "narration"], fn n -> Map.delete(n, "block") end)},
          {"npcs/tobin.json", &Map.delete(&1, "resource_starts")},
          {"items/rusty_sword.json", &Map.put(&1, "slot", "off_hand")},
          {"skills/swords.json", &put_in(&1, ["qualification", "root", "attribute"], "missing")}
        ] do
      original = @source |> Path.join(path) |> File.read!() |> JSON.decode!()
      target = Path.join(dir, path)
      File.write!(target, JSON.encode!(change.(original)))
      assert {:error, _} = Loka.Content.compile(dir)
      File.write!(target, JSON.encode!(original))
    end
  end
end
