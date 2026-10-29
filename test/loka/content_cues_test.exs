defmodule Loka.ContentCuesTest do
  use ExUnit.Case, async: true

  @dir "cartridges/senses_sampler"
  defp pairs(diags), do: Enum.map(diags, &{&1["code"], &1["path"]})

  # Breaks (toolbox row G6): the compiler accepts a cue (a room detail's included) without sense_cue@1, or a cue text key missing
  # from the catalog; or it fails to expand a short reference in a cue's condition (the sampler's
  # stew and rattle cues use one).
  test "cues need sense_cue@1 and catalog text" do
    dir = Loka.ContentSource.copy(@dir)
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])

    unowned =
      {"cartridge.json",
       &update_in(&1, ["requires", "capabilities"], fn c -> Map.delete(c, "sense_cue") end)}

    assert {:error, diags} = Loka.ContentSource.compile(dir, [unowned])
    assert {"UNDECLARED_CAPABILITY", "rooms/forge.cues[0]"} in pairs(diags), inspect(diags)
    # a room detail's cue is checked too
    assert {"UNDECLARED_CAPABILITY", "rooms/tower.details.kitchen.cues[0]"} in pairs(diags),
           inspect(diags)

    untexted = {"text.json", &Map.delete(&1, "cue.rattle")}
    assert {:error, diags} = Loka.ContentSource.compile(dir, [untexted])

    assert {"UNRESOLVED_REFERENCE", "actions/pick_lock.outcomes.failure.cues[0].text"} in pairs(
             diags
           ),
           inspect(diags)
  end
end
