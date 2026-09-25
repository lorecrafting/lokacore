defmodule Loka.Content.Compiler do
  @moduledoc """
  Validates the loaded source files and builds the CompiledCartridge (05 §3–§8, 06 §20–21).
  Each stage runs on the parts the stages before it accepted, so one bad file does not hide
  the diagnostics of the others.
  """
  alias Loka.Content.Checks
  alias Loka.Core.Contracts
  import Loka.Content.Source, only: [diag: 2, at: 2, schema: 4]

  @facts_file %{
    "type" => "object",
    "properties" => %{"facts" => %{"type" => "object", "additionalProperties" => %{}}},
    "required" => ["facts"],
    "additionalProperties" => false
  }

  @doc "The CompiledCartridge for the loaded files, or its diagnostics (unsorted)."
  @spec compile([{String.t(), term(), term()}], [map()]) :: {:ok, map()} | {:error, [map()]}
  def compile(files, registry) do
    {manifest, d1} = manifest(of(files, :manifest), registry)
    {defs, d2} = definitions(files)

    case d1 ++ d2 ++ Checks.check(manifest, defs, registry) do
      [] -> {:ok, cartridge(manifest, defs)}
      diags -> {:error, diags}
    end
  end

  defp of(files, kind), do: for({rel, ^kind, v} <- files, do: {rel, v})

  defp manifest([], _), do: {nil, [diag("MISSING_MANIFEST", "cartridge")]}

  defp manifest([{rel, m}], registry) do
    case validated(rel, [], "CartridgeManifest", m) do
      [] -> {m, Checks.requirements(rel, m, registry)}
      diags -> {nil, diags}
    end
  end

  defp definitions(files) do
    {facts, d1} = facts(of(files, :facts))
    {policies, d2} = files(files, :policy, "VersionedPolicy")
    {actions, d3} = files(files, :action, "ActionDefinition")
    {%{"fact" => facts, "policy" => policies, "action" => actions}, d1 ++ d2 ++ d3}
  end

  defp files(files, kind, contract),
    do: collect(for {rel, {^kind, k}, v} <- files, do: {k, definition(rel, [], k, v, contract)})

  # {key => definition, diagnostics} from {key, {:ok, definition} | {:error, diagnostics}}.
  defp collect(results) do
    {Map.new(for {k, {:ok, d}} <- results, do: {k, d}),
     for({_, {:error, ds}} <- results, d <- ds, do: d)}
  end

  # facts.json: {"facts": {authored name: FactSpec without key}}; each . in a name becomes _.
  defp facts([]), do: {%{}, []}

  defp facts([{rel, file}]) do
    case validated(
           rel,
           [],
           "FactsFile",
           file,
           Map.put(Contracts.defs(), "FactsFile", @facts_file)
         ) do
      [] -> named_facts(rel, file["facts"])
      diags -> {%{}, diags}
    end
  end

  defp named_facts(rel, named) do
    entries = for {name, spec} <- named, do: {String.replace(name, ".", "_"), name, spec}
    {facts, diags} = collect(Enum.map(entries, &fact(rel, &1)))
    defaults = for {_, {_, at, spec}} <- facts, d <- default(rel, at, spec), do: d
    {facts, diags ++ defaults ++ collisions(rel, entries)}
  end

  defp fact(rel, {key, name, spec}),
    do: {key, definition(rel, ["facts", name], key, spec, "FactSpec")}

  defp collisions(rel, entries) do
    for {_, [_, _ | _] = group} <- Enum.group_by(entries, &elem(&1, 0)),
        {_, name, _} <- group,
        do: diag("FACT_NAME_COLLISION", at(rel, ["facts", name]))
  end

  defp default(rel, steps, %{"value_type" => t}) do
    d = t["default"]

    ok =
      case t["type"] do
        "enum" -> d in t["values"]
        "int" -> d >= Map.get(t, "minimum", d) and d <= Map.get(t, "maximum", d)
        "bool" -> true
      end

    if ok,
      do: [],
      else: [diag("FACT_DEFAULT_INVALID", at(rel, steps ++ ["value_type", "default"]))]
  end

  # The key comes from the file stem or fact name, so an authored key is UNKNOWN_FIELD.
  defp definition(rel, steps, key, value, contract) do
    keyed = if contract == "VersionedPolicy", do: value, else: with_key(value, key)

    case authored_key(rel, steps, value) ++
           validated(rel, steps, "Key", key) ++ validated(rel, steps, contract, keyed) do
      [] -> {:ok, {rel, steps, keyed}}
      diags -> {:error, diags}
    end
  end

  defp with_key(value, key) when is_map(value), do: Map.put(value, "key", key)
  defp with_key(value, _), do: value

  defp authored_key(rel, steps, %{"key" => _}),
    do: [diag("UNKNOWN_FIELD", at(rel, steps ++ ["key"]))]

  defp authored_key(_, _, _), do: []

  # Schema diagnostics; an error at /key is the inserted key's, reported against Key.
  defp validated(rel, steps, contract, value, defs \\ Contracts.defs()) do
    case Contracts.validate(contract, value, defs) do
      :ok -> []
      {:error, es} -> schema(rel, steps, value, Enum.reject(es, &(&1.path == "/key")))
    end
  end

  defp cartridge(m, defs) do
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

  defp keyed(m, kind, defs),
    do:
      Map.new(defs[kind], fn {key, {_, _, v}} ->
        {"#{m["id"]}@#{m["version"]}:#{kind}/#{key}", v}
      end)
end
