defmodule Loka.ContentFirstSearchTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/journal_sampler")}

  # Twin of kernel/ts/test/search_fixture.ts: resolving the lantern quest with outcome carry starts
  # the oar quest.
  defp source do
    [
      {"cartridge.json",
       fn c ->
         c
         |> put_in(~w(requires kernel_api at_least), "1.8")
         |> update_in(~w(requires capabilities), &Map.put(&1, "reaction", 1))
       end},
      {"facts.json",
       &put_in(&1, ~w(facts tracks_found), %{
         "version" => 1,
         "value_type" => %{"type" => "bool", "default" => false},
         "scopes" => ["player"],
         "meaning" => "The player studied the tracks."
       })},
      {"reactions/start_search.json",
       %{
         "on" => %{"event" => "quest_resolved", "quest" => "lantern", "outcome" => "carry"},
         "apply" => [%{"op" => "quest.activate", "quest" => "oar"}]
       }}
    ]
  end

  # Breaks: new short quest refs remain strings, missing definitions/owner locks compile,
  # or activation is accepted under an actorless legacy trigger.
  test "quest reaction references, owners and restricted activation are checked", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, source())
    search = "reactions/start_search.json"
    caps = ["requires", "capabilities"]

    cases = [
      {"source quest", "UNRESOLVED_REFERENCE", search, &put_in(&1, ["on", "quest"], "absent")},
      {"malformed source", "SCHEMA_VIOLATION", search, &put_in(&1, ["on", "quest"], "bad key")},
      {"target quest", "UNRESOLVED_REFERENCE", search,
       &put_in(&1, ["apply", Access.at(0), "quest"], "absent")},
      {"actorless", "OUTCOME_MISMATCH", search,
       &Map.put(&1, "on", %{"event" => "fact_changed", "fact" => "tracks_found"})},
      {"quest owner", "UNDECLARED_CAPABILITY", "cartridge.json",
       &update_in(&1, caps, fn c -> Map.delete(c, "quest") end)},
      {"reaction owner", "UNDECLARED_CAPABILITY", "cartridge.json",
       &update_in(&1, caps, fn c -> Map.delete(c, "reaction") end)}
    ]

    for {name, code, file, change} <- cases do
      assert {:error, diagnostics} = Loka.ContentSource.compile(dir, source() ++ [{file, change}])
      assert Enum.any?(diagnostics, &(&1["code"] == code)), name
    end
  end
end
