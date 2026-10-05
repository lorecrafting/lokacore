defmodule Loka.Content.Commerce do
  @moduledoc "Validates finite authored shop identities and explicit conserved funding."
  import Loka.Content.Source, only: [diag: 2, at: 2]
  alias Loka.Content.Refs

  def check(nil, _), do: []

  def check(m, defs) do
    for {_, {rel, [], npc}} <- defs["npc"], npc["shop"], d <- shop(m, defs, rel, npc), do: d
  end

  defp shop(m, defs, rel, npc) do
    s = npc["shop"]
    path = at(rel, ["shop"])
    resource = Refs.resolve(s["resource"], "resource", m, defs)
    ids = Enum.map(s["offers"], & &1["item"])

    api = api_check(m, path)

    duplicate =
      if length(Enum.uniq(ids)) != length(ids), do: [diag("DUPLICATE_DEFINITION", path)], else: []

    funds = if funded?(resource, npc), do: [], else: [diag("RESOURCE_SPEC_INVALID", path)]

    items =
      for ref <- ids, not stocked?(ref, npc, m, defs), do: diag("UNRESOLVED_REFERENCE", path)

    api ++ duplicate ++ funds ++ items
  end

  defp api_check(manifest, path) do
    version =
      manifest["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    if version < [1, 16], do: [diag("KERNEL_API_RANGE_INVALID", path)], else: []
  end

  defp funded?({_, _, resource}, npc) do
    resource["gain"] == 0 and resource["regen"] == nil and
      npc["resource_starts"][resource["key"]] != nil
  end

  defp funded?(_, _), do: false

  defp stocked?(ref, npc, m, defs) do
    case Refs.resolve(ref, "item", m, defs) do
      {_, _, %{"location" => %{"in" => "npc", "npc" => holder}}} ->
        holder == Loka.Content.Source.ref(npc["key"], "npc", m)

      _ ->
        false
    end
  end
end
