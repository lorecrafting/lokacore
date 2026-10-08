defmodule Loka.Core.ExpeditionTest do
  use ExUnit.Case, async: true
  alias Loka.Core.{Compose, Contracts}
  @fixture JSON.decode!(File.read!("protocol/fixtures/expedition.json"))

  # Breaks: the independent checker accepts a stale expected row, a rebound instance, a cursor
  # jump, a reused attempt, a second shelter or a restart after completion.
  test "expedition composition matches literal lifecycle and refusal rows" do
    for c <- @fixture["cases"] do
      delta = %{"ops" => c["ops"]}
      assert Contracts.validate("StateDelta", delta) == :ok, c["id"]
      assert Compose.compose(c["state"], delta) == c["expected"], c["id"]
    end
  end
end
