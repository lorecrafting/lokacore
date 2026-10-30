defmodule Loka.ContentHarvestToolTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/harvest_sampler")}

  # Break (toolbox row 19): a
  # harvest tool gate compiles without tag@1.
  test "a harvest tool needs tag@1", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])

    untagged = &Map.delete(&1, "tags")

    assert {:error, diags} =
             Loka.ContentSource.compile(dir, [
               {"cartridge.json", &(pop_in(&1, ["requires", "capabilities", "tag"]) |> elem(1))},
               {"items/pickaxe.json", untagged},
               {"items/stick.json", untagged}
             ])

    assert {"UNDECLARED_CAPABILITY", "rooms/mine.details.seam.harvest.tool"} in Enum.map(
             diags,
             &{&1["code"], &1["path"]}
           )
  end
end
