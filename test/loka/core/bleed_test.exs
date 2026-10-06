defmodule Loka.Core.BleedTest do
  use ExUnit.Case, async: true
  alias Loka.Core.Compose

  @cases JSON.decode!(File.read!("protocol/fixtures/bleed_composition.json"))["cases"]

  # Breaks: an unrelated group edits the same bleed or a bandage transfer reaches no terminal holder.
  test "literal bleed and bandage composition cases" do
    for c <- @cases do
      assert Compose.compose(c["state"], %{"ops" => c["ops"]}) == c["expected"], c["id"]
    end
  end
end
