defmodule Loka.ContentDecayTest do
  use ExUnit.Case, async: true

  # Breaks (toolbox row 41): item.move's
  # room, or a trigger's status or item filter, is never resolved.
  test "item.move keeps a resolved room and triggers resolve their filters" do
    dir = Loka.ContentSource.copy("cartridges/decay_sampler")
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    room = &put_in(&1, ["apply", Access.at(0), "room"], "nowhere")

    for {edit, expected} <- [
          {{"reactions/spoil.json", room},
           {"UNRESOLVED_REFERENCE", "reactions/spoil.apply[0].room"}},
          {{"reactions/spoil.json", &put_in(&1, ["on", "status"], "rotting")},
           {"UNRESOLVED_REFERENCE", "reactions/spoil.on.status"}},
          {{"reactions/catch.json", &put_in(&1, ["on", "item"], "eel")},
           {"UNRESOLVED_REFERENCE", "reactions/catch.on.item"}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [edit])
      assert expected in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end
end
