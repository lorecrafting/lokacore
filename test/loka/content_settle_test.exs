defmodule Loka.ContentSettleTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/settle_sampler")}

  # Break (Settle S3-1; twin of the loader test in kernel/ts/test/settle.test.ts): a narrate line
  # whose text key is not in the catalog compiles. The 1.103 floor is loader_floors.json's
  # "a narrate step" case.
  test "a narrate text key resolves in the text catalog", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    missing = &put_in(&1, ["apply", Access.at(0), "text"], "settle.missing")

    assert {:error, diags} =
             Loka.ContentSource.compile(dir, [{"reactions/arrival_line.json", missing}])

    assert Enum.map(diags, &{&1["code"], &1["path"]}) == [
             {"UNRESOLVED_REFERENCE", "reactions/arrival_line.apply[0].text"}
           ]
  end
end
