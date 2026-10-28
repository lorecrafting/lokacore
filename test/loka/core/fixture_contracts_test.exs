defmodule Loka.Core.FixtureContractsTest do
  # One test per protocol/fixtures/<name>_contracts.json. A fixture is a flat case list, a
  # {"contracts": [...]} list, or {"bases", "cases"} where a case edits its base by path, set,
  # omit or replace. A case with "errors" must match them exactly; otherwise only "valid".
  use ExUnit.Case, async: true
  alias Loka.Core.{Canonical, Compose, Contracts}

  for name <- ~w(bell combat first_search light liquid notice_board reward_storage riddle
                 service water wisp) do
    # Breaks: a wire contract admits a missing field, malformed ref, out-of-range value or open
    # variant the fixture refuses, or refuses a valid control.
    test "#{name} contract boundaries match the literal fixture answers" do
      fixture = JSON.decode!(File.read!("protocol/fixtures/#{unquote(name)}_contracts.json"))

      for {c, base} <- cases(fixture) do
        value = value(c, base)
        check(Contracts.validate(base["contract"], value), c, c["errors"])

        if variant = base["variant"] do
          schema =
            Enum.find(
              Contracts.defs()[base["contract"]]["oneOf"],
              &(&1["properties"][variant["field"]]["const"] == variant["value"])
            )

          assert schema, c["name"]
          defs = Map.put(Contracts.defs(), "Variant", schema)
          check(Contracts.validate("Variant", value, defs), c, c["variant_errors"] || c["errors"])
        end
      end
    end
  end

  defp cases(%{"bases" => bases, "cases" => cases}),
    do: Enum.map(cases, &{&1, Map.fetch!(bases, &1["base"])})

  defp cases(%{"contracts" => cases}), do: Enum.map(cases, &{&1, &1})
  defp cases(cases) when is_list(cases), do: Enum.map(cases, &{&1, &1})

  defp value(c, base) do
    value =
      cond do
        Map.has_key?(c, "replace") -> c["replace"]
        file = base["value_fixture"] -> JSON.decode!(File.read!(file))["value"]
        true -> base["value"]
      end

    value = if set = c["set"], do: Map.merge(value, set), else: value
    value = if is_binary(c["omit"]), do: Map.delete(value, c["omit"]), else: value
    if path = c["path"], do: changed(value, path, c), else: value
  end

  defp changed(v, [field], %{"omit" => true}), do: Map.delete(v, field)
  defp changed(v, [field], c) when is_integer(field), do: List.replace_at(v, field, c["value"])
  defp changed(v, [field], c), do: Map.put(v, field, c["value"])

  defp changed(v, [field | rest], c) when is_integer(field),
    do: List.update_at(v, field, &changed(&1, rest, c))

  defp changed(v, [field | rest], c), do: Map.update!(v, field, &changed(&1, rest, c))

  defp check(result, %{"errors" => _} = c, errors) do
    expected = Enum.map(errors, &%{path: &1["path"], code: String.to_atom(&1["code"])})
    assert result == if(expected == [], do: :ok, else: {:error, expected}), c["name"]
  end

  defp check(result, c, _errors), do: assert(result == :ok == c["valid"], c["name"])

  @attempts JSON.decode!(File.read!("protocol/fixtures/wisp_attempts.json"))

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
