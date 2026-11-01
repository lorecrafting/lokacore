defmodule Loka.ContentUnattackableTest do
  use ExUnit.Case, async: true
  @moduletag :tmp_dir

  defp update(path, fun),
    do: File.write!(path, path |> File.read!() |> JSON.decode!() |> fun.() |> JSON.encode!())

  # Break: the contradiction compiles, and the authored engage line silently never plays.
  test "unattackable with an engage line is refused in plain words", %{tmp_dir: dir} do
    File.cp_r!("cartridges/standing_sampler", dir)
    update(Path.join(dir, "npcs/guard.json"), &Map.put(&1, "unattackable", true))

    {:error, diags} = Loka.Content.compile(dir)

    assert [%{"path" => "npcs/guard.unattackable"}] =
             Enum.filter(diags, &(&1["data"]["why"] == "unattackable_engage"))

    assert Enum.any?(
             Loka.Content.explained(diags, dir),
             &(&1 =~ "`npcs/guard.json` is `unattackable` and has a `disposition.engage` line")
           )
  end

  # Break: the flag is accepted on something it cannot apply to, and silently does nothing.
  test "unattackable on an item is an unknown field", %{tmp_dir: dir} do
    File.cp_r!("cartridges/fear_sampler", dir)
    update(Path.join(dir, "items/ear.json"), &Map.put(&1, "unattackable", true))

    {:error, diags} = Loka.Content.compile(dir)
    assert Enum.any?(diags, &(&1["code"] == "UNKNOWN_FIELD" and &1["path"] =~ "unattackable"))
  end

  # Break: the compiler drops the key (kernel never sees it), or refuses it on a story NPC with no
  # attack or hp, the prologue's shape.
  test "a story NPC with no attack or hp keeps the flag in the compiled cartridge", %{
    tmp_dir: dir
  } do
    File.cp_r!("cartridges/fear_sampler", dir)
    update(Path.join(dir, "npcs/guard.json"), &Map.put(&1, "unattackable", true))

    {:ok, out, []} = Loka.Content.compile(dir)

    assert %{"unattackable" => true} =
             JSON.decode!(out)["cartridge"]["npcs"]["fear_sampler@0.0.1:npc/guard"]
  end
end
