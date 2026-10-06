alias Loka.Core.Contracts
cases = JSON.decode!(File.read!("protocol/fixtures/wisp_contracts.json"))
mutants = JSON.decode!(File.read!("docs/evidence/2026-10-05-b6-wisp/b6-schema-mutants.json"))

defmodule WispSweep do
  def update(node, [], f), do: f.(node)

  def update(node, [i | rest], f) when is_integer(i),
    do: List.update_at(node, i, &update(&1, rest, f))

  def update(node, [k | rest], f), do: Map.update!(node, k, &update(&1, rest, f))
end

results =
  for m <- mutants do
    defs =
      WispSweep.update(Contracts.defs(), [m["contract"] | m["path"]], fn node ->
        if m["field"],
          do: Map.update!(node, "required", &List.delete(&1, m["field"])),
          else: Map.delete(node, m["keyword"])
      end)

    caught =
      for c <- cases,
          c["valid"] == false and Contracts.validate(c["contract"], c["value"], defs) == :ok,
          do: c["name"]

    Map.merge(m, %{"elixir_killed" => caught != [], "elixir_controls" => caught})
  end

File.write!(
  "docs/evidence/2026-10-05-b6-wisp/b6-schema-elixir-results.json",
  JSON.encode!(results)
)

IO.inspect(%{
  guards: length(results),
  fixture_detected: Enum.count(results, & &1["elixir_killed"]),
  agrees_with_ts: Enum.all?(results, &(&1["elixir_killed"] == &1["killed"]))
})
