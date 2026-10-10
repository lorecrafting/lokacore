defmodule Loka.SystemGraphTest do
  # docs/system-graph.gen.json (bin/system_graph.exs) against protocol/ read here directly;
  # `elixir bin/contracts.exs --check` keeps the committed file current.
  use ExUnit.Case, async: true

  @graph JSON.decode!(File.read!("docs/system-graph.gen.json"))
  @schemas Path.wildcard("protocol/*.schema.json")

  defp contract(name), do: Enum.find(@graph["nodes"], &(&1["name"] == name))

  # Breaks: a new schema file left out of the layer map, or a file's defs dropped.
  test "every schema file has a layer and every $defs entry is a node" do
    files = Map.new(@graph["files"], &{&1["file"], &1["layer"]})
    assert Enum.sort(Map.keys(files)) == Enum.sort(@schemas)
    assert Enum.all?(Map.values(files), &(&1 in @graph["layers"]))

    defs = for p <- @schemas, {name, _} <- JSON.decode!(File.read!(p))["$defs"], do: name
    assert Enum.sort(Enum.map(@graph["nodes"], & &1["name"])) == Enum.sort(defs)
  end

  # Breaks: the edge walk skips a schema position (items, anyOf, a oneOf branch, a map value).
  test "every $ref site is an edge from its contract to the target" do
    edges = MapSet.new(@graph["edges"], &{&1["from"], &1["to"]})

    sites =
      for p <- @schemas,
          {name, s} <- JSON.decode!(File.read!(p))["$defs"],
          ref <- refs(s),
          do: {name, ref |> String.split("/") |> List.last()}

    assert sites != []
    assert Enum.reject(sites, &MapSet.member?(edges, &1)) == []
  end

  # Raw walk of everything but values (examples, enum, const).
  defp refs(%{"$ref" => r}), do: [r]

  defp refs(s) when is_map(s),
    do: Enum.flat_map(Map.drop(s, ~w(examples enum const)), fn {_, v} -> refs(v) end)

  defp refs(l) when is_list(l), do: Enum.flat_map(l, &refs/1)
  defp refs(_), do: []

  # Breaks: line counted from 0 or from the wrong match (a property of the same name).
  test "each node's line is its $defs entry" do
    for n <- @graph["nodes"] do
      line = File.read!(n["file"]) |> String.split("\n") |> Enum.at(n["line"] - 1)
      assert line == ~s(    "#{n["name"]}": {), n["name"]
    end
  end

  # Breaks: 00a read as 00, or a cited NN linked to no file.
  test "spec citations link the archived spec file" do
    assert contract("ItemLocation")["spec"] == ["docs/archive/spec/00a-chapter-one-content.md"]

    assert "docs/archive/spec/04-command-event-effect-protocol.md" in contract("StateDelta")[
             "spec"
           ]
  end

  # Breaks: every field marked required, or a union read as an object.
  test "required marks and kinds follow the schema" do
    fields = Map.new(contract("UnavailableReason")["fields"], &{&1["name"], &1["required"]})
    assert fields == %{"code" => true, "message" => false}
    assert contract("TextValue")["kind"] == "union"
  end

  # Breaks: a capability row lost, or a definition kind resolved to the wrong contract.
  test "every registry capability has a row with its owned contracts" do
    registry = JSON.decode!(File.read!("protocol/capability_registry.json"))
    rows = Map.new(@graph["capabilities"], &{&1["id"], &1})

    assert Enum.sort(Map.keys(rows)) ==
             Enum.sort(for e <- registry, do: "#{e["key"]}@#{e["version"]}")

    assert %{"kind" => "room", "node" => "RoomDefinition"} in rows["movement@1"]["definitions"]
    assert contract("ResourceSpec")["owner"] == "resource@1"
  end

  # Breaks: a registry command no CommandPayload variant declares passes silently.
  test "generation fails on a registry command no schema declares" do
    registry =
      Path.join(System.tmp_dir!(), "loka-graph-#{System.unique_integer([:positive])}.json")

    on_exit(fn -> File.rm(registry) end)

    File.write!(
      registry,
      ~s([{"key": "movement", "version": 1, "portability": "portable", "residency": "portable_capability", "commands": ["teleport"]}])
    )

    {out, status} =
      System.cmd("elixir", ["bin/contracts.exs", "--check", registry], stderr_to_stdout: true)

    assert status != 0
    assert out =~ ~s(movement@1: commands ["teleport"] not in CommandPayload)
  end

  # Breaks: the save-table block misparsed (a row lost, the header taken as a row).
  test "save tables are save.md's seven" do
    assert Enum.map(@graph["saveTables"], & &1["table"]) ==
             ~w(head state_row receipt save report trace observation)
  end
end
