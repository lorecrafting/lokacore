defmodule Loka.Content.Compiler do
  @moduledoc """
  Validates the loaded source files and builds the CompiledCartridge (05 §3–§8, 06 §20–21).
  Each stage runs on the parts the stages before it accepted, so one bad file does not hide
  the diagnostics of the others.
  """
  alias Loka.Content.{Checks, Links}
  alias Loka.Core.Contracts
  import Loka.Content.Source, only: [diag: 2, at: 2, schema: 4, ref: 3]

  @facts_file %{
    "type" => "object",
    "properties" => %{"facts" => %{"type" => "object", "additionalProperties" => %{}}},
    "required" => ["facts"],
    "additionalProperties" => false
  }

  @doc """
  The CompiledCartridge and its warnings, or all diagnostics (unsorted), `loaded` (the load
  diagnostics) included.
  """
  @spec compile([{String.t(), term(), term()}], [map()], [map()]) ::
          {:ok, map(), [map()]} | {:error, [map()]}
  def compile(files, loaded, registry) do
    {manifest, entry, d1} = manifest(of(files, :manifest), registry)
    {defs, d2} = definitions(files, manifest)
    {text, d3} = text(of(files, :text))
    v2 = v2(defs, entry, text)
    {links, warnings} = if v2, do: Links.check(defs, elem(v2, 1)), else: {[], []}

    case loaded ++
           d1 ++
           d2 ++
           d3 ++
           Checks.check(manifest, defs, registry) ++
           Checks.rooms(manifest, defs, v2, registry) ++ links do
      [] -> {:ok, cartridge(manifest, defs, v2), warnings}
      diags -> {:error, diags}
    end
  end

  # v2 exactly when the source has rooms, items, NPCs, an entry or a text catalog
  # (CompiledCartridge).
  defp v2(defs, entry, text) do
    if Enum.any?(~w(room item npc), &(defs[&1] != %{})) or entry != nil or text != nil,
      do: {entry, text || %{}}
  end

  defp of(files, kind), do: for({rel, ^kind, v} <- files, do: {rel, v})

  defp manifest([], _), do: {nil, nil, [diag("MISSING_MANIFEST", "cartridge")]}
  defp manifest([{_, :invalid}], _), do: {nil, nil, []}

  # cartridge.json is the CartridgeManifest plus the optional entry room (00a §12), which the
  # compiled v2 cartridge carries beside the manifest.
  defp manifest([{rel, m}], registry) do
    defs = source_defs()

    file =
      put_in(defs["CartridgeManifest"], ["properties", "entry"], %{"$ref" => "DefinitionRef"})

    case validated(rel, [], "ManifestFile", m, Map.put(defs, "ManifestFile", file)) do
      [] ->
        {entry, manifest} = Map.pop(m, "entry")
        {manifest, ref(entry, "room", m), Checks.requirements(rel, manifest, registry)}

      diags ->
        {nil, nil, diags}
    end
  end

  # text.json is the TextCatalog; nil when absent, :unknown when rejected (text keys are then
  # not resolved against it).
  defp text([]), do: {nil, []}
  defp text([{_, :invalid}]), do: {:unknown, []}

  defp text([{rel, t}]) do
    case validated(rel, [], "TextCatalog", t) do
      [] -> {t, []}
      diags -> {:unknown, diags}
    end
  end

  defp definitions(files, m) do
    {facts, d1} = facts(of(files, :facts))
    {policies, d2} = files(files, :policy, "VersionedPolicy")
    {actions, d3} = files(files, :action, "ActionDefinition")
    {rooms, d4} = files(files, :room, "RoomDefinition")
    {items, d5} = files(files, :item, "ItemDefinition")
    {npcs, d6} = files(files, :npc, "NpcDefinition")

    defs = %{
      "policy" => policies,
      "action" => actions,
      "room" => rooms,
      "item" => items,
      "npc" => npcs
    }

    {Map.put(expanded(defs, m), "fact", facts), d1 ++ d2 ++ d3 ++ d4 ++ d5 ++ d6}
  end

  # Short references become full ones once a valid manifest names the cartridge; without one
  # the build fails anyway and reference checks are skipped.
  defp expanded(defs, nil), do: defs

  defp expanded(defs, m) do
    for {kind, ds} <- defs, into: %{} do
      {kind, Map.new(ds, fn {k, d} -> {k, expand(d, m)} end)}
    end
  end

  defp expand({rel, steps, v}, m), do: {rel, steps, Checks.expand(v, m)}
  defp expand(:invalid, _), do: :invalid

  defp files(files, kind, contract),
    do: collect(for {rel, {^kind, k}, v} <- files, do: {k, definition(rel, [], k, v, contract)})

  # {key => definition | :invalid, diagnostics}. An invalid definition stays known, so a
  # reference to it resolves instead of adding a second, false cause (08 §6); any
  # diagnostic stops the build, so :invalid never reaches the artifact.
  defp collect(results) do
    {Map.new(results, fn
       {k, {:ok, d}} -> {k, d}
       {k, {:error, _}} -> {k, :invalid}
     end), for({_, {:error, ds}} <- results, d <- ds, do: d)}
  end

  # facts.json: {"facts": {authored name: FactSpec without key}}; each . in a name becomes _.
  # A present but rejected facts.json leaves the fact namespace :unknown, so fact
  # references are not resolved against it.
  defp facts([]), do: {%{}, []}
  defp facts([{_, :invalid}]), do: {:unknown, []}

  defp facts([{rel, file}]) do
    case validated(
           rel,
           [],
           "FactsFile",
           file,
           Map.put(Contracts.defs(), "FactsFile", @facts_file)
         ) do
      [] -> named_facts(rel, file["facts"])
      diags -> {:unknown, diags}
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
  defp definition(_, _, _, :invalid, _), do: {:error, []}

  defp definition(rel, steps, key, value, contract) do
    keyed = if contract == "VersionedPolicy", do: value, else: with_key(value, key)

    case authored_key(rel, steps, value) ++
           validated(rel, steps, "Key", key) ++ body(rel, steps, contract, keyed) do
      [] -> {:ok, {rel, steps, keyed}}
      diags -> {:error, diags}
    end
  end

  # An error at /key is the inserted key's, already reported against Key.
  defp body(rel, steps, contract, value) do
    Enum.reject(
      validated(rel, steps, contract, value),
      &(&1["path"] == at(rel, steps ++ ["key"]))
    )
  end

  defp with_key(value, key) when is_map(value), do: Map.put(value, "key", key)
  defp with_key(value, _), do: value

  defp authored_key(rel, steps, %{"key" => _}),
    do: [diag("UNKNOWN_FIELD", at(rel, steps ++ ["key"]))]

  defp authored_key(_, _, _), do: []

  defp validated(rel, steps, contract, value, defs \\ source_defs()) do
    case Contracts.validate(contract, value, defs) do
      :ok -> []
      {:error, es} -> schema(rel, steps, value, es)
    end
  end

  # In source a DefinitionRef may also be short: the Key of this cartridge's definition.
  defp source_defs,
    do: Map.update!(Contracts.defs(), "DefinitionRef", &%{"anyOf" => [%{"$ref" => "Key"}, &1]})

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

  # items and npcs are optional maps (CompiledCartridge): absent when empty.
  defp cartridge(m, defs, {entry, text}) do
    optional =
      for {k, map} <- [{"item", "items"}, {"npc", "npcs"}],
          defs[k] != %{},
          into: %{},
          do: {map, keyed(m, k, defs)}

    cartridge(m, defs, nil)
    |> Map.merge(%{"format" => "loka-cartridge-v2", "rooms" => keyed(m, "room", defs)})
    |> Map.merge(%{"entry" => entry, "text" => text})
    |> Map.merge(optional)
  end

  defp keyed(m, kind, defs),
    do:
      Map.new(defs[kind], fn {key, {_, _, v}} ->
        {"#{m["id"]}@#{m["version"]}:#{kind}/#{key}", v}
      end)
end
