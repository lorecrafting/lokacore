defmodule Loka.Content.Keywords do
  @moduledoc """
  Toolbox row G9: a dialogue keyword uses speech@1's spoken event, declares no riddle
  (OUTCOME_MISMATCH at the keyword) and needs kernel_api 1.48. Twin of the keyword checks in
  kernel/ts/src/content/cartridge_dialogues.ts.
  """
  import Loka.Content.Source, only: [diag: 2, at: 2]
  import Loka.Content.Refs, only: [owned: 3]

  @doc "The keyword diagnostics of the dialogues in `defs`."
  @spec check(map(), map(), term()) :: [map()]
  def check(m, defs, events) do
    keyed = for {_, {rel, [], %{"keyword" => _} = d}} <- defs["dialogue"], do: {rel, d}

    floor(m, keyed) ++
      Enum.flat_map(keyed, fn {rel, d} ->
        owned(at(rel, ["keyword"]), "spoken", events) ++
          if(d["riddle"], do: [diag("OUTCOME_MISMATCH", at(rel, ["keyword"]))], else: [])
      end)
  end

  defp floor(_, []), do: []

  defp floor(m, _) do
    version =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    if version < [1, 48],
      do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
      else: []
  end
end
