defmodule Loka.Core.WispContractsTest do
  use ExUnit.Case, async: true
  alias Loka.Core.{Contracts, Compose, Canonical}
  @cases JSON.decode!(File.read!("protocol/fixtures/wisp_contracts.json"))
  @attempts JSON.decode!(File.read!("protocol/fixtures/wisp_attempts.json"))

  # Break: malformed typed attempts, marker, checks or topic grants cross the boundary.
  test "independent Wisp contract controls" do
    for c <- @cases,
        do: assert(Contracts.validate(c["contract"], c["value"]) == :ok == c["valid"], c["name"])
  end

  # Break: missing ownership, prior count or limit/closure guard commits a forged attempt.
  test "both-kernel literal bounded attempt answers" do
    for c <- @attempts do
      assert Compose.compose(c["state"], %{"ops" => c["ops"]}) == c["expected"], c["name"]
    end
  end

  # Break: the portable kernels disagree on randomized valid/invalid sitting counts and writer groups.
  test "randomized bounded attempt differential" do
    :rand.seed(:exsss, {6, 4, 3})
    first = hd(@attempts)

    cases =
      for _ <- 1..300 do
        count = Enum.random(-1..4)

        op =
          hd(first["ops"])
          |> Map.put("prior_count", Enum.random(0..3))
          |> Map.put("writer_group", Enum.random(0..1))

        state =
          put_in(first["state"], ["choices", op["continuation_id"], "attempts", "count"], count)

        close = %{
          "op" => "choice.close",
          "writer_group" => Enum.random(0..1),
          "continuation_id" => op["continuation_id"]
        }

        %{
          "state" => state,
          "delta" => %{"ops" => if(Enum.random([true, false]), do: [op, close], else: [op])}
        }
      end

    ours =
      for c <- cases,
          do: %{"result" => Compose.compose(c["state"], c["delta"]), "invariants" => []}

    path =
      Path.join(
        System.tmp_dir!(),
        "loka-wisp-differential-#{System.unique_integer([:positive])}.json"
      )

    File.write!(path, JSON.encode!(%{"ids" => [], "cases" => cases}))
    {theirs, status} = System.cmd("node", ["kernel/ts/test/differential_peer.ts", path])
    File.rm!(path)
    assert status == 0
    assert theirs == elem(Canonical.encode(ours), 1)
  end
end
