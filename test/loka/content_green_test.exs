defmodule Loka.ContentGreenTest do
  # Reaction rules in the compiler (Early R7/R8 R; reaction.schema.json ReactionRule). Expected
  # diagnostics are hand-written from protocol/cartridge.schema.json DiagnosticCode, with the
  # loader's paths in kernel/ts/test/reactions.test.ts; the known answer is
  # protocol/fixtures/cartridge_green_hash.json (Python).
  use ExUnit.Case, async: true

  import Loka.ContentSource, only: [compile: 2]
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/ashmere_green")}
  @kat JSON.decode!(File.read!("protocol/fixtures/cartridge_green_hash.json"))
  @src "cartridges/ashmere_green"
  @expected ~s({"cartridge":#{@kat["canonical"]},"content_hash":"#{@kat["sha256"]}"})

  defp src(rel), do: JSON.decode!(File.read!(Path.join(@src, rel)))

  defp ref(kind, key),
    do: %{
      "cartridge_id" => "ashmere_green",
      "cartridge_version" => "0.0.1",
      "kind" => kind,
      "key" => key
    }

  defp d(code, path, data, suggested \\ []) do
    %{
      "severity" => "error",
      "code" => code,
      "path" => path,
      "message_key" => "diagnostics." <> String.downcase(code),
      "data" => data,
      "suggested_capabilities" => suggested
    }
  end

  defp rule(key, f), do: %{"reactions/#{key}.json" => f.(src("reactions/#{key}.json"))}

  # Breaks: reactions dropped, misplaced or reshaped in the artifact, or a source without them
  # compiled as another format.
  test "ashmere_green compiles to its Python known answer without warnings" do
    assert Loka.Content.compile(@src) == {:ok, @expected, []}
  end

  # Breaks: a trigger's short fact or room left short (Checks.expand; the loader would reject it).
  test "full trigger references compile to the same artifact", %{dir: dir} do
    files =
      Map.merge(
        rule("gossip", &put_in(&1, ["on", "fact"], ref("fact", "green_busy"))),
        rule("ring", &put_in(&1, ["on", "room"], ref("room", "belfry")))
      )

    assert compile(dir, files) == {:ok, @expected, []}
  end

  # Breaks: a trigger of an unregistered event type, a trigger, `when` or fact.assign naming a
  # fact or room the cartridge lacks, or a value not of its fact's type compiling.
  test "reaction triggers and consequences are checked", %{dir: dir} do
    cases = [
      {rule("ring", &put_in(&1, ["on", "event"], "bell_rung")),
       d("SCHEMA_VIOLATION", "reactions/ring.on.event", %{"error" => "unknown_variant"})},
      {rule("gossip", &put_in(&1, ["on", "fact"], "rumour")),
       d("UNRESOLVED_REFERENCE", "reactions/gossip.on.fact", %{
         "target" => "ashmere_green@0.0.1:fact/rumour"
       })},
      {rule("gossip", &put_in(&1, ["when", "root", "fact"], "rumour")),
       d("UNRESOLVED_REFERENCE", "reactions/gossip.when.root.fact", %{
         "target" => "ashmere_green@0.0.1:fact/rumour"
       })},
      {rule("ring", &put_in(&1, ["on", "room"], "tower")),
       d("UNRESOLVED_REFERENCE", "reactions/ring.on.room", %{
         "target" => "ashmere_green@0.0.1:room/tower"
       })},
      {rule(
         "ring",
         &put_in(&1, ["apply"], [%{"op" => "fact.assign", "fact" => "bell", "value" => true}])
       ),
       d("UNRESOLVED_REFERENCE", "reactions/ring.apply[0].fact", %{
         "target" => "ashmere_green@0.0.1:fact/bell"
       })},
      {rule(
         "ring",
         &put_in(&1, ["apply"], [%{"op" => "fact.assign", "fact" => "bell_up", "value" => 1}])
       ), d("FACT_TYPE_MISMATCH", "reactions/ring.apply[0].value", %{})}
    ]

    for {files, diag} <- cases,
        do: assert(compile(dir, files) == {:error, [diag]})
  end

  # Breaks: a reaction, its trigger's event or its fact.assign's fact_changed compiling without
  # its owner (reaction@1, fact@1) in the manifest.
  test "a reaction needs reaction@1, and fact@1 for a fact trigger or a fact.assign", %{
    dir: dir
  } do
    m = src("cartridge.json")

    without =
      &%{
        "cartridge.json" =>
          update_in(m, ["requires", "capabilities"], fn c -> Map.delete(c, &1) end)
      }

    # Every reaction file but `key`'s removed.
    others = fn key ->
      for path <- Path.wildcard(Path.join(dir, "reactions/*.json")),
          rel = Path.relative_to(path, dir),
          rel != "reactions/#{key}.json",
          into: %{},
          do: {rel, nil}
    end

    assert compile(dir, Map.merge(others.("ring"), without.("reaction"))) ==
             {:error,
              [
                d("UNDECLARED_CAPABILITY", "reactions/ring", %{"capability" => "reaction"}, [
                  "reaction@1"
                ])
              ]}

    fact = ["fact@1"]

    assert compile(
             dir,
             others.("gossip")
             |> Map.merge(without.("fact"))
             |> Map.merge(rule("gossip", &Map.merge(Map.delete(&1, "when"), %{"apply" => []})))
           ) ==
             {:error,
              [
                d(
                  "UNDECLARED_CAPABILITY",
                  "reactions/gossip.on.event",
                  %{"capability" => "fact"},
                  fact
                )
              ]}

    assert compile(dir, Map.merge(others.("ring"), without.("fact"))) ==
             {:error,
              [
                d(
                  "UNDECLARED_CAPABILITY",
                  "reactions/ring.apply[0].op",
                  %{"capability" => "fact"},
                  fact
                )
              ]}
  end
end
