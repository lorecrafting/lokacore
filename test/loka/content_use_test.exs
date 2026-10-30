defmodule Loka.ContentUseTest do
  use ExUnit.Case, async: true

  @dir "cartridges/use_sampler"
  defp pairs(diags), do: Enum.map(diags, &{&1["code"], &1["path"]})

  # Breaks (toolbox row G4): the compiler accepts a status.cure on a detail scripted action,
  # an opposed check on a use scripted action (no detail, so no rating), a use tool's
  # liquid naming no liquid of the cartridge, or leaves its short liquid reference unexpanded.
  test "use scripted actions: cures only on them, no rating-opposed check, liquid expands" do
    dir = Loka.ContentSource.copy(@dir)
    assert {:ok, artifact, []} = Loka.ContentSource.compile(dir, [])

    assert get_in(JSON.decode!(artifact), [
             "cartridge",
             "scripted_actions",
             "use_sampler@0.0.1:action/oil",
             "target",
             "tool",
             "liquid"
           ]) == %{
             "cartridge_id" => "use_sampler",
             "cartridge_version" => "0.0.1",
             "kind" => "liquid",
             "key" => "oil"
           }

    # A status.cure on a detail scripted action cures nothing (a detail holds no status): refused.
    detail = %{"kind" => "detail", "room" => "yard", "detail" => "pump"}

    on_detail = [
      {"cartridge.json", &put_in(&1, ["requires", "capabilities", "inspectable_detail"], 1)},
      {"actions/quench.json", &Map.put(&1, "target", detail)},
      {"rooms/yard.json",
       &Map.put(&1, "details", %{
         "pump" => %{"aliases" => ["pump"], "description" => "room.yard.title"}
       })}
    ]

    assert {:error, diags} = Loka.ContentSource.compile(dir, on_detail)

    assert pairs(diags) == [
             {"SCHEMA_VIOLATION", "actions/quench.outcomes.success.steps[0].op"}
           ]

    opposed = %{"key" => "q", "kind" => "opposed", "attribute" => "str"}

    checked = [
      {"cartridge.json",
       &update_in(&1, ["requires", "capabilities"], fn c ->
         Map.merge(c, %{"attributes" => 1, "check" => 1})
       end)},
      {"attributes.json", %{"attributes" => %{"str" => %{"start" => 8}}}},
      {"actions/quench.json",
       &(&1
         |> Map.put("check", opposed)
         |> put_in(["outcomes", "failure"], &1["outcomes"]["success"]))}
    ]

    assert {:error, diags} = Loka.ContentSource.compile(dir, checked)

    assert {"SCHEMA_VIOLATION", "actions/quench.check"} in pairs(diags), inspect(diags)

    milk = [{"actions/quench.json", &put_in(&1, ["target", "tool", "liquid"], "milk")}]
    assert {:error, diags} = Loka.ContentSource.compile(dir, milk)
    assert pairs(diags) == [{"UNRESOLVED_REFERENCE", "actions/quench.target.tool.liquid"}]
  end
end
