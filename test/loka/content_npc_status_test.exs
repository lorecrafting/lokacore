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
end
