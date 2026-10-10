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

  # Breaks: 00a read as 00, §2 linked to the `# 23 — …` title, `§2, §5` losing §5, or a
  # slug that is not GitHub's.
  test "spec citations link the archived spec file at the cited heading" do
    assert contract("ItemLocation")["spec"] == [
             %{
               "cite" => "00a §12",
               "path" => "docs/archive/spec/00a-chapter-one-content.md#12-hello-world-fixture"
             }
           ]

    assert %{
             "cite" => "23 §2",
             "path" =>
               "docs/archive/spec/23-accounts-progress-admission.md#2-three-authorities-no-new-gameplay-scope"
           } in contract("AccountId")["spec"]

    # `23 §2, §5`: the second section keeps its own link.
    assert %{
             "cite" => "23 §5",
             "path" =>
               "docs/archive/spec/23-accounts-progress-admission.md#5-minimal-records-and-api-boundary"
           } in contract("AccountId")["spec"]

    decision = "docs/archive/spec/04-command-event-effect-protocol.md"

    assert %{"cite" => "04 §5", "path" => decision <> "#5-decision-result"} in contract(
             "DecisionResult"
           )["spec"]

    assert %{
             "cite" => "04 §5.1",
             "path" => decision <> "#51-proposal-state-semantics-and-statedelta-composition"
           } in contract("StateDelta")["spec"]
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

  # Breaks: the key-name rule guesses past `<Kind>Definition`, `<Kind>`, `<Kind>Spec`, or drops one.
  test "definition kinds no map names resolve by key name, else stay null" do
    named =
      for c <- @graph["capabilities"],
          %{"kind" => k, "node" => n} <- c["definitions"],
          k in ~w(slot detail variant status schedule shop bed calendar fuel darkness vessel
                  liquid_source readable escort patrol edible bleed water),
          into: %{},
          do: {k, n}

    assert Map.reject(named, fn {_, n} -> is_nil(n) end) == %{
             "status" => "StatusDefinition",
             "shop" => "Shop",
             "calendar" => "Calendar",
             "fuel" => "FuelSpec",
             "vessel" => "VesselSpec",
             "bleed" => "BleedDefinition"
           }

    assert map_size(named) == 18
    assert contract("StatusDefinition")["owner"] == "status@1"
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

  # Breaks: the state-sections join dropped or inverted (a section named by its target kind).
  test "state_row lists the State sections with the target kinds kept in them" do
    state_row = Enum.find(@graph["saveTables"], &(&1["table"] == "state_row"))
    assert %{"section" => "statuses", "targets" => ["status"]} in state_row["sections"]
    assert %{"section" => "created", "targets" => ["entity"]} in state_row["sections"]
  end

  # Breaks: protocol/README.md's fixture column misread (another column, a row's second file).
  test "each schema file lists the fixtures protocol/README.md gives it" do
    fixtures = Map.new(@graph["files"], &{&1["file"], &1["fixtures"]})
    assert fixtures["protocol/delta.schema.json"] == ~w(composition.json resource_recovery.json)
    assert fixtures["protocol/error.schema.json"] == []
    assert fixtures["protocol/effect.schema.json"] == []
  end

  # Breaks: the save-table block misparsed (a row lost, the header taken as a row).
  test "save tables are save.md's seven" do
    assert Enum.map(@graph["saveTables"], & &1["table"]) ==
             ~w(head state_row receipt save report trace observation)
  end
end
