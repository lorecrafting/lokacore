# The data model graph behind Storybook's System pages (docs/design/system-dashboard/spec.md §5),
# rendered by bin/contracts.exs into docs/system-graph.gen.json. Inputs: protocol/*.schema.json,
# the capability registry, the save-table block of docs/system/save.md, protocol/README.md's
# fixture column, docs/state-sections.gen.json (a kernel test writes it) and @layers below. A file
# missing from @layers gets layer null (test/loka/system_graph_test.exs fails it), so a planted
# schema still reaches the stale-file check. Fails on a registry command, event or policy op no
# schema declares, and on a missing save-table block. Save holds no schema: its column is the
# save tables. A definition kind with no CompiledCartridge map keyed `:kind/` takes the key-name
# rule (by_name/3), else node null.
defmodule SystemGraph do
  @layer_order ~w(Content Capabilities Change State Save View)
  @layers %{
    "Content" =>
      ~w(action cartridge dialogue entity liquid manifest quest reaction resource room scene service text transport water),
    "Capabilities" => ~w(capability feature invariant policy),
    "Change" => ~w(command decision delta effect error event observation),
    "State" => ~w(account fact identity relation scope),
    "View" => ~w(gameview)
  }
  # Registry list => the contract whose oneOf tags declare its names
  @tagged %{"commands" => "CommandPayload", "events" => "EventPayload", "policies" => "Policy"}

  @spec json(String.t(), [map()]) :: String.t()
  def json(root, registry) do
    {:ok, text} = Loka.Core.Canonical.encode(build(root, registry, Loka.Core.Contracts.defs()))
    text <> "\n"
  end

  defp build(root, registry, defs) do
    docs = Enum.map(Enum.sort(Path.wildcard(Path.join(root, "protocol/*.schema.json"))), &doc/1)
    kinds = by_name(registry, definition_kinds(defs), defs)
    nodes = nodes(docs, defs, definition_owners(registry, kinds), spec_files(root))

    %{
      "layers" => @layer_order,
      "files" => files(docs, fixtures(root)),
      "capabilities" => Enum.map(registry, &capability(&1, kinds, defs)),
      "nodes" => nodes,
      "edges" => Enum.flat_map(nodes, &edges(&1["name"], defs)),
      "saveTables" => save_tables(root, state_sections(root))
    }
  end

  defp nodes(docs, defs, owner, specs) do
    for d <- docs,
        {name, s} <- Enum.sort(d["defs"]),
        do: node(d, name, s, defs, owner, specs)
  end

  defp doc(path) do
    raw = File.read!(path)
    json = JSON.decode!(raw)
    stem = Path.basename(path, ".schema.json")
    layer = Enum.find_value(@layers, fn {l, stems} -> if stem in stems, do: l end)

    %{
      "file" => "protocol/#{Path.basename(path)}",
      "title" => json["title"],
      "layer" => layer,
      "defs" => json["$defs"],
      "raw" => raw
    }
  end

  defp node(d, name, s, defs, owner, specs) do
    line =
      case Regex.run(~r/^    "#{name}": /m, d["raw"], return: :index) do
        [{at, _}] -> 1 + length(:binary.matches(binary_part(d["raw"], 0, at), "\n"))
        nil -> nil
      end

    %{
      "name" => name,
      "file" => d["file"],
      "line" => line,
      "layer" => d["layer"],
      "kind" => kind(defs[name]),
      "owner" => owner[name],
      "description" => s["description"],
      "fields" => fields(defs[name]),
      "enum" => values(defs[name]),
      "examples" => s["examples"],
      "spec" => cited(s["description"] || "", specs)
    }
  end

  defp kind(%{"oneOf" => _}), do: "union"
  defp kind(%{"anyOf" => _}), do: "union"
  defp kind(%{"enum" => _}), do: "enum"
  defp kind(%{"const" => _}), do: "enum"
  defp kind(%{"type" => "object"}), do: "object"

  defp kind(s),
    do: if(Loka.Core.Contracts.Schema.nominal?(s), do: "id", else: "value")

  # Enum values, a const, or a oneOf's discriminator values (Schema's tag rule).
  defp values(%{"enum" => e}), do: e
  defp values(%{"const" => c}), do: [c]

  defp values(%{"oneOf" => bs}),
    do: for(b <- bs, {_, %{"const" => v}} <- b["properties"], do: v)

  defp values(_), do: nil

  defp fields(%{"properties" => ps} = s) do
    for {k, sub} <- Enum.sort(ps) do
      %{
        "name" => k,
        "type" => type(sub),
        "required" => k in Map.get(s, "required", []),
        "enum" => values(sub)
      }
    end
  end

  defp fields(_), do: []

  defp type(%{"$ref" => r}), do: r
  defp type(%{"type" => "array", "items" => i}), do: type(i) <> "[]"
  defp type(%{"type" => "object", "additionalProperties" => v}) when is_map(v), do: "{#{type(v)}}"
  defp type(%{"anyOf" => bs}), do: Enum.map_join(bs, " | ", &type/1)
  defp type(%{"oneOf" => _}), do: "union"
  defp type(%{"enum" => _}), do: "enum"
  defp type(%{"type" => t}), do: t
  defp type(_), do: "const"

  # Archived spec files a description cites as `NN §M`, linked to the heading `M` (`## 5. …`,
  # `### 5.1 …`) when the file has one; an NN without exactly one docs/archive/spec/NN-*.md links
  # nothing.
  defp spec_files(root) do
    for path <- Path.wildcard(Path.join(root, "docs/archive/spec/*.md")),
        [_, nn] <- [Regex.run(~r{/(\d\d[a-z]?)-[^/]+$}, path)],
        reduce: %{} do
      acc -> Map.update(acc, nn, [{Path.relative_to(path, root), File.read!(path)}], &[nil | &1])
    end
  end

  defp cited(text, specs) do
    for [cite, nn | sec] <-
          Regex.scan(~r/\b(\d\d[a-z]?) §(?:([0-9A-Z](?:[0-9A-Za-z.]*[0-9A-Za-z])?))?/, text),
        [{path, md}] <- [specs[nn] || []],
        uniq: true,
        do: %{"cite" => cite, "path" => path <> anchor(md, sec)}
  end

  defp anchor(md, [sec]) do
    case Regex.run(~r/^#+ (#{Regex.escape(sec)}\.?\s.*)$/m, md) do
      # GitHub's heading slug: lower case, punctuation dropped, each space a hyphen.
      [_, h] ->
        "#" <> String.replace(Regex.replace(~r/[^\w\- ]/u, String.downcase(h), ""), " ", "-")

      nil ->
        ""
    end
  end

  defp anchor(_, _), do: ""

  # Definition kind => contract, from CompiledCartridge's maps (key pattern `:kind/`).
  defp definition_kinds(defs) do
    for b <- defs["CompiledCartridge"]["oneOf"],
        {_, %{"propertyNames" => %{"pattern" => p}, "additionalProperties" => %{"$ref" => r}}} <-
          b["properties"],
        [_, kind] <- [Regex.run(~r/\):([a-z_]+)\//, p)],
        into: %{},
        do: {kind, r}
  end

  # The key-name rule for a kind no map names: the first of `<Kind>Definition`, `<Kind>` and
  # `<Kind>Spec` that is a contract (status => StatusDefinition), else null.
  defp by_name(registry, kinds, defs) do
    for e <- registry, k <- e["definitions"] || [], !kinds[k], into: kinds do
      camel = Macro.camelize(k)
      {k, Enum.find(["#{camel}Definition", camel, "#{camel}Spec"], &defs[&1])}
    end
  end

  defp definition_owners(registry, kinds) do
    for e <- registry,
        k <- e["definitions"] || [],
        kinds[k],
        into: %{},
        do: {kinds[k], "#{e["key"]}@#{e["version"]}"}
  end

  defp capability(e, kinds, defs) do
    tagged =
      for {list, contract} <- @tagged, into: %{} do
        names = e[list] || []

        case names -- values(defs[contract]) do
          [] -> {list, names}
          bad -> raise "#{e["key"]}@#{e["version"]}: #{list} #{inspect(bad)} not in #{contract}"
        end
      end

    Map.merge(tagged, %{
      "id" => "#{e["key"]}@#{e["version"]}",
      "portability" => e["portability"],
      "residency" => e["residency"],
      "definitions" => for(k <- e["definitions"] || [], do: %{"kind" => k, "node" => kinds[k]})
    })
  end

  # One edge per (target, field) of a contract's $refs, in schema positions (Schema.rewrite's).
  defp edges(name, defs) do
    for {field, to} <- Enum.uniq(refs(defs[name], nil)),
        do: %{"from" => name, "to" => to, "kind" => "ref", "field" => field}
  end

  defp refs(%{"$ref" => r}, field), do: [{field, r}]

  defp refs(s, field) when is_map(s), do: Enum.flat_map(s, fn {k, v} -> refs(k, v, field) end)

  defp refs("properties", ps, field),
    do: Enum.flat_map(ps, fn {k, sub} -> refs(sub, field || k) end)

  defp refs(k, bs, field) when k in ~w(oneOf anyOf), do: Enum.flat_map(bs, &refs(&1, field))

  defp refs(k, sub, field) when k in ~w(items additionalProperties) and is_map(sub),
    do: refs(sub, field)

  defp refs(_, _, _), do: []

  defp files(docs, fixtures) do
    for d <- docs,
        do: Map.put(Map.take(d, ~w(file title layer)), "fixtures", fixtures[d["file"]] || [])
  end

  # protocol/README.md's table: each schema file's fixtures (its last column).
  defp fixtures(root) do
    for line <- String.split(File.read!(Path.join(root, "protocol/README.md")), "\n"),
        [_, files, fixtures] <- [Regex.run(~r/^\| (.*?) \|.*\| ([^|]*) \|$/, line)],
        [_, stem] <- Regex.scan(~r/`(\w+)\.schema\.json`/, files),
        into: %{},
        do:
          {"protocol/#{stem}.schema.json",
           for([_, f] <- Regex.scan(~r/`([\w.]+\.json)`/, fixtures), do: f)}
  end

  # docs/state-sections.gen.json (kernel/ts/test/state_sections.test.ts): MutationTarget kind =>
  # State section, turned into the sections a state_row holds and the kinds kept in each.
  defp state_sections(root) do
    Path.join(root, "docs/state-sections.gen.json")
    |> File.read!()
    |> JSON.decode!()
    |> Enum.group_by(&elem(&1, 1), &elem(&1, 0))
    |> Enum.map(fn {section, kinds} -> %{"section" => section, "targets" => Enum.sort(kinds)} end)
    |> Enum.sort_by(& &1["section"])
  end

  # The `| Table | Rows |` block under "## The save file" in docs/system/save.md.
  defp save_tables(root, sections) do
    text = File.read!(Path.join(root, "docs/system/save.md"))

    [_, block] =
      Regex.run(
        ~r/^## The save file.*?\n\| Table \| Rows \|\n\|---\|---\|\n((?:\|[^\n]*\n)+)/ms,
        text
      ) ||
        raise "docs/system/save.md: no `| Table | Rows |` block under ## The save file"

    for row <- String.split(block, "\n", trim: true) do
      [_, table, rows] =
        Regex.run(~r/^\| `(\w+)` \| (.*) \|$/, row) ||
          raise "docs/system/save.md: save table row is not '| `table` | rows |': #{row}"

      if table == "state_row",
        do: %{"table" => table, "rows" => rows, "sections" => sections},
        else: %{"table" => table, "rows" => rows}
    end
  end
end
