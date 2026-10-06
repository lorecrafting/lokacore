defmodule Loka.Content.Liquids do
  @moduledoc "Liquid references, initial contents and checked maximum effective vessel mass."
  import Loka.Content.Source, only: [at: 2, diag: 2, diag: 3, diag: 4]
  import Loka.Content.Refs, only: [reference: 6]

  @spec check(map() | nil, map(), {term(), map() | :unknown} | nil) :: [map()]
  def check(nil, _, _), do: []
  def check(_, _, nil), do: []

  def check(m, defs, {_, text}) do
    declarations = declarations(defs)
    vessels = vessels(defs)
    sources = sources(defs)
    opted = Enum.any?([declarations, vessels, sources], &(&1 != []))

    if(opted, do: requirements(m), else: []) ++
      liquid_texts(declarations, text) ++
      Enum.flat_map(vessels, fn {rel, i, v} -> vessel(rel, i, v, m, defs, text) end) ++
      source_refs(sources, m, defs)
  end

  defp liquid_texts(declarations, text),
    do:
      Enum.flat_map(declarations, fn {rel, steps, d} ->
        texts(rel, steps, d, ~w(label unit_label), text)
      end)

  defp declarations(defs), do: for({_, {rel, [], d}} <- defs["liquid"], do: {rel, [], d})

  defp vessels(defs),
    do: for({_, {rel, [], %{"vessel" => v} = i}} <- defs["item"], do: {rel, i, v})

  defp sources(defs),
    do:
      for(
        {_, {rel, [], r}} <- defs["room"],
        {key, %{"liquid_source" => _} = d} <- Map.get(r, "details", %{}),
        do: {rel, ["details", key], d}
      )

  defp source_refs(sources, m, defs),
    do:
      for(
        {rel, steps, d} <- sources,
        error <- reference(rel, steps, {"liquid_source", "liquid"}, d, m, defs),
        do: error
      )

  defp vessel(rel, item, v, m, defs, text) do
    row = v["initial"]

    shape =
      if row["kind"] == nil == (row["quantity"] == 0) and row["quantity"] <= v["capacity"],
        do: [],
        else: [bad(at(rel, ["vessel", "initial"]))]

    refs =
      if row["kind"] == nil,
        do: [],
        else: reference(rel, ["vessel", "initial"], {"kind", "liquid"}, row, m, defs)

    shape ++ refs ++ mass(rel, item, v, defs) ++ texts(rel, ["vessel"], v, ["unit_label"], text)
  end

  defp mass(rel, item, v, defs) do
    if is_integer(item["mass_grams"]),
      do:
        for(
          {_, {_, _, liquid}} <- defs["liquid"],
          item["mass_grams"] + v["capacity"] * liquid["grams_per_unit"] > 2_147_483_647,
          do: bad(at(rel, ["vessel", "capacity"]))
        ),
      else: [bad(at(rel, ["mass_grams"]))]
  end

  defp texts(_, _, _, _, :unknown), do: []

  defp texts(rel, steps, d, fields, text),
    do:
      for(
        field <- fields,
        not is_map_key(text, d[field]),
        do: diag("UNRESOLVED_REFERENCE", at(rel, steps ++ [field]), %{"target" => d[field]})
      )

  defp requirements(m) do
    version =
      m["requires"]["kernel_api"]["at_least"]
      |> String.split(".")
      |> Enum.map(&String.to_integer/1)

    if(version < [1, 19],
      do: [diag("KERNEL_API_RANGE_INVALID", "cartridge.requires.kernel_api.at_least")],
      else: []
    ) ++
      if m["requires"]["capabilities"]["liquid"] == 1,
        do: [],
        else: [
          diag(
            "UNDECLARED_CAPABILITY",
            "cartridge.requires.capabilities.liquid",
            %{"capability" => "liquid"},
            ["liquid@1"]
          )
        ]
  end

  defp bad(path), do: diag("SCHEMA_VIOLATION", path, %{"error" => "invalid_value"})
end
