defmodule Loka.Content.Spells do
  @moduledoc """
  Toolbox row 29a: a spell recipe target needs kernel_api 1.51 (one diagnostic), and no two spells
  share a word (DUPLICATE_DEFINITION at each one's word). Twin of spells/1 in
  kernel/ts/src/content/cartridge_recipes.ts.
  """
  import Loka.Content.Source, only: [at: 2, diag: 2]

  # A missing or schema-invalid manifest (nil) has its own diagnostics.
  def check(nil, _), do: []

  def check(m, defs) do
    spells =
      for {_, {rel, [], %{"target" => %{"kind" => "spell"}} = r}} <- defs["recipe"] || %{},
          do: {rel, r["target"]["word"]}

    words = Enum.frequencies_by(spells, &elem(&1, 1))

    shared =
      for {rel, w} <- spells,
          words[w] > 1,
          do: diag("DUPLICATE_DEFINITION", at(rel, ["target", "word"]))

    if spells != [] and api(m) < [1, 51], do: [floor() | shared], else: shared
  end

  defp floor, do: diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")

  defp api(m),
    do:
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)
end
