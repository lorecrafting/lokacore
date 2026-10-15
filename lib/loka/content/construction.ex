defmodule Loka.Content.Construction do
  @moduledoc """
  Built rooms S1 (construction@1; cartridge.md Blueprint and site declarations): a room's site
  names no direction the room has an exit in (SITE_EXIT_CONFLICT) and only blueprints of this
  cartridge (UNRESOLVED_REFERENCE); a blueprint, its tags and description variants are owned by
  their capabilities, and its title and descriptions have catalog entries; a site or
  world.construction needs construction@1; a blueprint, a site or world.construction needs kernel_api 1.99. Twin of kernel/ts/src/content/cartridge_construction.ts
  (the TS loader checks blueprint parts in cartridge_refs.ts). Variant and enter-lock conditions
  join Checks.trees/1 through RoomParts.conditions/1.
  """
  import Loka.Content.Source, only: [at: 2, diag: 3, diag: 4, ref: 3]
  import Loka.Content.Refs, only: [owned: 3, owners: 2, resolve: 4]
  alias Loka.Content.RoomParts

  # A missing or schema-invalid manifest (nil) has its own diagnostics.
  def check(nil, _, _, _, _), do: []

  def check(m, defs, v2, {_, settings}, registry) do
    {blueprints, sites} = {blueprints(defs), sites(defs)}
    required = {m["requires"]["capabilities"], owners(registry, ["definitions"])}

    world = settings["world"] || %{}
    gates = if is_map_key(world, "construction"), do: ["cartridge.world.construction"], else: []

    Enum.flat_map(sites, &site(&1, m, defs)) ++
      Enum.flat_map(blueprints, &(owned_parts(&1, required) ++ texts(&1, text(v2)))) ++
      gated(m, for({rel, _, _} <- sites, do: at(rel, ["site"])) ++ gates) ++
      floor(m, blueprints != [] or sites != [], world)
  end

  # A site or world.construction needs construction@1 (a blueprint is owned through the registry).
  defp gated(m, paths) do
    for p <- paths, m["requires"]["capabilities"]["construction"] != 1 do
      diag("UNDECLARED_CAPABILITY", p, %{"capability" => "construction"}, ["construction@1"])
    end
  end

  defp blueprints(defs), do: for({_, {rel, [], b}} <- defs["blueprint"] || %{}, do: {rel, b})

  defp sites(defs),
    do: for({_, {rel, [], %{"site" => s} = r}} <- defs["room"] || %{}, do: {rel, r, s})

  @doc "A room definition with its site's short blueprint references expanded (other values as given)."
  def expand(%{"site" => %{"blueprints" => bs} = s} = room, m) when is_list(bs),
    do: %{room | "site" => %{s | "blueprints" => Enum.map(bs, &ref(&1, "blueprint", m))}}

  def expand(definition, _), do: definition

  defp site({rel, r, s}, m, defs) do
    exits = r["exits"] || %{}

    for(
      {d, i} <- Enum.with_index(s["directions"]),
      is_map_key(exits, d),
      do: diag("SITE_EXIT_CONFLICT", at(rel, ["site", "directions", i]), %{})
    ) ++
      for {b, i} <- Enum.with_index(s["blueprints"]),
          resolve(b, "blueprint", m, defs) == :unresolved,
          do:
            diag("UNRESOLVED_REFERENCE", at(rel, ["site", "blueprints", i]), %{
              "target" =>
                "#{b["cartridge_id"]}@#{b["cartridge_version"]}:#{b["kind"]}/#{b["key"]}"
            })
  end

  defp text(nil), do: :unknown
  defp text(v2), do: elem(v2, 1)

  defp owned_parts({rel, b}, required) do
    tags = if b["tags"], do: owned(at(rel, ["tags"]), "tags", required), else: []

    owned(at(rel, []), "blueprint", required) ++
      tags ++
      for {s, _} <- RoomParts.variants(b), d <- owned(at(rel, s), "variant", required), do: d
  end

  defp texts({rel, b}, text) do
    keys = for {s, v} <- RoomParts.variants(b), do: {s ++ ["description"], v["description"]}

    for {s, k} <- [{["title"], b["title"]}, {["description"], b["description"]} | keys],
        text != :unknown and not is_map_key(text, k),
        do: diag("UNRESOLVED_REFERENCE", at(rel, s), %{"target" => k})
  end

  defp floor(m, used, world) do
    api =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    if (used or is_map_key(world, "construction")) and api < [1, 99],
      do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least", %{})],
      else: []
  end
end
