defmodule Loka.ContentStatusReadersTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/ward_sampler")}

  defp diags(dir, edits) do
    assert {:error, ds} = Loka.ContentSource.compile(dir, edits)
    Enum.map(ds, &{&1["code"], &1["path"]})
  end

  defp plain(s), do: s |> Map.drop(~w(blocks allows resistances)) |> Map.put("per_tick", -1)

  # Breaks (status readers 4 and 5; twin of the loader row in kernel/ts/test/status_readers.test.ts):
  # one reader field (each alone) compiles under API 1.53, a blocks or allows entry naming no
  # command (or the authority-internal elapsed) compiles, or a reader status without per_tick (the
  # sampler's four) is refused.
  test "reader fields need API 1.54 and name player commands", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    at153 = {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.53")}

    for {key, field, value} <- [
          {"warded", "resistances", %{"fire" => 10}},
          {"hushed", "blocks", ["say"]},
          {"hushed", "allows", ["look"]}
        ] do
      plains =
        for k <- ~w(warded hushed soaked stunned), k != key, do: {"statuses/#{k}.json", &plain/1}

      one = {"statuses/#{key}.json", &(&1 |> plain() |> Map.put(field, value))}

      assert {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api"} in diags(
               dir,
               [at153, one | plains]
             ),
             field
    end

    for {field, name} <- [{"blocks", "fly"}, {"allows", "elapsed"}] do
      named = &Map.put(&1, field, ["say", name])

      assert {"UNKNOWN_COMMAND", "statuses/hushed.#{field}[1]"} in diags(dir, [
               {"statuses/hushed.json", named}
             ])
    end
  end
end
