defmodule Loka.Content.ScopedFacts do
  @moduledoc """
  Toolbox row W2: a per_subject (entity or pair) fact, or a subject field (npc, item, subject) on a
  fact_compare or fact.assign, needs kernel_api 1.47. Twin of the floor in
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

    if (scoped?(defs["fact"]) or subject?(defs) or subject?(settings)) and api < [1, 47],
      do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least", %{})],
      else: []
  end

  defp scoped?(facts) when is_map(facts),
    do: Enum.any?(facts, &match?({_, {_, _, %{"per_subject" => true}}}, &1))

  defp scoped?(_), do: false

  defp subject?(%{"op" => op} = n) when op in ~w(fact_compare fact.assign),
    do:
      Enum.any?(~w(npc item subject), &is_map_key(n, &1)) or Enum.any?(Map.values(n), &subject?/1)

  defp subject?(v) when is_map(v), do: Enum.any?(Map.values(v), &subject?/1)
  defp subject?(v) when is_list(v), do: Enum.any?(v, &subject?/1)
  defp subject?(v) when is_tuple(v), do: subject?(Tuple.to_list(v))
  defp subject?(_), do: false
end
