defmodule Loka.Core.PatrolTest do
  use ExUnit.Case, async: true
  alias Loka.Core.{Canonical, Compose, Contracts, Invariants}
  @fixture JSON.decode!(File.read!("protocol/fixtures/patrol.json"))

  # Breaks: missing/unknown patrol fields, unbounded status or non-null/non-object expected cross the boundary.
  test "patrol contracts match independent boundary literals" do
    for c <- @fixture["contracts"] do
      errors =
        Enum.map(c["errors"], &%{path: &1["path"], code: String.to_existing_atom(&1["code"])})

      assert Contracts.validate(c["contract"], c["value"]) ==
               if(errors == [], do: :ok, else: {:error, errors}),
             c["name"]
    end
  end

  # Breaks: stale expected rows, swapped identities, illegal edges or cross-writer patrol writes are accepted.
  test "patrol composition matches literal lifecycle and refusal rows" do
    for c <- @fixture["cases"] do
      delta = %{"ops" => c["ops"]}
      assert Contracts.validate("StateDelta", delta) == :ok, c["id"]
      assert Compose.compose(c["state"], delta) == c["expected"], c["id"]

      assert Invariants.check("delta_preconditions_hold", %{
               "state" => c["state"],
               "delta" => delta,
               "result" => c["expected"]
             }),
             c["id"]
    end
  end

  # Breaks: independent replay trusts impossible successes or omits proof of the final patrol row.
  test "patrol invariant rejects counterfeit and missing writes" do
    for c <- @fixture["cases"], get_in(c, ["expected", "fault", "code"]) != "conflicting_write" do
      result =
        if c["expected"]["changes"],
          do: %{"changes" => []},
          else: %{
            "changes" => [
              %{
                "target" => %{
                  "kind" => "patrol",
                  "quest_instance_id" => hd(c["ops"])["quest_instance_id"]
                },
                "value" => List.last(c["ops"])["value"]
              }
            ]
          }

      refute Invariants.check("delta_preconditions_hold", %{
               "state" => c["state"],
               "delta" => %{"ops" => c["ops"]},
               "result" => result
             }),
             c["id"]
    end
  end

  # Breaks: the two portable composers or independent precondition checks disagree on the new op.
  @tag :tmp_dir
  test "patrol deltas agree across both kernels after their literal checks", %{tmp_dir: dir} do
    ids = ["delta_preconditions_hold"]

    cases =
      Enum.map(@fixture["cases"], &%{"state" => &1["state"], "delta" => %{"ops" => &1["ops"]}})

    input = Path.join(dir, "patrol.json")
    File.write!(input, JSON.encode!(%{"ids" => ids, "cases" => cases}))
    ours = Enum.map(@fixture["cases"], &%{"result" => &1["expected"], "invariants" => [true]})
    {theirs, 0} = System.cmd("node", ["kernel/ts/test/differential_peer.ts", input])
    assert theirs == elem(Canonical.encode(ours), 1)
  end
end
