defmodule Loka.ContentStoryletTest do
  use ExUnit.Case, async: true

  @dir "cartridges/storylet_sampler"
  defp pairs(diags), do: Enum.map(diags, &{&1["code"], &1["path"]})

  # Breaks (toolbox row FD3): the compiler accepts a storylet below kernel_api 1.92, a storylet
  # room that names no room, weight 0, or a scene action start naming one of room and detail
  # (the TS loader refuses them too; storylet.test.ts).
  test "storylet targets need 1.92 and real rooms; their scenes name neither room nor detail" do
    dir = Loka.ContentSource.copy(@dir)
    assert {:ok, _, []} = Loka.ContentSource.compile(dir, [])

    below = [{"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.91")}]
    assert {:error, diags} = Loka.ContentSource.compile(dir, below)

    assert pairs(diags) == [
             {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}
           ]

    nowhere = [
      {"recipes/pickpocket.json", &put_in(&1, ["target", "rooms"], ["market", "nowhere"])}
    ]

    assert {:error, diags} = Loka.ContentSource.compile(dir, nowhere)
    assert pairs(diags) == [{"UNRESOLVED_REFERENCE", "recipes/pickpocket.target.rooms[1]"}]

    # A storylet has no detail and so no rating to oppose.
    opposed = [
      {"recipes/pickpocket.json",
       &Map.put(&1, "check", %{"key" => "lift", "kind" => "opposed", "attribute" => "str"})}
    ]

    assert {:error, diags} = Loka.ContentSource.compile(dir, opposed)
    assert {"SCHEMA_VIOLATION", "recipes/pickpocket.check"} in pairs(diags)

    zero = [{"recipes/pickpocket.json", &put_in(&1, ["target", "weight"], 0)}]
    assert {:error, diags} = Loka.ContentSource.compile(dir, zero)
    assert pairs(diags) == [{"SCHEMA_VIOLATION", "recipes/pickpocket.target.weight"}]

    half = [{"scenes/stranger.json", &put_in(&1, ["on", "detail"], "stall")}]
    assert {:error, diags} = Loka.ContentSource.compile(dir, half)
    assert pairs(diags) == [{"SCHEMA_VIOLATION", "scenes/stranger.on"}]

    # Only a storylet recipe may start an unplaced scene.
    spell = [
      {"recipes/stranger_beckons.json",
       &put_in(&1, ["target"], %{"kind" => "spell", "word" => "lux"})}
    ]

    assert {:error, diags} = Loka.ContentSource.compile(dir, spell)
    assert pairs(diags) == [{"SCHEMA_VIOLATION", "scenes/stranger.on"}]
  end
end
