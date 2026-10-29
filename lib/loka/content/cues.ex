defmodule Loka.Content.Cues do
  @moduledoc """
  Toolbox row G6: every declared sense cue (a room's, detail's, item's and its fuel source's,
  NPC's, status's or recipe outcome's) is owned by sense_cue@1 and names a text key.
  """
  import Loka.Content.Source, only: [diag: 3, at: 2]
  import Loka.Content.Refs, only: [owners: 2, owned: 3]

  @holders [
    {"room", [[]]},
    {"npc", [[]]},
    {"item", [[], ["fuel"]]},
    {"status", [[]]},
    {"recipe", [["outcomes", "success"], ["outcomes", "failure"]]}
  ]

  @doc "Each cue as `{rel, steps, cue}`."
  @spec located(map()) :: [{String.t(), list(), map()}]
  def located(defs) do
    for {kind, fields} <- @holders,
        {_, {rel, steps, d}} <- defs[kind] || %{},
        {path, cue} <- cues(d, fields ++ details(kind, d)),
        do: {rel, steps ++ path, cue}
  end

  # Each cue of definition `d` under one of its holder paths, with its path in `d`.
  defp cues(d, holders) do
    for holder <- holders,
        {cue, i} <- Enum.with_index(Enum.reduce(holder, d, &(&2[&1] || %{}))["cues"] || []),
        do: {holder ++ ["cues", i], cue}
  end

  defp details("room", r), do: for({k, _} <- Map.get(r, "details", %{}), do: ["details", k])
  defp details(_, _), do: []

  @doc "Each cue's condition, as `{rel, steps, root}`."
  @spec conditions(map()) :: [{String.t(), list(), map()}]
  def conditions(defs),
    do:
      for(
        {rel, steps, %{"when" => w}} <- located(defs),
        do: {rel, steps ++ ["when", "root"], w["root"]}
      )

  # From Checks.rooms/4, a v2 source only; `text` is :unknown when the catalog was rejected. A missing or schema-invalid manifest (nil)
  # has its own diagnostics.
  def check(nil, _, _, _), do: []

  def check(m, defs, text, registry) do
    cues = located(defs)
    required = {m["requires"]["capabilities"], owners(registry, ["definitions"])}

    Enum.flat_map(cues, fn {rel, steps, cue} ->
      owned(at(rel, steps), "cue", required) ++
        if text == :unknown or is_map_key(text, cue["text"]),
          do: [],
          else: [
            diag("UNRESOLVED_REFERENCE", at(rel, steps ++ ["text"]), %{"target" => cue["text"]})
          ]
    end)
  end
end
