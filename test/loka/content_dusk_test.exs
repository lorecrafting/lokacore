defmodule Loka.ContentDuskTest do
  # Luck checks, failure outcomes, durations and time_window in the compiler (R5 S6a;
  # action.schema.json ScriptedAction, ActionCheck; policy.schema.json time_window). Expected
  # diagnostics are hand-written from protocol/cartridge.schema.json DiagnosticCode; the known
  # answer is protocol/fixtures/cartridge_dusk_hash.json (Python).
  use ExUnit.Case, async: true

  import Loka.ContentSource, only: [compile: 2]
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/check_sampler")}
  @kat JSON.decode!(File.read!("protocol/fixtures/cartridge_dusk_hash.json"))
  @src "cartridges/check_sampler"
  @expected ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})

  defp src(rel), do: JSON.decode!(File.read!(Path.join(@src, rel)))

  defp pick(path, f),
    do: %{"actions/pick_lock.json" => update_in(src("actions/pick_lock.json"), path, f)}

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
  test "check_sampler compiles to its Python known answer without warnings", %{dir: dir} do
    assert Loka.Content.compile(@src) == {:ok, @expected, []}
    # A failure step's short fact reference expands like a success step's.
    step = %{"op" => "fact.assign", "fact" => "crypt_gate_open", "value" => false}

    {:ok, artifact, []} =
      compile(dir, pick(["outcomes", "failure", "sequence"], fn _ -> [step] end))

    [failure] =
      JSON.decode!(artifact)["cartridge"]["scripted_actions"][
        "check_sampler@0.0.1:action/pick_lock"
      ][
        "outcomes"
      ]["failure"]["sequence"]

    assert failure["fact"]["kind"] == "fact"
  end

  # Breaks: a checked scripted action without a failure outcome, or a failure outcome without a check,
  # compiles (the loader rejects both).
  test "a scripted action has a failure outcome exactly when it has a check", %{dir: dir} do
    mismatch = {:error, [d("OUTCOME_MISMATCH", "actions/pick_lock.outcomes")]}
    drop = fn key -> fn r -> Map.delete(r, key) end end
    assert compile(dir, pick(["outcomes"], drop.("failure"))) == mismatch

    assert compile(dir, %{
             "actions/pick_lock.json" => Map.delete(src("actions/pick_lock.json"), "check")
           }) == mismatch
  end

  # Breaks: a failure outcome's fact, narration or step owner, or the check's owner, unchecked.
  test "a failure outcome's references and owners, and the check's, are checked", %{dir: dir} do
    step = %{"op" => "fact.assign", "fact" => "gate_rusted", "value" => true}

    assert compile(dir, pick(["outcomes", "failure", "sequence"], fn _ -> [step] end)) ==
             {:error,
              [
                d(
                  "UNRESOLVED_REFERENCE",
                  "actions/pick_lock.outcomes.failure.sequence[0].fact",
                  %{
                    "target" => "check_sampler@0.0.1:fact/gate_rusted"
                  }
                )
              ]}

    assert compile(
             dir,
             pick(["outcomes", "failure", "narration", "actor"], fn _ -> "narration.none" end)
           ) ==
             {:error,
              [
                d("UNRESOLVED_REFERENCE", "actions/pick_lock.outcomes.failure.narration.actor", %{
                  "target" => "narration.none"
                })
              ]}

    assert compile(dir, without("check")) ==
             {:error,
              [
                d(
                  "UNDECLARED_CAPABILITY",
                  "actions/pick_lock.check",
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

    {:error, diags} = compile(dir, files)

    assert d(
             "UNDECLARED_CAPABILITY",
             "actions/pick_lock.outcomes.failure.sequence[1].op",
             %{"capability" => "fact"},
             ["fact@1"]
           ) in diags
  end

  # Breaks: time_window compiles without schedule@1, or with an empty window.
  test "time_window needs schedule@1 and a non-empty window", %{dir: dir} do
    assert compile(dir, without("schedule")) ==
             {:error,
              [
                d(
                  "UNDECLARED_CAPABILITY",
                  "actions/ring_bell.policy.op",
                  %{"capability" => "schedule"},
                  ["schedule@1"]
                )
              ]}

    ring = put_in(src("actions/ring_bell.json"), ["policy", "to"], 18)

    assert compile(dir, %{"actions/ring_bell.json" => ring}) ==
             {:error, [d("EMPTY_TIME_WINDOW", "actions/ring_bell.policy")]}
  end

  # Review S2. Breaks: two scripted actions' checks with one key compile, so one check DefinitionRef names
  # two checks.
  test "two scripted actions' checks with one key are DUPLICATE_DEFINITION", %{dir: dir} do
    ring = Map.put(src("actions/ring_bell.json"), "check", src("actions/pick_lock.json")["check"])

    ring =
      put_in(ring, ["outcomes", "failure"], src("actions/pick_lock.json")["outcomes"]["failure"])

    assert compile(dir, %{"actions/ring_bell.json" => ring}) ==
             {:error,
              [
                d("DUPLICATE_DEFINITION", "actions/pick_lock.check"),
                d("DUPLICATE_DEFINITION", "actions/ring_bell.check")
              ]}
  end
end
