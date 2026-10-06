defmodule Loka.Core.LightContractsTest do
  use ExUnit.Case, async: true
  @cases JSON.decode!(File.read!("protocol/fixtures/light_contracts.json"))
  # Break: malformed/missing participants or unbounded fuel history cross the wire boundary.
  test "light contracts share independent valid and invalid wire examples" do
    for c <- @cases,
        do:
          assert(
            Loka.Core.Contracts.validate(c["contract"], c["value"]) == :ok == c["valid"],
            c["name"]
          )
  end
end
