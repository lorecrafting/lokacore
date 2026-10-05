defmodule Loka.Content.Death do
  @moduledoc "Corpse templates and shrine settings; twin of content/cartridge_death.ts."
  import Loka.Content.Source, only: [diag: 2, diag: 3, diag: 4, at: 2, ref: 3]
  import Loka.Content.Refs, only: [reference: 6, resolve: 4]
  alias Loka.Content.Entities

  def expand(death, m) do
    death
    |> Map.update!("player_corpse", &ref(&1, "item", m))
    |> Map.update!("npc_corpse", &ref(&1, "item", m))
    |> Map.update!("shrine", &ref(&1, "room", m))
  end

  def check(nil, _, _), do: []

  def check(m, defs, {_, settings}) do
    death = get_in(settings, ["world", "death"])
    templates(m, defs, death) ++ if(death, do: settings(m, defs, death), else: [])
  end

  defp templates(m, defs, death) do
    Enum.flat_map(Entities.all(defs), &template(&1, m, defs, death))
  end

  defp template({"item", rel, %{"location" => %{"in" => "template"}} = i}, m, _, death) do
    configured =
      death && ref(i["key"], "item", m) in [death["player_corpse"], death["npc_corpse"]]

    if(configured, do: [], else: [bad(at(rel, ["location"]))]) ++
      if(i["container"] == true, do: [], else: [bad(at(rel, ["container"]))]) ++
      for(f <- ~w(capacity slot barrier), is_map_key(i, f), do: bad(at(rel, [f])))
  end

  defp template({"item", rel, %{"location" => %{"in" => "item", "item" => r}}}, m, defs, _) do
    case resolve(r, "item", m, defs) do
      {_, _, %{"location" => %{"in" => "template"}}} -> [bad(at(rel, ["location", "item"]))]
      _ -> []
    end
  end

  defp template(_, _, _, _), do: []

  defp settings(m, defs, d) do
    refs =
      for {field, kind} <- [{"shrine", "room"}, {"player_corpse", "item"}, {"npc_corpse", "item"}],
          error <- reference("cartridge.json", ["world", "death"], {field, kind}, d, m, defs),
          do: error

    requirements(m) ++ refs ++ values(m, defs, d)
  end

  defp values(m, defs, d) do
    kinds =
      for field <- ~w(player_corpse npc_corpse),
          {_, _, item} <- [resolve(d[field], "item", m, defs)],
          item["location"]["in"] != "template",
          do: bad("cartridge.world.death." <> field)

    distinct =
      if d["player_corpse"] == d["npc_corpse"],
        do: [bad("cartridge.world.death.npc_corpse")],
        else: []

    kinds ++ distinct ++ restoration(defs, d)
  end

  defp restoration(defs, d) do
    for pool <- ~w(hp mv),
        not restore_valid?(defs["resource"][pool], d["restore"][pool]),
        do: bad("cartridge.world.death.restore." <> pool)
  end

  defp requirements(m) do
    version =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    api =
      if version < [1, 5],
        do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
        else: []

    owners =
      for c <- ~w(death containment position),
          m["requires"]["capabilities"][c] != 1,
          do:
            diag("UNDECLARED_CAPABILITY", "cartridge.world.death", %{"capability" => c}, [
              c <> "@1"
            ])

    api ++ owners
  end

  defp restore_valid?({_, _, spec}, amount),
    do: amount >= spec["minimum"] and amount <= spec["maximum"]

  defp restore_valid?(_, _), do: false
  defp bad(path), do: diag("SCHEMA_VIOLATION", path, %{"error" => "invalid_value"})
end
