defmodule Loka.ContentVarietyTest do
  use ExUnit.Case, async: true

  # Breaks (toolbox row W7): the compiler drops cartridge.json alternates, accepts an alternate or
  # key the text catalog lacks, skips alternates' or visited_count's owner check, or accepts
  # alternates or a visited_count leaf below kernel_api 1.45 (each alone included).
  test "alternates reach the artifact, name catalog keys and need variety@1 and 1.45" do
    dir = Loka.ContentSource.copy("cartridges/variety_sampler")
    assert {:ok, artifact, _} = Loka.ContentSource.compile(dir, [])

    assert JSON.decode!(artifact)["cartridge"]["alternates"] == %{
             "narration.walk" => ["narration.walk_b", "narration.walk_c"]
           }

    alternate = &put_in(&1, ["alternates", "narration.walk"], ["narration.walk_b", "nope"])
    key = &put_in(&1, ["alternates"], %{"narration.gone" => ["narration.walk_b"]})
    drop = &update_in(&1, ["requires", "capabilities"], fn m -> Map.delete(m, "variety") end)
    api = &put_in(&1, ["requires", "kernel_api", "at_least"], "1.44")
    floor = {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}
    plain = {"rooms/garden.json", &Map.delete(&1, "variants")}

    cases = [
      {[{"cartridge.json", alternate}],
       {"UNRESOLVED_REFERENCE", "cartridge.alternates[\"narration.walk\"][1]"}},
      {[{"cartridge.json", key}],
       {"UNRESOLVED_REFERENCE", "cartridge.alternates[\"narration.gone\"]"}},
      {[{"cartridge.json", drop}], {"UNDECLARED_CAPABILITY", "cartridge.alternates"}},
      {[{"cartridge.json", drop}],
       {"UNDECLARED_CAPABILITY", "rooms/garden.variants[0].when.root.op"}},
      {[{"cartridge.json", api}, plain], floor},
      {[{"cartridge.json", &(&1 |> api.() |> Map.delete("alternates"))}], floor}
    ]

    for {changes, {code, path}} <- cases do
      assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end

  # Breaks: a visited_count leaf without knowledge@1 (never holds) compiles silently, the warning
  # fails the build, or it fires when knowledge@1 is required.
  test "visited_count without knowledge@1 warns and still compiles" do
    dir = Loka.ContentSource.copy("cartridges/variety_sampler")
    drop = &update_in(&1, ["requires", "capabilities"], fn m -> Map.delete(m, "knowledge") end)
    codes = &Enum.map(&1, fn d -> {d["severity"], d["code"], d["path"]} end)
    warning = {"warning", "VISITS_UNRECORDED", "cartridge.requires.capabilities"}

    assert {:ok, _, warnings} = Loka.ContentSource.compile(dir, [{"cartridge.json", drop}])
    assert warning in codes.(warnings), inspect(warnings)
    assert {:ok, _, warnings} = Loka.ContentSource.compile(dir, [])
    refute warning in codes.(warnings)
  end

  # Break: alternates pass through short-reference expansion, whose clauses match a map by key, so
  # a text key named like a declaration member (rest, transport) is rewritten or crashes.
  test "alternates keyed like declaration members compile unchanged" do
    dir = Loka.ContentSource.copy("cartridges/variety_sampler")
    alts = %{"rest" => ["narration.walk_b"], "transport" => ["narration.walk_c"]}

    changes = [
      {"cartridge.json", &put_in(&1, ["alternates"], alts)},
      {"text.json", &Map.merge(&1, %{"rest" => "Rest.", "transport" => "Ride."})}
    ]

    assert {:ok, artifact, _} = Loka.ContentSource.compile(dir, changes)
    assert JSON.decode!(artifact)["cartridge"]["alternates"] == alts
  end
end
