defmodule Loka.Content.Construction do
  @moduledoc """
  Built rooms S1 (construction@1; cartridge.md Blueprint and site declarations): a room's site
  names no direction the room has an exit in (SITE_EXIT_CONFLICT) and only blueprints of this
  cartridge (UNRESOLVED_REFERENCE); a blueprint, its tags and description variants are owned by
  their capabilities, and each variant's description has a catalog entry; a blueprint, a site or
  world.construction needs kernel_api 1.99. Twin of kernel/ts/src/content/cartridge_construction.ts
  (the TS loader checks blueprint parts in cartridge_refs.ts). Title and description keys are
  Checks.texts/2's; variant and enter-lock conditions join Checks.trees/1 through conditions/1.
  """
  import Loka.Content.Source, only: [at: 2, diag: 3]
  import Loka.Content.Refs, only: [owned: 3, owners: 2, resolve: 4]
  alias Loka.Content.RoomParts

  # A missing or schema-invalid manifest (nil) has its own diagnostics.
  def check(nil, _, _, _, _), do: []

  def check(m, defs, v2, {_, settings}, registry) do
    {blueprints, sites} = {blueprints(defs), sites(defs)}
    required = {m["requires"]["capabilities"], owners(registry, ["definitions"])}

    Enum.flat_map(sites, &site(&1, m, defs)) ++
      Enum.flat_map(blueprints, &(owned_parts(&1, required) ++ texts(&1, text(v2)))) ++
      floor(m, blueprints != [] or sites != [], settings["world"] || %{})
  end

  defp blueprints(defs), do: for({_, {rel, [], b}} <- defs["blueprint"] || %{}, do: {rel, b})

  defp sites(defs),
    do: for({_, {rel, [], %{"site" => s} = r}} <- defs["room"] || %{}, do: {rel, r, s})

  @doc "Each blueprint's variant conditions and enter lock, as `{rel, steps, root}`."
  def conditions(defs) do
    for {rel, b} <- blueprints(defs), {steps, root} <- roots(b), do: {rel, steps, root}
  end

  defp roots(b) do
    for({s, v} <- RoomParts.variants(b), do: {s ++ ["when", "root"], v["when"]["root"]}) ++
      for %{"enter" => p} <- [b["locks"]], do: {["locks", "enter", "root"], p["root"]}
  end

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
    for {s, v} <- RoomParts.variants(b),
        text != :unknown and not is_map_key(text, v["description"]),
        do:
          diag("UNRESOLVED_REFERENCE", at(rel, s ++ ["description"]), %{
            "target" => v["description"]
          })
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
