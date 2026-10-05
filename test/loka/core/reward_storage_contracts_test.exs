defmodule Loka.Core.RewardStorageContractsTest do
  use ExUnit.Case, async: true
  @cases JSON.decode!(File.read!("protocol/fixtures/reward_storage_contracts.json"))

  # Breaks: required/closed incoming transfer, adjustment or Put fields admit malformed inputs.
  test "reward/storage contracts share controlled valid and invalid examples" do
    for c <- @cases do
      result = Loka.Core.Contracts.validate(c["contract"], c["value"])
      assert result == :ok == c["valid"], c["name"]
    end
  end
end
