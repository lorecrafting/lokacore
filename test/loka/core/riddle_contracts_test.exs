defmodule Loka.Core.RiddleContractsTest do
  use ExUnit.Case, async: true
  @cases JSON.decode!(File.read!("protocol/fixtures/riddle_contracts.json"))

  # Breaks: malformed answers/banks, leaked answers or malformed journal variants cross boundaries.
  test "bounded dialogue and journal contracts accept literal controls and reject malformed input" do
    for c <- @cases do
      assert Loka.Core.Contracts.validate(c["contract"], c["value"]) == :ok == c["valid"],
             c["name"]
    end
  end
end
