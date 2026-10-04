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
    # Breaks: fact@1 added only after validation, so legal reads under position@1 are refused.
    caps = if position?, do: caps |> Map.delete("fact") |> Map.put("position", 1), else: caps
    manifest = put_in(src("cartridge.json"), ["requires", "capabilities"], caps)

    for {rel, v} <- Map.put_new(files, "cartridge.json", manifest) do
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

  # Breaks: dependency normalization before authored-version validation hides fact@2.
  test "position's implicit fact dependency does not hide an unsupported authored version", %{
    tmp_dir: dir
  } do
    manifest =
      update_in(src("cartridge.json"), ["requires", "capabilities"], fn caps ->
        Map.merge(caps, %{"position" => 1, "fact" => 2})
      end)

    assert compile(dir, true, %{"cartridge.json" => manifest}) ==
             {:error,
              [
                %{
                  d("cartridge.requires.capabilities.fact")
                  | "code" => "UNKNOWN_CAPABILITY",
                    "message_key" => "diagnostics.unknown_capability"
                }
              ]}
  end

  @recovery %{
    "every" => 10,
    "by_position" => %{"standing" => 2, "sitting" => 2, "resting" => 4, "sleeping" => 4}
  }

  defp recovery_source(dir, change) do
    File.cp_r!("cartridges/ashmere_rest", dir)
    manifest = JSON.decode!(File.read!(Path.join(dir, "cartridge.json")))

    manifest =
      manifest
      |> put_in(["requires", "kernel_api", "at_least"], "1.2")
      |> put_in(["requires", "capabilities", "schedule"], 1)
      |> Map.put("time_policy", %{"profile" => "real_elapsed", "rate" => 50})

    pool = %{"maximum" => 10, "start" => 0, "regen" => @recovery}
    {manifest, pool} = change.(manifest, pool)
    File.write!(Path.join(dir, "cartridge.json"), JSON.encode!(manifest))
    File.write!(Path.join(dir, "resources.json"), JSON.encode!(%{"resources" => %{"mv" => pool}}))
    Loka.Content.compile(dir)
  end

  # Breaks: compiler drops authored recovery or admits missing dependencies/unsafe residual arithmetic.
  test "recovery compiler preserves opt-in and checks its actual dependencies and exact bound", %{
    tmp_dir: dir
  } do
    assert {:ok, bytes, []} = recovery_source(Path.join(dir, "valid"), &{&1, &2})
    cartridge = JSON.decode!(bytes)["cartridge"]

    assert cartridge["resources"]["ashmere_rest@0.0.1:resource/mv"] == %{
             "key" => "mv",
             "minimum" => 0,
             "maximum" => 10,
             "start" => 0,
             "gain" => 18,
             "regen" => @recovery
           }

    cases = [
      {"UNDECLARED_CAPABILITY", "resources.resources.mv.regen",
       fn m, p -> {update_in(m, ["requires", "capabilities"], &Map.delete(&1, "position")), p} end},
      {"INVALID_TIME_POLICY", "resources.resources.mv.regen",
       fn m, p -> {Map.delete(m, "time_policy"), p} end},
      {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least",
       fn m, p -> {put_in(m, ["requires", "kernel_api", "at_least"], "1.1"), p} end},
      {"RESOURCE_SPEC_INVALID", "resources.resources.mv.regen",
       fn m, p ->
         {m,
          Map.put(p, "regen", %{
            "every" => 4_194_304,
            "by_position" => %{
              "standing" => 2_147_483_647,
              "sitting" => 0,
              "resting" => 0,
              "sleeping" => 0
            }
          })}
       end}
    ]

    for {{code, path, change}, i} <- Enum.with_index(cases) do
      assert {:error, diagnostics} = recovery_source(Path.join(dir, "invalid-#{i}"), change)

      assert Enum.any?(diagnostics, &(&1["code"] == code and &1["path"] == path)),
             inspect(diagnostics)
    end

    assert {:ok, _, []} =
             recovery_source(Path.join(dir, "boundary"), fn m, p ->
               {m,
                Map.put(p, "regen", %{
                  "every" => 4_194_303,
                  "by_position" => %{
                    "standing" => 2_147_483_647,
                    "sitting" => 0,
                    "resting" => 0,
                    "sleeping" => 0
                  }
                })}
             end)
  end
end
