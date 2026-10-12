defmodule Loka.Content.Combat do
  @moduledoc "Attack profiles and finite death credit; twin of content/cartridge_combat.ts."
  import Loka.Content.Source, only: [diag: 2, diag: 3, diag: 4, at: 2, ref: 3]
  import Loka.Content.Refs, only: [reference: 6, resolve: 4]

  @spec expand(map(), map()) :: map()
  def expand(credit, m), do: Map.new(credit, fn {k, v} -> {k, ref(v, k, m)} end)

  @spec settings(map(), map()) :: map()
  def settings(settings, m),
    do:
      settings
      |> put_ref(["world", "combat", "allies"], &Enum.map(&1, fn r -> ref(r, "npc", m) end))
      |> put_ref(["world", "group", "member"], &ref(&1, "fact", m))

  defp put_ref(settings, path, f),
    do: if(get_in(settings, path), do: update_in(settings, path, f), else: settings)

  @spec check(map() | nil, map(), {term(), map()}, {term(), map() | :unknown} | nil) :: [map()]
  def check(nil, _, _, _), do: []
  def check(_, _, _, nil), do: []

  def check(m, defs, {_, settings}, {_, text}) do
    combat = get_in(settings, ["world", "combat"])
    credit = get_in(settings, ["world", "death_credit"])

    settings_errors(combat, settings, m, text) ++
      allies(combat, m, defs) ++
      group(settings, combat, m, defs) ++
      npc_profiles(defs, combat) ++
      damage_api(m, defs, combat) ++
      shots(combat, m, defs) ++
      if(credit && !combat, do: [bad("cartridge.world.death_credit")], else: []) ++
      credits(credit || [], m, defs)
  end

  defp settings_errors(nil, _, _, _), do: []

  defp settings_errors(combat, settings, m, text) do
    if(get_in(settings, ["world", "death"]), do: [], else: [bad("cartridge.world.death")]) ++
      requirements(m) ++
      profile(combat["player_attack"], "cartridge.world.combat.player_attack") ++
      narration(combat, text) ++
      if((combat["target_choice"] || combat["allies"]) && version(m) < [1, 48],
        # Toolbox rows 6a and 6b: target choice and allies need kernel_api 1.48.
        do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
        else: []
      )
  end

  # Toolbox row 6b: each ally is an authored NPC with an attack; allies need their narration.
  defp allies(%{"allies" => allies} = combat, m, defs) do
    path = ["world", "combat"]

    ally_narration(combat["narration"], path) ++
      for {r, i} <- Enum.with_index(allies),
          error <-
            reference("cartridge.json", path ++ ["allies"], {i, "npc"}, %{i => r}, m, defs) ++
              ally(resolve(r, "npc", m, defs), at("cartridge.json", path ++ ["allies", i])),
          do: error
  end

  defp allies(_, _, _), do: []

  defp ally_narration(narration, path),
    do:
      for(
        field <- ~w(ally_hit ally_miss),
        !narration[field],
        do: bad(at("cartridge.json", path ++ ["narration", field]))
      )

  defp ally({_, _, %{"attack" => _} = npc}, path),
    do: if(npc["spawn_template"], do: [bad(path)], else: [])

  defp ally({_, _, _}, path), do: [bad(path)]
  defp ally(_, _), do: []

  # Toolbox row G8: the group's member fact is a bool pair fact, from kernel_api 1.70; members
  # strike as allies, so combat needs the ally narration.
  defp group(%{"world" => %{"group" => %{"member" => r} = g}}, combat, m, defs) do
    path = ["world", "group"]

    reference("cartridge.json", path, {"member", "fact"}, g, m, defs) ++
      case resolve(r, "fact", m, defs) do
        {_, _,
         %{"per_subject" => true, "scopes" => ["player"], "value_type" => %{"type" => "bool"}}} ->
          []

        {_, _, _} ->
          [bad(at("cartridge.json", path ++ ["member"]))]

        _ ->
          []
      end ++
      if(combat && !combat["allies"],
        do: ally_narration(combat["narration"], ["world", "combat"]),
        else: []
      ) ++
      if(version(m) < [1, 70],
        do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
        else: []
      )
  end

  defp group(_, _, _, _), do: []

  defp npc_profiles(defs, combat) do
    for {_, {rel, _, %{"attack" => attack} = npc}} <- defs["npc"],
        error <-
          profile(attack, at(rel, ["attack"])) ++
            if(combat, do: [], else: [bad(at(rel, ["attack"]))]) ++
            if(npc["hp"], do: [], else: [bad(at(rel, ["hp"]))]),
        do: error
  end

  # Toolbox row G2: damage kinds, crits and resistances need kernel_api 1.44.
  defp damage_api(m, defs, combat) do
    if version(m) < [1, 44] and damage_fields?(defs, combat),
      do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
      else: []
  end

  defp damage_fields?(defs, combat) do
    npcs = for {_, {_, _, n}} <- defs["npc"] || %{}, do: n
    profiles = [combat["player_attack"] | Enum.map(npcs, & &1["attack"])] ++ weapon_attacks(defs)
    Enum.any?(profiles, &(&1["kind"] || &1["crit"])) or Enum.any?(npcs, & &1["resistances"])
  end

  # Toolbox row 17: a ranged weapon names a known ammo pool, and its shots need their narration
  # and kernel_api 1.67.
  defp shots(combat, m, defs) do
    ranged =
      for {_, {rel, _, %{"weapon" => %{"ranged" => r}}}} <- defs["item"] || %{}, do: {rel, r}

    for(
      {rel, r} <- ranged,
      error <- reference(rel, ["weapon", "ranged"], {"ammo", "resource"}, r, m, defs),
      do: error
    ) ++ if(ranged == [], do: [], else: ranged_requirements(combat, m))
  end

  defp ranged_requirements(combat, m) do
    for(
      field <- ~w(shot_hit shot_miss),
      !get_in(combat || %{}, ["narration", field]),
      do: bad(at("cartridge.json", ["world", "combat", "narration", field]))
    ) ++
      if version(m) < [1, 67],
        do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
        else: []
  end

  defp weapon_attacks(defs),
    do: for({_, {_, _, i}} <- defs["item"] || %{}, do: i["weapon"]["attack"])

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

  defp version(m),
    do:
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

  defp requirements(m) do
    if(version(m) < [1, 6],
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
