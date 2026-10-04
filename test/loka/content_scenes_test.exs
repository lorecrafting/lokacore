defmodule Loka.ContentScenesTest do
  # scene@1 source contract and independent hash; literal diagnostics follow cartridge.md.
  use ExUnit.Case, async: true
  @moduletag :tmp_dir
  @src "cartridges/ashmere_scene"
  @kat JSON.decode!(File.read!("protocol/fixtures/cartridge_scene_hash.json"))
  @expected ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
  defp src(rel), do: JSON.decode!(File.read!(Path.join(@src, rel)))

  defp compile(dir, files) do
    File.cp_r!(@src, dir)
    for {rel, value} <- files, do: File.write!(Path.join(dir, rel), JSON.encode!(value))
    Loka.Content.compile(dir)
  end

  defp d(code, path, data \\ %{}, suggested \\ []),
    do: %{
      "severity" => "error",
      "code" => code,
      "path" => path,
      "message_key" => "diagnostics." <> String.downcase(code),
      "data" => data,
      "suggested_capabilities" => suggested
    }

  # Breaks: missing artifact scene map, short reference expansion, incorrect hashed FactSpec.
  test "modal scene compiles to the independent known answer with short and full refs", %{
    tmp_dir: dir
  } do
    assert Loka.Content.compile(@src) == {:ok, @expected, []}

    manifest =
      src("cartridge.json") |> update_in(["requires", "capabilities"], &Map.delete(&1, "fact"))

    assert compile(dir, %{"cartridge.json" => manifest}) == {:ok, @expected, []}
    s = src("scenes/bell_rung.json")

    full =
      put_in(s, ["on", "story_point"], %{
        "cartridge_id" => "ashmere_scene",
        "cartridge_version" => "0.0.1",
        "kind" => "story_point",
        "key" => "lantern_resolved"
      })

    assert compile(dir, %{"scenes/bell_rung.json" => full}) == {:ok, @expected, []}
  end

  # Breaks: schema-valid steps out of sequence or unresolved trigger/text are admitted.
  test "scene subset and trigger references fail closed", %{tmp_dir: dir} do
    s = src("scenes/bell_rung.json")

    for {value, path, code, data} <- [
          {put_in(s, ["steps", Access.at(0)], %{"type" => "dialogue"}), ".steps[0].type",
           "SCHEMA_VIOLATION", %{"error" => "unknown_variant"}},
          {Map.put(s, "steps", [
             %{"type" => "narrate", "text" => "scene.bell_rung.bell"},
             %{"type" => "end"}
           ]), ".steps[1].type", "SCHEMA_VIOLATION", %{"error" => "not_in_enum"}},
          {Map.put(s, "control", "restricted"), ".control", "SCHEMA_VIOLATION",
           %{"error" => "const_mismatch"}},
          {put_in(s, ["on", "story_point"], "nope"), ".on.story_point", "UNRESOLVED_REFERENCE",
           %{"target" => "ashmere_scene@0.0.1:story_point/nope"}},
          {put_in(s, ["on", "outcome"], "stay"), ".on.outcome", "UNRESOLVED_REFERENCE",
           %{"target" => "stay"}},
          {put_in(s, ["steps", Access.at(1), "text"], "scene.missing"), ".steps[1].text",
           "UNRESOLVED_REFERENCE", %{"target" => "scene.missing"}}
        ] do
      assert compile(dir, %{"scenes/bell_rung.json" => value}) ==
               {:error, [d(code, "scenes/bell_rung" <> path, data)]}
    end
  end

  # Breaks: two scenes start at one event; diagnostics must identify both authored sites.
  test "duplicate story-point outcome triggers name both scenes", %{tmp_dir: dir} do
    assert compile(dir, %{"scenes/bell_echo.json" => src("scenes/bell_rung.json")}) ==
             {:error,
              [
                d("DUPLICATE_DEFINITION", "scenes/bell_echo.on"),
                d("DUPLICATE_DEFINITION", "scenes/bell_rung.on")
              ]}
  end

  # Breaks: engine fact reservation misses any authored definition or consequence write site.
  test "content can read but cannot define or assign a scene fact", %{tmp_dir: dir} do
    f = src("facts.json")
    spec = @kat["value"]["facts"]["ashmere_scene@0.0.1:fact/scene_bell_rung"] |> Map.delete("key")

    assert compile(dir, %{"facts.json" => put_in(f, ["facts", "scene_bell_rung"], spec)}) ==
             {:error, [d("RESERVED_FACT", "facts.facts.scene_bell_rung")]}

    write = %{"op" => "fact.assign", "fact" => "scene_bell_rung", "value" => 1}

    for {rel, path, diagnostic} <- [
          {"recipes/coil_rope.json", ["outcomes", "success", "sequence"],
           "recipes/coil_rope.outcomes.success.sequence[0].fact"},
          {"reactions/bell_after.json", ["apply"], "reactions/bell_after.apply[0].fact"},
          {"dialogues/bram.json", ["choices", "carry", "sequence"],
           "dialogues/bram.choices.carry.sequence[0].fact"}
        ] do
      assert compile(dir, %{rel => put_in(src(rel), path, [write])}) ==
               {:error, [d("RESERVED_FACT", diagnostic)]}
    end
  end

  # Breaks: a scene definition bypasses its owning capability.
  test "scene definitions require scene@1", %{tmp_dir: dir} do
    File.cp_r!(@src, dir)
    File.rm!(Path.join(dir, "reactions/bell_after.json"))
    m = src("cartridge.json") |> update_in(["requires", "capabilities"], &Map.delete(&1, "scene"))
    File.write!(Path.join(dir, "cartridge.json"), JSON.encode!(m))

    assert Loka.Content.compile(dir) ==
             {:error,
              [
                d("UNDECLARED_CAPABILITY", "scenes/bell_rung", %{"capability" => "scene"}, [
                  "scene@1"
                ])
              ]}
  end
end
