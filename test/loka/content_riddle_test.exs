defmodule Loka.ContentRiddleTest do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir

  defp update(dir, rel, fun) do
    path = Path.join(dir, rel)
    File.write!(path, JSON.encode!(fun.(JSON.decode!(File.read!(path)))))
  end

  defp source(dir) do
    File.cp_r!("cartridges/ashmere_ferry", dir)
    update(dir, "cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.9"))

    update(
      dir,
      "dialogues/bram.json",
      &Map.put(&1, "riddle", %{
        "choice_id" => "carry",
        "answer" => "lantern",
        "bank" => ~w(R N A O L T E N S),
        "wrong" => "narration.bram.leave"
      })
    )

    update(
      dir,
      "quests/lantern.json",
      &Map.put(&1, "journal", %{
        "active" => "quest.lantern.title",
        "objectives_met" => "quest.lantern.title",
        "resolved" => "quest.lantern.title",
        "failed" => "quest.lantern.title",
        "abandoned" => "quest.lantern.title",
        "active_variants" => [
          %{
            "when" => %{
              "policy_version" => 1,
              "root" => %{
                "op" => "fact_compare",
                "fact" => "search_plan",
                "equals" => "player_led"
              }
            },
            "text" => "narration.bram.carry"
          }
        ]
      })
    )
  end

  # Breaks: short references in active journal policies remain unexpanded or riddle data is discarded.
  test "API1.9 source preserves riddles and expands journal policies", %{tmp_dir: dir} do
    source(dir)
    assert {:ok, bytes, []} = Loka.Content.compile(dir)
    c = JSON.decode!(bytes)["cartridge"]

    assert c["dialogues"]["ashmere_ferry@0.0.1:dialogue/bram"]["riddle"]["bank"] ==
             ~w(R N A O L T E N S)

    [v] = c["quests"]["ashmere_ferry@0.0.1:quest/lantern"]["journal"]["active_variants"]

    assert v["when"]["root"]["fact"] == %{
             "cartridge_id" => "ashmere_ferry",
             "cartridge_version" => "0.0.1",
             "kind" => "fact",
             "key" => "search_plan"
           }
  end

  # Breaks: missing choices/text/typed policy refs, insufficient repeated tiles or old API declarations compile.
  test "authoring rejects invalid riddles and journal variants", %{tmp_dir: dir} do
    source(dir)

    for {rel, steps, value, code} <- [
          {"dialogues/bram.json", ["riddle", "choice_id"], "missing", "UNRESOLVED_REFERENCE"},
          {"dialogues/bram.json", ["riddle", "wrong"], "missing", "UNRESOLVED_REFERENCE"},
          {"dialogues/bram.json", ["riddle", "bank"], ~w(R N A O L T E S), "OUTCOME_MISMATCH"},
          {"dialogues/bram.json", ["riddle", "answer"], "Lantern", "SCHEMA_VIOLATION"},
          {"quests/lantern.json", ["journal", "active_variants", 0, "text"], "missing",
           "UNRESOLVED_REFERENCE"},
          {"quests/lantern.json", ["journal", "active_variants", 0, "when", "root", "fact"],
           "missing", "UNRESOLVED_REFERENCE"},
          {"quests/lantern.json", ["journal", "active_variants", 0, "when", "root", "equals"],
           true, "FACT_TYPE_MISMATCH"},
          {"quests/lantern.json", ["journal", "active_variants", 0, "when", "policy_version"], 2,
           "SCHEMA_VIOLATION"}
        ] do
      path = Path.join(dir, rel)
      original = File.read!(path)

      access =
        Enum.map(steps, fn
          n when is_integer(n) -> Access.at(n)
          k -> Access.key(k)
        end)

      update(dir, rel, &put_in(&1, access, value))
      assert {:error, diagnostics} = Loka.Content.compile(dir)
      assert Enum.any?(diagnostics, &(&1["code"] == code)), inspect({steps, diagnostics})
      File.write!(path, original)
    end
  end

  # Breaks: either optional feature independently bypasses API1.9 gating.
  test "each API1.9 feature requires its declared minimum", %{tmp_dir: dir} do
    for feature <- ["riddle", "active_variants"] do
      sub = Path.join(dir, feature)
      source(sub)
      update(sub, "cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.8"))

      if feature == "riddle",
        do: update(sub, "quests/lantern.json", &Map.delete(&1, "journal")),
        else: update(sub, "dialogues/bram.json", &Map.delete(&1, "riddle"))

      assert {:error, diagnostics} = Loka.Content.compile(sub)
      assert Enum.any?(diagnostics, &(&1["code"] == "KERNEL_API_RANGE_INVALID"))
    end
  end
end
