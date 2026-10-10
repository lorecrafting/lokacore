defmodule Loka.Core.LevellingTest do
  use ExUnit.Case, async: true
  alias Loka.Core.Compose

  @cases JSON.decode!(File.read!("protocol/fixtures/levelling_composition.json"))["cases"]

  # Breaks: the Elixir composer and the TypeScript one disagree on a levelling row's admission.
  test "literal levelling composition cases" do
    for c <- @cases do
      assert Compose.compose(c["state"], %{"ops" => c["ops"]}) == c["expected"], c["id"]
    end
  end
end
