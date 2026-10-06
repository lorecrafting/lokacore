defmodule Loka.Core.CrowCompositionTest do
  use ExUnit.Case, async: true
  alias Loka.Core.{Canonical, Compose, Contracts, Invariants}
  @cases JSON.decode!(File.read!("protocol/fixtures/crow_composition.json"))["cases"]

  # Breaks: Elixir accepts a stale crow row or writes a different plan and slot.
  test "crow transport composition matches independent literal answers" do
    for c <- @cases do
      delta = %{"ops" => c["ops"]}
      assert Contracts.validate("StateDelta", delta) == :ok, c["id"]
      result = Compose.compose(c["state"], delta)
      assert result == c["expected"], c["id"]

      assert Invariants.check("delta_preconditions_hold", %{
               "state" => c["state"],
               "delta" => delta,
               "result" => result
             }),
             c["id"]
    end
  end

  # Breaks: an invariant accepts a claimed success without the crow row.
  test "crow invariant rejects counterfeit success" do
    c = hd(@cases)

    refute Invariants.check("delta_preconditions_hold", %{
             "state" => c["state"],
             "delta" => %{"ops" => c["ops"]},
             "result" => %{"changes" => []}
           })
  end

  # Breaks: requiredUnless accepts only its first alternative or accepts no binding.
  test "crow-only job cancellation validates, unbound cancellation does not" do
    op = %{
      "op" => "job.cancel",
      "writer_group" => 0,
      "job_id" => "44444444-4444-4444-8444-444444444444",
      "crow_member_id" => "11111111-1111-4111-8111-111111111111",
      "crow_generation" => 1
    }

    assert Contracts.validate("DeltaOp", op) == :ok

    assert {:error, _} =
             Contracts.validate("DeltaOp", Map.drop(op, ~w(crow_member_id crow_generation)))
  end

  # Breaks: a crow-bound job without a closed phase passes the portable wire validator.
  test "crow-bound schedule requires its closed phase" do
    c = Enum.find(@cases, &(&1["id"] == "schedule-phase-bound-crow-job"))
    op = hd(c["ops"])

    assert %{"fault" => %{"code" => "precondition_failed"}} =
             Compose.compose(c["state"], %{"ops" => [Map.delete(op, "crow_phase")]})

    assert {:error, _} = Contracts.validate("DeltaOp", %{op | "crow_phase" => "paused_return"})
  end

  # Breaks: the portable kernels differ despite both having checked literal cases.
  @tag :tmp_dir
  test "crow deltas agree across kernels", %{tmp_dir: dir} do
    cases = Enum.map(@cases, &%{"state" => &1["state"], "delta" => %{"ops" => &1["ops"]}})
    input = Path.join(dir, "crow.json")
    File.write!(input, JSON.encode!(%{"ids" => ["delta_preconditions_hold"], "cases" => cases}))
    expected = Enum.map(@cases, &%{"result" => &1["expected"], "invariants" => [true]})
    {actual, 0} = System.cmd("node", ["kernel/ts/test/differential_peer.ts", input])
    assert actual == elem(Canonical.encode(expected), 1)
  end
end
