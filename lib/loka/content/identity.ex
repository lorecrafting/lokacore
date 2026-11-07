defmodule Loka.Content.Identity do
  @moduledoc """
  Toolbox rows W15 and FD9: world.identity's name and each name variant's description name text
  catalog keys; description_variant@1 owns each name variant, whose condition names declared
  definitions through ops the cartridge's capabilities own. Called from Alternates. The name
  variants' condition roots also get
  Delayed's time_since checks and the target-subject FACT_SCOPE_UNSUPPORTED walk (Resolve.trees/1
  holds definition roots only).
  """
  import Loka.Content.Source, only: [at: 2, diag: 3]
  import Loka.Content.Refs, only: [owned: 3, owners: 1, owners: 2]

  @path ["world", "identity"]

  def check(m, defs, %{"world" => %{"identity" => id}}, {text, registry}) do
    caps = m["requires"]["capabilities"]

    variants = Enum.with_index(id["name_variants"] || [], &{&1, @path ++ ["name_variants", &2]})
    trees = trees(variants)

    owned_all(variants, caps, registry) ++
      Enum.flat_map(trees, &Loka.Content.Policies.tree(&1, {m, defs, {caps, owners(registry)}})) ++
      clocks(m, defs, trees) ++
      texts(keys(id, variants), text)
  end

  def check(_, _, _, _), do: []

  defp clocks(m, defs, trees),
    do:
      Loka.Content.Delayed.check(m, Map.put(defs, "reaction", %{}), trees) ++
        Enum.flat_map(trees, fn {rel, p, root} -> targetless(rel, p, root) end)

  # A name variant reads the player's body with no fact subject.
  defp targetless(rel, p, %{"op" => op, "subject" => "target"})
       when op in ~w(fact_compare fact_at_least),
       do: [diag("FACT_SCOPE_UNSUPPORTED", at(rel, p ++ ["subject"]), %{})]

  defp targetless(rel, p, v) when is_map(v),
    do: Enum.flat_map(v, fn {k, x} -> targetless(rel, p ++ [k], x) end)

  defp targetless(rel, p, v) when is_list(v),
    do: v |> Enum.with_index() |> Enum.flat_map(fn {x, i} -> targetless(rel, p ++ [i], x) end)

  defp targetless(_, _, _), do: []

  defp owned_all(variants, caps, registry),
    do:
      for(
        {_, p} <- variants,
        d <- owned(at("cartridge.json", p), "variant", {caps, owners(registry, ["definitions"])}),
        do: d
      )

  # Resolve.trees/1 reads definitions only; these roots get its tree checks here.
  defp trees(variants),
    do: for({v, p} <- variants, do: {"cartridge.json", p ++ ["when"], v["when"]})

  defp keys(id, variants),
    do: [
      {id["name"], @path ++ ["name"]}
      | for({v, p} <- variants, do: {v["description"], p ++ ["description"]})
    ]

  defp texts(_, :unknown), do: []

  defp texts(keys, text),
    do:
      for(
        {k, p} <- keys,
        not is_map_key(text || %{}, k),
        do: diag("UNRESOLVED_REFERENCE", at("cartridge.json", p), %{"target" => k})
      )
end
