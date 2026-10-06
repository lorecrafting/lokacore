defmodule Loka.Content.Artifact do
  @moduledoc """
  Builds the CompiledCartridge (05 §8) from the parts the compiler's stages accepted: the
  manifest and its lock, each definition map keyed by DefinitionRefString, and, in v2, the
  entry, text, default pools and cartridge.json's calendar and world.
  """
  alias Loka.Content.Resources

  @doc "The cartridge, v2 when `v2` is its {entry, text}, with cartridge.json's calendar and world."
  @spec cartridge(map(), map(), {term(), map()} | nil, {term(), map()}) :: map()
  def cartridge(m, defs, v2, {_, settings}), do: Map.merge(cartridge(m, defs, v2), settings)

  defp cartridge(m, defs, nil) do
    %{
      "format" => "loka-cartridge-v1",
      "manifest" => m,
      "lock" => %{
        "format" => "loka-capability-lock-v1",
        "capabilities" => m["requires"]["capabilities"]
      },
      "facts" => keyed(m, "fact", defs),
      "policies" => keyed(m, "policy", defs),
      "actions" => keyed(m, "action", defs)
    }
  end

  # items, npcs, recipes, barriers, quests, reactions, dialogues, story points and attributes are optional maps (CompiledCartridge): absent when empty. The
  # default pools are always there, with resource@1 (Resources).
  defp cartridge(m, defs, {entry, text}) do
    m = Resources.requires(m)

    optional =
      for k <-
            ~w(item npc recipe barrier quest reaction dialogue story_point scene attribute skill topic liquid service transport population population_bundle bleed),
          defs[k] != %{},
          into: %{},
          do:
            {if(k == "population_bundle", do: "population_bundles", else: k <> "s"),
             keyed(m, k, defs)}

    cartridge(m, defs, nil)
    |> Map.merge(%{"format" => "loka-cartridge-v2", "rooms" => keyed(m, "room", defs)})
    |> Map.merge(%{"entry" => entry, "text" => text, "resources" => keyed(m, "resource", defs)})
    |> Map.merge(optional)
  end

  defp keyed(m, kind, defs),
    do:
      Map.new(defs[kind], fn {key, {_, _, v}} ->
        {"#{m["id"]}@#{m["version"]}:#{kind}/#{key}", v}
      end)
end
