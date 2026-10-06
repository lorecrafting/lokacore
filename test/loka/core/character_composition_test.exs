defmodule Loka.Core.CharacterCompositionTest do
  use ExUnit.Case, async: true
  alias Loka.Core.Compose
  @fixture JSON.decode!(File.read!("protocol/fixtures/character_composition.json"))

  # Breaks: the new character target writes no portable row or permits a second selection.
  test "character selection's one-row and refusal answers are portable" do
    c = @fixture
    assert Compose.compose(c["state"], c["delta"]) == c["expected"]
    [op] = c["delta"]["ops"]
    selected = put_in(c, ["state", "characters"], %{op["character_id"] => op["value"]})
    assert Compose.compose(selected["state"], c["delta"]) == c["repeat"]
  end

  # Breaks: an existing malformed null character row is mistaken for an absent selection.
  test "present null character row refuses selection" do
    c = @fixture
    [op] = c["delta"]["ops"]
    state = Map.put(c["state"], "characters", %{op["character_id"] => nil})
    assert Compose.compose(state, c["delta"]) == c["present_null"]
  end
end
