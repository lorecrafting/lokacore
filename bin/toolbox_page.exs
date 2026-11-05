# Generates docs/TOOLBOX.gen.md, the builder's toolbox page (loka-vduxr.59): one row per
# implemented capability of protocol/capability_registry.json (its docs/features.json row names
# implemented_in, which bin/features.exs requires of every implemented one) and one per Book
# treatment. Each capability row needs, in docs/features.json:
#   summary   one line for builders (not player prose);
#   declares  the source-schema paths it reads (`<kind>[.<field>...]` in
#             schemas/source/defs.schema.json, docs/rnd/gui-editor-design-2026-11-04.md §11),
#             or "engine-only: <reason>";
#   sampler   a cartridge under cartridges/ whose requires.capabilities names it (every cartridge
#             compiles in kernel/ts/test/longwait_property.test.ts), or "none: <reason>";
#   showcase  `areas/<district>` of cartridges/toolbox_showcase, which must require it, or
#             "none: <reason>";
#   mechanics an anchor in docs/system/mechanics.md, only when no `## <key>@N` heading exists.
# Treatment rows come from the "Book treatments" table of docs/MECHANICS-TOOLBOX.md, which must
# name every value of the scene `treatment` enum. Row ids (`key@N`, `treatment:<name>`) are stable:
# the editor registry keys on them. Halts on a missing or broken cell. `--check` regenerates in
# memory and exits 1 if the committed file differs; a second and third argument read the rows
# and the treatments doc from those files instead (red controls).
#
#   elixir bin/toolbox_page.exs [--check [rows.json [toolbox.md]]]
defmodule SchemaPath do
  # The {field, subschema} pairs a node offers, through $ref (not partial.*), branches and
  # array or map members.
  def props(%{} = n, defs, seen) do
    subs =
      for k <- ~w(then else allOf anyOf oneOf items additionalProperties),
          x <- List.wrap(n[k]),
          is_map(x),
          do: {x, seen}

    Map.to_list(n["properties"] || %{}) ++
      Enum.flat_map(ref(n["$ref"], defs, seen) ++ subs, fn {x, s} -> props(x, defs, s) end)
  end

  def props(_, _, _), do: []

  defp ref("#/$defs/" <> r, defs, seen) do
    if r in seen or String.starts_with?(r, "partial."), do: [], else: [{defs[r], [r | seen]}]
  end

  defp ref(_, _, _), do: []

  # The subschemas a dotted path reaches from source.<kind>; [] when it names nothing.
  def resolve(path, defs) do
    [kind | fields] = String.split(path, ".")

    Enum.reduce(fields, List.wrap(defs["source." <> kind]), fn f, nodes ->
      for n <- nodes, {k, v} <- props(n, defs, []), k == f, do: v
    end)
  end
end

root = Path.expand("..", __DIR__)
read = &File.read!(Path.join(root, &1))
json = &JSON.decode!(read.(&1))
registry = json.("protocol/capability_registry.json")
rows_path = Enum.at(System.argv(), 1, "docs/features.json")
rows = json.(rows_path)
toolbox_path = Enum.at(System.argv(), 2, "docs/MECHANICS-TOOLBOX.md")
defs = json.("schemas/source/defs.schema.json")["$defs"]

requires = fn cart ->
  path = "cartridges/#{cart}/cartridge.json"

  if File.exists?(Path.join(root, path)),
    do: Map.keys(get_in(json.(path), ["requires", "capabilities"]) || %{}),
    else: nil
end

# GitHub's heading anchor, as bin/system_graph.exs slug/1 (requiring that file runs it).
slug = &("#" <> String.replace(Regex.replace(~r/[^\w\- ]/u, String.downcase(&1), ""), " ", "-"))

headings =
  for [h] <-
        Regex.scan(~r/^##+ (.+)$/m, read.("docs/system/mechanics.md"), capture: :all_but_first),
      do: h

anchors = MapSet.new(headings, slug)

reason? = fn v, prefix ->
  is_binary(v) and String.starts_with?(v, prefix <> ": ") and v != prefix <> ": "
end

showcase_caps = requires.("toolbox_showcase")

caps =
  for e <- registry, row = rows[e["key"]], is_map_key(row, "implemented_in") do
    k = e["key"]

    anchor =
      row["mechanics"] ||
        Enum.find_value(headings, &(Regex.match?(~r/\b#{k}@\d/, &1) && slug.(&1)))

    problems =
      [
        if(not is_binary(row["summary"]) or row["summary"] == "", do: "missing summary"),
        case row["declares"] do
          [_ | _] = ps ->
            for p <- ps,
                not is_binary(p) or SchemaPath.resolve(p, defs) == [],
                do: "declares #{inspect(p)}: no such source-schema path"

          d ->
            if(not reason?.(d, "engine-only"),
              do: "missing declares (paths or \"engine-only: <reason>\")"
            )
        end,
        cond do
          reason?.(row["sampler"], "none") -> nil
          not is_binary(row["sampler"]) -> "missing sampler (a cartridge or \"none: <reason>\")"
          requires.(row["sampler"]) == nil -> "sampler #{row["sampler"]}: no such cartridge"
          k not in requires.(row["sampler"]) -> "sampler #{row["sampler"]}: does not require #{k}"
          true -> nil
        end,
        cond do
          reason?.(row["showcase"], "none") ->
            nil

          not (is_binary(row["showcase"]) and row["showcase"] =~ ~r{^areas/[\w-]+$}) ->
            "missing showcase (areas/<district> or \"none: <reason>\")"

          not File.dir?(Path.join([root, "cartridges/toolbox_showcase", row["showcase"]])) ->
            "showcase #{row["showcase"]}: no such district"

          k not in showcase_caps ->
            "showcase: toolbox_showcase does not require #{k}"

          true ->
            nil
        end,
        cond do
          anchor == nil ->
            "missing mechanics (no `## #{k}@N` heading in docs/system/mechanics.md)"

          anchor not in anchors ->
            "mechanics #{anchor}: no such heading"

          true ->
            nil
        end
      ]
      |> List.flatten()
      |> Enum.reject(&is_nil/1)
      |> Enum.map(&"#{rows_path}: #{k}@#{e["version"]}: #{&1}")

    {e, row, anchor, problems}
  end

enum =
  for(n <- SchemaPath.resolve("scenes.treatment", defs), v <- n["enum"] || [], do: v)
  |> Enum.uniq()

# Self-check: an enum moved behind a $ref would leave the treatment checks below dead.
enum != [] || raise "scenes.treatment has no literal enum in schemas/source/defs.schema.json"

# The "### Book treatments" section's table rows; each must parse.
section =
  read.(toolbox_path)
  |> String.split(~r/^### Book treatments$/m)
  |> Enum.at(1, "")
  |> String.split(~r/^#/m)
  |> hd()

table = for l <- String.split(section, "\n"), String.starts_with?(l, "| `"), do: l

treatments =
  for l <- table, m = Regex.run(~r/^\| `(\w+)` \| (.+?) \| `([^`]+)` \|$/, l), do: tl(m)

problems =
  Enum.flat_map(caps, &elem(&1, 3)) ++
    if(length(treatments) < length(table) or table == [],
      do: ["#{toolbox_path}: Book treatments table rows must read | `name` | host | `sampler` |"],
      else: []
    ) ++
    for(
      t <- enum,
      not Enum.any?(treatments, &(hd(&1) == t)),
      do: "#{toolbox_path}: treatment:#{t}: no row in the Book treatments table"
    ) ++
    for [t, _, s] <- treatments,
        not File.exists?(Path.join(root, s)),
        do: "#{toolbox_path}: treatment:#{t}: no sampler #{s}"

if problems != [] do
  Enum.each(problems, &IO.puts(:stderr, &1))
  System.halt(1)
end

link = fn
  "none: " <> _ = v, _ -> v
  v, href -> "[#{v}](#{href})"
end

cap_rows =
  for {e, row, anchor, _} <- caps do
    declares =
      if is_list(row["declares"]),
        do: Enum.map_join(row["declares"], ", ", &"`#{&1}`"),
        else: row["declares"]

    "| `#{e["key"]}@#{e["version"]}` | #{row["summary"]} | #{declares} | " <>
      "#{link.(row["sampler"], "../cartridges/#{row["sampler"]}/")} | " <>
      "#{link.(row["showcase"], "../cartridges/toolbox_showcase/#{row["showcase"]}/")} | " <>
      "[mechanics](system/mechanics.md#{anchor}) |"
  end

treatment_rows =
  for [t, host, s] <- treatments do
    declares = if t in enum, do: "`scenes.treatment`", else: "engine-only: #{host}"

    "| `treatment:#{t}` | Book treatment drawn over #{host} | #{declares} | [#{s}](../#{s}) | — | " <>
      "[book-ui](system/book-ui.md#book-treatments) |"
  end

md =
  Enum.join(
    [
      "# Builder's toolbox (generated)",
      "",
      "Generated by `elixir bin/toolbox_page.exs` from `protocol/capability_registry.json`,",
      "[features.json](features.json), `schemas/source/defs.schema.json`, the Book treatments table",
      "of [MECHANICS-TOOLBOX.md](MECHANICS-TOOLBOX.md#book-treatments) and the cartridges. Do not edit:",
      "change a row's `summary`, `declares`, `sampler`, `showcase` or `mechanics` in features.json.",
      "Read this page before asking for a new mechanic: what you need may already be here.",
      "",
      "One row per implemented capability, then one per Book treatment. **You declare** names",
      "source-schema paths (`<kind>.<field>`, `cartridge.world.<field>`); engine-only rows need no",
      "declaration. The **sampler** is the smallest cartridge that uses it; every cartridge compiles in",
      "`kernel/ts/test/longwait_property.test.ts`. The **showcase** is the toolbox showcase district",
      "that shows it in play. Row ids are stable keys.",
      "",
      "| Id | What it does | You declare | Sampler | Showcase | Mechanics |",
      "|---|---|---|---|---|---|"
      | cap_rows ++ treatment_rows
    ] ++ [""],
    "\n"
  )

target = Path.join(root, "docs/TOOLBOX.gen.md")

case System.argv() do
  [] ->
    File.write!(target, md)

  ["--check" | _] ->
    if File.read(target) != {:ok, md} do
      IO.puts(:stderr, "docs/TOOLBOX.gen.md is out of date: run elixir bin/toolbox_page.exs")
      System.halt(1)
    end
end
