defmodule Loka.ContentTracksTest do
  use ExUnit.Case, async: true

  # Toolbox row W13 (mechanics.md Tracks and trails; cartridge.md Trail declarations), twin of
  # kernel/ts/test/tracks.test.ts's loader cases.
  @sampler "cartridges/tracks_sampler"

  defp facts(artifact),
    do: for({k, f} <- Jason.decode!(artifact)["cartridge"]["facts"], into: %{}, do: {k, f})

  # Breaks: a trail fact not added (or added without its opt-in), or its spec drifting from the
  # loader's (trailFacts in content/cartridge_trails.ts: the loader refuses the artifact).
  test "the compiler adds each trail fact for its opt-in only" do
    assert {:ok, artifact, _} = Loka.ContentSource.compile(Loka.ContentSource.copy(@sampler), [])
    facts = facts(artifact)
    trail = for k <- Map.keys(facts), String.contains?(k, "/trail_"), do: k

    assert Enum.sort(trail) ==
             for(
               k <- ~w(trail_at trail_exit trail_hounds_at trail_hounds_exit),
               do: "tracks_sampler@0.0.1:fact/#{k}"
             )

    exit = facts["tracks_sampler@0.0.1:fact/trail_hounds_exit"]
    assert {exit["scopes"], exit["per_subject"]} == {["instance"], true}
    assert facts["tracks_sampler@0.0.1:fact/trail_exit"]["scopes"] == ["player"]

    assert {:ok, fear, _} =
             Loka.ContentSource.compile(Loka.ContentSource.copy("cartridges/fear_sampler"), [])

    refute fear |> facts() |> Map.keys() |> Enum.any?(&String.contains?(&1, "/trail_"))
  end

  # Breaks: each compiler check dropped or reporting another path.
  test "the compiler refuses each bad trail declaration" do
    dir = Loka.ContentSource.copy(@sampler)
    long = String.duplicate("h", 54)
    hounds = JSON.decode!(File.read!(Path.join(dir, "populations/hounds.json")))
    write = %{"op" => "fact.assign", "fact" => "trail_hounds_at", "value" => 1}

    for {changes, want} <- [
          {[{"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.84")}],
           {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}},
          {[{"facts.json", &put_in(&1, ["facts", "trail_hounds_exit"], &1["facts"]["tracked"])}],
           {"RESERVED_FACT", "facts.facts.trail_hounds_exit"}},
          {[
             {"recipes/track_clearing.json",
              &update_in(&1, ["outcomes", "success", "sequence"], fn s -> s ++ [write] end)}
           ], {"RESERVED_FACT", "recipes/track_clearing.outcomes.success.sequence[1].fact"}},
          {[{"cartridge.json", &(pop_in(&1, ["world", "trails", "leads", "north"]) |> elem(1))}],
           {"UNRESOLVED_REFERENCE", "cartridge.world.trails.leads"}},
          {[{"cartridge.json", &put_in(&1, ["world", "trails", "leads", "north"], "trail.nope")}],
           {"UNRESOLVED_REFERENCE", "cartridge.world.trails.leads.north"}},
          {[{"recipes/track_burrow.json", &put_in(&1, ["check", "plan"], "hunters")}],
           {"UNRESOLVED_REFERENCE", "recipes/track_burrow.check.plan"}},
          {[{"cartridge.json", &(pop_in(&1, ["world", "trails"]) |> elem(1))}],
           {"UNRESOLVED_REFERENCE", "populations/hunters.hunts"}},
          {[{"populations/#{long}.json", hounds}],
           {"SCHEMA_VIOLATION", "populations/#{long}.key"}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
      assert want in codes(diags), inspect({want, codes(diags)})
    end
  end

  defp codes(diags), do: Enum.map(diags, &{&1["code"], &1["path"]})
end
