defmodule Loka.Core.FirstSearchContractsTest do
  use ExUnit.Case, async: true
  @cases JSON.decode!(File.read!("protocol/fixtures/first_search_contracts.json"))

  # Breaks: malformed quest-resolution triggers/consequences or malformed Notice actions enter contracts.
  test "first search contracts accept controls and reject malformed shapes" do
    for c <- @cases do
      assert Loka.Core.Contracts.validate(c["contract"], c["value"]) == :ok == c["valid"],
             c["name"]
    end
  end
end
