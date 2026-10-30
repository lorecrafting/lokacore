defmodule Loka.ContentTrainingTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/toolbox_showcase")}

  # The showcase blade skill gated on str, and combat dodging with the blade skill.
  defp trained do
    [
      {"skills/blade.json",
       &put_in(&1, ["qualification"], %{
         "op" => "stat_compare",
         "attribute" => "str",
         "at_least" => 10
       })},
      {"cartridge.json",
       fn c ->
         c
         |> put_in(["world", "combat", "dodge"], %{"skill" => "blade", "chance" => 50})
         |> put_in(["world", "combat", "narration", "dodge"], "combat.npc_miss")
       end}
    ]
  end

  # Breaks: new short references remain short, so the compiler emits an unloadable training consumer.
  test "skills, lessons and equipment expand their real source references", %{dir: dir} do
    {:ok, bytes, _} = Loka.ContentSource.compile(dir, trained())
    c = JSON.decode!(bytes)["cartridge"]
    prefix = "toolbox_showcase@#{c["manifest"]["version"]}"

    ref = fn kind, key ->
      %{
        "cartridge_id" => "toolbox_showcase",
        "cartridge_version" => c["manifest"]["version"],
        "kind" => kind,
        "key" => key
      }
    end

    assert c["skills"][prefix <> ":skill/blade"]["qualification"]["attribute"] ==
             ref.("attribute", "str")

    assert c["items"][prefix <> ":item/training_sword"]["weapon"]["skill"] ==
             ref.("skill", "blade")

    choice = c["dialogues"][prefix <> ":dialogue/carpenter_lessons"]["choices"]["carving"]
    assert choice["steps"] == [%{"op" => "skill.acquire", "skill" => ref.("skill", "carving")}]
    assert choice["lesson_payment"]["resource"] == ref.("resource", "pennies")
    assert c["world"]["combat"]["dodge"]["skill"] == ref.("skill", "blade")
  end

  # Breaks: content can counterfeit acquisition, author teaching with no funds or a doubled
  # lesson, dodge without its narration, or a weapon or qualification the kernel cannot bind.
  test "training rejects counterfeit writes, missing qualification/funding and wrong slots", %{
    dir: dir
  } do
    carving =
      &{"dialogues/carpenter_lessons.json",
       fn d -> update_in(d, ["choices", "carving", "steps"], &1) end}

    # The scene's on_end claims a letter_fate outcome so its write is otherwise valid.
    on_end = fn fact ->
      [
        {"scenes/letter_read.json",
         &Map.put(&1, "on_end", %{
           "story_point" => "letter_fate",
           "outcome" => "read",
           "assign" => [%{"fact" => fact, "value" => true}]
         })}
      ]
    end

    # Baseline: the same scene write of an ordinary fact compiles.
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, on_end.("stair_found"))

    assert {:error,
            [%{"code" => "RESERVED_FACT", "path" => "scenes/letter_read.on_end.assign[0].fact"}]} =
             Loka.ContentSource.compile(dir, on_end.("skill_blade"))

    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])

    for {edits, expected} <- [
          {[
             carving.(fn _ ->
               [%{"op" => "fact.assign", "fact" => "skill_carving", "value" => true}]
             end)
           ], {"RESERVED_FACT", "dialogues/carpenter_lessons.choices.carving.steps[0].fact"}},
          {[carving.(&(&1 ++ &1))],
           {"SCHEMA_VIOLATION", "dialogues/carpenter_lessons.choices.carving.lesson_payment"}},
          {[{"npcs/carpenter.json", &Map.delete(&1, "resource_starts")}],
           {"SCHEMA_VIOLATION", "dialogues/carpenter_lessons.choices.carving.lesson_payment"}},
          {[
             {"cartridge.json",
              fn c ->
                c
                |> put_in(["world", "combat", "dodge"], %{"skill" => "blade", "chance" => 50})
              end}
           ], {"SCHEMA_VIOLATION", "cartridge.world.combat.narration.dodge"}},
          {[{"items/training_sword.json", &Map.put(&1, "slot", "off_hand")}],
           {"SCHEMA_VIOLATION", "items/training_sword.weapon"}},
          {[{"items/training_sword.json", &put_in(&1, ["weapon", "attack", "damage_min"], 4)}],
           {"SCHEMA_VIOLATION", "items/training_sword.weapon"}},
          {[{"items/training_sword.json", &put_in(&1, ["weapon", "skill"], "missing")}],
           {"UNRESOLVED_REFERENCE", "items/training_sword.weapon.skill"}},
          # A block chance belongs on an off-hand item, and a shield needs its block narration.
          {[{"items/training_sword.json", &Map.put(&1, "block_chance", 10)}],
           {"SCHEMA_VIOLATION", "items/training_sword.block_chance"}},
          {[{"items/training_sword.json", &Map.put(&1, "block_chance", 10)}],
           {"SCHEMA_VIOLATION", "cartridge.world.combat.narration.block"}},
          {[
             {"skills/blade.json",
              &put_in(&1, ["qualification"], %{
                "op" => "stat_compare",
                "attribute" => "missing",
                "at_least" => 10
              })}
           ], {"UNRESOLVED_REFERENCE", "skills/blade.qualification.attribute"}}
        ] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, edits)
      assert expected in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end
  end
end
