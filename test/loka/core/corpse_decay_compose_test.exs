defmodule Loka.Core.CorpseDecayComposeTest do
  use ExUnit.Case, async: true
  alias Loka.Core.{Canonical, Compose, Invariants}

  # Breaks (death@1 decay, owner decision 2026-11-02): a composer or the independent guard that
  # lets a non-corpse, a consumption or a carried corpse into the consumed holder, refuses the
  # decay itself, or the kernels disagree on it.
  @tag :tmp_dir
  test "only a death corpse decays from its room into the consumed holder", %{tmp_dir: dir} do
    [corpse, room, gone, body] = for n <- 1..4, do: "a0000000-0000-4000-8000-00000000000#{n}"

    state = %{
      "clock" => 100,
      "containers" => %{corpse => room, body => room},
      "known_entities" => %{
        corpse => %{"kind" => "item"},
        room => %{"kind" => "room"},
        gone => %{"kind" => "consumed"},
        body => %{"kind" => "body"}
      },
      "created" => %{corpse => %{"origin" => %{"kind" => "death"}}}
    }

    op = %{
      "op" => "entity.transfer",
      "writer_group" => 0,
      "entity_id" => corpse,
      "source_id" => room,
      "destination_id" => gone
    }

    decayed = %{
      "changes" => [
        %{"target" => %{"kind" => "containment", "entity_id" => corpse}, "value" => gone}
      ]
    }

    refused = %{
      "fault" => %{
        "code" => "precondition_failed",
        "kind" => "fault",
        "target" => %{"kind" => "containment", "entity_id" => corpse}
      }
    }

    cases = [
      {state, op, decayed},
      {put_in(state, ["created", corpse, "origin", "kind"], "spawned"), op, refused},
      {state, Map.put(op, "consumption", "eaten"), refused},
      {put_in(state, ["containers", corpse], body), %{op | "source_id" => body}, refused}
    ]

    for {s, o, want} <- cases do
      delta = %{"ops" => [o]}
      assert Compose.compose(s, delta) == want, inspect(o)
      check = %{"state" => s, "delta" => delta, "result" => decayed}
      assert Invariants.check("delta_preconditions_hold", check) == (want == decayed)
    end

    agree(
      dir,
      ["delta_preconditions_hold"],
      for({s, o, _} <- cases, do: %{"state" => s, "delta" => %{"ops" => [o]}}),
      for({_, _, want} <- cases, do: %{"result" => want, "invariants" => [true]})
    )
  end

  defp agree(dir, ids, cases, expected) do
    input = Path.join(dir, "cases.json")
    File.write!(input, JSON.encode!(%{"ids" => ids, "cases" => cases}))
    {actual, 0} = System.cmd("node", ["kernel/ts/test/differential_peer.ts", input])
    assert actual == elem(Canonical.encode(expected), 1)
  end
end
