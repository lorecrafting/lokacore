defmodule Loka.Content.Keywords do
  @moduledoc """
  Toolbox row G9: a dialogue keyword uses speech@1's spoken event, declares no riddle
  (OUTCOME_MISMATCH at the keyword). Twin of the keyword checks in
  kernel/ts/src/content/cartridge_dialogues.ts.
  """
  import Loka.Content.Source, only: [diag: 2, at: 2]
  import Loka.Content.Refs, only: [owned: 3]

  @doc "The keyword diagnostics of the dialogues in `defs`."
  @spec check(map(), term()) :: [map()]
  def check(defs, events) do
    keyed = for {_, {rel, [], %{"keyword" => _} = d}} <- defs["dialogue"], do: {rel, d}

    Enum.flat_map(keyed, fn {rel, d} ->
      owned(at(rel, ["keyword"]), "spoken", events) ++
        if(d["riddle"], do: [diag("OUTCOME_MISMATCH", at(rel, ["keyword"]))], else: [])
    end)
  end
end
