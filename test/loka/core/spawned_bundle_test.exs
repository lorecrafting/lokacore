defmodule Loka.Core.SpawnedBundleTest do
  use ExUnit.Case, async: true
  alias Loka.Core.{Canonical, Compose, Invariants}

  @literal JSON.decode!(File.read!("protocol/fixtures/spawned_bundle.json"))

  # Breaks: a complete birth can omit its pelt/HP, misplace the pelt, or bind a wrong generation.
  test "complete spawned pair, HP and slot have literal rows and reject malformed bundles" do
    s = @literal["state"]
    ops = @literal["ops"]
    expected = @literal["expected_rows"]
    good = Compose.compose(s, %{"ops" => ops})
    assert %{"changes" => changes} = good

    at = fn target ->
      Enum.find_value(changes, fn row -> if row["target"] == target, do: row["value"] end)
    end

    assert at.(%{"kind" => "entity", "entity_id" => expected["member"]}) == expected["hound"]
    assert at.(%{"kind" => "entity", "entity_id" => expected["child"]}) == expected["pelt"]
    assert at.(%{"kind" => "containment", "entity_id" => expected["member"]}) == expected["room"]
    assert at.(%{"kind" => "containment", "entity_id" => expected["child"]}) == expected["member"]

    assert at.(%{
             "kind" => "resource",
             "resource" => Enum.at(ops, 4)["resource"],
             "entity_id" => expected["member"]
           }) == expected["hp"]

    assert at.(%{"kind" => "population_slot", "plan" => Enum.at(ops, 5)["plan"], "slot" => 1}) ==
             expected["slot"]

    assert Invariants.check("delta_preconditions_hold", %{
             "state" => s,
             "delta" => %{"ops" => ops},
             "result" => good
           })

    variants = [
      List.update_at(ops, 3, &Map.put(&1, "destination_id", expected["room"])),
      Enum.reject(Enum.with_index(ops), fn {_, i} -> i in [2, 3] end) |> Enum.map(&elem(&1, 0)),
      List.delete_at(ops, 4),
      Enum.take(ops, 5)
      |> Enum.map(fn op ->
        if op["op"] == "entity.create",
          do: put_in(op, ["identity", "origin", "generation"], 2),
          else: op
      end),
      List.update_at(ops, 5, &put_in(&1, ["value", "generation"], 2)),
      ops ++ [Map.put(Enum.at(ops, 5), "slot", 2)],
      List.update_at(ops, 2, &put_in(&1, ["identity", "origin", "generation"], 2))
    ]

    for bad <- variants do
      assert %{"fault" => _} = Compose.compose(s, %{"ops" => bad})

      refute Invariants.check("delta_preconditions_hold", %{
               "state" => s,
               "delta" => %{"ops" => bad},
               "result" => good
             })
    end
  end

  # Breaks: final bundle validation is accidentally applied to intermediate paired prefixes.
  test "paired prefix remains composable for proposal hydration" do
    assert %{"changes" => _} =
             Compose.compose(@literal["state"], %{"ops" => Enum.take(@literal["ops"], 4)}, false)
  end

  # Breaks: an extra slot under another full plan ref claims the same newborn/group/ordinal.
  test "a newborn cannot also occupy a foreign plan slot" do
    state = @literal["state"]
    full = @literal["ops"]
    extra = put_in(List.last(full), ["plan", "key"], "foreign_hounds")
    ops = full ++ [extra]

    assert Compose.compose(state, %{"ops" => ops}) == %{
             "fault" => %{
               "kind" => "fault",
               "code" => "precondition_failed",
               "target" => %{"kind" => "clock"}
             }
           }

    accepted = Compose.compose(state, %{"ops" => full})

    forged = %{
      "changes" =>
        accepted["changes"] ++
          [
            %{
              "target" => %{
                "kind" => "population_slot",
                "plan" => extra["plan"],
                "slot" => extra["slot"]
              },
              "value" => extra["value"]
            }
          ]
    }

    refute Invariants.check("delta_preconditions_hold", %{
             "state" => state,
             "delta" => %{"ops" => ops},
             "result" => forged
           })
  end

  # Breaks: another writer group claims the newborn in a second slot, or assigns an existing hound without a birth.
  test "each final occupied slot binds its own same-group newborn" do
    state = @literal["state"]
    full = @literal["ops"]

    fault = %{
      "fault" => %{
        "kind" => "fault",
        "code" => "precondition_failed",
        "target" => %{"kind" => "clock"}
      }
    }

    extra = List.last(full) |> Map.put("writer_group", 1) |> Map.put("slot", 2)
    ops = full ++ [extra]
    assert Compose.compose(state, %{"ops" => ops}) == fault
    accepted = Compose.compose(state, %{"ops" => full})
    target = %{"kind" => "population_slot", "plan" => extra["plan"], "slot" => 2}

    forged = %{
      "changes" => accepted["changes"] ++ [%{"target" => target, "value" => extra["value"]}]
    }

    refute Invariants.check("delta_preconditions_hold", %{
             "state" => state,
             "delta" => %{"ops" => ops},
             "result" => forged
           })

    slot1 = Map.put(target, "slot", 1)
    empty = %{"generation" => 0, "member_id" => nil, "replacement_due" => nil}
    member = @literal["expected_rows"]["member"]

    prior =
      state
      |> Map.put("created", %{member => @literal["expected_rows"]["hound"]})
      |> Map.put("containers", %{member => @literal["expected_rows"]["room"]})
      |> Map.put("population_slots", %{
        Compose.key(slot1) => @literal["expected_rows"]["slot"],
        Compose.key(target) => empty
      })

    lone = List.last(full) |> Map.put("slot", 2) |> Map.put("expected", empty)
    assert Compose.compose(prior, %{"ops" => [lone]}) == fault

    refute Invariants.check("delta_preconditions_hold", %{
             "state" => prior,
             "delta" => %{"ops" => [lone]},
             "result" => %{"changes" => [%{"target" => target, "value" => lone["value"]}]}
           })
  end

  # Breaks: the two portable kernels diverge on an accepted bundle or missing-HP refusal.
  @tag :tmp_dir
  test "spawned bundle answers agree after their literal checks", %{tmp_dir: dir} do
    state = @literal["state"]

    cases =
      for ops <- [@literal["ops"], List.delete_at(@literal["ops"], 4)] do
        %{"state" => state, "delta" => %{"ops" => ops}}
      end

    input = Path.join(dir, "spawned.json")
    File.write!(input, JSON.encode!(%{"ids" => ["delta_preconditions_hold"], "cases" => cases}))

    expected =
      Enum.map(cases, fn %{"state" => s, "delta" => d} ->
        result = Compose.compose(s, d)

        %{
          "result" => result,
          "invariants" => [
            Invariants.check("delta_preconditions_hold", %{
              "state" => s,
              "delta" => d,
              "result" => result
            })
          ]
        }
      end)

    {actual, 0} = System.cmd("node", ["kernel/ts/test/differential_peer.ts", input])
    assert actual == elem(Canonical.encode(expected), 1)
  end
end
