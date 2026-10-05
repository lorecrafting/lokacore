defmodule Loka.ContentEscortTest do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir

  defp update(dir, rel, fun) do
    path = Path.join(dir, rel)
    File.write!(path, JSON.encode!(fun.(JSON.decode!(File.read!(path)))))
  end

  defp source(dir) do
    File.cp_r!("cartridges/ashmere_ferry", dir)
    File.rm!(Path.join(dir, "story_points/lantern_resolved.json"))
    File.cp!(Path.join(dir, "quests/lantern.json"), Path.join(dir, "quests/other.json"))

    update(dir, "cartridge.json", fn m ->
      m
      |> put_in(["requires", "kernel_api", "at_least"], "1.11")
      |> put_in(["requires", "capabilities", "escort"], 1)
    end)

    update(dir, "dialogues/bram.json", fn d ->
      d
      |> Map.delete("quest")
      |> put_in(["choices", "carry", "escort"], %{
        "npc" => "bram",
        "quest" => "lantern",
        "transition" => "start"
      })
    end)
  end

  # Breaks: short escort quest refs fail expansion or valid nonterminal/terminal forms are rejected.
  test "escort effects and policy leaves expand local quest references", %{tmp_dir: dir} do
    source(dir)

    for transition <- ~w(start rejoin complete) do
      update(dir, "dialogues/bram.json", fn d ->
        d = put_in(d, ["choices", "carry", "escort", "transition"], transition)

        if transition == "complete",
          do: Map.put(d, "quest", "lantern"),
          else: Map.delete(d, "quest")
      end)

      assert {:ok, bytes, []} = Loka.Content.compile(dir)
      d = JSON.decode!(bytes)["cartridge"]["dialogues"]["ashmere_ferry@0.0.1:dialogue/bram"]

      assert d["choices"]["carry"]["escort"]["quest"] == %{
               "cartridge_id" => "ashmere_ferry",
               "cartridge_version" => "0.0.1",
               "kind" => "quest",
               "key" => "lantern"
             }
    end

    update(
      dir,
      "dialogues/bram.json",
      &put_in(&1, ["policy", "root"], %{
        "op" => "escort_state",
        "quest" => "lantern",
        "state" => "following"
      })
    )

    assert {:ok, bytes, []} = Loka.Content.compile(dir)
    d = JSON.decode!(bytes)["cartridge"]["dialogues"]["ashmere_ferry@0.0.1:dialogue/bram"]
    assert d["policy"]["root"]["quest"]["key"] == "lantern"
  end

  # Breaks: escort capability/API, role typing, local quest and complete agreement cease guarding content.
  test "escort authoring rejects incompatible and unresolved bindings", %{tmp_dir: dir} do
    source(dir)

    for {rel, change, code} <- [
          {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.10"),
           "KERNEL_API_RANGE_INVALID"},
          {"cartridge.json",
           &update_in(&1, ["requires", "capabilities"], fn c -> Map.delete(c, "escort") end),
           "UNDECLARED_CAPABILITY"},
          {"dialogues/bram.json", &put_in(&1, ["choices", "carry", "escort", "npc"], "lantern"),
           "UNRESOLVED_REFERENCE"},
          {"dialogues/bram.json", &put_in(&1, ["choices", "carry", "escort", "quest"], "missing"),
           "UNRESOLVED_REFERENCE"},
          {"dialogues/bram.json",
           &put_in(&1, ["choices", "carry", "escort", "transition"], "complete"),
           "OUTCOME_MISMATCH"},
          {"dialogues/bram.json",
           fn d ->
             d
             |> Map.put("quest", "other")
             |> put_in(["choices", "carry", "escort", "transition"], "complete")
           end, "OUTCOME_MISMATCH"},
          {"dialogues/bram.json", &Map.put(&1, "quest", "lantern"), "OUTCOME_MISMATCH"},
          {"dialogues/bram.json",
           &put_in(&1, ["policy", "root"], %{
             "op" => "escort_state",
             "quest" => "missing",
             "state" => "following"
           }), "UNRESOLVED_REFERENCE"}
        ] do
      path = Path.join(dir, rel)
      original = File.read!(path)
      update(dir, rel, change)
      assert {:error, diagnostics} = Loka.Content.compile(dir)
      assert Enum.any?(diagnostics, &(&1["code"] == code)), inspect(diagnostics)
      File.write!(path, original)
    end
  end
end
