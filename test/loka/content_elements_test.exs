defmodule Loka.ContentElementsTest do
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/elements_sampler")}

  defp diags(dir, edits) do
    assert {:error, ds} = Loka.ContentSource.compile(dir, edits)
    Enum.map(ds, &{&1["code"], &1["path"]})
  end

  # The sampler at API 1.52 without its two reader rules; `edit` changes reaction spark.
  defp at152(edit),
    do: [
      {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], "1.52")},
      {"reactions/shock_on_wet.json", nil},
      {"reactions/warmth_dries.json", nil},
      {"reactions/spark.json", edit}
    ]

  @api {"KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least"}

  # Breaks (status readers 1 to 3, row G3; twin of the loader row in
  # kernel/ts/test/elements.test.ts): a status_applied trigger, a reaction status.cure or a
  # status_active leaf reading self or subject (each alone) compiles under API 1.52, or a reaction
  # cure of an undeclared status compiles.
  test "status readers need API 1.53; a reaction cure names a declared status", %{dir: dir} do
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, [])
    assert {:ok, _, _} = Loka.ContentSource.compile(dir, at152(& &1))

    leaf =
      &%{
        "policy_version" => 1,
        "root" => %{"op" => "status_active", "subject" => &1, "status" => "wet"}
      }

    cure = %{"op" => "status.cure", "status" => "wet"}

    for edit <- [
          &put_in(&1, ["on"], %{"event" => "status_applied"}),
          &update_in(&1, ["apply"], fn a -> a ++ [cure] end),
          &Map.put(&1, "when", leaf.("self")),
          &Map.put(&1, "when", leaf.("subject"))
        ],
        do: assert(@api in diags(dir, at152(edit)))

    assert {:ok, _, _} =
             Loka.ContentSource.compile(dir, at152(&Map.put(&1, "when", leaf.("target"))))

    ash = &update_in(&1, ["apply"], fn a -> a ++ [%{cure | "status" => "ash"}] end)

    assert {"UNRESOLVED_REFERENCE", "reactions/spark.apply[1].status"} in diags(dir, [
             {"reactions/spark.json", ash}
           ])
  end
end
