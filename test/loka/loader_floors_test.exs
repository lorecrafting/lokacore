defmodule Loka.LoaderFloorsTest do
  use ExUnit.Case, async: true

  # Twin of kernel/ts/test/loader_floors.test.ts; both read this fixture (Beads loka-xroj).
  @fixture JSON.decode!(File.read!("protocol/fixtures/loader_floors.json"))

  defp compile(dir, c, at) do
    api = {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], at)}

    edits =
      for [file, path, value] <- c["edits"] || [], path != [], do: {file, &edit(&1, path, value)}

    Loka.ContentSource.compile(dir, merge(edits ++ [api]) ++ whole(c))
  end

  # An edit at path [] writes a whole (new) file, or with null deletes it.
  defp whole(c), do: for([file, [], value] <- c["edits"] || [], do: {file, value})

  # A null value deletes the key (a case below a later sampler key's floor).
  defp edit(json, path, nil), do: elem(pop_in(json, path), 1)
  defp edit(json, path, value), do: put_in(json, path, value)

  # ContentSource.compile takes one change per file: chain the changes of one file.
  defp merge(edits) do
    edits
    |> Enum.group_by(&elem(&1, 0), &elem(&1, 1))
    |> Enum.map(fn {file, funs} -> {file, fn v -> Enum.reduce(funs, v, & &1.(&2)) end} end)
  end

  # Breaks: a compiler floor check dropped, moved to another floor or reporting another code or
  # path (each case's below refused, its floor accepted).
  test "each fixture floor: accepted at the floor, refused just below it" do
    for c <- @fixture["cases"] do
      dir = Loka.ContentSource.copy(c["source"])
      assert {:ok, _, _} = compile(dir, c, c["floor"]), c["source"] <> " at " <> c["floor"]
      assert {:error, diags} = compile(dir, c, c["below"]), c["source"] <> " at " <> c["below"]

      assert List.to_tuple(c["compiler"]) in Enum.map(diags, &{&1["code"], &1["path"]}),
             inspect({c["floor"], diags})
    end
  end

  # Breaks: a case shadowed by another feature at its floor (Beads loka-59uu): with its own
  # feature removed too (its without edits), the source compiles just below the floor.
  test "each counter-edited case compiles just below its floor" do
    refused =
      for c <- @fixture["cases"],
          w = c["without"],
          dir = Loka.ContentSource.copy(c["source"]),
          {:error, diags} <- [compile(dir, Map.update(c, "edits", w, &(&1 ++ w)), c["below"])],
          do: {c["floor"], c["source"], Enum.map(diags, &{&1["code"], &1["path"]})}

    assert refused == []
  end

  # Breaks: a new case without a counter-edit (without), or a stale entry left here once a case
  # gains one. Today's cases are frozen here; the
  # shared samplers (craft, skills, status, build, terrain, gift) are never listed.
  @unguarded [
    "1.17 harvest_sampler",
    "1.21 journal_sampler",
    "1.26 fast_travel_sampler",
    "1.37 gate_sampler",
    "1.37 gate_sampler",
    "1.39 derived_sampler",
    "1.40 derived_sampler",
    "1.41 affects_sampler",
    "1.42 levelling_sampler",
    "1.43 loot_sampler",
    "1.44 damage_sampler",
    "1.45 barrier_sampler",
    "1.46 quest_sampler",
    "1.47 persuade_sampler",
    "1.47 journal_sampler",
    "1.48 senses_sampler",
    "1.49 use_sampler",
    "1.50 fear_sampler",
    "1.51 levelling_sampler",
    "1.52 harvest_sampler",
    "1.53 elements_sampler",
    "1.58 toolbox_showcase",
    "1.67 ranged_sampler",
    "1.68 identify_sampler",
    "1.69 durability_sampler",
    "1.70 group_sampler",
    "1.71 replenish_sampler",
    "1.72 affects_sampler",
    "1.73 group_sampler",
    "1.74 encounter_sampler",
    "1.75 hireling_sampler",
    "1.77 decay_sampler",
    "1.78 access_sampler",
    "1.80 escrow_sampler",
    "1.81 doors_sampler",
    "1.82 prices_sampler",
    "1.83 property_sampler",
    "1.84 fear_sampler",
    "1.85 tracks_sampler",
    "1.86 fen_sampler",
    "1.87 boss_sampler",
    "1.89 rivals_sampler",
    "1.90 raid_sampler",
    "1.91 voices_sampler",
    "1.92 storylet_sampler",
    "1.93 sneak_sampler",
    "1.94 theft_sampler",
    "1.95 rivals_sampler",
    "1.95 reactions_sampler",
    "1.96 ask_sampler",
    "1.97 identity_sampler",
    "1.98 spells_sampler",
    "1.98 speech_sampler",
    "1.100 spells_sampler",
    "1.101 replenish_sampler",
    "1.101 kitchen_sampler",
    "1.102 furnish_sampler",
    "1.102 variants_sampler",
    "1.103 settle_sampler",
    "1.103 settle_sampler",
    "1.104 toolbox_showcase",
    "1.105 trial_sampler",
    "1.105 toolbox_showcase",
    "1.106 climb_sampler",
    "1.108 mount_sampler",
    "1.109 penalty_sampler"
  ]
  test "every case but the frozen list carries a counter-edit" do
    missing =
      for c <- @fixture["cases"],
          !c["without"],
          do: c["floor"] <> " " <> Path.basename(c["source"])

    assert Enum.sort(missing) == Enum.sort(@unguarded)
    refute Enum.any?(@unguarded, &(&1 =~ ~r/craft|skills|status|build|terrain|gift/))
  end

  # Breaks: a schema names a new kernel_api floor and no fixture case exercises it.
  test "every kernel_api floor the schemas name has a fixture case" do
    floors = MapSet.new(@fixture["cases"], & &1["floor"])

    named =
      for file <- Path.wildcard("protocol/*.schema.json"),
          [_, v] <- Regex.scan(~r/kernel_api (?:at least )?(1\.\d+)/, File.read!(file)),
          into: MapSet.new(),
          do: v

    assert MapSet.difference(named, floors) == MapSet.new()
  end
end
