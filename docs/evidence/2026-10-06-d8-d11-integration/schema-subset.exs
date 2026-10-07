# Required discriminators and declared closed objects are enforced by source compilation.
alias Loka.Core.Contracts.Schema

docs =
  Map.new(Path.wildcard("protocol/*.schema.json"), fn path ->
    {Path.basename(path), path |> File.read!() |> JSON.decode!()}
  end)

Schema.flatten!(docs)
scavenge = ["$defs", "PopulationPlan", "properties", "scavenge"]

objects = [
  {"relation.schema.json", ["$defs", "CrowTransport"]},
  {"cartridge.schema.json", scavenge},
  {"cartridge.schema.json", scavenge ++ ["properties", "narration"]}
]

closed =
  for {file, path} <- objects do
    {file, path, "closed object", &Map.delete(&1, "additionalProperties")}
  end

variants = [
  {"command.schema.json", "CommandPayload", "type", "shoo"},
  {"event.schema.json", "EventPayload", "type", "shooed"},
  {"delta.schema.json", "DeltaOp", "op", "crow.transition"},
  {"delta.schema.json", "MutationTarget", "kind", "crow"}
]

branches =
  for {file, contract, tag, value} <- variants,
      {row, index} <- Enum.with_index(get_in(docs[file], ["$defs", contract, "oneOf"])),
      get_in(row, ["properties", tag, "const"]) == value do
    path = ["$defs", contract, "oneOf", Access.at(index)]

    [
      {file, path, "closed " <> value, &Map.delete(&1, "additionalProperties")},
      {file, path, "required discriminator " <> value,
       &Map.update!(&1, "required", fn r -> r -- [tag] end)}
    ]
  end

mutants = closed ++ List.flatten(branches)

for {file, path, label, edit} <- mutants do
  changed = update_in(docs, [file | path], edit)

  rejected =
    try do
      Schema.flatten!(changed)
      false
    rescue
      ArgumentError -> true
    end

  unless rejected, do: raise("survived source schema mutant: " <> label)
  IO.puts("SCHEMA REJECTED " <> label)
end

IO.puts("source subset mutants: #{length(mutants)}; survived: 0")
