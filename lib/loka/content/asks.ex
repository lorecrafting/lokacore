defmodule Loka.Content.Asks do
  @moduledoc """
  Toolbox row FD7: an NPC's ask names topics of this cartridge, needs speech@1 and topics@1
  (UNDECLARED_CAPABILITY at the ask) and kernel_api 1.96. Twin of
  kernel/ts/src/content/cartridge_asks.ts; the answers' conditions and texts are checked with
  every entity's (Loka.Content.Entities).
  """
  import Loka.Content.Source, only: [diag: 2, diag: 4, at: 2]
  import Loka.Content.Refs, only: [reference: 6]

  # A missing or schema-invalid manifest (nil) has its own diagnostics.
  @spec check(map() | nil, map()) :: [map()]
  def check(nil, _), do: []

  def check(m, defs) do
    asks = for {_, {rel, [], %{"ask" => a}}} <- defs["npc"] || %{}, do: {rel, a}
    Enum.flat_map(asks, &npc(&1, m, defs)) ++ floor(m, asks)
  end

  defp npc({rel, a}, m, defs) do
    owners =
      for c <- ~w(speech topics),
          m["requires"]["capabilities"][c] != 1,
          do: diag("UNDECLARED_CAPABILITY", at(rel, ["ask"]), %{"capability" => c}, ["#{c}@1"])

    owners ++ Enum.flat_map(Enum.with_index(a["answers"]), &refs(&1, rel, m, defs))
  end

  defp refs({x, i}, rel, m, defs) do
    for f <- ~w(topic grants),
        is_map_key(x, f),
        d <- reference(rel, ["ask", "answers", i], {f, "topic"}, x, m, defs),
        do: d
  end

  defp floor(_, []), do: []

  defp floor(m, _) do
    version =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    if version < [1, 96],
      do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
      else: []
  end
end
