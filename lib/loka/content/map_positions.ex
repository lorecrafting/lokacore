defmodule Loka.Content.MapPositions do
  @moduledoc "Static drawing metadata; real room exits remain the only graph."
  import Loka.Content.Source, only: [at: 2, diag: 2, ref: 3, schema: 4]
  alias Loka.Core.Contracts

  def source(_, nil, _), do: {nil, []}
  def source([], _, _), do: {nil, []}
  def source([{_, :invalid}], _, _), do: {nil, []}

  def source([{rel, rows}], m, defs) do
    shape = %{"type" => "array", "items" => %{"$ref" => "MapPosition"}, "minItems" => 1}

    validation =
      Contracts.validate(
        "MapPositionsFile",
        rows,
        Map.put(Loka.Content.Source.contracts(), "MapPositionsFile", shape)
      )

    if validation != :ok do
      {:error, errors} = validation
      {nil, schema(rel, [], rows, errors)}
    else
      check(rel, rows, m, defs)
    end
  end

  def settings(located, nil), do: located
  def settings({entry, settings}, rows), do: {entry, Map.put(settings, "map_positions", rows)}

  defp check(rel, rows, m, defs) do
    rows = Enum.map(rows, &Map.update!(&1, "room", fn r -> ref(r, "room", m) end))
    keys = Enum.map(rows, & &1["room"]["key"])

    complete = Enum.sort(keys) == Enum.sort(Map.keys(defs["room"]))
    coords = Enum.map(rows, &Map.take(&1, ~w(x y z)))
    unique = Enum.uniq(coords) == coords
    checks = if complete and unique, do: [], else: [diag("SCHEMA_VIOLATION", at(rel, []))]

    {rows, references(rel, rows, m, defs) ++ checks ++ requirements(rel, m)}
  end

  defp references(rel, rows, m, defs) do
    for {row, i} <- Enum.with_index(rows),
        row["room"] != ref(row["room"]["key"], "room", m) or
          not Map.has_key?(defs["room"], row["room"]["key"]),
        do: diag("UNRESOLVED_REFERENCE", at(rel, [i, "room"]))
  end

  defp requirements(rel, m) do
    if m["requires"]["capabilities"]["knowledge"] == 1,
      do: [],
      else: [diag("UNDECLARED_CAPABILITY", at(rel, []))]
  end
end
