defmodule Loka.Content.ScopedFacts do
  @moduledoc """
  Toolbox row W2: a per_subject (entity or pair) fact, or a subject field (npc, item, subject) on a
  fact_compare, fact.assign or fact.adjust, needs kernel_api 1.47; row FD4: an npc_pair fact, or a
  `with` field there, needs 1.89. Twin of the floors in
  kernel/ts/src/content/cartridge_scoped_facts.ts; where such a fact may be named is checked by
  the loader only (FACT_SCOPE_UNSUPPORTED).
  """
  import Loka.Content.Source, only: [diag: 3]

  # A missing or schema-invalid manifest (nil) has its own diagnostics.
  def check(nil, _, _), do: []

  def check(m, defs, {_, settings}) do
    api =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    w2 =
      declares?(defs["fact"], "per_subject") or named?(defs, :subject) or
        named?(settings, :subject)

    fd4 = declares?(defs["fact"], "npc_pair") or named?(defs, :with) or named?(settings, :with)

    if (w2 and api < [1, 47]) or (fd4 and api < [1, 89]),
      do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least", %{})],
      else: []
  end

  defp declares?(facts, flag) when is_map(facts),
    do: Enum.any?(facts, &match?({_, {_, _, %{^flag => true}}}, &1))

  defp declares?(_, _), do: false

  # A subject field: npc or item, and subject on a fact_compare only (as the loader's fieldsOf).
  defp fields(:subject, "fact_compare"), do: ~w(npc item subject)
  defp fields(:subject, _), do: ~w(npc item)
  defp fields(:with, _), do: ["with"]

  defp named?(%{"op" => op} = n, f) when op in ~w(fact_compare fact.assign fact.adjust),
    do: Enum.any?(fields(f, op), &is_map_key(n, &1)) or Enum.any?(Map.values(n), &named?(&1, f))

  defp named?(v, f) when is_map(v), do: Enum.any?(Map.values(v), &named?(&1, f))
  defp named?(v, f) when is_list(v), do: Enum.any?(v, &named?(&1, f))
  defp named?(v, f) when is_tuple(v), do: named?(Tuple.to_list(v), f)
  defp named?(_, _), do: false
end
