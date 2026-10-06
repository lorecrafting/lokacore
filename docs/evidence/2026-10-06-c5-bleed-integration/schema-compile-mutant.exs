alias Loka.Core.Contracts.Schema

docs =
  Path.wildcard("protocol/*.schema.json")
  |> Map.new(fn path -> {Path.basename(path), path |> File.read!() |> JSON.decode!()} end)

name = "delta.schema.json"
doc = docs[name]
branches = get_in(doc, ["$defs", "BleedRow", "oneOf"])
first = hd(branches)
mutated = put_in(first, ["required"], Enum.reject(first["required"], &(&1 == "active")))
docs = put_in(docs, [name, "$defs", "BleedRow", "oneOf"], [mutated | tl(branches)])

try do
  Schema.flatten!(docs)
  raise "mutant survived"
rescue
  e in ArgumentError ->
    if String.contains?(
         Exception.message(e),
         "every branch needs the same one required const property"
       ),
       do: IO.puts("compile mutant rejected missing BleedRow discriminator"),
       else: reraise(e, __STACKTRACE__)
end
