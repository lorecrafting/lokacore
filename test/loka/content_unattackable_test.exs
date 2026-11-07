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

  # Break: removing the engage line, as the error advises, trips the "hostile with attack needs an
  # engage line" shape, so a protected NPC with a profile cannot compile at all.
  test "unattackable with attack, hostile and no engage line compiles", %{tmp_dir: dir} do
    File.cp_r!("cartridges/standing_sampler", dir)

    update(Path.join(dir, "npcs/guard.json"), fn n ->
      n |> Map.put("unattackable", true) |> update_in(["disposition"], &Map.delete(&1, "engage"))
    end)

    assert {:ok, _, _} = Loka.Content.compile(dir)
  end

  # Break: a population or death credit names an NPC no one can fight: it compiles and never pays.
  test "unattackable population members and death credit NPCs are refused", %{tmp_dir: dir} do
    for {sampler, npc, code} <- [
          {"boss_sampler", "guard", "populations/guards"},
          {"cellar_sampler", "cellar_rat_1", "death_credit[0].npc"}
        ] do
      at = Path.join(dir, sampler)
      File.cp_r!("cartridges/#{sampler}", at)
      update(Path.join(at, "npcs/#{npc}.json"), &Map.put(&1, "unattackable", true))
      assert {:error, diags} = Loka.Content.compile(at)
      assert [%{"path" => path}] = Enum.filter(diags, &(&1["data"]["why"] == "unattackable_foe"))
      assert path =~ code

      assert Enum.any?(
               Loka.Content.explained(diags, at),
               &(&1 =~ "`npcs/#{npc}.json` is `unattackable`, so no one can fight it")
             )
    end
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

  # Break: the flag or the engage line is read before `extends` merges, so a child that inherits
  # the engage line and sets the flag (or the reverse) compiles and the line never plays.
  test "unattackable and an engage line meet through extends", %{tmp_dir: dir} do
    File.cp_r!("cartridges/standing_sampler", dir)
    guard = Path.join(dir, "npcs/guard.json")

    File.write!(
      Path.join(dir, "npcs/sentry.json"),
      JSON.encode!(%{"extends" => "guard", "unattackable" => true})
    )

    assert {:error, diags} = Loka.Content.compile(dir)

    assert [%{"path" => "npcs/sentry.unattackable"}] =
             Enum.filter(diags, &(&1["data"]["why"] == "unattackable_engage"))

    File.write!(
      guard,
      guard |> File.read!() |> JSON.decode!() |> Map.put("unattackable", true) |> JSON.encode!()
    )

    File.write!(Path.join(dir, "npcs/sentry.json"), JSON.encode!(%{"extends" => "guard"}))
    assert {:error, diags} = Loka.Content.compile(dir)

    assert ["npcs/guard.unattackable", "npcs/sentry.unattackable"] ==
             for(%{"data" => %{"why" => "unattackable_engage"}, "path" => p} <- diags, do: p)
             |> Enum.sort()
  end
end
