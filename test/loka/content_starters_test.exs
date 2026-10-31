defmodule Loka.ContentStartersTest do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir
  alias Loka.Content.Starters

  @schema_kinds "schemas/source/*.schema.json"
                |> Path.wildcard()
                |> Enum.map(&Path.basename(&1, ".schema.json"))
                |> List.delete("defs")
  @guide File.read!("docs/guides/writing-the-game.md")

  # Breaks: a source kind the owner cannot start from the tools, or one the guide's coverage
  # table leaves out (a new schema file lands without either).
  test "every source schema kind has a starter and a coverage row" do
    assert @schema_kinds -- Starters.kinds() == []
    for kind <- @schema_kinds, do: assert(@guide =~ "\n| `#{kind}` |", "no coverage row: #{kind}")
  end

  # Breaks: a starter missing a field or capability the compiler requires, or two starters
  # sharing a key (the service's entitlement once took the action's fact, which made it reserved).
  test "a new cartridge with one starter of every kind compiles", %{tmp_dir: tmp} do
    dir = Path.join(tmp, "mine")
    assert {:ok, _} = Starters.write(dir, "cartridge", dir)
    first = ~w(items npcs resources facts quests)
    rest = (Starters.kinds() -- first) -- ~w(cartridge layout)

    for kind <- first ++ rest ++ ["layout"],
        do: assert({:ok, _} = Starters.write(dir, kind, "my_#{kind}"), kind)

    assert {:ok, _, warnings} = Loka.Content.compile(dir)
    # placeholder prose names no keyword; the writer's words will
    assert Enum.map(warnings, & &1["code"]) |> Enum.uniq() == ["TOUCH_LINK_MISSING"]
  end

  # Breaks: a dependent starter writing a dangling reference, a bad key or an unknown kind
  # reaching the file system instead of one line naming the fix.
  test "a starter refuses a missing prerequisite, a bad name and an unknown kind", %{tmp_dir: tmp} do
    assert {:error, "a name is lowercase" <> _} = Starters.write(tmp, "cartridge", tmp)
    dir = Path.join(tmp, "mine")
    assert {:ok, _} = Starters.write(dir, "cartridge", dir)

    assert Starters.write(dir, "quests", "q") ==
             {:error, "no items yet: bin/loka new items <name> first"}

    assert {:error, "a name is lowercase" <> _} = Starters.write(dir, "items", "Bad-Name")

    assert {:error, "unknown kind \"shop\"; one of: actions" <> _} =
             Starters.write(dir, "shop", "x")

    assert {:error, _} = Starters.write(dir, "cartridge", dir)
    assert Path.wildcard(Path.join(dir, "**/*.json")) |> length() == 2
  end
end
