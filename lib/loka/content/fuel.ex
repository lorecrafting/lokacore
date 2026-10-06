defmodule Loka.Content.Fuel do
  @moduledoc "The first exact-item light consumer's authored fuel constraints."
  import Loka.Content.Source, only: [diag: 2, at: 2]
  alias Loka.Content.Refs
  @spec check(map() | nil, map()) :: [map()]
  def check(nil, _), do: []

  def check(m, defs) do
    for {_, {rel, [], item}} <- defs["item"],
        f = item["fuel"],
        f,
        d <- check_item(m, defs, rel, item, f),
        do: d
  end

  defp check_item(m, defs, rel, item, f) do
    path = at(rel, ["fuel"])

    bounded =
      if f["initial"] <= f["capacity"] and item["location"]["in"] != "template",
        do: [],
        else: [diag("SCHEMA_VIOLATION", path)]

    owner =
      if m["requires"]["capabilities"]["light"] == 1,
        do: [],
        else: [diag("UNDECLARED_CAPABILITY", path)]

    unit = f["unit"]

    supply =
      if f["kind"] == "source" do
        case Refs.resolve(f["supply"], "item", m, defs) do
          {_, _, %{"fuel" => %{"kind" => "supply", "unit" => expected_unit}}}
          when unit == expected_unit ->
            []

          _ ->
            [diag("UNRESOLVED_REFERENCE", at(rel, ["fuel", "supply"]))]
        end
      else
        []
      end

    bounded ++ owner ++ supply
  end
end
