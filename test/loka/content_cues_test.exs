defmodule Loka.ContentCuesTest do
  use ExUnit.Case, async: true

  @dir "cartridges/senses_sampler"
  defp pairs(diags), do: Enum.map(diags, &{&1["code"], &1["path"]})

  # Breaks (toolbox row G6): the compiler accepts a cue or a lone cue_perceived leaf below
  # kernel_api 1.48, a cue (a room detail's included) without sense_cue@1, or a cue text key missing
  # from the catalog; or it fails to expand a short reference in a cue's condition (the sampler's
  # stew and rattle cues use one).
  test "cues need 1.48, sense_cue@1 and catalog text" do
    dir = Loka.ContentSource.copy(@dir)
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    api = {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.47")}
    floor = {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}

    no_cues =
      for f <-
            ~w(rooms/forge.json rooms/tower.json items/torch.json recipes/pick_lock.json npcs/sentry.json),
          do: {f, &drop_cues/1}

    assert {:error, diags} = Loka.ContentSource.compile(dir, [api])
    assert floor in pairs(diags), inspect(diags)
    # the reactions' cue_perceived leaves alone, nested under `not`, still need 1.48
    hidden_leaf =
      for f <- ~w(reactions/guard_hears.json reactions/sentry_hears.json),
          do:
            {f, &update_in(&1, ["when", "root"], fn root -> %{"op" => "not", "item" => root} end)}

    assert {:error, diags} = Loka.ContentSource.compile(dir, [api | no_cues ++ hidden_leaf])
    assert floor in pairs(diags), inspect(diags)

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

    assert {"UNRESOLVED_REFERENCE", "recipes/pick_lock.outcomes.failure.cues[0].text"} in pairs(
             diags
           ),
           inspect(diags)
  end

  defp drop_cues(d) when is_map(d),
    do: Map.new(Map.delete(d, "cues"), fn {k, v} -> {k, drop_cues(v)} end)

  defp drop_cues(d), do: d
end
