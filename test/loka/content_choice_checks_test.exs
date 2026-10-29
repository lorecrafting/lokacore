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
         &Map.update!(&1, "sequence", fn s ->
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

  # Breaks: the duplicate-key scan drops scripted actions or choices, so a scripted action and a dialogue choice
  # (one check DefinitionRef) both define one key and compile.
  test "check keys gather every scripted action check and every dialogue choice check" do
    defs = %{
      "scripted_action" => %{"a" => {"actions/a.json", [], %{"check" => %{"key" => "k"}}}},
      "dialogue" => %{
        "d" => {"dialogues/d.json", [], %{"choices" => %{"x" => %{"check" => %{"key" => "k"}}}}}
      }
    }

    assert Loka.Content.ScriptedActions.shared_checks(defs) == MapSet.new(["k"])
  end
end
