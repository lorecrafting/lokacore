defmodule Loka.LoaderFloorsTest do
  use ExUnit.Case, async: true

  # Twin of kernel/ts/test/loader_floors.test.ts; both read this fixture (Beads loka-xroj).
  @fixture JSON.decode!(File.read!("protocol/fixtures/loader_floors.json"))

  defp compile(dir, c, at) do
    api = {"cartridge.json", &put_in(&1, ["requires", "kernel_api", "at_least"], at)}

    edits =
      for [file, path, value] <- c["edits"] || [], path != [], do: {file, &edit(&1, path, value)}

    Loka.ContentSource.compile(dir, merge(edits ++ [api]) ++ whole(c))
  end

  # An edit at path [] writes a whole (new) file.
  defp whole(c), do: for([file, [], value] <- c["edits"] || [], do: {file, value})

  # A null value deletes the key (a case below a later sampler key's floor).
  defp edit(json, path, nil), do: elem(pop_in(json, path), 1)
  defp edit(json, path, value), do: put_in(json, path, value)

  # ContentSource.compile takes one change per file: chain the changes of one file.
  defp merge(edits) do
    edits
    |> Enum.group_by(&elem(&1, 0), &elem(&1, 1))
    |> Enum.map(fn {file, funs} -> {file, fn v -> Enum.reduce(funs, v, & &1.(&2)) end} end)
  end

  # Breaks: a compiler floor check dropped, moved to another floor or reporting another code or
  # path (each case's below refused, its floor accepted).
  test "each fixture floor: accepted at the floor, refused just below it" do
    for c <- @fixture["cases"] do
      dir = Loka.ContentSource.copy(c["source"])
      assert {:ok, _, _} = compile(dir, c, c["floor"]), c["source"] <> " at " <> c["floor"]
      assert {:error, diags} = compile(dir, c, c["below"]), c["source"] <> " at " <> c["below"]

      assert List.to_tuple(c["compiler"]) in Enum.map(diags, &{&1["code"], &1["path"]}),
             inspect({c["floor"], diags})
    end
  end

  # Breaks: a schema names a new kernel_api floor and no fixture case exercises it.
  test "every kernel_api floor the schemas name has a fixture case" do
    floors = MapSet.new(@fixture["cases"], & &1["floor"])

    named =
      for file <- Path.wildcard("protocol/*.schema.json"),
          [_, v] <- Regex.scan(~r/kernel_api (?:at least )?(1\.\d+)/, File.read!(file)),
          into: MapSet.new(),
          do: v

    assert MapSet.difference(named, floors) == MapSet.new()
  end
end
