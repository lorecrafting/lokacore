defmodule Loka.ContentSamplerTest do
  # C1 sampler: approved semantics, compiler-owned defaults and canonical bytes from
  # the stdlib Python oracle, never from the compiler or the other kernel.
  use ExUnit.Case, async: true
  @kat JSON.decode!(File.read!("protocol/fixtures/containers_cartridge_sampler_hash.json"))

  # Breaks: missing/reshaped rooms, keys, capabilities, quest/point/scene pairing or approved text.
  test "the approved sampler compiles to its independent answer without warnings" do
    expected = ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
    assert Loka.Content.compile("cartridges/ashmere_sampler") == {:ok, expected, []}
  end

  # Breaks: NPC HP cross-field bounds/schema validation drifts from the portable loader.
  @tag :tmp_dir
  test "NPC HP authoring rejects invalid overrides and an old API", %{tmp_dir: dir} do
    File.cp_r!("cartridges/ashmere_sampler", dir)
    path = Path.join(dir, "npcs/cellar_rat_1.json")
    npc = JSON.decode!(File.read!(path))
    fixture = JSON.decode!(File.read!("protocol/fixtures/entity_resource.json"))
    invalid = for c <- fixture["contracts"], not c["valid"], do: c["value"]

    for hp <-
          invalid ++
            [
              %{"minimum" => 7, "maximum" => 6, "start" => 6, "gain" => 0},
              %{"minimum" => 0, "maximum" => 6, "start" => 7, "gain" => 0}
            ] do
      File.write!(path, JSON.encode!(Map.put(npc, "hp", hp)))
      assert {:error, _} = Loka.Content.compile(dir)
    end

    File.write!(path, JSON.encode!(npc))
    manifest = Path.join(dir, "cartridge.json")

    old =
      put_in(JSON.decode!(File.read!(manifest)), ["requires", "kernel_api", "at_least"], "1.3")

    File.write!(manifest, JSON.encode!(old))
    assert {:error, diagnostics} = Loka.Content.compile(dir)
    assert Enum.any?(diagnostics, &(&1["code"] == "KERNEL_API_RANGE_INVALID"))
  end
end
