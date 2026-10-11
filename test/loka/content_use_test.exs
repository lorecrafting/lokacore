defmodule Loka.ContentUseTest do
  use ExUnit.Case, async: true

  @dir "cartridges/use_sampler"
  defp pairs(diags), do: Enum.map(diags, &{&1["code"], &1["path"]})

  # Breaks (toolbox row G4): the compiler accepts a use recipe or a status.cure step below
  # kernel_api 1.49, an opposed check on a use recipe (no detail, so no rating), or leaves a use
  # tool's short liquid reference unexpanded.
  test "use recipes need 1.49, no rating-opposed check, and expand the tool's liquid" do
    dir = Loka.ContentSource.copy(@dir)
    assert {:ok, artifact, []} = Loka.ContentSource.compile(dir, [])

    assert get_in(JSON.decode!(artifact), [
             "cartridge",
             "recipes",
             "use_sampler@0.0.1:recipe/oil",
             "target",
             "tool",
             "liquid"
           ]) == %{
             "cartridge_id" => "use_sampler",
             "cartridge_version" => "0.0.1",
             "kind" => "liquid",
             "key" => "oil"
           }

    api = {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.48")}
    floor = {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}
    assert {:error, diags} = Loka.ContentSource.compile(dir, [api])
    assert floor in pairs(diags), inspect(diags)

    # Only the cure step is left needing 1.49: the oil recipe is dropped, quench targets a detail.
    detail = %{"kind" => "detail", "room" => "yard", "detail" => "pump"}

    cure_only = [
      {"cartridge.json",
       fn c ->
         c
         |> put_in(["requires", "kernel_api", "at_least"], "1.48")
         |> put_in(["requires", "capabilities", "inspectable_detail"], 1)
       end},
      {"recipes/oil.json", nil},
      {"recipes/quench.json", &Map.put(&1, "target", detail)},
      {"rooms/yard.json",
       &Map.put(&1, "details", %{
         "pump" => %{"aliases" => ["pump"], "description" => "room.yard.title"}
       })}
    ]

    assert {:error, diags} = Loka.ContentSource.compile(dir, cure_only)
    assert pairs(diags) == [floor]

    opposed = %{"key" => "q", "kind" => "opposed", "attribute" => "str"}

    checked = [
      {"cartridge.json",
       &update_in(&1, ["requires", "capabilities"], fn c ->
         Map.merge(c, %{"attributes" => 1, "check" => 1})
       end)},
      {"attributes.json", %{"attributes" => %{"str" => %{"start" => 8}}}},
      {"recipes/quench.json",
       &(&1
         |> Map.put("check", opposed)
         |> put_in(["outcomes", "failure"], &1["outcomes"]["success"]))}
    ]

    assert {:error, diags} = Loka.ContentSource.compile(dir, checked)

    assert {"SCHEMA_VIOLATION", "recipes/quench.check"} in pairs(diags), inspect(diags)
  end
end
