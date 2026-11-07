defmodule Loka.ContentSourceSchemaTest do
  use ExUnit.Case, async: true

  # The committed source JSON Schemas (docs/system/cartridge.md, Source schema) are the
  # generator's output; kernel/ts/test/source_schema.test.ts validates the corpus with them.
  @dir "schemas/source"

  # The kinds prologue Part 1 uses (loka-wfrgk.102): their help texts are the editor's field help.
  # Spec cites and internal names an author cannot use: sections, decisions, toolbox rows, docs, issues.
  @jargon ~r/§|ADR-|(?i:toolbox row|\brow \d|\btrap \d|\bpass-\d)|@\d|\bmix loka|(?i:balance tool)|\bstatus\.apply|\brefuses [a-z]+_[a-z_]+|\bcompiler\b|\bbytes\b|\bnamespaced\b|\badded then\b|\bversioned\b|\b[A-Z]\d[A-Z]\b|\bRNG\b|SHA-|^[(a-z\d]|schema\.json|\b[A-Z]+_[A-Z_]+\b|\.md\b|\bloka-|\bAPI\d|\b[A-Z]{1,2}\d+(\.\d+)?\b|\b[A-Z][a-z]+[A-Z]\w*/u

  @plain ~w(source.rooms source.npcs source.items source.reactions source.ScriptedAction
            source.dialogues source.scenes source.facts source.quests source.cartridge)

  test "schemas/source matches the generator byte for byte" do
    on_disk = Map.new(File.ls!(@dir), &{&1, File.read!(Path.join(@dir, &1))})

    assert on_disk == Loka.Content.source_schema(),
           "schemas/source is stale: run `mix loka.source_schema`"
  end

  # Break: a field the editor offers with no help line, or help (a field's, a kind's or an
  # option's) citing the spec or an internal name instead of saying what it does.
  test "every field of the Part 1 kinds has a plain description" do
    defs = Jason.decode!(Loka.Content.source_schema()["defs.schema.json"])["$defs"]

    bad =
      for name <- reach(@plain, defs, MapSet.new()),
          not String.starts_with?(name, "partial."),
          {path, why} <- gaps(defs[name], name),
          do: "#{path}: #{why}"

    assert bad == []
  end

  defp reach([], _defs, seen), do: Enum.sort(seen)

  defp reach([n | rest], defs, seen) do
    if n in seen or not is_map_key(defs, n),
      do: reach(rest, defs, seen),
      else: reach(refs(defs[n]) ++ rest, defs, MapSet.put(seen, n))
  end

  defp refs(%{"$ref" => "#/$defs/" <> n} = s), do: [n | refs(Map.delete(s, "$ref"))]
  defp refs(%{} = s), do: Enum.flat_map(Map.values(s), &refs/1)
  defp refs(l) when is_list(l), do: Enum.flat_map(l, &refs/1)
  defp refs(_), do: []

  defp gaps(%{} = s, path) do
    props = Map.get(s, "properties", %{})
    own = for {k, p} <- props, not told?(p, s), do: {"#{path}.#{k}", "no description"}
    inner = for {k, p} <- props, g <- gaps(p, "#{path}.#{k}"), do: g
    own ++ jargon(s["description"], path) ++ inner ++ rest(s, path)
  end

  # if/then/else only constrains fields declared beside it; the editor shows their help.
  defp rest(s, path) do
    for {k, v} <- s,
        k not in ~w(properties if then else examples default),
        g <- gaps(v, path),
        do: g
  end

  defp jargon(d, path) when is_binary(d),
    do: if(d =~ @jargon, do: [{path, "cites the spec: #{d}"}], else: [])

  defp jargon(_, _), do: []

  defp gaps(l, path) when is_list(l), do: Enum.flat_map(l, &gaps(&1, path))
  defp gaps(_, _), do: []

  # A bare `const` field (an `op` or `type` tag) is told by its branch.
  defp told?(%{"const" => _} = p, branch) when map_size(p) == 1, do: told?(branch, nil)
  defp told?(%{"description" => d}, _), do: is_binary(d) and d != ""
  defp told?(_, _), do: false
end
