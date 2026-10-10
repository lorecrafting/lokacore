defmodule Loka.ContentWispTest do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir

  # Break: newly authored short refs, Boolean topic mapping or bounded sitting consumers bypass compiler checks.
  test "Wisp source rejects malformed references, mappings and sitting declarations", %{
    tmp_dir: dir
  } do
    File.cp_r!("cartridges/ashmere_missing_child", dir)

    for {rel, keys, value, code} <- [
          {"recipes/seek_wisp.json", ["check", "attribute"], "missing", "UNRESOLVED_REFERENCE"},
          {"topics/ward.json", ["fact"], "missing", "UNRESOLVED_REFERENCE"},
          {"topics/ward.json", ["label"], "missing", "UNRESOLVED_REFERENCE"},
          {"facts.json", ["facts", "topic_ward_known", "scopes"], ["instance"],
           "FACT_TYPE_MISMATCH"},
          {"facts.json", ["facts", "topic_ward_known", "value_type"],
           %{"type" => "int", "default" => 0}, "FACT_TYPE_MISMATCH"},
          {"npcs/wisp.json", ["perception", "discovered"], "missing", "UNRESOLVED_REFERENCE"},
          {"rooms/marsh_light.json", ["details", "glow", "perception", "title"], "missing",
           "UNRESOLVED_REFERENCE"},
          {"dialogues/b_wisp_riddle.json", ["choices", "answer", "sequence"],
           [%{"op" => "topic.grant", "topic" => "missing"}], "UNRESOLVED_REFERENCE"},
          {"dialogues/b_wisp_riddle.json", ["quest"], nil, "SCHEMA_VIOLATION"},
          {"dialogues/b_wisp_riddle.json", ["riddle", "wrong_limit"], 0, "SCHEMA_VIOLATION"},
          {"cartridge.json", ["requires", "kernel_api", "at_least"], "1.20",
           "KERNEL_API_RANGE_INVALID"}
        ] do
      path = Path.join(dir, rel)
      original = File.read!(path)
      d = JSON.decode!(original)
      updated = put_in(d, Enum.map(keys, &Access.key!/1), value)
      File.write!(path, JSON.encode!(updated))
      assert {:error, diagnostics} = Loka.Content.compile(dir)
      assert Enum.any?(diagnostics, &(&1["code"] == code)), "#{rel}: #{inspect(diagnostics)}"
      File.write!(path, original)
    end

    File.cp!(Path.join(dir, "topics/ward.json"), Path.join(dir, "topics/other_ward.json"))
    assert {:error, diagnostics} = Loka.Content.compile(dir)
    assert Enum.any?(diagnostics, &(&1["code"] == "DUPLICATE_DEFINITION"))
  end

  # Breaks (loka-x6t.5 save re-check, twin of kernel/ts/test/cartridge_wisp.test.ts): a hub answer
  # (b_aldric reopens after each answer) directly assigning a fact topics-save.ts proves by one
  # receipt (topic, perception discovery, bounded riddle answer) compiles; or any fact is flagged.
  test "a reopening dialogue rejects a direct assignment of a once-proven fact", %{tmp_dir: dir} do
    File.cp_r!("cartridges/ashmere_missing_child", dir)
    path = Path.join(dir, "dialogues/b_aldric.json")
    original = JSON.decode!(File.read!(path))
    at = "dialogues/b_aldric.choices.leave.sequence[0].op"

    for {fact, flagged} <- [
          {"topic_ward_known", true},
          {"fen_wisp_discovered", true},
          {"fen_wisp_answered", true},
          {"chapel_bell_rung", false}
        ] do
      step = %{"op" => "fact.assign", "fact" => fact, "value" => true}
      File.write!(path, JSON.encode!(put_in(original, ~w(choices leave sequence), [step])))
      result = Loka.Content.compile(dir)

      diags =
        case result do
          {:error, diags} -> diags
          {:ok, _, _} -> []
        end

      assert Enum.any?(diags, &(&1["code"] == "OUTCOME_MISMATCH" and &1["path"] == at)) == flagged,
             "#{fact}: #{inspect(diags)}"

      if !flagged, do: assert({:ok, _, _} = result)
    end
  end
end
