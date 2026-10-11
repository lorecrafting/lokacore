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

  defp moving,
    do:
      {"statuses/warded.json",
       &(&1 |> Map.delete("resistances") |> Map.put("movement", %{"cost_percent" => 50}))}

  # Breaks (status reader 7; twin of the loader test in kernel/ts/test/status_movement.test.ts): a
  # status movement or a room's air, chasm or water tag compiles under API 1.61, an ordinary tag
  # needs 1.62, or a movement status without per_tick is refused.
  test "movement and terrain tags need API 1.62; movement stands in for per_tick", %{dir: dir} do
    for edits <- [[moving()], tagged("air"), tagged("chasm"), tagged("water")] do
      assert {:ok, _, _} = Loka.ContentSource.compile(dir, [api("1.62") | edits])

      assert {:error, [%{"code" => "KERNEL_API_RANGE_INVALID"}]} =
               Loka.ContentSource.compile(dir, [api("1.61") | edits])
    end

    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [api("1.61") | tagged("wooden")])
  end
end
