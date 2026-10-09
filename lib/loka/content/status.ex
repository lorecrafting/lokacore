defmodule Loka.Content.Status do
  @moduledoc "Checks toolbox row 1 status declarations, their appliers and the foods that cure them."
  import Loka.Content.Source, only: [at: 2, diag: 2]
  alias Loka.Content.Refs

  def check(nil, _, _), do: []
  def check(_, _, nil), do: []

  def check(m, defs, {_, text}) do
    statuses = defs["status"] || %{}

    cures =
      for {_, {rel, _, i}} <- defs["item"],
          cures = get_in(i, ["edible", "cures"]),
          cures,
          do: {rel, cures}

    if statuses == %{} and cures == [],
      do: [],
      else: gate(m) ++ values(statuses, m, defs, text) ++ foods(cures, m, defs)
  end

  defp gate(m) do
    [major, minor] =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    if major > 1 or (major == 1 and minor >= 38),
      do: [],
      else: [diag("KERNEL_API_RANGE_INVALID", at("cartridge.json", ["requires", "kernel_api"]))]
  end

  defp values(statuses, m, defs, text) do
    for {_, {rel, _, s}} <- statuses, d <- status(rel, s, m, defs, text), do: d
  end

  defp status(rel, s, m, defs, text) do
    keys = [s["label"] | Map.values(s["narration"] || %{})]

    Refs.reference(rel, [], "resource", s, m, defs) ++
      if(s["tick_every"] >= s["duration"],
        do: [diag("SCHEMA_VIOLATION", at(rel, ["tick_every"]))],
        else: []
      ) ++
      if(s["per_tick"] == 0, do: [diag("SCHEMA_VIOLATION", at(rel, ["per_tick"]))], else: []) ++
      if(text == :unknown or Enum.all?(keys, &Map.has_key?(text, &1)),
        do: [],
        else: [diag("SCHEMA_VIOLATION", at(rel, ["narration"]))]
      )
  end

  defp foods(cures, m, defs) do
    for {rel, list} <- cures,
        {s, i} <- Enum.with_index(list),
        Refs.resolve(s, "status", m, defs) == :unresolved,
        do: diag("UNRESOLVED_REFERENCE", at(rel, ["edible", "cures", i]))
  end
end
