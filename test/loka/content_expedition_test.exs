defmodule Loka.ContentExpeditionTest do
  use ExUnit.Case, async: true

  # Breaks: the new expedition short refs remain strings, so source compiles but the loader refuses it.
  test "expedition references expand without changing the five authored edges" do
    assert {:ok, bytes, []} = Loka.Content.compile("cartridges/ashmere_missing_child")
    c = JSON.decode!(bytes)["cartridge"]
    q = Enum.find(Map.values(c["quests"]), &(&1["key"] == "a_night_in_the_marsh"))
    e = q["expedition"]
    assert e["start_room"]["kind"] == "room"
    assert e["survived_fact"]["kind"] == "fact"
    assert e["hound_population"]["kind"] == "population"

    assert Enum.map(e["route"], &{&1["from"]["key"], &1["direction"], &1["to"]["key"]}) == [
             {"hound_run", "west", "reed_bank"},
             {"reed_bank", "west", "willow_shade"},
             {"willow_shade", "south", "drowned_oak"},
             {"drowned_oak", "north", "willow_shade"},
             {"willow_shade", "east", "reed_bank"}
           ]
  end

  # Breaks: a declared route accepts a direction that cannot perform its claimed physical transfer.
  @tag :tmp_dir
  test "a nonexistent physical edge is refused at the expedition declaration", %{tmp_dir: dir} do
    File.cp_r!("cartridges/ashmere_missing_child", dir)
    path = Path.join(dir, "quests/a_night_in_the_marsh.json")
    source = path |> File.read!() |> JSON.decode!()
    changed = put_in(source, ["expedition", "route", Access.at(0), "direction"], "north")
    File.write!(path, JSON.encode!(changed))
    assert {:error, diagnostics} = Loka.Content.compile(dir)

    assert Enum.any?(
             diagnostics,
             &(&1["code"] == "OUTCOME_MISMATCH" and
                 &1["path"] == "quests/a_night_in_the_marsh.expedition.route")
           )
  end
end
