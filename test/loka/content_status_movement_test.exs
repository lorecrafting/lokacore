defmodule Loka.ContentStatusMovementTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/ward_sampler")}

  defp api(v), do: {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], v)}

  defp tagged(tag) do
    [
      {"rooms/den.json", &Map.put(&1, "tags", [tag])},
      {"cartridge.json", &put_in(&1, ["requires", "capabilities", "tags"], 1)}
    ]
  end

  defp item,
    do: [
      {"items/npc_corpse.json", &Map.put(&1, "tags", ["water"])},
      {"cartridge.json", &put_in(&1, ["requires", "capabilities", "tags"], 1)}
    ]

  defp barrier,
    do: [
      {"barriers/mist_gate.json",
       %{
         "keywords" => ["gate"],
         "short" => "barrier.mist_gate.short",
         "initial" => "open",
         "tags" => ["chasm"]
       }},
      {"text.json", &Map.put(&1, "barrier.mist_gate.short", "a mist gate")},
      {"cartridge.json",
       &(&1
         |> put_in(["requires", "capabilities", "barrier"], 1)
         |> put_in(["requires", "capabilities", "tags"], 1))}
    ]

  defp moving,
    do:
      {"statuses/warded.json",
       &(&1 |> Map.delete("resistances") |> Map.put("movement", %{"cost_percent" => 50}))}

  # Breaks (status reader 7; twin of the loader test in kernel/ts/test/status_movement.test.ts): the
  # compiler refuses a status movement, a room's air, chasm or water tag, an item's water tag or a
  # barrier's chasm tag (a movement status needs no per_tick), or drops movement from the artifact.
  test "movement and terrain tags compile; movement stands in for per_tick", %{dir: dir} do
    for edits <- [[moving()], tagged("air"), tagged("chasm"), tagged("water"), item(), barrier()] do
      assert {:ok, _, _} = Loka.ContentSource.compile(dir, [api("1.62") | edits])
    end

    assert {:ok, artifact, _} = Loka.ContentSource.compile(dir, [api("1.62"), moving()])
    warded = JSON.decode!(artifact)["cartridge"]["statuses"]["ward_sampler@0.0.1:status/warded"]
    assert warded["movement"] == %{"cost_percent" => 50}
  end
end
