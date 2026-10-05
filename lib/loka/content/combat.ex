defmodule Loka.Content.Combat do
  @moduledoc "Attack profiles and finite death credit; twin of content/cartridge_combat.ts."
  import Loka.Content.Source, only: [diag: 2, diag: 3, diag: 4, at: 2, ref: 3]
  import Loka.Content.Refs, only: [reference: 6, resolve: 4]

  @spec expand(map(), map()) :: map()
  def expand(credit, m), do: Map.new(credit, fn {k, v} -> {k, ref(v, k, m)} end)

  @spec check(map() | nil, map(), {term(), map()}, {term(), map() | :unknown} | nil) :: [map()]
  def check(nil, _, _, _), do: []
  def check(_, _, _, nil), do: []

  def check(m, defs, {_, settings}, {_, text}) do
    combat = get_in(settings, ["world", "combat"])
    credit = get_in(settings, ["world", "death_credit"])

    settings_errors(combat, settings, m, text) ++
      npc_profiles(defs, combat) ++
      if(credit && !combat, do: [bad("cartridge.world.death_credit")], else: []) ++
      credits(credit || [], m, defs)
  end

  defp settings_errors(nil, _, _, _), do: []

  defp settings_errors(combat, settings, m, text) do
    if(get_in(settings, ["world", "death"]), do: [], else: [bad("cartridge.world.death")]) ++
      requirements(m) ++
      profile(combat["player_attack"], "cartridge.world.combat.player_attack") ++
      narration(combat, text)
  end

  defp npc_profiles(defs, combat) do
    for {_, {rel, _, %{"attack" => attack} = npc}} <- defs["npc"],
        error <-
          profile(attack, at(rel, ["attack"])) ++
            if(combat, do: [], else: [bad(at(rel, ["attack"]))]) ++
            if(npc["hp"], do: [], else: [bad(at(rel, ["hp"]))]),
        do: error
  end

  defp narration(_, :unknown), do: []

  defp narration(combat, text) do
    for {field, key} <- combat["narration"],
        not is_map_key(text, key),
        do:
          diag(
            "UNRESOLVED_REFERENCE",
            at("cartridge.json", ["world", "combat", "narration", field]),
            %{"target" => key}
          )
  end

  defp profile(p, path),
    do: if(p["damage_min"] > p["damage_max"], do: [bad(path <> ".damage_max")], else: [])

  defp requirements(m) do
    version =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    if(version < [1, 6],
      do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
      else: []
    ) ++
      for c <- ~w(combat schedule death),
          m["requires"]["capabilities"][c] != 1,
          do:
            diag("UNDECLARED_CAPABILITY", "cartridge.world.combat", %{"capability" => c}, [
              c <> "@1"
            ])
  end

  defp credits(credits, m, defs) do
    duplicates =
      for field <- ~w(npc fact), into: %{}, do: {field, Enum.frequencies_by(credits, & &1[field])}

    for {credit, i} <- Enum.with_index(credits),
        error <- credit(credit, ["world", "death_credit", i], duplicates, m, defs),
        do: error
  end

  defp credit(c, path, duplicates, m, defs) do
    refs =
      for field <- ~w(npc room fact),
          d <- reference("cartridge.json", path, {field, field}, c, m, defs),
          do: d

    repeated =
      for field <- ~w(npc fact),
          duplicates[field][c[field]] > 1,
          do: bad(at("cartridge.json", path ++ [field]))

    refs ++ repeated ++ credit_npc(c, path, m, defs) ++ credit_fact(c, path, m, defs)
  end

  defp credit_npc(c, path, m, defs) do
    case resolve(c["npc"], "npc", m, defs) do
      {_, _, n} ->
        if(n["attack"], do: [], else: [bad(at("cartridge.json", path ++ ["npc"]))]) ++
          if(not is_tuple(resolve(c["room"], "room", m, defs)) or n["room"] == c["room"],
            do: [],
            else: [bad(at("cartridge.json", path ++ ["room"]))]
          )

      _ ->
        []
    end
  end

  defp credit_fact(c, path, m, defs) do
    case resolve(c["fact"], "fact", m, defs) do
      {_, _, %{"scopes" => ["player"], "value_type" => %{"type" => "bool", "default" => false}}} ->
        []

      {_, _, _} ->
        [bad(at("cartridge.json", path ++ ["fact"]))]

      _ ->
        []
    end
  end

  defp bad(path), do: diag("SCHEMA_VIOLATION", path, %{"error" => "invalid_value"})
end
