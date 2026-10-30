defmodule Loka.Content.Emotes do
  @moduledoc "NPC emotes (G9, emote@1; cartridge.md Emote declarations): each emote is owned by emote@1 and its text keys are in the catalog."
  import Loka.Content.Source, only: [at: 2, diag: 3]
  import Loka.Content.Refs, only: [owned: 3, owners: 2]

  def check(_, _, nil, _), do: []

  def check(m, defs, {_, text}, registry) do
    required = {m["requires"]["capabilities"], owners(registry, ["definitions"])}

    for {_, {rel, [], e}} <- defs["emote"] || %{},
        d <- owned(rel, "emote", required) ++ texts(rel, e, text),
        do: d
  end

  defp texts(rel, e, text) do
    keys = [{["others"], e["others"]} | for({f, k} <- e["to"] || %{}, do: {["to", f], k})]

    for {path, k} <- keys,
        text != :unknown and not is_map_key(text, k),
        do: diag("UNRESOLVED_REFERENCE", at(rel, path), %{"target" => k})
  end
end
