defmodule Loka.Content.Spells do
  @moduledoc """
  Toolbox row 29a: a spell recipe target needs kernel_api 1.98, an aimed one 1.119 (loka-x6t.109;
  one diagnostic), and no two spells
  share a word (DUPLICATE_DEFINITION at each one's word); its learned names a bool fact of this
  cartridge (FACT_TYPE_MISMATCH otherwise) of player scope alone, not per_subject
  (FACT_SCOPE_UNSUPPORTED). Row 29b: an effect step (status.apply, damage, light.ignite) sits on a
  spell (SCHEMA_VIOLATION at its op) and needs its owner (UNDECLARED_CAPABILITY at its op: damage
  death@1 by entity_died, light.ignite light@1 by the ignite command; status.apply's status
  already needs status@1); an unaimed spell's damage names its npc and its light.ignite its item
  (SCHEMA_VIOLATION at the missing field). Word bar S2: speech.phrases needs kernel_api 1.98 too, and speech@1
  (UNDECLARED_CAPABILITY at the phrases). Twin of
  spells/1 in kernel/ts/src/content/cartridge_recipes.ts and the recipe steps of lockStage in
  cartridge.ts.
  """
  import Loka.Content.Source, only: [at: 2, diag: 2, diag: 3, diag: 4]
  import Loka.Content.Refs, only: [owners: 2, owned: 3]
  alias Loka.Content.Refs

  @effects ~w(status.apply damage light.ignite)
  @bare %{"damage" => "npc", "light.ignite" => "item"}
  @owners %{"damage" => {"events", "entity_died"}, "light.ignite" => {"commands", "ignite"}}

  # A missing or schema-invalid manifest (nil) has its own diagnostics.
  def check(nil, _, _, _), do: []

  def check(m, defs, registry, settings) do
    targets =
      for {_, {rel, [], %{"target" => %{"kind" => "spell"} = t}}} <- defs["recipe"] || %{},
          do: {rel, t}

    effects = effects(defs)

    aimed = Enum.any?(targets, fn {_, t} -> is_map_key(t, "aimed") end)

    floor(
      targets != [] or Map.has_key?(settings, "speech"),
      if(aimed, do: [1, 119], else: [1, 98]),
      m
    ) ++
      shared(targets) ++
      Enum.flat_map(targets, &learned(&1, m, defs)) ++
      placed(effects) ++ bare(effects) ++ unowned(effects, m, registry) ++ phrases(settings, m)
  end

  defp phrases(%{"speech" => _}, %{"requires" => %{"capabilities" => %{"speech" => 1}}}), do: []

  defp phrases(%{"speech" => _}, _),
    do: [
      diag(
        "UNDECLARED_CAPABILITY",
        at("cartridge.json", ["speech", "phrases"]),
        %{"capability" => "speech"},
        ["speech@1"]
      )
    ]

  defp phrases(_, _), do: []

  defp learned({rel, t}, m, defs) do
    bool =
      case Refs.resolve(t["learned"], "fact", m, defs) do
        {_, _, %{"value_type" => %{"type" => type}}} when type != "bool" ->
          [diag("FACT_TYPE_MISMATCH", at(rel, ["target", "learned"]))]

        {_, _, %{"scopes" => ["player"]} = f} when not is_map_key(f, "per_subject") ->
          []

        {_, _, _} ->
          [diag("FACT_SCOPE_UNSUPPORTED", at(rel, ["target", "learned"]))]

        _ ->
          []
      end

    Refs.reference(rel, ["target"], {"learned", "fact"}, t, m, defs) ++ bool
  end

  defp shared(targets) do
    words = Enum.frequencies_by(targets, &elem(&1, 1)["word"])

    for {rel, t} <- targets,
        words[t["word"]] > 1,
        do: diag("DUPLICATE_DEFINITION", at(rel, ["target", "word"]))
  end

  defp effects(defs) do
    for {_, {rel, [], r}} <- defs["recipe"] || %{},
        {name, o} <- r["outcomes"],
        {%{"op" => op} = s, i} <- Enum.with_index(o["sequence"]),
        op in @effects,
        do: {rel, r, ["outcomes", name, "sequence", i, "op"], op, s}
  end

  defp placed(effects) do
    for {rel, r, steps, _, _} <- effects,
        r["target"]["kind"] != "spell",
        do: diag("SCHEMA_VIOLATION", at(rel, steps), %{"error" => "invalid_value"})
  end

  defp bare(effects) do
    for {rel, %{"target" => %{"kind" => "spell"} = t}, steps, op, s} <- effects,
        field = @bare[op],
        field != nil and not is_map_key(t, "aimed") and not is_map_key(s, field),
        path = List.replace_at(steps, -1, field),
        do: diag("SCHEMA_VIOLATION", at(rel, path), %{"error" => "missing_property"})
  end

  defp unowned(effects, m, registry) do
    for {rel, _, steps, op, _} <- effects,
        {field, name} <- [@owners[op]],
        caps = m["requires"]["capabilities"],
        d <- owned(at(rel, steps), name, {caps, owners(registry, [field])}),
        do: d
  end

  defp floor(floored, at_least, m) do
    if floored and api(m) < at_least,
      do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
      else: []
  end

  defp api(m),
    do:
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)
end
