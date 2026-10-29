defmodule Loka.ContentQuestDeadlineTest do
  use ExUnit.Case, async: true

  # Breaks (toolbox row W24, twin of kernel/ts/test/quest_deadline.test.ts): the compiler accepts a
  # mixed legacy and generic deadline, both or neither of after and at, a legacy deadline missing a
  # field.
  test "a deadline is legacy or generic" do
    dir = Loka.ContentSource.copy("cartridges/quest_sampler")
    at = "quests/find_key.deadline"
    legacy = %{"at" => 5, "outcome" => "late", "fact" => "floor_searched"}
    legacy = Map.merge(legacy, %{"trust_fact" => "floor_searched", "trust_amount" => -1})
    put = fn d -> [{"quests/find_key.json", &Map.put(&1, "deadline", d)}] end

    cases =
      [
        {put.(%{"after" => 60, "outcome" => "late", "trust_amount" => -1}), "SCHEMA_VIOLATION",
         at},
        {put.(%{"after" => 60, "at" => 5, "outcome" => "late"}), "SCHEMA_VIOLATION", at},
        {put.(%{"outcome" => "late"}), "SCHEMA_VIOLATION", at}
      ] ++
        for field <- ~w(at fact trust_fact trust_amount),
            do: {put.(Map.delete(legacy, field)), "SCHEMA_VIOLATION", at}

    for {changes, code, path} <- cases do
      assert {:error, diags} = Loka.ContentSource.compile(dir, changes)
      assert {code, path} in Enum.map(diags, &{&1["code"], &1["path"]}), inspect(diags)
    end

    assert {:ok, _, _} =
             Loka.ContentSource.compile(dir, put.(%{"after" => 60, "outcome" => "late"}))

    assert {:ok, _, _} = Loka.ContentSource.compile(dir, put.(legacy))
  end
end
