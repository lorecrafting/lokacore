# Red controls plant violations, require checks to fail, and clean their own files.
# Refuse occupied paths before planting; exclusive creation closes the race. AST: ast-grep test.
root = Path.expand("..", __DIR__)

verdict = fn
  name, true, _ ->
    IO.puts("ok   #{name}")
    0

  name, false, detail ->
    IO.puts("FAIL #{name}: #{detail}")
    1
end

# A throwaway copy under the system temp dir: the real file is never edited.
tmp = &Path.join(System.tmp_dir!(), "loka-red-#{&1}-#{System.unique_integer([:positive])}#{&2}")

registry = JSON.decode!(File.read!(Path.join(root, "protocol/capability_registry.json")))
rows = JSON.decode!(File.read!(Path.join(root, "docs/features.json")))

unimplemented =
  Enum.find(registry, fn entry ->
    row = rows[entry["key"]] || %{}
    rule = "kernel/ts/src/mechanics/#{entry["key"]}/rule.ts"

    not File.exists?(Path.join(root, rule)) and not Map.has_key?(row, "implemented_in") and
      not Map.has_key?(row, "spec")
  end) || raise("no unimplemented capability for feature red control")

ruleless =
  Enum.find(registry, fn entry ->
    row = rows[entry["key"]] || %{}
    rule = "kernel/ts/src/mechanics/#{entry["key"]}/rule.ts"

    (entry["commands"] || []) == [] and not File.exists?(Path.join(root, rule)) and
      not Map.has_key?(row, "implemented_in") and not Map.has_key?(row, "spec")
  end) || raise("no unimplemented ruleless capability for feature red control")

controls = [
  {"boundary: web reaches store (only platform may)",
   %{
     "lib/loka_web/red_control.ex" =>
       "defmodule LokaWeb.RedControl do\n  def x, do: Loka.Store.__info__(:module)\nend\n"
   }, ~w(mix compile --warnings-as-errors --force), "forbidden reference to Loka.Store"},
  {"boundary: core calls an undeclared external app",
   %{
     "lib/loka/core/red_control.ex" =>
       "defmodule Loka.Core.RedControl do\n  def x, do: Logger.flush()\nend\n"
   }, ~w(mix compile --warnings-as-errors --force), "forbidden reference to Logger"},
  {"types: a PartyId where a CharacterId is matched (03 §6)",
   %{
     "lib/loka/core/red_control.ex" =>
       "defmodule Loka.Core.RedControl do\n  def scope({:character_id, id}), do: id\n  def x(v) do\n    {:ok, p} = Loka.Core.Contracts.party_id(v)\n    scope(p)\n  end\nend\n"
   }, ~w(mix compile --warnings-as-errors --force), "incompatible types given to scope/1"},
  {"xref: dependency cycle",
   %{
     "lib/loka/content/red_control_a.ex" =>
       "defmodule Loka.Content.RedA do\n  def a, do: Loka.Content.RedB.b()\nend\n",
     "lib/loka/content/red_control_b.ex" =>
       "defmodule Loka.Content.RedB do\n  def b, do: Loka.Content.RedA.a()\nend\n"
   }, ~w(mix xref graph --format cycles --fail-above 0), "Too many cycles"},
  {"xref: compile-connected edge",
   %{
     "lib/loka/content/red_control_x.ex" =>
       "defmodule Loka.Content.RedX do\n  def a, do: Loka.Content.RedZ.c()\nend\n",
     "lib/loka/content/red_control_y.ex" =>
       "defmodule Loka.Content.RedY do\n  @x Loka.Content.RedX.a()\n  def b, do: @x\nend\n",
     "lib/loka/content/red_control_z.ex" =>
       "defmodule Loka.Content.RedZ do\n  def c, do: :ok\nend\n"
   }, ~w(mix xref graph --label compile-connected --fail-above 0), "Too many references"},
  {"credo: cyclomatic complexity 10",
   %{
     "lib/loka/content/red_control_c.ex" =>
       "defmodule Loka.Content.RedC do\n  def c(x) do\n    case x do\n" <>
         Enum.map_join(1..8, &"      #{&1} -> :a\n") <> "      _ -> :b\n    end\n  end\nend\n"
   }, ~w(mix credo --strict --verbose), "[Credo.Check.Refactor.CyclomaticComplexity]"},
  {"credo: nesting 3",
   %{
     "lib/loka/content/red_control_n.ex" =>
       "defmodule Loka.Content.RedN do\n  def n(a, b, c) do\n    if a do\n      if b do\n        if c, do: :x\n      end\n    end\n  end\nend\n"
   }, ~w(mix credo --strict --verbose), "[Credo.Check.Refactor.Nesting]"},
  {"credo: ABC size 31",
   %{
     "lib/loka/content/red_control_abc.ex" =>
       "defmodule Loka.Content.RedAbc do\n  def a, do: [#{Enum.map_join(1..31, ", ", &"f#{&1}()")}]\nend\n"
   }, ~w(mix credo --strict --verbose), "[Credo.Check.Refactor.ABCSize]"},
  {"credo: arity 7",
   %{
     "lib/loka/content/red_control_ar.ex" =>
       "defmodule Loka.Content.RedAr do\n  def r(a, b, c, d, e, f, g), do: {a, b, c, d, e, f, g}\nend\n"
   }, ~w(mix credo --strict --verbose), "[Credo.Check.Refactor.FunctionArity]"},
  {"contracts: schema changed without regenerating the TypeScript",
   %{"protocol/red_control.schema.json" => ~s({"$defs": {"RedControl": {"type": "null"}}})},
   ~w(elixir bin/contracts.exs --check), "contracts.gen.ts is out of date"},
  {"contracts: schema changed without regenerating the docs",
   %{"protocol/red_control.schema.json" => ~s({"$defs": {"RedControl": {"type": "null"}}})},
   ~w(elixir bin/contracts.exs --check), "docs/contracts.gen.md is out of date"},
  {"contracts: schema changed without regenerating the System graph",
   %{"protocol/red_control.schema.json" => ~s({"$defs": {"RedControl": {"type": "null"}}})},
   ~w(elixir bin/contracts.exs --check), "docs/system-graph.gen.json is out of date"},
  {"contracts: unsupported keyword fails compilation",
   %{
     "protocol/red_control.schema.json" =>
       ~s({"$defs": {"RedControl": {"type": "string", "format": "uuid"}}})
   }, ~w(mix compile --warnings-as-errors --force), "unsupported keyword format"},
  {"contracts: unsupported keyword fails generation",
   %{
     "protocol/red_control.schema.json" =>
       ~s({"$defs": {"RedControl": {"type": "string", "format": "uuid"}}})
   }, ~w(elixir bin/contracts.exs --check), "unsupported keyword format"},
  {"contracts: a map with declared properties fails compilation",
   %{
     "protocol/red_control.schema.json" =>
       ~s({"$defs": {"RedControl": {"type": "object", "properties": {}, "additionalProperties": {"type": "null"}}}})
   }, ~w(mix compile --warnings-as-errors --force), "RedControl/type: invalid"},
  {"contracts: anyOf with overlapping types fails compilation",
   %{
     "protocol/red_control.schema.json" =>
       ~s({"$defs": {"RedControl": {"anyOf": [{"type": "string"}, {"type": "string"}]}}})
   }, ~w(mix compile --warnings-as-errors --force), "RedControl/anyOf: invalid"},
  {"features: a capability implemented without its feature map cells",
   %{"kernel/ts/src/mechanics/#{unimplemented["key"]}/rule.ts" => "export {};\n"},
   ~w(elixir bin/features.exs --check),
   "#{unimplemented["key"]}@#{unimplemented["version"]}: missing spec"},
  {"features: a ruleless capability implemented without its feature map cells",
   %{
     "tmp/red-features.json" =>
       JSON.encode!(Map.put(rows, ruleless["key"], %{"implemented_in" => "planted"}))
   }, ~w(elixir bin/features.exs --check tmp/red-features.json),
   "#{ruleless["key"]}@#{ruleless["version"]}: missing spec"},
  {"features: a transcript added without regenerating the feature map",
   %{"cartridges/ashmere_details/transcripts/skills.jsonl" => ""},
   ~w(elixir bin/features.exs --check), "docs/features.gen.md is out of date"}
]

for {_, files, _, _} <- controls, {rel, _} <- files do
  if File.exists?(Path.join(root, rel)),
    do: raise("refusing to overwrite red-control file: #{rel}")
end

failures =
  for {name, files, [cmd | args], expected} <- controls, reduce: 0 do
    acc ->
      paths =
        Enum.map(files, fn {rel, body} ->
          path = Path.join(root, rel)
          File.mkdir_p!(Path.dirname(path))
          tap(path, &File.write!(&1, body, [:exclusive]))
        end)

      {out, status} =
        try do
          System.cmd(cmd, args, cd: root, stderr_to_stdout: true)
        after
          Enum.each(paths, &File.rm!/1)
          Enum.each(paths, &File.rmdir(Path.dirname(&1)))
        end

      ok? = status != 0 and String.contains?(out, expected)
      acc + verdict.(name, ok?, "exit #{status}, expected #{inspect(expected)}\n#{out}")
  end

# Docs budget: a padded copy of AGENTS.md (never the real file) must fail check_docs.
padded = tmp.("agents", ".md")

File.write!(
  padded,
  File.read!(Path.join(root, "AGENTS.md")) <> String.duplicate("padding ", 3000)
)

{out, status} =
  try do
    System.cmd("elixir", ["bin/check_docs.exs", padded], cd: root, stderr_to_stdout: true)
  after
    File.rm(padded)
  end

failures =
  failures +
    verdict.(
      "docs: AGENTS.md over its word budget",
      status != 0 and String.contains?(out, "AGENTS.md is "),
      "exit #{status}\n#{out}"
    )

# ADR-074 trigger: a registry copy (never the real file) giving a portable_capability an
# Elixir host adapter without a differential, or with a declared but absent one, must fail
# contracts --check with the ADR-074 diagnostic for each.
registry = tmp.("registry", ".json")

entry =
  &~s({"key": "#{&1}", "version": 1, "portability": "portable", "residency": "portable_capability", "host_adapters": ["elixir"]#{&2}})

File.write!(
  registry,
  "[#{entry.("movement", "")}, #{entry.("barrier", ~s(, "differential": "test/loka/core/absent_test.exs"))}]"
)

{out, status} =
  try do
    System.cmd("elixir", ["bin/contracts.exs", "--check", registry],
      cd: root,
      stderr_to_stdout: true
    )
  after
    File.rm(registry)
  end

failures =
  failures +
    verdict.(
      "contracts: elixir host adapter without a differential (ADR-074)",
      status != 0 and
        Enum.all?(~w(movement@1 barrier@1), &String.contains?(out, "#{&1}: elixir host adapter")),
      "exit #{status}\n#{out}"
    )

{size_out, size_status} =
  System.cmd("elixir", ["bin/red_size_controls.exs"], cd: root, stderr_to_stdout: true)

IO.write(size_out)
failures = failures + size_status

System.cmd("mix", ~w(compile --force), cd: root)
System.halt(if failures == 0, do: 0, else: 1)
