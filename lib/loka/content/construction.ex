defmodule Loka.Content.Construction do
  @moduledoc """
  Built rooms S1 (construction@1; cartridge.md Structure and site declarations): a room's site
  names no direction the room has an exit in (SITE_EXIT_CONFLICT) and only structures of this
  cartridge (UNRESOLVED_REFERENCE); a structure, its tags and description variants are owned by
  their capabilities, and its name and descriptions have catalog entries; a site or
  world.construction needs construction@1. Variant and enter-lock conditions
  join Resolve.trees/1 through RoomParts.conditions/1.
  """
  import Loka.Content.Source, only: [at: 2, diag: 3, diag: 4, ref: 3]
  import Loka.Content.Refs, only: [owned: 3, owners: 2, resolve: 4]
  alias Loka.Content.RoomParts

  # A missing or schema-invalid manifest (nil) has its own diagnostics.
  def check(nil, _, _, _, _), do: []

  def check(m, defs, v2, {_, settings}, registry) do
    {structures, sites, text} = {structures(defs), sites(defs), text(v2)}

    Enum.flat_map(sites, &site(&1, m, defs)) ++
      owned_structures(structures, m, defs, text, registry) ++
      requirements(m, sites, settings) ++
      builds(m, defs, text, settings)
  end

  defp owned_structures(structures, m, defs, text, registry) do
    required = {m["requires"]["capabilities"], owners(registry, ["definitions"])}

    Enum.flat_map(
      structures,
      &(owned_parts(&1, required) ++ texts(&1, text) ++ statuses(&1, m, defs))
    )
  end

  # Built rooms S6: a scripted action build step sits in the success outcome of a detail target whose room is a site listing its
  # structure and direction, at most one per sequence, with world.construction, the build refusal
  # texts. The listed structure
  # resolves and owns construction@1 already.
  defp builds(m, defs, text, settings) do
    for {_, {rel, [], r}} <- defs["scripted_action"] || %{},
        {name, o} <- r["outcomes"],
        {s, i} <- Enum.with_index(o["sequence"]),
        s["op"] == "build",
        d <- build(m, defs, text, settings, {rel, name, r, s, o["sequence"], i}),
        do: d
  end

  defp build(m, defs, text, settings, {rel, name, r, s, sequence, i}) do
    path = ["outcomes", name, "sequence", i]
    site = build_site(r["target"], m, defs)
    op = at(rel, path ++ ["op"])

    for(
      true <- [misplaced?(sequence, i, name, site, settings)],
      do: diag("SCHEMA_VIOLATION", op, %{"error" => "invalid_value"})
    ) ++
      refusal_texts(text, op) ++ on_site(site, s, rel, path)
  end

  # A second build in the sequence, a build outside success, off a site or without world.construction.
  defp misplaced?(sequence, i, name, site, settings),
    do:
      Enum.any?(Enum.take(sequence, i), &(&1["op"] == "build")) or name != "success" or
        site == nil or get_in(settings, ["world", "construction"]) == nil

  defp refusal_texts(text, op) do
    for k <- ~w(service.site_taken service.construction_full),
        text != :unknown and not is_map_key(text, k),
        do: diag("UNRESOLVED_REFERENCE", op, %{"target" => k})
  end

  defp build_site(target, m, defs) do
    with %{"kind" => "detail", "room" => room} <- target,
         {_, _, %{"site" => site}} <- resolve(room, "room", m, defs),
         do: site,
         else: (_ -> nil)
  end

  defp on_site(nil, _, _, _), do: []

  defp on_site(site, s, rel, path) do
    for {f, ok} <- [
          {"structure", s["structure"] in site["structures"]},
          {"direction", s["direction"] in site["directions"]}
        ],
        not ok,
        do: diag("SCHEMA_VIOLATION", at(rel, path ++ [f]), %{"error" => "invalid_value"})
  end

  # A site or world.construction needs construction@1 (a structure is owned through the registry).
  defp requirements(m, sites, settings) do
    world =
      if get_in(settings, ["world", "construction"]),
        do: ["cartridge.world.construction"],
        else: []

    for p <- for({rel, _, _} <- sites, do: at(rel, ["site"])) ++ world,
        m["requires"]["capabilities"]["construction"] != 1 do
      diag("UNDECLARED_CAPABILITY", p, %{"capability" => "construction"}, ["construction@1"])
    end
  end

  defp structures(defs), do: for({_, {rel, [], b}} <- defs["structure"] || %{}, do: {rel, b})

  defp sites(defs),
    do: for({_, {rel, [], %{"site" => s} = r}} <- defs["room"] || %{}, do: {rel, r, s})

  @doc "A room definition with its site's short structure references expanded (other values as given)."
  def expand(%{"site" => %{"structures" => bs} = s} = room, m) when is_list(bs),
    do: %{room | "site" => %{s | "structures" => Enum.map(bs, &ref(&1, "structure", m))}}

  # Built rooms S4: a structure's weathering and ruin statuses (no other definition has them).
  def expand(%{} = b, m) when is_map_key(b, "weathering") or is_map_key(b, "ruin"),
    do:
      Map.new(b, fn
        {f, v} when f in ~w(weathering ruin) -> {f, ref(v, "status", m)}
        kv -> kv
      end)

  def expand(definition, _), do: definition

  defp statuses({rel, b}, m, defs) do
    for {f, r} <- Map.take(b, ~w(weathering ruin)),
        resolve(r, "status", m, defs) == :unresolved,
        do:
          diag("UNRESOLVED_REFERENCE", at(rel, [f]), %{
            "target" => "#{r["cartridge_id"]}@#{r["cartridge_version"]}:#{r["kind"]}/#{r["key"]}"
          })
  end

  defp site({rel, r, s}, m, defs) do
    exits = r["exits"] || %{}

    for(
      {d, i} <- Enum.with_index(s["directions"]),
      is_map_key(exits, d),
      do: diag("SITE_EXIT_CONFLICT", at(rel, ["site", "directions", i]), %{})
    ) ++
      for {b, i} <- Enum.with_index(s["structures"]),
          resolve(b, "structure", m, defs) == :unresolved,
          do:
            diag("UNRESOLVED_REFERENCE", at(rel, ["site", "structures", i]), %{
              "target" =>
                "#{b["cartridge_id"]}@#{b["cartridge_version"]}:#{b["kind"]}/#{b["key"]}"
            })
  end

  defp text(nil), do: :unknown
  defp text(v2), do: elem(v2, 1)

  defp owned_parts({rel, b}, required) do
    tags = if b["tags"], do: owned(at(rel, ["tags"]), "tags", required), else: []

    owned(at(rel, []), "structure", required) ++
      tags ++
      for {s, _} <- RoomParts.variants(b), d <- owned(at(rel, s), "variant", required), do: d
  end

  defp texts({rel, b}, text) do
    keys = for {s, v} <- RoomParts.variants(b), do: {s ++ ["description"], v["description"]}

    for {s, k} <- [{["name"], b["name"]}, {["description"], b["description"]} | keys],
        text != :unknown and not is_map_key(text, k),
        do: diag("UNRESOLVED_REFERENCE", at(rel, s), %{"target" => k})
  end
end
