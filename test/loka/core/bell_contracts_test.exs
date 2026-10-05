defmodule Loka.Core.BellContractsTest do
  use ExUnit.Case, async: true
  @cases JSON.decode!(File.read!("protocol/fixtures/bell_contracts.json"))

  # Breaks: a malformed typed bell consequence or scene trigger crosses the contract boundary.
  test "bell contracts accept typed controls and reject missing evidence" do
    for c <- @cases do
      assert Loka.Core.Contracts.validate(c["contract"], c["value"]) == :ok == c["valid"],
             c["name"]
    end
  end
end
