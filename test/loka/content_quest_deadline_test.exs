defmodule Loka.ContentQuestDeadlineTest do
  use ExUnit.Case, async: true

  @floor "cartridge.requires.kernel_api.at_least"

  # Breaks (toolbox row W24, twin of kernel/ts/test/quest_deadline.test.ts): the compiler accepts a
  # mixed legacy and generic deadline, both or neither of after and at, a legacy deadline missing a
  # field, or a generic deadline or a quest_failed reaction below kernel_api 1.46.
  test "a deadline is legacy or generic, and a generic one needs 1.46" do
    dir = Loka.ContentSource.copy("cartridges/quest_sampler")
    at = "quests/find_key.deadline"
    legacy = %{"at" => 5, "outcome" => "late", "fact" => "floor_searched"}
    legacy = Map.merge(legacy, %{"trust_fact" => "floor_searched", "trust_amount" => -1})
    put = fn d -> [{"quests/find_key.json", &Map.put(&1, "deadline", d)}] end

    lower = fn api ->
      [
        {"quests/find_key.json",
         &(&1
           |> Map.put("deadline", %{"after" => 60, "outcome" => "late"})
           |> pop_in(["journal", "hints"])
           |> elem(1))},
        {"recipes/search_floor.json", &Map.delete(&1, "tip")},
        {"reactions/late.json", nil},
        {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], api)}
      ]
    end

    assign = %{"op" => "fact.assign", "fact" => "floor_searched", "value" => true}

    late = [
      {"quests/find_key.json",
       &(&1 |> Map.delete("deadline") |> pop_in(["journal", "hints"]) |> elem(1))},
      {"recipes/search_floor.json", &Map.delete(&1, "tip")},
      {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.45")},
      {"reactions/late.json", %{"on" => %{"event" => "quest_failed"}, "apply" => [assign]}}
    ]

    cases =
      [
        {put.(%{"after" => 60, "outcome" => "late", "trust_amount" => -1}), "SCHEMA_VIOLATION",
         at},
        {put.(%{"after" => 60, "at" => 5, "outcome" => "late"}), "SCHEMA_VIOLATION", at},
        {put.(%{"outcome" => "late"}), "SCHEMA_VIOLATION", at},
        {lower.("1.45"), "KERNEL_API_RANGE_INVALID", @floor},
        {late, "KERNEL_API_RANGE_INVALID", @floor}
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
