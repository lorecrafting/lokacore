defmodule Loka.Content.Dialogues do
  @moduledoc """
  Dialogues in a v2 source (dialogue.schema.json DialogueDefinition; 06 §8, §17, §33), twin of
  `kernel/ts/src/cartridge_dialogues.ts`: each dialogue's owner (dialogue@1) and each
  fact.assign's (fact@1, by its fact_changed) is required; its key is no registered command's,
  action's, recipe's or quest's (DUPLICATE_DEFINITION: its talk is an ActionSet identity); its
  prompt, labels and narrations have catalog entries (unless the catalog was rejected,
  `:unknown`); its speaker, roles and quest name an NPC, item or quest of this cartridge; its
  speaker is one of its npc roles (else UNRESOLVED_REFERENCE at npc); no role is named actor
  (DUPLICATE_DEFINITION); it has a choice (SCHEMA_VIOLATION too_few_items: the subset has no
  minProperties); each hand_over gives an item role to an npc role (else UNRESOLVED_REFERENCE);
  each fact.assign names a fact with a value of its type. Its policy tree is checked with every
  other (`conditions/1`, `Loka.Content.Checks`).
  """
  import Loka.Content.Source, only: [diag: 2, diag: 3, at: 2]
  import Loka.Content.Refs, only: [commands: 0, owners: 2, owned: 3, reference: 6]

  @doc "Each schema-valid dialogue's policy root, as `{rel, steps, root}`."
  @spec conditions(map()) :: [{String.t(), list(), map()}]
  def conditions(defs),
    do: for({rel, d} <- all(defs), do: {rel, ["policy", "root"], d["policy"]["root"]})

  defp all(defs), do: for({_, {rel, [], d}} <- defs["dialogue"], do: {rel, d})

  @doc "Diagnostics for the schema-valid dialogues of a v2 source with a valid manifest (else none)."
  @spec check(map() | nil, map(), {term(), map() | :unknown} | nil, [map()]) :: [map()]
  def check(m, _, v2, _) when m == nil or v2 == nil, do: []

  def check(m, defs, {_, text}, registry) do
    caps = m["requires"]["capabilities"]
    keys = for kind <- ~w(action recipe quest), {_, {_, [], d}} <- defs[kind], do: d["key"]

    ctx = %{
      m: m,
      defs: defs,
      text: text,
      taken: MapSet.new(commands() ++ keys),
      kinds: {caps, owners(registry, ["definitions"])},
      events: {caps, owners(registry, ["events"])}
    }

    Enum.flat_map(all(defs), &dialogue(&1, ctx))
  end

  defp dialogue({rel, d}, ctx) do
    duplicate =
      if d["key"] in ctx.taken, do: [diag("DUPLICATE_DEFINITION", at(rel, []))], else: []

    speaker = Enum.any?(d["roles"], fn {_, r} -> r == %{"role" => "npc", "npc" => d["npc"]} end)

    target =
      "#{d["npc"]["cartridge_id"]}@#{d["npc"]["cartridge_version"]}:#{d["npc"]["kind"]}/#{d["npc"]["key"]}"

    owned(at(rel, []), "dialogue", ctx.kinds) ++
      duplicate ++
      texts(rel, [{["prompt"], d["prompt"]}], ctx.text) ++
      reference(rel, [], "npc", d, ctx.m, ctx.defs) ++
      if(d["quest"], do: reference(rel, [], "quest", d, ctx.m, ctx.defs), else: []) ++
      Enum.flat_map(d["roles"], &role(rel, &1, ctx)) ++
      if(speaker,
        do: [],
        else: [diag("UNRESOLVED_REFERENCE", at(rel, ["npc"]), %{"target" => target})]
      ) ++
      if(d["choices"] == %{},
        do: [diag("SCHEMA_VIOLATION", at(rel, ["choices"]), %{"error" => "too_few_items"})],
        else: []
      ) ++
      Enum.flat_map(d["choices"], &choice(rel, &1, d["roles"], ctx))
  end

  defp role(rel, {name, %{"role" => kind} = r}, ctx) do
    actor =
      if name == "actor",
        do: [diag("DUPLICATE_DEFINITION", at(rel, ["roles", "actor"]))],
        else: []

    actor ++ reference(rel, ["roles", name], kind, r, ctx.m, ctx.defs)
  end

  defp choice(rel, {id, o}, roles, ctx) do
    steps = ["choices", id]

    texts(
      rel,
      [{steps ++ ["label"], o["label"]}, {steps ++ ["narration"], o["narration"]}],
      ctx.text
    ) ++
      Enum.flat_map(Enum.with_index(Map.get(o, "sequence", [])), fn {s, i} ->
        owned(at(rel, steps ++ ["sequence", i, "op"]), "fact_changed", ctx.events) ++
          reference(rel, steps ++ ["sequence", i], "fact", s, ctx.m, ctx.defs)
      end) ++
      hand_over(rel, steps, o["hand_over"], roles)
  end

  defp hand_over(_, _, nil, _), do: []

  defp hand_over(rel, steps, h, roles) do
    for {field, kind} <- [{"item", "item"}, {"to", "npc"}],
        not match?(%{"role" => ^kind}, roles[h[field]]),
        do:
          diag("UNRESOLVED_REFERENCE", at(rel, steps ++ ["hand_over", field]), %{
            "target" => h[field]
          })
  end

  defp texts(_, _, :unknown), do: []

  defp texts(rel, pairs, text) do
    for {steps, key} <- pairs,
        not is_map_key(text, key),
        do: diag("UNRESOLVED_REFERENCE", at(rel, steps), %{"target" => key})
  end
end
