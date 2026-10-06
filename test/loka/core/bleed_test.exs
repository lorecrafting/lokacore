defmodule Loka.Core.BleedTest do
  use ExUnit.Case, async: true
  alias Loka.Core.Compose
  alias Loka.Core.Contracts

  @cases JSON.decode!(File.read!("protocol/fixtures/bleed_composition.json"))["cases"]

  # Breaks: an unrelated group edits the same bleed or a bandage transfer reaches no terminal holder.
  test "literal bleed and bandage composition cases" do
    for c <- @cases do
      assert Compose.compose(c["state"], %{"ops" => c["ops"]}) == c["expected"], c["id"]
    end
  end

  # Breaks: generic admission accepts an active wound without one of its required occurrence fields.
  test "active bleed contract rejects missing occurrence fields" do
    op = hd(@cases)["ops"] |> hd()

    for field <- ~w(effect source_id ends_at next_tick_at job_id) do
      value = Map.delete(op["value"], field)

      assert Contracts.validate("BleedRow", value) ==
               {:error, [%{path: "/" <> field, code: :missing_property}]}

      assert Contracts.validate("DeltaOp", Map.put(op, "value", value)) ==
               {:error, [%{path: "/value/" <> field, code: :missing_property}]}
    end
  end
end
