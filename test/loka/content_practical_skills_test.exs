defmodule Loka.ContentPracticalSkillsTest do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir
  @source "cartridges/ashmere_missing_child"

  # Breaks: new short skill references stay short or actual original-teacher lesson funding is absent.
  test "real careful and discount source expands to typed consumers and both bound lessons" do
    assert {:ok, bytes, _} = Loka.Content.compile(@source)
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

    assert c["rooms"][prefix <> ":room/willow_shade"]["details"]["fenwort_patch"]["harvest"][
             "careful"
           ]["skill"] == ref.("skill", "herbalism")

    assert c["npcs"][prefix <> ":npc/peg"]["shop"]["buy_discount"]["skill"] ==
             ref.("skill", "haggle")

    for {teacher, skill} <- [{"sedge", "herbalism"}, {"peg", "haggle"}] do
      d = c["dialogues"][prefix <> ":dialogue/#{teacher}_#{skill}"]
      assert d["npc"] == ref.("npc", teacher)
      assert d["roles"]["teacher"]["npc"] == ref.("npc", teacher)

      assert d["choices"]["learn"]["lesson_payment"] == %{
               "to" => "teacher",
               "resource" => ref.("resource", "pennies"),
               "amount" => 2
             }
    end
  end

  # Breaks: compiler accepts unresolved opt-ins, a wrong action shape, insufficient finite definitions or unsafe quote arithmetic.
  test "compiler refuses invalid careful/discount consumers", %{tmp_dir: dir} do
    File.cp_r!(@source, dir)

    for {path, change} <- [
          {"rooms/willow_shade.json",
           &put_in(&1, ["details", "fenwort_patch", "harvest", "careful", "skill"], "absent")},
          {"rooms/willow_shade.json",
           &put_in(&1, ["details", "fenwort_patch", "harvest", "careful", "count"], 13)},
          {"rooms/willow_shade.json",
           &put_in(&1, ["details", "fenwort_patch", "harvest", "careful", "narration"], "absent")},
          {"actions/gather_carefully.json", &Map.put(&1, "input", [])},
          {"actions/gather_carefully.json", &Map.put(&1, "command", "take")},
          {"actions/gather_carefully.json", &Map.put(&1, "target", %{"kind" => "none"})},
          {"npcs/peg.json", &put_in(&1, ["shop", "buy_discount", "skill"], "absent")},
          {"npcs/peg.json", &put_in(&1, ["shop", "buy_discount", "numerator"], 11)},
          {"npcs/peg.json", &put_in(&1, ["shop", "buy_discount", "minimum"], 3)},
          {"npcs/peg.json",
           fn c ->
             c
             |> put_in(["shop", "buy_discount", "numerator"], 2_147_483_647)
             |> put_in(["shop", "buy_discount", "denominator"], 2_147_483_647)
             |> update_in(["shop", "offers"], fn [o | rest] ->
               [Map.put(o, "buy", 2_147_483_647) | rest]
             end)
           end}
        ] do
      original = File.read!(Path.join(@source, path))
      target = Path.join(dir, path)
      File.write!(target, JSON.encode!(change.(JSON.decode!(original))))
      assert {:error, _} = Loka.Content.compile(dir), path
      File.write!(target, original)
    end
  end
end
