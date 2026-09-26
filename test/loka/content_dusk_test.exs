defmodule Loka.ContentDuskTest do
  # Luck checks, failure outcomes, durations and time_window in the compiler (R5 S6a;
  # action.schema.json ActionRecipe, RecipeCheck; policy.schema.json time_window). Expected
  # diagnostics are hand-written from protocol/cartridge.schema.json DiagnosticCode, with the
  # loader's paths in kernel/ts/test/recipes_loader.test.ts; the known answer is
  # protocol/fixtures/cartridge_dusk_hash.json (Python).
  use ExUnit.Case, async: true

  @moduletag :tmp_dir
  @kat JSON.decode!(File.read!("protocol/fixtures/cartridge_dusk_hash.json"))
  @src "cartridges/ashmere_dusk"
  @expected ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})

  # ashmere_dusk's source with `files` merged over it (nil removes a file).
  defp compile(dir, files) do
    base =
      for rel <- Path.wildcard("#{@src}/**/*.json"),
          not String.contains?(rel, "transcripts"),
          into: %{},
          do: {Path.relative_to(rel, @src), JSON.decode!(File.read!(rel))}

    for {rel, v} <- Map.merge(base, files), v != nil do
      File.mkdir_p!(Path.join(dir, Path.dirname(rel)))
      File.write!(Path.join(dir, rel), JSON.encode!(v))
    end

    Loka.Content.compile(dir)
  end

  defp src(rel), do: JSON.decode!(File.read!(Path.join(@src, rel)))

  defp pick(path, f),
    do: %{"recipes/pick_lock.json" => update_in(src("recipes/pick_lock.json"), path, f)}

  defp without(cap) do
    caps = Map.delete(src("cartridge.json")["requires"]["capabilities"], cap)
    %{"cartridge.json" => put_in(src("cartridge.json"), ["requires", "capabilities"], caps)}
  end

  defp d(code, path, data \\ %{}, suggested \\ []) do
    %{
      "severity" => "error",
      "code" => code,
      "path" => path,
      "message_key" => "diagnostics." <> String.downcase(code),
      "data" => data,
      "suggested_capabilities" => suggested
    }
  end

  # Breaks: the check, a failure outcome, a duration or a time_window node dropped or reshaped,
  # or a failure step's short fact reference left short.
  test "ashmere_dusk compiles to its Python known answer without warnings", %{tmp_dir: dir} do
    assert Loka.Content.compile(@src) == {:ok, @expected, []}
    # A failure step's short fact reference expands like a success step's.
    step = %{"op" => "fact.assign", "fact" => "crypt_gate_open", "value" => false}

    {:ok, artifact, []} =
      compile(dir, pick(["outcomes", "failure", "sequence"], fn _ -> [step] end))

    [failure] =
      JSON.decode!(artifact)["cartridge"]["recipes"]["ashmere_dusk@0.0.1:recipe/pick_lock"][
        "outcomes"
      ]["failure"]["sequence"]

    assert failure["fact"]["kind"] == "fact"
  end

  # Breaks: a checked recipe without a failure outcome, or a failure outcome without a check,
  # compiles (the loader rejects both).
  test "a recipe has a failure outcome exactly when it has a check", %{tmp_dir: dir} do
    mismatch = {:error, [d("OUTCOME_MISMATCH", "recipes/pick_lock.outcomes")]}
    drop = fn key -> fn r -> Map.delete(r, key) end end
    assert compile(dir, pick(["outcomes"], drop.("failure"))) == mismatch

    assert compile(Path.join(dir, "b"), %{
             "recipes/pick_lock.json" => Map.delete(src("recipes/pick_lock.json"), "check")
           }) == mismatch
  end

  # Breaks: a failure outcome's fact, narration or step owner, or the check's owner, unchecked.
  test "a failure outcome's references and owners, and the check's, are checked", %{tmp_dir: dir} do
    step = %{"op" => "fact.assign", "fact" => "gate_rusted", "value" => true}

    assert compile(dir, pick(["outcomes", "failure", "sequence"], fn _ -> [step] end)) ==
             {:error,
              [
                d(
                  "UNRESOLVED_REFERENCE",
                  "recipes/pick_lock.outcomes.failure.sequence[0].fact",
                  %{
                    "target" => "ashmere_dusk@0.0.1:fact/gate_rusted"
                  }
                )
              ]}

    assert compile(
             Path.join(dir, "b"),
             pick(["outcomes", "failure", "narration", "actor"], fn _ -> "narration.none" end)
           ) ==
             {:error,
              [
                d("UNRESOLVED_REFERENCE", "recipes/pick_lock.outcomes.failure.narration.actor", %{
                  "target" => "narration.none"
                })
              ]}

    assert compile(Path.join(dir, "c"), without("check")) ==
             {:error,
              [
                d(
                  "UNDECLARED_CAPABILITY",
                  "recipes/pick_lock.check",
                  %{"capability" => "check"},
                  [
                    "check@1"
                  ]
                )
              ]}

    emit = %{"op" => "event.emit", "event" => "pick_snapped"}

    files =
      Map.merge(
        without("fact"),
        pick(["outcomes", "failure", "sequence"], fn _ -> [emit, step] end)
      )

    {:error, diags} = compile(Path.join(dir, "d"), files)

    assert d(
             "UNDECLARED_CAPABILITY",
             "recipes/pick_lock.outcomes.failure.sequence[1].op",
             %{"capability" => "fact"},
             ["fact@1"]
           ) in diags
  end

  # Breaks: time_window compiles without schedule@1, or with an empty window.
  test "time_window needs schedule@1 and a non-empty window", %{tmp_dir: dir} do
    assert compile(dir, without("schedule")) ==
             {:error,
              [
                d(
                  "UNDECLARED_CAPABILITY",
                  "recipes/ring_bell.policy.root.op",
                  %{"capability" => "schedule"},
                  ["schedule@1"]
                )
              ]}

    ring = put_in(src("recipes/ring_bell.json"), ["policy", "root", "to"], 18)

    assert compile(Path.join(dir, "b"), %{"recipes/ring_bell.json" => ring}) ==
             {:error, [d("EMPTY_TIME_WINDOW", "recipes/ring_bell.policy.root")]}
  end

  # Review S2. Breaks: two recipes' checks with one key compile, so one check DefinitionRef names
  # two checks.
  test "two recipes' checks with one key are DUPLICATE_DEFINITION", %{tmp_dir: dir} do
    ring = Map.put(src("recipes/ring_bell.json"), "check", src("recipes/pick_lock.json")["check"])

    ring =
      put_in(ring, ["outcomes", "failure"], src("recipes/pick_lock.json")["outcomes"]["failure"])

    assert compile(dir, %{"recipes/ring_bell.json" => ring}) ==
             {:error,
              [
                d("DUPLICATE_DEFINITION", "recipes/pick_lock.check"),
                d("DUPLICATE_DEFINITION", "recipes/ring_bell.check")
              ]}
  end
end
