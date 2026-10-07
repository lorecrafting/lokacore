# Required discriminators and declared closed objects are enforced by source compilation.
alias Loka.Core.Contracts.Schema

docs =
  Map.new(Path.wildcard("protocol/*.schema.json"), fn path ->
    {Path.basename(path), path |> File.read!() |> JSON.decode!()}
  end)

Schema.flatten!(docs)

objects = [
  {"cartridge.schema.json", ["$defs", "WorldSettings", "properties", "bell_cue"]},
  {"gameview.schema.json", ["$defs", "NarrationRecord", "properties", "cue"]},
  {"relation.schema.json", ["$defs", "PopulationControl", "properties", "suppression"]},
  {"room.schema.json", ["$defs", "Connection", "properties", "corpse_ingress"]}
]

closed =
  for {file, path} <- objects do
    {file, path, "closed object", &Map.delete(&1, "additionalProperties")}
  end

{_, index} =
  docs["reaction.schema.json"]["$defs"]["ReactionRule"]["properties"]["apply"]["items"]["oneOf"]
  |> Enum.with_index()
  |> Enum.find(fn {row, _} -> row["properties"]["op"]["const"] == "population.suppress" end)

path = ["$defs", "ReactionRule", "properties", "apply", "items", "oneOf", Access.at(index)]

branches = [
  {"reaction.schema.json", path, "closed suppress", &Map.delete(&1, "additionalProperties")},
  {"reaction.schema.json", path, "required suppress discriminator",
   &Map.update!(&1, "required", fn r -> r -- ["op"] end)}
]

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
