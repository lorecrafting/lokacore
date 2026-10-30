defmodule Loka.ContentChoiceChecksTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/persuade_sampler")}

  # Breaks: a row 14 rule is dropped from the compiler, so an unsound choice check compiles.
  test "row 14 dialogue choice checks keep their boundaries", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    guard = "dialogues/guard.json"
    at = "dialogues/guard.choices."
    persuade = fn f -> &update_in(&1, ["choices", "persuade"], f) end
    check = fn f -> persuade.(&Map.update!(&1, "check", f)) end
    caps = ["requires", "capabilities"]

    cases = [
      {guard, check.(&Map.delete(&1, "npc")), {"SCHEMA_VIOLATION", at <> "persuade.check"}},
      {guard, check.(&Map.put(&1, "rating", 3)), {"SCHEMA_VIOLATION", at <> "persuade.check"}},
      {"npcs/guard.json", &Map.delete(&1, "attributes"),
       {"SCHEMA_VIOLATION", at <> "persuade.check.npc"}},
      {guard, check.(&Map.put(&1, "attribute", "wit")),
       {"UNRESOLVED_REFERENCE", at <> "persuade.check.attribute"}},
      {guard, check.(&Map.put(&1, "failure", "missing")),
       {"UNRESOLVED_REFERENCE", at <> "persuade.check.failure"}},
      {guard, check.(&Map.put(&1, "key", "intimidate_guard")),
       {"DUPLICATE_DEFINITION", at <> "intimidate.check"}},
      {guard, persuade.(&Map.put(&1, "exchange", true)),
       {"OUTCOME_MISMATCH", at <> "persuade.check"}},
      {guard,
       &Map.put(&1, "riddle", %{
         "choice_id" => "persuade",
         "answer" => "x",
         "bank" => ["X"],
         "wrong" => "narration.guard.persuade_failed"
       }), {"OUTCOME_MISMATCH", at <> "intimidate.check"}},
      {guard,
       persuade.(
         &Map.update!(&1, "steps", fn s ->
           s ++ [%{"op" => "skill.acquire", "skill" => "intimidate"}]
         end)
       ), {"OUTCOME_MISMATCH", at <> "persuade.check"}},
      {"cartridge.json", &update_in(&1, caps, fn c -> Map.delete(c, "check") end),
       {"UNDECLARED_CAPABILITY", at <> "intimidate.check"}}
    ]

    for {file, change, {code, path}} <- cases do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [{file, change}])
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]}), inspect({path, diags})
    end
  end

  # Breaks: the choice is checked in another step context or none, or CheckKinds.context(:choice) is dropped,
  # so a field, op or check the dialogue choice never runs compiles (the old DialogueChoice schema refused each).
  test "a dialogue choice refuses steps and checks outside the choice context", %{dir: dir} do
    guard = "dialogues/guard.json"
    at = "dialogues/guard.choices.persuade."
    persuade = fn f -> &update_in(&1, ["choices", "persuade"], f) end
    step = fn s -> persuade.(&Map.put(&1, "steps", [s])) end
    assign = %{"op" => "fact.assign", "fact" => "gate_open", "value" => true}
    check = fn f -> persuade.(&Map.update!(&1, "check", f)) end

    cases = [
      {step.(Map.put(assign, "npc", "guard")), at <> "steps[0].npc"},
      {step.(Map.put(assign, "item", "x")), at <> "steps[0].item"},
      {step.(%{"op" => "fact.adjust", "fact" => "gate_open", "amount" => 1, "npc" => "guard"}),
       at <> "steps[0].npc"},
      {step.(%{"op" => "fact.stamp", "fact" => "gate_open"}), at <> "steps[0].op"},
      {check.(fn _ -> %{"key" => "persuade_guard", "kind" => "luck", "chance" => 50} end),
       at <> "check.kind"}
    ]

    for {change, path} <- cases do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [{guard, change}])

      assert {"SCHEMA_VIOLATION", path} in Enum.map(diags, &{&1["code"], &1["path"]}),
             inspect({path, diags})
    end

    # Breaks: failure_text reads a missing failure as a text reference, adding a second diagnostic.
    assert {:error, diags} =
             Loka.ContentSource.compile(dir, [{guard, check.(&Map.delete(&1, "failure"))}])

    assert Enum.map(diags, &{&1["code"], &1["path"]}) == [
             {"SCHEMA_VIOLATION", at <> "check.failure"}
           ]
  end

  # Breaks: the duplicate-key scan drops scripted actions or choices, so a scripted action and a dialogue choice
  # (one check DefinitionRef) both define one key and compile.
  test "check keys gather every scripted action check and every dialogue choice check" do
    defs = %{
      "scripted_action" => %{"a" => {"actions/a.json", [], %{"check" => %{"key" => "k"}}}},
      "dialogue" => %{
        "d" => {"dialogues/d.json", [], %{"choices" => %{"x" => %{"check" => %{"key" => "k"}}}}}
      }
    }

    assert Loka.Content.CheckKinds.shared_checks(defs) == MapSet.new(["k"])
  end
end
