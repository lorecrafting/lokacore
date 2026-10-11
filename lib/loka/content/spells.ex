defmodule Loka.Content.Spells do
  @moduledoc """
  Toolbox row 29a: a spell recipe target needs kernel_api 1.51 (one diagnostic), and no two spells
  share a word (DUPLICATE_DEFINITION at each one's word); row 29b: an effect step (status.apply,
  damage, light.ignite) sits on a spell (SCHEMA_VIOLATION at its op), needs kernel_api 1.55 and
  its owner (UNDECLARED_CAPABILITY at its op: damage death@1 by entity_died, light.ignite light@1
  by the ignite command; status.apply's status already needs status@1). Twin of spells/1 in
  kernel/ts/src/content/cartridge_recipes.ts and the recipe steps of lockStage in cartridge.ts.
  """
  import Loka.Content.Source, only: [at: 2, diag: 2, diag: 3]
  import Loka.Content.Refs, only: [owners: 2, owned: 3]

  @effects ~w(status.apply damage light.ignite)
  @owners %{"damage" => {"events", "entity_died"}, "light.ignite" => {"commands", "ignite"}}

  # A missing or schema-invalid manifest (nil) has its own diagnostics.
  def check(nil, _, _), do: []

  def check(m, defs, registry) do
    spells =
      for {_, {rel, [], %{"target" => %{"kind" => "spell"}} = r}} <- defs["recipe"] || %{},
          do: {rel, r["target"]["word"]}

    words = Enum.frequencies_by(spells, &elem(&1, 1))

    shared =
      for {rel, w} <- spells,
          words[w] > 1,
          do: diag("DUPLICATE_DEFINITION", at(rel, ["target", "word"]))

    effects = effects(defs)
    least = if effects != [], do: [1, 55], else: [1, 51]
    out = shared ++ placed(effects) ++ unowned(effects, m, registry)
    if spells != [] and api(m) < least, do: [floor() | out], else: out
  end

  defp effects(defs) do
    for {_, {rel, [], r}} <- defs["recipe"] || %{},
        {name, o} <- r["outcomes"],
        {%{"op" => op}, i} <- Enum.with_index(o["sequence"]),
        op in @effects,
        do: {rel, r, ["outcomes", name, "sequence", i, "op"], op}
  end

  defp placed(effects) do
    for {rel, r, steps, _} <- effects,
        r["target"]["kind"] != "spell",
        do: diag("SCHEMA_VIOLATION", at(rel, steps), %{"error" => "invalid_value"})
  end

  defp unowned(effects, m, registry) do
    for {rel, _, steps, op} <- effects,
        {field, name} <- [@owners[op]],
        caps = m["requires"]["capabilities"],
        d <- owned(at(rel, steps), name, {caps, owners(registry, [field])}),
        do: d
  end

  defp floor, do: diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")

  defp api(m),
    do:
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)
end
