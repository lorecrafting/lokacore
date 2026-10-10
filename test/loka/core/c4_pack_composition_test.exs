defmodule Loka.Core.C4PackCompositionTest do
  use ExUnit.Case, async: true
  alias Loka.Core.{Canonical, Compose, Invariants}
  @fixture JSON.decode!(File.read!("protocol/fixtures/c4_pack_composition.json"))

  defp state(name) do
    case @fixture["states"][name] do
      %{"extends" => parent, "edits" => edits} ->
        Enum.reduce(edits, state(parent), fn edit, rows ->
          update_in(rows, [edit["section"]], &Map.put(&1 || %{}, edit["key"], edit["value"]))
        end)

      base ->
        base
    end
  end

  # Breaks: pack admission accepts a foreign member, or a flight stamp names the unselected hound.
  test "literal exact pack admission and refusals agree with both independent guards" do
    for c <- @fixture["cases"] do
      state = state(c["state"])
      delta = %{"ops" => c["ops"]}
      assert Compose.compose(state, delta) == c["expected"], c["id"]

      assert Invariants.check("delta_preconditions_hold", %{
               "state" => state,
               "delta" => delta,
               "result" => c["expected"]
             }),
             c["id"]

      if c["counterfeit"] do
        refute Invariants.check("delta_preconditions_hold", %{
                 "state" => state,
                 "delta" => delta,
                 "result" => c["counterfeit"]
               }),
               c["id"]
      end
    end
  end

  # Breaks: final flight proof is applied to a lawful prefix before encounter closure.
  test "a legal transfer and stamp compose before their round exit is appended" do
    c =
      Enum.find(
        @fixture["cases"],
        &(&1["id"] == "flight-stamp-requires-same-group-encounter-exit")
      )

    assert Compose.compose(state(c["state"]), %{"ops" => c["ops"]}, false) == c["counterfeit"]
  end

  # Break: the kernels' encounter or pack composers or guards disagree on a mixed delta (toolbox
  # row 6c; compose_test.exs's random pool and the simulator sample carry no encounter op).
  test "random mixes of pack ops compose identically in both kernels" do
    :rand.seed(:exsss, {6, 6, 6})
    pool = for c <- @fixture["cases"], op <- c["ops"], do: op
    wobble = &%{&1 | "writer_group" => Enum.random([0, 0, 1])}

    cases =
      for _ <- 1..300 do
        c = Enum.random(@fixture["cases"])
        own = Enum.take_random(c["ops"], Enum.random(1..length(c["ops"])))
        ops = Enum.map(own ++ Enum.take_random(pool, Enum.random(0..1)), wobble)
        %{"state" => state(c["state"]), "delta" => %{"ops" => ops}}
      end

    ours =
      for input <- cases do
        result = Compose.compose(input["state"], input["delta"])
        assert Invariants.check("delta_preconditions_hold", Map.put(input, "result", result))
        %{"result" => result, "invariants" => [true]}
      end

    path = Path.join(System.tmp_dir!(), "loka-pack-#{System.unique_integer([:positive])}.json")

    try do
      File.write!(path, JSON.encode!(%{"ids" => ~w(delta_preconditions_hold), "cases" => cases}))
      {theirs, 0} = System.cmd("node", ["kernel/ts/test/differential_peer.ts", path])
      assert theirs == elem(Canonical.encode(ours), 1)
    after
      File.rm!(path)
    end

    results = Enum.frequencies_by(ours, &(get_in(&1, ["result", "fault", "code"]) || :ok))
    assert Map.get(results, :ok, 0) >= 15 and map_size(results) >= 3, inspect(results)
  end
end
