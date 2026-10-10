defmodule Loka.ContentReactionsSamplerTest do
  # Toolbox row W1 in the compiler: trigger filters on every registered event kind expand from
  # short keys and name definitions of this cartridge (twin: kernel/ts/test/reactions.test.ts).
  use ExUnit.Case, async: true
  setup_all do: %{dir: Loka.ContentSource.copy("cartridges/reactions_sampler")}

  defp on(f), do: {"reactions/bone_drop.json", &Map.update!(&1, "on", f)}

  defp unresolved(path, target),
    do: %{
      "severity" => "error",
      "code" => "UNRESOLVED_REFERENCE",
      "path" => "reactions/bone_drop.on." <> path,
      "message_key" => "diagnostics.unresolved_reference",
      "data" => %{"target" => "reactions_sampler@0.0.1:" <> target},
      "suggested_capabilities" => []
    }

  # Breaks: a new filter left short (the loader would reject the artifact) or a filter naming a
  # definition this cartridge lacks compiling.
  test "trigger filters expand and must name local definitions", %{dir: dir} do
    assert {:ok, _, []} = Loka.ContentSource.compile(dir, [])

    cases = [
      {on(&Map.put(&1, "item", "ghost")), unresolved("item", "item/ghost")},
      {on(&Map.put(&1, "room", "attic")), unresolved("room", "room/attic")}
    ]

    for {change, diag} <- cases,
        do: assert(Loka.ContentSource.compile(dir, [change]) == {:error, [diag]})
  end
end
