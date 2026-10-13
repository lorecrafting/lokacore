defmodule Loka.ContentDecayTest do
  use ExUnit.Case, async: true

  # Breaks (toolbox row 41; twin of the loader test in kernel/ts/test/decay.test.ts): item.move
  # compiles under API 1.76, or its room is never resolved.
  test "item.move keeps API 1.77 and a resolved room" do
    dir = Loka.ContentSource.copy("cartridges/decay_sampler")
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    room = &put_in(&1, ["apply", Access.at(0), "room"], "nowhere")

    for {edit, expected} <- [
          {{"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.76")},
           {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}},
          {{"reactions/spoil.json", room},
           {"UNRESOLVED_REFERENCE", "reactions/spoil.apply[0].room"}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [edit])
      assert expected in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end
end
