defmodule Loka.ContentReplenishTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/replenish_sampler")}

  defp codes(dir, edits) do
    assert {:error, diags} = Loka.ContentSource.compile(dir, edits)
    Enum.map(diags, &{&1["code"], &1["path"]})
  end

  defp seam(f), do: [{"replenish/seam_regrowth.json", f}]

  # Break (toolbox row 19b): replenish
  # compiles with a template, spawn-template, template-item or self-move holder, a
  # non-container item target or one beside a listed container (which may be or hold it), an
  # unresolved item or holder or a duplicate item; or the harvest allowance is dropped, so the
  # seam's ore in the store is refused.
  test "replenish needs resolved, distinct holders and items", %{dir: dir} do
    at = "replenish/seam_regrowth"
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])

    assert {"SCHEMA_VIOLATION", at <> ".from"} in codes(
             dir,
             seam(&Map.put(&1, "from", %{"in" => "template"}))
           )

    assert {"SCHEMA_VIOLATION", at <> ".from"} in codes(dir, seam(&Map.put(&1, "from", &1["to"])))

    assert {"SCHEMA_VIOLATION", "replenish/shelf.to"} in codes(dir, [
             {"npcs/trader.json", &Map.put(&1, "spawn_template", true)}
           ])

    assert {"SCHEMA_VIOLATION", "replenish/shelf.from"} in codes(dir, [
             {"items/crate.json", &Map.put(&1, "location", %{"in" => "template"})}
           ])

    item_to = &Map.put(&1, "to", %{"in" => "item", "item" => &2})
    assert {"SCHEMA_VIOLATION", at <> ".to"} in codes(dir, seam(&item_to.(&1, "stone")))

    assert {"SCHEMA_VIOLATION", at <> ".to"} in codes(
             dir,
             seam(
               &item_to.(put_in(&1, ["items"], List.replace_at(&1["items"], 4, "crate")), "crate")
             )
           )

    # A listed container leaves an item reserve alone (only a target can nest), but not a target
    # it holds: the move would put it inside itself.
    assert {:ok, _, _} =
             Loka.ContentSource.compile(dir, [
               {"items/apple_01.json", &Map.put(&1, "container", true)}
             ])

    assert {"SCHEMA_VIOLATION", "replenish/shelf.to"} in codes(dir, [
             {"items/apple_01.json", &Map.put(&1, "container", true)},
             {"replenish/shelf.json",
              &Map.merge(&1, %{
                "items" => ["crate"],
                "from" => %{"in" => "room", "room" => "store"},
                "to" => %{"in" => "item", "item" => "apple_01"}
              })}
           ])

    assert {"UNRESOLVED_REFERENCE", at <> ".to.npc"} in codes(
             dir,
             seam(&Map.put(&1, "to", %{"in" => "npc", "npc" => "nobody"}))
           )

    assert {"UNRESOLVED_REFERENCE", at <> ".items[4]"} in codes(
             dir,
             seam(&put_in(&1, ["items"], List.replace_at(&1["items"], 4, "nothing")))
           )

    assert {"DUPLICATE_DEFINITION", at <> ".items"} in codes(
             dir,
             seam(&put_in(&1, ["items"], List.replace_at(&1["items"], 4, "ore_01")))
           )

    assert {"OUTCOME_MISMATCH", "rooms/mine.details.seam.harvest.items"} in codes(
             dir,
             seam(&Map.put(&1, "to", %{"in" => "npc", "npc" => "trader"}))
           )
  end

  # Homestead hs-1: the sampler with a `dig` scripted action whose custom_event `dig` runs `step`.
  defp digging(step, at_least \\ "1.101", rule \\ %{}) do
    # The step emits no event: it needs no fact@1 (which owns fact_changed).
    caps = &(&1 |> Map.delete("fact") |> Map.merge(%{"scripted_action" => 1, "reaction" => 1}))

    [
      {"cartridge.json",
       &(&1
         |> put_in(["requires", "kernel_api", "at_least"], at_least)
         |> update_in(["requires", "capabilities"], caps))},
      {"actions/dig.json",
       %{
         "name" => "action.mine",
         "aliases" => ["dig"],
         "target" => %{"kind" => "detail", "room" => "mine", "detail" => "seam"},
         "priority" => 10,
         "policy" => %{"op" => "all", "items" => []},
         "outcomes" => %{
           "success" => %{
             "sequence" => [%{"op" => "event.emit", "event" => "dig"}],
             "narration" => %{"actor" => "narration.mine"}
           }
         }
       }},
      {"reactions/dig.json",
       Map.merge(
         %{"on" => %{"event" => "custom_event", "custom" => "dig"}, "steps" => [step]},
         rule
       )}
    ]
  end

  # Break: replenish.run compiles
  # with an unresolved key, on a rule with `after` (refused as item.move is), or
  # twice with one key in a rule.
  test "replenish.run needs a replenish entry and no after", %{dir: dir} do
    run = %{"op" => "replenish.run", "replenish" => "seam_regrowth"}
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, digging(run))

    assert {"UNRESOLVED_REFERENCE", "reactions/dig.steps[0].replenish"} in codes(
             dir,
             digging(%{run | "replenish" => "gone"})
           )

    assert {"SCHEMA_VIOLATION", "reactions/dig.steps[0].op"} in codes(
             dir,
             digging(run, "1.101", %{"after" => 60})
           )

    assert {"DUPLICATE_DEFINITION", "reactions/dig.steps[1].replenish"} in codes(
             dir,
             digging(run, "1.101", %{"steps" => [run, run]})
           )
  end
end
