defmodule Loka.ContentNpcStatusTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/npc_status_sampler")}

  # Breaks: an immune list, a step's item or a tick trigger naming nothing, or a G3 field under
  # kernel_api 1.46, compiles; or an item's short immune reference is left unexpanded.
  test "G3 immune lists, step items and status triggers keep their boundaries", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])

    assert {:ok, _, _} =
             Loka.ContentSource.compile(dir, [
               {"items/torch.json", &Map.put(&1, "immune", ["poison"])}
             ])

    cases = [
      {"npcs/golem.json", &Map.put(&1, "immune", ["missing"])},
      {"items/torch.json", &Map.put(&1, "immune", ["missing"])},
      {"npcs/golem.json", &Map.put(&1, "immune", [])},
      {"reactions/kindle.json", &put_in(&1, ["apply", Access.at(0), "item"], "missing")},
      {"reactions/groan.json", &put_in(&1, ["on", "status"], "missing")},
      {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.45")}
    ]

    for {file, change} <- cases do
      assert {:error, _} = Loka.ContentSource.compile(dir, [{file, change}]), file
    end
  end

  # Breaks (row 2c): a status modifier naming no attribute compiles, or one under kernel_api 1.46
  # compiles (the derived sampler's might is its only 1.46 field).
  test "status modifiers keep their attribute and API floor", %{dir: dir} do
    luck = &put_in(&1, ["modifies", Access.at(0), "attribute"], "luck")
    assert {:error, diags} = Loka.ContentSource.compile(dir, [{"statuses/fury.json", luck}])

    assert {"UNRESOLVED_REFERENCE", "statuses/fury.modifies[0].attribute"} in Enum.map(
             diags,
             &{&1["code"], &1["path"]}
           ),
           inspect(diags)

    derived = Loka.ContentSource.copy("cartridges/derived_sampler")
    api = &put_in(&1, ["requires", "kernel_api", "at_least"], "1.45")

    assert {:error, [%{"code" => "KERNEL_API_RANGE_INVALID"}]} =
             Loka.ContentSource.compile(derived, [{"cartridge.json", api}])
  end
end
