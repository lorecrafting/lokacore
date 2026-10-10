defmodule Loka.Content.Cues do
  @moduledoc """
  Toolbox row G6: every declared sense cue (a room's, detail's, item's and its fuel source's,
  NPC's, status's or recipe outcome's) is owned by sense_cue@1 and names a text key, and a cue or
  a cue_perceived leaf needs kernel_api 1.48. Twin of kernel/ts/src/content/cartridge_senses.ts.
  """
  import Loka.Content.Source, only: [diag: 3, at: 2]
  import Loka.Content.Refs, only: [owners: 2, owned: 3]

  @doc "Each cue as `{rel, steps, cue}`."
  @spec located(map()) :: [{String.t(), list(), map()}]
  def located(defs) do
    for {kind, fields} <- [
          {"room", [[]]},
          {"npc", [[]]},
          {"item", [[], ["fuel"]]},
          {"status", [[]]},
          {"recipe", [["outcomes", "success"], ["outcomes", "failure"]]}
        ],
        {_, {rel, steps, d}} <- defs[kind] || %{},
        holder <- fields ++ details(kind, d),
        {cue, i} <- Enum.with_index(Enum.reduce(holder, d, &(&2[&1] || %{}))["cues"] || []),
        do: {rel, steps ++ holder ++ ["cues", i], cue}
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

  # From Checks.rooms/4, a v2 source only; `text` is :unknown when the catalog was rejected. A
  # missing or schema-invalid manifest (nil) has its own diagnostics.
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
    end) ++ floor(m, cues != [] or perceives?(defs))
  end

  defp floor(m, true) do
    api =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    if api < [1, 48],
      do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least", %{})],
      else: []
  end

  defp floor(_, false), do: []

  defp perceives?(%{"op" => "cue_perceived"}), do: true
  defp perceives?(v) when is_map(v), do: Enum.any?(Map.values(v), &perceives?/1)
  defp perceives?(v) when is_list(v), do: Enum.any?(v, &perceives?/1)
  defp perceives?(v) when is_tuple(v), do: perceives?(Tuple.to_list(v))
  defp perceives?(_), do: false
end
