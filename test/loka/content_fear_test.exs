defmodule Loka.ContentFearTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/fear_sampler")}

  defp diags(dir, edits) do
    assert {:error, ds} = Loka.ContentSource.compile(dir, edits)
    Enum.map(ds, &{&1["code"], &1["path"]})
  end

  defp at149, do: {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.49")}

  # Breaks (toolbox row W21; twin of the loader row in kernel/ts/test/fear.test.ts): a fear status
  # or a co_present step (each alone) compiles under API 1.49, a co_present step also names its
  # holder, or a fear status without per_tick (the sampler's afraid) is refused.
  test "fear and co_present need API 1.50; co_present names no holder", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])

    assert List.keymember?(
             diags(dir, [at149(), {"reactions/leader_fell.json", nil}]),
             "KERNEL_API_RANGE_INVALID",
             0
           )

    plain = &(&1 |> Map.delete("fear") |> Map.put("per_tick", -1))

    assert List.keymember?(
             diags(dir, [at149(), {"statuses/afraid.json", plain}]),
             "KERNEL_API_RANGE_INVALID",
             0
           )

    for {field, key} <- [{"npc", "guard"}, {"item", "ear"}] do
      named = &put_in(&1, ["apply", Access.at(0), field], key)
      path = "reactions/leader_fell.apply[0].#{field}"
      assert {"SCHEMA_VIOLATION", path} in diags(dir, [{"reactions/leader_fell.json", named}])
    end
  end
end
