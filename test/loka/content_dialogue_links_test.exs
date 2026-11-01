defmodule Loka.ContentDialogueLinksTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/persuade_sampler")}

  @guard "dialogues/guard.json"
  @at "dialogues/guard.choices.persuade."
  @label "dialogue.guard.persuade"
  @said "narration.guard.persuade"

  defp persuade(f), do: &update_in(&1, ["choices", "persuade"], f)
  defp field(k, v), do: persuade(&Map.put(&1, k, v))

  defp talk(npc, extra \\ %{}) do
    Map.merge(
      %{
        "npc" => npc,
        "prompt" => "dialogue.guard.prompt",
        "roles" => %{npc => %{"role" => "npc", "npc" => npc}},
        "choices" => %{"x" => %{"label" => @label, "narration" => @said}}
      },
      extra
    )
  end

  defp codes(diags), do: Enum.map(diags, &{&1["code"], &1["path"]})

  defp refused(dir, changes, want) do
    assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
    assert want in codes(diags), inspect({want, diags})
  end

  # Breaks: a link rule dropped, so a then the runtime cannot follow compiles and fails at play.
  test "then and then_failed refuse what cannot be followed", %{dir: dir} do
    child = {"dialogues/child.json", talk("guard")}
    worded = {"dialogues/child.json", talk("guard", %{"keyword" => "gate"})}
    clash = {"dialogues/end.json", talk("guard")}
    quest = &Map.put(&1, "quest", "any")

    refused(dir, [{@guard, field("then", "nobody")}], {"UNRESOLVED_REFERENCE", @at <> "then"})
    refused(dir, [worded, {@guard, field("then", "child")}], {"OUTCOME_MISMATCH", @at <> "then"})
    refused(dir, [clash, {@guard, field("then", "end")}], {"OUTCOME_MISMATCH", @at <> "then"})

    refused(
      dir,
      [{@guard, field("then_failed", "nobody")}],
      {"UNRESOLVED_REFERENCE", @at <> "then_failed"}
    )

    refused(
      dir,
      [
        child,
        {@guard, persuade(&(&1 |> Map.delete("check") |> Map.put("then_failed", "child")))}
      ],
      {"OUTCOME_MISMATCH", @at <> "then_failed"}
    )

    # A row opened by an answer has no quest instance and no riddle talk evidence on reload.
    for extra <- [
          %{"quest" => "any"},
          %{
            "riddle" => %{
              "choice_id" => "x",
              "answer" => "x",
              "bank" => ["X"],
              "wrong" => "narration.guard.persuade_failed"
            }
          }
        ] do
      target = {"dialogues/child.json", talk("guard", extra)}

      assert {:error, diags} =
               Loka.ContentSource.compile(dir, [target, {@guard, field("then", "child")}])

      assert {"OUTCOME_MISMATCH", @at <> "then"} in codes(diags), inspect(extra)
    end

    refused(
      dir,
      [child, {@guard, &(&1 |> field("then", "child").() |> quest.())}],
      {"OUTCOME_MISMATCH", @at <> "then"}
    )
  end

  # Breaks: a link that is allowed refused, the old same-speaker refusal back among them.
  test "then: end and a pass and fail branch compile", %{dir: dir} do
    assert {:ok, _, []} = Loka.ContentSource.compile(dir, [{@guard, field("then", "end")}])

    assert {:ok, _, []} =
             Loka.ContentSource.compile(dir, [
               {"dialogues/child.json", talk("guard")},
               {@guard, persuade(&Map.merge(&1, %{"then" => "child", "then_failed" => "child"}))}
             ])
  end

  # Breaks: the warning fails the build, fires for a speaker in the same room, or a hand-off
  # to another speaker is refused outright as before.
  test "a hand-off to a speaker in another room warns and compiles", %{dir: dir} do
    npc = fn room ->
      {"npcs/captain.json",
       %{
         "keywords" => ["captain"],
         "name" => "npc.guard.short",
         "room_line" => "npc.guard.room",
         "description" => "npc.guard.description",
         "room" => room
       }}
    end

    far =
      {"rooms/far.json",
       %{
         "name" => "room.gate_room.title",
         "description" => "room.gate_room.description",
         "exits" => %{}
       }}

    then = [
      {"dialogues/captain.json", talk("captain")},
      {@guard, field("then", "captain")}
    ]

    warning = {"warning", "SPEAKER_ELSEWHERE", @at <> "then"}
    seen = &Enum.map(&1, fn d -> {d["severity"], d["code"], d["path"]} end)

    assert {:ok, _, warnings} = Loka.ContentSource.compile(dir, [far, npc.("far") | then])
    assert warning in seen.(warnings), inspect(warnings)
    assert {:ok, _, warnings} = Loka.ContentSource.compile(dir, [npc.("gate_room") | then])
    refute warning in seen.(warnings), inspect(warnings)
  end

  # Breaks: a choice's condition, reply words or narrate step left out of the reference walk, so a
  # bad reference compiles and fails only when played.
  test "a choice's policy, variants and narrate step are checked", %{dir: dir} do
    variant = fn w, d -> [%{"when" => w, "description" => d}] end
    held = %{"op" => "fact_compare", "fact" => "gate_open", "equals" => true}
    unlocked = %{"op" => "quest_state", "quest" => "any", "state" => "active"}

    refused(
      dir,
      [{@guard, field("policy", %{held | "fact" => "nothing"})}],
      {"UNRESOLVED_REFERENCE", @at <> "policy.fact"}
    )

    refused(
      dir,
      [{@guard, field("policy", unlocked)}],
      {"UNDECLARED_CAPABILITY", @at <> "policy.op"}
    )

    refused(
      dir,
      [{@guard, field("narration_variants", variant.(held, "missing"))}],
      {"UNRESOLVED_REFERENCE", @at <> "narration_variants[0].description"}
    )

    refused(
      dir,
      [{@guard, field("narration_variants", variant.(%{held | "fact" => "nothing"}, @said))}],
      {"UNRESOLVED_REFERENCE", @at <> "narration_variants[0].when.fact"}
    )

    refused(
      dir,
      [{@guard, field("steps", [%{"op" => "narrate", "text" => "missing"}])}],
      {"UNRESOLVED_REFERENCE", @at <> "steps[0].text"}
    )
  end

  # Breaks: at_least accepted on a non-int fact, which never holds at play.
  test "at_least needs an int fact", %{dir: dir} do
    policy = %{"op" => "fact_at_least", "fact" => "gate_open", "at_least" => 1}

    refused(
      dir,
      [{@guard, field("policy", policy)}],
      {"FACT_TYPE_MISMATCH", @at <> "policy.at_least"}
    )
  end
end
