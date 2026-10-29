defmodule Loka.Content.Combat do
  @moduledoc "Attack profiles and finite death credit."
  import Loka.Content.Source, only: [diag: 3, diag: 4, at: 2, ref: 3]
  import Loka.Content.Refs, only: [reference: 6, resolve: 4]

  @spec expand(map(), map()) :: map()
  def expand(credit, m), do: Map.new(credit, fn {k, v} -> {k, ref(v, k, m)} end)

  @spec settings(map(), map()) :: map()
  def settings(settings, m),
    do:
      settings
      |> put_ref(["world", "combat", "allies"], &Enum.map(&1, fn r -> ref(r, "npc", m) end))
      |> put_ref(["world", "group", "member"], &ref(&1, "fact", m))
      |> put_ref(["world", "group", "stay"], &ref(&1, "fact", m))
      |> put_ref(["world", "group", "fight"], &ref(&1, "fact", m))

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
      shots(combat, m, defs) ++
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

  # Toolbox rows G8 and 22a: the group's member, stay and fight facts are bool pair facts;
  # members strike as allies, so combat needs the ally
  # narration. Row 22b: the wage resource is conserved (gain 0, no regen).
  defp group(%{"world" => %{"group" => %{"member" => _} = g}}, combat, m, defs) do
    Enum.flat_map(~w(member stay fight), &if(g[&1], do: pair_fact(&1, g, m, defs), else: [])) ++
      wage(g["wage"], m, defs) ++
      if(combat && !combat["allies"],
        do: ally_narration(combat["narration"], ["world", "combat"]),
        else: []
      )
  end

  defp group(_, _, _, _), do: []

  defp wage(nil, _, _), do: []

  defp wage(w, m, defs) do
    path = ["world", "group", "wage"]

    reference("cartridge.json", path, {"resource", "resource"}, w, m, defs) ++
      case resolve(w["resource"], "resource", m, defs) do
        {_, _, %{"gain" => 0, "regen" => nil}} -> []
        {_, _, %{"gain" => 0} = r} when not is_map_key(r, "regen") -> []
        {_, _, _} -> [bad(at("cartridge.json", path ++ ["resource"]))]
        _ -> []
      end
  end

  defp pair_fact(key, g, m, defs) do
    path = ["world", "group"]

    reference("cartridge.json", path, {key, "fact"}, g, m, defs) ++
      case resolve(g[key], "fact", m, defs) do
        {_, _,
         %{"per_subject" => true, "scopes" => ["player"], "value_type" => %{"type" => "bool"}}} ->
          []

        {_, _, _} ->
          [bad(at("cartridge.json", path ++ [key]))]

        _ ->
          []
      end
  end

  defp npc_profiles(defs, combat) do
    for {_, {rel, _, %{"attack" => attack} = npc}} <- defs["npc"],
        error <-
          profile(attack, at(rel, ["attack"])) ++
            if(combat, do: [], else: [bad(at(rel, ["attack"]))]) ++
            if(npc["hp"], do: [], else: [bad(at(rel, ["hp"]))]),
        do: error
  end

  # Toolbox row 17: a ranged weapon names a known ammo pool, and its shots need their narration.
  defp shots(combat, m, defs) do
    ranged =
      for {_, {rel, _, %{"weapon" => %{"ranged" => r}}}} <- defs["item"] || %{}, do: {rel, r}

    for(
      {rel, r} <- ranged,
      error <- reference(rel, ["weapon", "ranged"], {"ammo", "resource"}, r, m, defs),
      do: error
    ) ++ if(ranged == [], do: [], else: ranged_requirements(combat))
  end

  defp ranged_requirements(combat) do
    for(
      field <- ~w(shot_hit shot_miss),
      !get_in(combat || %{}, ["narration", field]),
      do: bad(at("cartridge.json", ["world", "combat", "narration", field]))
    )
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
