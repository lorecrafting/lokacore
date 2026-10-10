defmodule Loka.Content.Ancestries do
  @moduledoc false
  alias Loka.Content.Refs
  import Loka.Content.Source, only: [at: 2, diag: 2, ref: 3]

  def expand(ancestry, manifest) do
    ancestry
    |> Map.update!("attribute", &ref(&1, "attribute", manifest))
    |> Map.update("skill", nil, fn skill -> ref(skill, "skill", manifest) end)
    |> Map.update("faction", nil, fn faction ->
      Map.update!(faction, "fact", &ref(&1, "fact", manifest))
    end)
    |> Map.reject(fn {_, value} -> is_nil(value) end)
  end

  def check(nil, _, _, _), do: []

  def check(manifest, defs, {_, settings} = located, text) do
    ancestries = settings["ancestries"] || %{}

    empty =
      if is_map_key(settings, "ancestries") and ancestries == %{},
        do: [diag("SCHEMA_VIOLATION", at("cartridge.json", ["ancestries"]))],
        else: []

    # attributes@1 owns these cartridge.json settings: ancestries, derived-stat tables, levelling.
    empty ++
      Loka.Content.Derived.check(manifest, defs, located) ++
      Loka.Content.Levelling.check(manifest, defs, located, text) ++
      Enum.flat_map(ancestries, fn {key, choice} ->
        one(manifest, defs, text, key, choice)
      end)
  end

  defp one(manifest, defs, text, key, choice) do
    path = ["ancestries", key]

    labels =
      for field <- ~w(label description),
          text != :unknown and not is_map_key(text, choice[field]),
          do: diag("UNRESOLVED_REFERENCE", at("cartridge.json", path ++ [field]))

    skill =
      if choice["skill"],
        do: Refs.reference("cartridge.json", path, "skill", choice, manifest, defs),
        else: []

    capability(manifest, path, choice) ++
      labels ++
      Refs.reference("cartridge.json", path, "attribute", choice, manifest, defs) ++
      skill ++
      faction(manifest, defs, path, choice["faction"]) ++
      bound(manifest, defs, path, choice)
  end

  defp capability(manifest, path, choice) do
    caps = manifest["requires"]["capabilities"]

    if caps["attributes"] == 1 and caps["fact"] == 1 and
         (is_nil(choice["skill"]) or caps["skills"] == 1) and
         (is_nil(choice["dark_sight"]) or caps["light"] == 1),
       do: [],
       else: [diag("UNDECLARED_CAPABILITY", at("cartridge.json", path))]
  end

  defp faction(_, _, _, nil), do: []

  defp faction(manifest, defs, path, faction) do
    path = path ++ ["faction"]
    ref = Refs.reference("cartridge.json", path, {"fact", "fact"}, faction, manifest, defs)

    scope =
      case Refs.resolve(faction["fact"], "fact", manifest, defs) do
        {_, _, %{"scopes" => ["player"]}} -> []
        {_, _, %{}} -> [diag("SCHEMA_VIOLATION", at("cartridge.json", path ++ ["fact"]))]
        _ -> []
      end

    ref ++ scope
  end

  defp bound(manifest, defs, path, choice) do
    case Refs.resolve(choice["attribute"], "attribute", manifest, defs) do
      {_, _, %{"start" => start}} ->
        if start + choice["modifier"] > 9_007_199_254_740_991,
          do: [diag("SCHEMA_VIOLATION", at("cartridge.json", path ++ ["modifier"]))],
          else: []

      _ ->
        []
    end
  end
end
