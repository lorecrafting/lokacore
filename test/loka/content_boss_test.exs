defmodule Loka.ContentBossTest do
  use ExUnit.Case, async: true

  # Breaks (toolbox row 39; twin of the loader test in kernel/ts/test/boss.test.ts): the 1.87 floor
  # misses resource_compare `subject` or `at_least_percent` inside a reaction `when`, or the
  # attack_result `target` filter, or refuses a 1.86 cartridge with none of them.
  test "subject, at_least_percent and target keep API 1.87" do
    dir = Loka.ContentSource.copy("cartridges/boss_sampler")
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    api = {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}
    old = {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.86")}

    leaf = fn
      "summon" -> ["when", "root", "items", Access.at(0), "item"]
      "withdraw" -> ["when", "root", "item"]
    end

    edits = fn keep ->
      for rule <- ["summon", "withdraw"] do
        {"reactions/#{rule}.json",
         fn r ->
           r
           |> update_in(leaf.(rule), fn l ->
             l = if keep == :subject, do: l, else: Map.delete(l, "subject")

             if keep == :percent,
               do: l,
               else: l |> Map.delete("at_least_percent") |> Map.put("at_least", 1)
           end)
           |> update_in(["on"], &if(keep == :target, do: &1, else: Map.delete(&1, "target")))
           |> strip_alive(rule, keep)
         end}
      end
    end

    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [old | edits.(:none)])

    for keep <- [:subject, :percent, :target] do
      assert {:error, diags} = Loka.ContentSource.compile(dir, [old | edits.(keep)])
      assert api in Enum.map(diags, &{&1["code"], &1["path"]}), inspect({keep, diags})
    end
  end

  # The summon's alive leaf (hp at least 1) also names the subject.
  defp strip_alive(r, "summon", keep) when keep != :subject,
    do: update_in(r, ["when", "root", "items", Access.at(1)], &Map.delete(&1, "subject"))

  defp strip_alive(r, _rule, _keep), do: r
end
