defmodule Loka.Core.CancelAlternativesTest do
  use ExUnit.Case, async: true
  alias Loka.Core.Contracts

  # Breaks: Elixir keeps only one cancellation alternative or admits an unbound cancellation.
  test "sight, water and encounter cancellation match literal shared answers" do
    cases = JSON.decode!(File.read!("protocol/fixtures/cancel_alternatives.json"))["cases"]

    for %{"name" => name, "contract" => contract, "value" => value, "errors" => errors} <- cases do
      expected = Enum.map(errors, &%{path: &1["path"], code: String.to_atom(&1["code"])})

      assert Contracts.validate(contract, value) ==
               if(expected == [], do: :ok, else: {:error, expected}),
             name
    end
  end
end
