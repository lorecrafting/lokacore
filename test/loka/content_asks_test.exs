defmodule Loka.ContentAsksTest do
  use ExUnit.Case, async: true

  # Breaks (row FD7; twin of the loader test in kernel/ts/test/ask.test.ts): an answer naming no
  # topic, an ask without speech@1, an ask under API 1.96, or an asked trigger naming no topic
  # compiles.
  test "ask declarations keep their boundaries" do
    dir = Loka.ContentSource.copy("cartridges/ask_sampler")
    nope = &put_in(&1, &2, "nope")
    floor = {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}

    diags = fn edits ->
      assert {:error, ds} = Loka.ContentSource.compile(dir, edits)
      Enum.map(ds, &{&1["code"], &1["path"]})
    end

    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])

    assert diags.([{"npcs/smith.json", &nope.(&1, ["ask", "answers", Access.at(0), "topic"])}]) ==
             [{"UNRESOLVED_REFERENCE", "npcs/smith.ask.answers[0].topic"}]

    assert diags.([
             {"cartridge.json",
              &(&1 |> pop_in(["requires", "capabilities", "speech"]) |> elem(1))},
             {"reactions/guard_smugglers.json", nil}
           ]) == [
             {"UNDECLARED_CAPABILITY", "npcs/guard.ask"},
             {"UNDECLARED_CAPABILITY", "npcs/smith.ask"}
           ]

    # Each floor alone: the asks' (no asked trigger left), then the asked trigger's (no ask left).
    api = {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.95")}
    assert diags.([api, {"reactions/guard_smugglers.json", nil}]) == [floor]
    no_ask = &Map.delete(&1, "ask")
    assert diags.([api, {"npcs/smith.json", no_ask}, {"npcs/guard.json", no_ask}]) == [floor]

    assert diags.([{"reactions/guard_smugglers.json", &nope.(&1, ["on", "topic"])}]) ==
             [{"UNRESOLVED_REFERENCE", "reactions/guard_smugglers.on.topic"}]
  end
end
