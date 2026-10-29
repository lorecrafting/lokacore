defmodule Loka.ContentCraftTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/craft_sampler")}

  @at "actions/carve_spoon.craft"

  defp codes(dir, f) do
    assert {:error, diags} = Loka.ContentSource.compile(dir, [{"actions/carve_spoon.json", f}])
    Enum.map(diags, &{&1["code"], &1["path"]})
  end

  defp part(part, key, v), do: &put_in(&1, ["craft", part, key], v)

  # Break (Homestead hs-10; twin of the loader rows in kernel/ts/test/craft.test.ts): a craft
  # compiles with a template or non-container holder, an unresolved item, holder or reason, a
  # duplicate item, or on a spell.
  test "a craft needs resolved, placed holders, distinct items, a catalog reason, a station",
       %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])

    assert {"SCHEMA_VIOLATION", @at <> ".consume.to"} in codes(
             dir,
             part("consume", "to", %{"in" => "template"})
           )

    assert {"SCHEMA_VIOLATION", @at <> ".yield.from"} in codes(
             dir,
             part("yield", "from", %{"in" => "item", "item" => "stick_02"})
           )

    assert {"UNRESOLVED_REFERENCE", @at <> ".consume.items[0]"} in codes(
             dir,
             part("consume", "items", ["nothing"])
           )

    assert {"UNRESOLVED_REFERENCE", @at <> ".yield.from.room"} in codes(
             dir,
             part("yield", "from", %{"in" => "room", "room" => "nowhere"})
           )

    assert {"DUPLICATE_DEFINITION", @at <> ".yield.items"} in codes(
             dir,
             part("yield", "items", ["spoon_01", "spoon_01"])
           )

    assert {"UNRESOLVED_REFERENCE", @at <> ".consume.reason"} in codes(
             dir,
             part("consume", "reason", "craft.unknown")
           )

    spell = %{"kind" => "spell", "word" => "carve", "learned" => "spoon_carved"}
    assert {"SCHEMA_VIOLATION", @at} in codes(dir, &Map.put(&1, "target", spell))
  end

  # Break: a storylet target compiles again (FD3 retired by the owner, 2026-10-23).
  test "a storylet target is refused", %{dir: dir} do
    storylet = &(&1 |> Map.drop(~w(check craft)) |> Map.put("target", %{"kind" => "storylet"}))
    assert [{"SCHEMA_VIOLATION", "actions/carve_spoon.target.kind"}] = codes(dir, storylet)
  end

  # Break (hs-11; twin of the loader test in kernel/ts/test/craft.test.ts): a skill prerequisite
  # naming its own skill, or an unknown skill, compiles.
  test "a skill prerequisite resolves and never names its own skill", %{dir: dir} do
    # The leaf sits under all and not, so a walker that skips nesting misses it.
    nested = fn key ->
      leaf = %{"op" => "skill_compare", "skill" => key, "at_least" => 2}
      %{"op" => "all", "items" => [%{"op" => "not", "item" => leaf}]}
    end

    naming = fn key ->
      assert {:error, diags} =
               Loka.ContentSource.compile(dir, [
                 {"skills/carving.json", &put_in(&1, ["prerequisite", "root"], nested.(key))}
               ])

      Enum.map(diags, &{&1["code"], &1["path"]})
    end

    assert {"SCHEMA_VIOLATION", "skills/carving.prerequisite"} in naming.("carving")

    assert {"UNRESOLVED_REFERENCE", "skills/carving.prerequisite.root.items[0].item.skill"} in naming.(
             "nothing"
           )
  end

  # Homestead hs-11. Break: an ancestry grants at birth a skill whose
  # prerequisite was never met (woodfolk's woodcutting takes one here).
  test "an ancestry never grants a skill with a prerequisite", %{dir: dir} do
    prerequisite = %{"policy_version" => 1, "root" => %{"op" => "all", "items" => []}}

    assert {:error, diags} =
             Loka.ContentSource.compile(dir, [
               {"skills/woodcutting.json", &Map.put(&1, "prerequisite", prerequisite)}
             ])

    assert Enum.map(diags, &{&1["code"], &1["path"]}) == [
             {"SCHEMA_VIOLATION", "cartridge.ancestries.woodfolk.skill"}
           ]
  end

  # Break (hs-14): a shown skill whose
  # prerequisite reads a hidden skill compiles, a hidden skill reading a hidden one is refused,
  # or an unknown profession text compiles.
  test "nothing shown reads or names a hidden skill; a profession resolves", %{dir: dir} do
    edit = fn edits ->
      case Loka.ContentSource.compile(dir, edits) do
        {:error, diags} -> Enum.map(diags, &{&1["code"], &1["path"]})
        {:ok, _, _} -> :ok
      end
    end

    hide = &{"skills/#{&1}.json", fn s -> Map.put(s, "hidden", true) end}

    assert edit.([hide.("carving")]) == [{"SCHEMA_VIOLATION", "skills/joinery.prerequisite"}]
    assert edit.([hide.("carving"), hide.("joinery")]) == :ok

    assert edit.([{"skills/whittling.json", &Map.put(&1, "profession", "profession.nothing")}]) ==
             [{"UNRESOLVED_REFERENCE", "skills/whittling.profession"}]

    # hs-14 secret: a shown skill's
    # qualification, any dialogue policy, or a talk label or riddle on a dialogue teaching a hidden skill.
    reads = %{
      "policy_version" => 1,
      "root" => %{"op" => "skill_compare", "skill" => "carving", "at_least" => 1}
    }

    read = &{"#{&1}.json", fn x -> Map.put(x, &2, reads) end}
    hidden = [hide.("carving"), hide.("joinery")]

    assert edit.([read.("skills/whittling", "qualification") | hidden]) ==
             [{"SCHEMA_VIOLATION", "skills/whittling.qualification"}]

    assert edit.([read.("dialogues/old_carver_carpentry", "policy") | hidden]) ==
             [{"SCHEMA_VIOLATION", "dialogues/old_carver_carpentry.policy"}]

    assert edit.([read.("skills/joinery", "qualification") | hidden]) == :ok

    label =
      {"dialogues/old_carver_carving.json", &Map.put(&1, "label", "old_carver.carving.prompt")}

    assert edit.([label | hidden]) == [{"SCHEMA_VIOLATION", "dialogues/old_carver_carving.label"}]
    assert edit.([label]) == :ok

    riddle =
      {"dialogues/old_carver_carving.json",
       &Map.put(&1, "riddle", %{
         "choice_id" => "learn",
         "answer" => "a",
         "bank" => ["A"],
         "wrong" => "old_carver.carving.prompt"
       })}

    assert edit.([riddle | hidden]) ==
             [{"SCHEMA_VIOLATION", "dialogues/old_carver_carving.riddle"}]

    assert edit.([riddle]) == :ok
  end

  # Break (Built rooms S6; twin of the loader test in kernel/ts/test/craft.test.ts): a build step
  # compiles off a detail target, on a room that is no site, twice in one sequence, without
  # world.construction or the refusal texts, or naming a blueprint or direction the site does not
  # list.
  test "a build step needs a site detail, its listed blueprint and direction, once, on success",
       %{dir: dir} do
    seq = "actions/raise_timbered_hut.outcomes.success.sequence"
    raise = "actions/raise_timbered_hut.json"

    builds = fn edits ->
      assert {:error, diags} = Loka.ContentSource.compile(dir, edits)
      Enum.map(diags, &{&1["code"], &1["path"]})
    end

    step = &put_in(&1, ["outcomes", "success", "sequence", Access.at(0), &2], &3)

    use =
      &(&1
        |> Map.drop(["check"])
        |> Map.put("target", %{"kind" => "use", "tool" => %{"tag" => "metal"}}))

    use = &(use.(&1) |> update_in(["outcomes"], fn o -> Map.delete(o, "failure") end))
    oak = %{"kind" => "detail", "room" => "glade", "detail" => "oak"}
    twice = &update_in(&1, ["outcomes", "success", "sequence"], fn [b] -> [b, b] end)

    cases = [
      {[{raise, use}], "SCHEMA_VIOLATION", "[0].op"},
      {[{raise, &Map.put(&1, "target", oak)}], "SCHEMA_VIOLATION", "[0].op"},
      {[{raise, twice}], "SCHEMA_VIOLATION", "[1].op"},
      {[{"cartridge.json", &update_in(&1, ["world"], fn w -> Map.delete(w, "construction") end)}],
       "SCHEMA_VIOLATION", "[0].op"},
      {[{"text.json", &Map.delete(&1, "service.site_taken")}], "UNRESOLVED_REFERENCE", "[0].op"},
      {[{"text.json", &Map.delete(&1, "service.construction_full")}], "UNRESOLVED_REFERENCE",
       "[0].op"},
      {[{"rooms/lane.json", &put_in(&1, ["site", "blueprints"], ["hut_plain"])}],
       "SCHEMA_VIOLATION", "[0].blueprint"},
      {[{raise, &step.(&1, "direction", "east")}], "SCHEMA_VIOLATION", "[0].direction"}
    ]

    for {edits, code, path} <- cases, do: assert({code, seq <> path} in builds.(edits))

    failed =
      &put_in(&1, ["outcomes", "failure", "sequence"], &1["outcomes"]["success"]["sequence"])

    at = "actions/raise_timbered_hut.outcomes.failure.sequence[0].op"
    assert {"SCHEMA_VIOLATION", at} in builds.([{raise, failed}])
  end
end
