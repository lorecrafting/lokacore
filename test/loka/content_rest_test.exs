defmodule Loka.ContentRestTest do
  # position@1's engine fact in the compiler (c1-position; cartridge.md Compiler). The known
  # answer is protocol/fixtures/cartridge_rest_hash.json (Python); diagnostics are hand-written
  # from protocol/cartridge.schema.json DiagnosticCode RESERVED_FACT, twins of the loader cases in
  # kernel/ts/test/position.test.ts.
  use ExUnit.Case, async: true

  @moduletag :tmp_dir
  @kat JSON.decode!(File.read!("protocol/fixtures/cartridge_rest_hash.json"))
  @ferry "cartridges/ashmere_ferry"

  # Breaks: the engine FactSpec, fact@1 or the lock wrong or missing in the artifact.
  test "ashmere_rest compiles to its Python known answer without warnings" do
    expected = ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})
    assert Loka.Content.compile("cartridges/ashmere_rest") == {:ok, expected, []}
  end

  defp src(rel), do: JSON.decode!(File.read!(Path.join(@ferry, rel)))

  # ashmere_ferry's source in `dir` with reaction@1 (and position@1 when `position?`) required,
  # and `files` (relative path => JSON value) written over it.
  defp compile(dir, position?, files) do
    File.cp_r!(@ferry, dir)
    caps = Map.merge(src("cartridge.json")["requires"]["capabilities"], %{"reaction" => 1})
    caps = if position?, do: Map.put(caps, "position", 1), else: caps
    manifest = put_in(src("cartridge.json"), ["requires", "capabilities"], caps)

    for {rel, v} <- Map.put(files, "cartridge.json", manifest) do
      File.mkdir_p!(Path.dirname(Path.join(dir, rel)))
      File.write!(Path.join(dir, rel), JSON.encode!(v))
    end

    Loka.Content.compile(dir)
  end

  @write %{"op" => "fact.assign", "fact" => "position", "value" => "sitting"}
  @own %{
    "version" => 1,
    "value_type" => %{
      "type" => "enum",
      "values" => ["standing", "sitting"],
      "default" => "standing"
    },
    "scopes" => ["player"],
    "meaning" => "The cartridge's own."
  }

  # A recipe outcome, a dialogue choice and a reaction writing position, and an authored fact
  # named position; with `read` the reaction only reads it.
  defp writes(read \\ false) do
    recipe =
      update_in(
        src("recipes/coil_rope.json"),
        ["outcomes", "success", "sequence"],
        &[@write | &1]
      )

    dialogue = put_in(src("dialogues/bram.json"), ["choices", "carry", "sequence"], [@write])
    plan = %{"op" => "fact.assign", "fact" => "search_plan", "value" => "party_led"}
    on = %{"event" => "fact_changed", "fact" => "search_plan"}

    reaction =
      if read,
        do: %{
          "on" => on,
          "when" => %{
            "policy_version" => 1,
            "root" => %{"op" => "fact_compare", "fact" => "position", "equals" => "sitting"}
          },
          "apply" => [plan]
        },
        else: %{"on" => on, "apply" => [@write]}

    facts = put_in(src("facts.json"), ["facts", "position"], @own)

    if read,
      do: %{"reactions/settle.json" => reaction},
      else: %{
        "recipes/coil_rope.json" => recipe,
        "dialogues/bram.json" => dialogue,
        "reactions/settle.json" => reaction,
        "facts.json" => facts
      }
  end

  defp d(path) do
    %{
      "severity" => "error",
      "code" => "RESERVED_FACT",
      "path" => path,
      "message_key" => "diagnostics.reserved_fact",
      "data" => %{},
      "suggested_capabilities" => []
    }
  end

  # Breaks: a write-site check or the authored-fact check dropped, a read refused, or a cartridge
  # without position@1 losing its own fact named position.
  test "content may read the position fact but never write it, under position@1", %{tmp_dir: dir} do
    assert {:error, ds} = compile(Path.join(dir, "writes"), true, writes())

    assert Enum.sort_by(ds, & &1["path"]) == [
             d("dialogues/bram.choices.carry.sequence[0].fact"),
             d("facts.facts.position"),
             d("reactions/settle.apply[0].fact"),
             d("recipes/coil_rope.outcomes.success.sequence[0].fact")
           ]

    assert {:ok, _, _} = compile(Path.join(dir, "reads"), true, writes(true))
    assert {:ok, _, _} = compile(Path.join(dir, "own"), false, writes())
  end
end
