defmodule Loka.Core.LiquidTest do
  use ExUnit.Case, async: true
  alias Loka.Core.{Canonical, Compose, Contracts, Invariants}
  @fixture JSON.decode!(File.read!("protocol/fixtures/liquid_composition.json"))
  @ids ~w(delta_preconditions_hold liquid_rows_valid no_last_writer_wins)

  # Breaks: omitted debit, partial adoption, stale whole rows, malformed contents or conflicting writers.
  test "liquid composition matches independent rows and atomic refusals" do
    for c <- @fixture["cases"] do
      state = c["state"] || @fixture["state"]
      delta = %{"ops" => c["ops"]}
      assert Contracts.validate("StateDelta", delta) == :ok, c["id"]
      result = Compose.compose(state, delta)
      assert result == c["expected"], c["id"]

      for id <- @ids,
          do:
            assert(
              Invariants.check(id, %{"state" => state, "delta" => delta, "result" => result}),
              c["id"]
            )
    end
  end

  # Breaks: independent replay trusts composition, omits a Pour participant or accepts stale rows.
  test "liquid replay rejects counterfeit successes and missing debit" do
    for c <- @fixture["cases"], get_in(c, ["expected", "fault", "code"]) != "conflicting_write" do
      changes =
        if c["expected"]["changes"],
          do: [],
          else:
            Enum.map(
              c["ops"],
              &%{
                "target" => %{"kind" => "liquid", "item_id" => &1["item_id"]},
                "value" => &1["to"]
              }
            )

      refute Invariants.check("delta_preconditions_hold", %{
               "state" => c["state"] || @fixture["state"],
               "delta" => %{"ops" => c["ops"]},
               "result" => %{"changes" => changes}
             }),
             c["id"]
    end

    c = hd(@fixture["cases"])

    refute Invariants.check("delta_preconditions_hold", %{
             "state" => @fixture["state"],
             "delta" => %{"ops" => c["ops"]},
             "result" => %{"changes" => [Enum.at(c["expected"]["changes"], 1)]}
           })
  end

  # Breaks: portable kernels disagree on liquid guards, overlays or independent final-row proof.
  @tag :tmp_dir
  test "liquid differential follows literal answers then randomized cases", %{tmp_dir: dir} do
    literal =
      for c <- @fixture["cases"] do
        state = c["state"] || @fixture["state"]
        delta = %{"ops" => c["ops"]}
        assert Compose.compose(state, delta) == c["expected"], c["id"]
        %{"state" => state, "delta" => delta}
      end

    :rand.seed(:exsss, {7, 5, 4})
    cases = literal ++ for(_ <- 1..300, do: random_case())

    ours =
      for %{"state" => state, "delta" => delta} <- cases do
        result = Compose.compose(state, delta)

        invariants =
          for id <- @ids,
              do: Invariants.check(id, %{"state" => state, "delta" => delta, "result" => result})

        assert Enum.all?(invariants), inspect(delta)
        %{"result" => result, "invariants" => invariants}
      end

    input = Path.join(dir, "liquid.json")
    File.write!(input, JSON.encode!(%{"ids" => @ids, "cases" => cases}))
    {theirs, 0} = System.cmd("node", ["kernel/ts/test/differential_peer.ts", input])
    assert theirs == elem(Canonical.encode(ours), 1)
  end

  defp random_case do
    base = @fixture["state"]
    specs = base["liquid_specs"]
    rows = Map.new(specs, fn {id, spec} -> {id, row(Enum.random(0..spec["capacity"]), spec)} end)
    state = Map.put(base, "liquids", rows)

    ops = for _ <- 1..Enum.random(0..4)//1, do: random_op(rows, specs)
    %{"state" => state, "delta" => %{"ops" => ops}}
  end

  defp random_op(rows, specs) do
    id = Enum.random(Map.keys(rows))
    spec = specs[id]

    %{
      "op" => "liquid.set",
      "writer_group" => Enum.random([0, 0, 1]),
      "item_id" => id,
      "from" => Enum.random([rows[id], row(Enum.random(0..8), spec)]),
      "to" => row(Enum.random(0..8), spec)
    }
  end

  defp row(0, _), do: %{"kind" => nil, "quantity" => 0}
  defp row(q, spec), do: %{"kind" => hd(spec["kinds"]), "quantity" => q}
end
