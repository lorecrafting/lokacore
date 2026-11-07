defmodule Loka.ContentSourceSchemaTest do
  use ExUnit.Case, async: true

  # The committed source JSON Schemas (docs/system/cartridge.md, Source schema) are the
  # generator's output; kernel/ts/test/source_schema.test.ts validates the corpus with them.
  @dir "schemas/source"

  # The kinds prologue Part 1 uses (loka-wfrgk.102): their help texts are the editor's field help.
  @plain ~w(source.rooms source.npcs source.items source.reactions source.ScriptedAction
            source.dialogues source.scenes source.facts source.quests source.cartridge)

  test "schemas/source matches the generator byte for byte" do
    on_disk = Map.new(File.ls!(@dir), &{&1, File.read!(Path.join(@dir, &1))})

    assert on_disk == Loka.Content.source_schema(),
           "schemas/source is stale: run `mix loka.source_schema`"
  end

  # Break: a field the editor offers with no help line, or one citing the spec (§, ADR-) instead
  # of saying what it does. A bare `const` field (an `op` or `type` tag) is told by its branch.
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
    own = for {k, p} <- props, why <- [gap(p, s)], why, do: {"#{path}.#{k}", why}
    inner = for {k, p} <- props, g <- gaps(p, "#{path}.#{k}"), do: g
    # if/then/else only constrains fields declared beside it; the editor shows their help.
    own ++
      inner ++ for({k, v} <- s, k not in ~w(properties if then else), g <- gaps(v, path), do: g)
  end

  defp gaps(l, path) when is_list(l), do: Enum.flat_map(l, &gaps(&1, path))
  defp gaps(_, _), do: []

  defp gap(%{"const" => _} = p, branch) when map_size(p) == 1, do: told(branch["description"])
  defp gap(%{} = p, _), do: told(p["description"])
  defp gap(p, _), do: "no description: #{inspect(p)}"

  defp told(d) when not is_binary(d) or d == "", do: "no description"
  defp told(d), do: if(d =~ ~r/§|ADR-/u, do: "cites the spec: #{d}")
end
