# Where a System graph contract lives outside protocol/ (bin/system_graph.exs joins these): the State
# sections a DeltaOp writes it into as a row, and the authored cartridge files of the
# CompiledCartridge map that holds it.
defmodule SystemGraph.Homes do
  # A row, and the payloads saved with it: an entity's identity, a choice's attempts and role bindings.
  @rows ~w(value expected from to identity attempts roles bindings)

  # Contract => the State sections (`ops`: DeltaOp => section, docs/state-sections.gen.json) whose
  # ops write it as their row or a payload saved with it (@rows). `row?` drops scalars (ids, times,
  # counts), which sit in many rows.
  @spec saved(map(), map(), (String.t() -> boolean())) :: %{String.t() => [String.t()]}
  def saved(defs, ops, row?) do
    for %{"properties" => p} <- defs["DeltaOp"]["oneOf"],
        section = ops[p["op"]["const"]],
        to <- rows(p),
        row?.(to),
        uniq: true do
      {to, section}
    end
    |> Enum.group_by(&elem(&1, 0), &elem(&1, 1))
    |> Map.new(fn {to, sections} -> {to, Enum.sort(sections)} end)
  end

  defp rows(properties), do: Enum.flat_map(Map.take(properties, @rows), fn {_, s} -> ref(s) end)

  # A row field is a $ref, anyOf null and a $ref (`expected`) or an array of them (`roles`).
  defp ref(%{"$ref" => r}), do: [r]
  defp ref(%{"items" => i}), do: ref(i)
  defp ref(%{"anyOf" => bs}), do: Enum.flat_map(bs, &ref/1)
  defp ref(_), do: []

  # Contract => the authored files of the map holding it (`rooms` => RoomDefinition): a directory
  # `cartridges/*/rooms/*.json` or one file `cartridges/*/facts.json`.
  @spec authored(String.t(), map()) :: %{String.t() => [String.t()]}
  def authored(root, defs) do
    for b <- defs["CompiledCartridge"]["oneOf"],
        {map, %{"additionalProperties" => %{"$ref" => r}}} <- b["properties"],
        uniq: true,
        into: %{} do
      files =
        for g <- ["*/#{map}/*.json", "*/#{map}.json"], do: Path.join([root, "cartridges", g])

      {r,
       files
       |> Enum.flat_map(&Path.wildcard/1)
       |> Enum.map(&Path.relative_to(&1, root))
       |> Enum.sort()}
    end
  end

  # docs/state-sections.gen.json's kinds (kernel/ts/test/state_sections.test.ts): MutationTarget kind
  # => State section, turned into the sections a state_row holds and the kinds kept in each.
  @spec state_sections(map()) :: [map()]
  def state_sections(kinds) do
    kinds
    |> Enum.group_by(&elem(&1, 1), &elem(&1, 0))
    |> Enum.map(fn {section, kinds} -> %{"section" => section, "targets" => Enum.sort(kinds)} end)
    |> Enum.sort_by(& &1["section"])
  end
end
