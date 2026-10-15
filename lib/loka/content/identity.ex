defmodule Loka.Content.Identity do
  @moduledoc """
  Toolbox rows W15 and FD9: world.identity's name and each name variant's description name text
  catalog keys; description_variant@1 owns each name variant, whose condition names declared
  definitions through ops the cartridge's capabilities own. Twin of the world.identity entries
  of the TS loader's parts and refStage (kernel/ts/src/content/cartridge_refs.ts); Variants
  holds the 1.97 floor. Called from Variety.
  """
  import Loka.Content.Source, only: [at: 2, diag: 3]
  import Loka.Content.Refs, only: [owned: 3, owners: 1, owners: 2]

  @path ["world", "identity"]

  def check(m, defs, %{"world" => %{"identity" => id}}, {text, registry}) do
    caps = m["requires"]["capabilities"]

    variants =
      Enum.with_index(id["name_variants"] || [], fn v, i -> {v, @path ++ ["name_variants", i]} end)

    keys = [
      {id["name"], @path ++ ["name"]}
      | for({v, p} <- variants, do: {v["description"], p ++ ["description"]})
    ]

    Enum.flat_map(variants, fn {v, p} ->
      owned(at("cartridge.json", p), "variant", {caps, owners(registry, ["definitions"])}) ++
        Loka.Content.Policies.tree(
          {"cartridge.json", p ++ ["when", "root"], v["when"]["root"]},
          {m, defs, {caps, owners(registry)}}
        )
    end) ++ texts(keys, text)
  end

  def check(_, _, _, _), do: []

  defp texts(_, :unknown), do: []

  defp texts(keys, text),
    do:
      for(
        {k, p} <- keys,
        not is_map_key(text || %{}, k),
        do: diag("UNRESOLVED_REFERENCE", at("cartridge.json", p), %{"target" => k})
      )
end
