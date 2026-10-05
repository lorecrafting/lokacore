defmodule Loka.Core.CombatContractsTest do
  use ExUnit.Case, async: true
  alias Loka.Core.Contracts

  # Breaks: a combat trust boundary admits missing fields, malformed refs or out-of-range values.
  test "combat contracts match the independent shared boundary corpus" do
    cases = JSON.decode!(File.read!("protocol/fixtures/combat_contracts.json"))["contracts"]

    for %{"name" => name, "contract" => contract, "value" => value, "errors" => errors} <- cases do
      expected = Enum.map(errors, &%{path: &1["path"], code: String.to_atom(&1["code"])})

      assert Contracts.validate(contract, value) ==
               if(expected == [], do: :ok, else: {:error, expected}),
             name
    end
  end
end
