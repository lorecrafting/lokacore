defmodule Loka.ContentFirstSearchTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/ashmere_missing_child")}

  # Breaks: new short quest refs remain strings, missing definitions/owner locks compile,
  # or activation is accepted under an actorless legacy trigger or an older API.
  test "quest reaction references, owners and restricted activation are checked", %{dir: dir} do
    search = "reactions/start_search.json"
    caps = ["requires", "capabilities"]

    cases = [
      {"source quest", "UNRESOLVED_REFERENCE", search, &put_in(&1, ["on", "quest"], "absent")},
      {"malformed source", "SCHEMA_VIOLATION", search, &put_in(&1, ["on", "quest"], "bad key")},
      {"target quest", "UNRESOLVED_REFERENCE", search,
       &put_in(&1, ["apply", Access.at(0), "quest"], "absent")},
      {"actorless", "OUTCOME_MISMATCH", search,
       &Map.put(&1, "on", %{"event" => "entity_entered_room", "room" => "reed_bank"})},
      {"quest owner", "UNDECLARED_CAPABILITY", "cartridge.json",
       &update_in(&1, caps, fn c -> Map.delete(c, "quest") end)},
      {"reaction owner", "UNDECLARED_CAPABILITY", "cartridge.json",
       &update_in(&1, caps, fn c -> Map.delete(c, "reaction") end)},
      {"API", "KERNEL_API_RANGE_INVALID", "cartridge.json",
       &put_in(&1, ["requires", "kernel_api", "at_least"], "1.7")}
    ]

    for {name, code, file, change} <- cases do
      assert {:error, diagnostics} = Loka.ContentSource.compile(dir, [{file, change}])
      assert Enum.any?(diagnostics, &(&1["code"] == code)), name
    end
  end
end
