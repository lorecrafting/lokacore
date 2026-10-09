defmodule Loka.Core.StatusTest do
  use ExUnit.Case, async: true
  alias Loka.Core.Compose

  @cases JSON.decode!(File.read!("protocol/fixtures/status_composition.json"))["cases"]

  # Breaks: the Elixir composer and the TypeScript one disagree on a status row's admission.
  test "literal status composition cases" do
    for c <- @cases do
      assert Compose.compose(c["state"], %{"ops" => c["ops"]}) == c["expected"], c["id"]
    end
  end
end
