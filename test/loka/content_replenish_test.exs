defmodule Loka.ContentReplenishTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/replenish_sampler")}

  defp codes(dir, edits) do
    assert {:error, diags} = Loka.ContentSource.compile(dir, edits)
    Enum.map(diags, &{&1["code"], &1["path"]})
  end

  defp seam(f), do: [{"replenish/seam_regrowth.json", f}]

  # Break (toolbox row 19b; twin of the loader row in kernel/ts/test/replenish.test.ts): replenish
  # compiles under API 1.70, with a template or self-move holder, an unresolved item or holder or a
  # duplicate item; or the harvest allowance is dropped, so the seam's ore in the store is refused.
  test "replenish needs API 1.71 and resolved, distinct holders and items", %{dir: dir} do
    at = "replenish/seam_regrowth"
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])

    assert {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"} in codes(dir, [
             {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.70")}
           ])

    assert {"SCHEMA_VIOLATION", at <> ".from"} in codes(
             dir,
             seam(&Map.put(&1, "from", %{"in" => "template"}))
           )

    assert {"SCHEMA_VIOLATION", at <> ".from"} in codes(dir, seam(&Map.put(&1, "from", &1["to"])))

    assert {"UNRESOLVED_REFERENCE", at <> ".to.npc"} in codes(
             dir,
             seam(&Map.put(&1, "to", %{"in" => "npc", "npc" => "nobody"}))
           )

    assert {"UNRESOLVED_REFERENCE", at <> ".items[4]"} in codes(
             dir,
             seam(&put_in(&1, ["items"], List.replace_at(&1["items"], 4, "nothing")))
           )

    assert {"DUPLICATE_DEFINITION", at <> ".items"} in codes(
             dir,
             seam(&put_in(&1, ["items"], List.replace_at(&1["items"], 4, "ore_01")))
           )

    assert {"OUTCOME_MISMATCH", "rooms/mine.details.seam.harvest.items"} in codes(
             dir,
             seam(&Map.put(&1, "to", %{"in" => "npc", "npc" => "trader"}))
           )
  end
end
