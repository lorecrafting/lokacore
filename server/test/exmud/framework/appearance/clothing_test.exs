defmodule Exmud.Framework.Appearance.ClothingTest do
  use ExUnit.Case

  alias Exmud.Framework.Appearance.Clothing
  alias Exmud.Framework.Player.GameState

  setup do
    # Create a test GameState
    game_state = %GameState{
      player_id: "test_player",
      stats: %{},
      inventory: [],
      equipment: %{},
      quests: %{},
      flags: %{},
      health: %{current: 100, max: 100},
      current_room_id: nil
    }

    %{game_state: game_state}
  end

  describe "get_worn_clothing/1" do
    test "returns empty map for new player", %{game_state: game_state} do
      clothing = Clothing.get_worn_clothing(game_state)

      assert clothing == %{}
    end

    test "returns worn clothing", %{game_state: game_state} do
      cloak = %{slot: :cloak, appearance_text: "wearing a red cloak"}
      game_state = %{game_state | stats: %{equipment: %{clothing: %{cloak: cloak}}}}

      clothing = Clothing.get_worn_clothing(game_state)

      assert clothing == %{cloak: cloak}
    end
  end

  describe "get_slot/2" do
    test "returns nil for empty slot", %{game_state: game_state} do
      assert Clothing.get_slot(game_state, :head) == nil
    end

    test "returns clothing in slot", %{game_state: game_state} do
      hat = %{slot: :head, appearance_text: "wearing a hat"}
      game_state = %{game_state | stats: %{equipment: %{clothing: %{head: hat}}}}

      assert Clothing.get_slot(game_state, :head) == hat
    end

    test "returns nil for different slot", %{game_state: game_state} do
      hat = %{slot: :head, appearance_text: "wearing a hat"}
      game_state = %{game_state | stats: %{equipment: %{clothing: %{head: hat}}}}

      assert Clothing.get_slot(game_state, :feet) == nil
    end
  end

  describe "wear/3" do
    test "wears clothing in valid slot", %{game_state: game_state} do
      cloak = %{slot: :cloak, appearance_text: "wearing a cloak"}

      {:ok, updated_state} = Clothing.wear(game_state, :cloak, cloak)

      assert Clothing.get_slot(updated_state, :cloak) == cloak
    end

    test "replaces existing clothing in slot", %{game_state: game_state} do
      old_cloak = %{slot: :cloak, appearance_text: "wearing an old cloak"}
      game_state = %{game_state | stats: %{equipment: %{clothing: %{cloak: old_cloak}}}}

      new_cloak = %{slot: :cloak, appearance_text: "wearing a new cloak"}
      {:ok, updated_state} = Clothing.wear(game_state, :cloak, new_cloak)

      assert Clothing.get_slot(updated_state, :cloak) == new_cloak
    end

    test "returns error for invalid slot", %{game_state: game_state} do
      clothing = %{appearance_text: "test"}

      assert {:error, {:invalid_slot, :invalid}} = Clothing.wear(game_state, :invalid, clothing)
    end

    test "can wear clothing in all valid slots", %{game_state: game_state} do
      for slot <- Clothing.clothing_slots() do
        item = %{slot: slot, appearance_text: "wearing #{slot}"}
        assert {:ok, _} = Clothing.wear(game_state, slot, item)
      end
    end
  end

  describe "remove/2" do
    test "removes clothing from slot", %{game_state: game_state} do
      cloak = %{slot: :cloak, appearance_text: "wearing a cloak"}
      game_state = %{game_state | stats: %{equipment: %{clothing: %{cloak: cloak}}}}

      {:ok, updated_state, removed_item} = Clothing.remove(game_state, :cloak)

      assert removed_item == cloak
      assert Clothing.get_slot(updated_state, :cloak) == nil
    end

    test "returns error when nothing worn in slot", %{game_state: game_state} do
      assert {:error, :nothing_worn} = Clothing.remove(game_state, :head)
    end

    test "doesn't affect other slots", %{game_state: game_state} do
      cloak = %{slot: :cloak, appearance_text: "wearing a cloak"}
      hat = %{slot: :head, appearance_text: "wearing a hat"}
      game_state = %{game_state | stats: %{equipment: %{clothing: %{cloak: cloak, head: hat}}}}

      {:ok, updated_state, _removed} = Clothing.remove(game_state, :cloak)

      assert Clothing.get_slot(updated_state, :head) == hat
      assert Clothing.get_slot(updated_state, :cloak) == nil
    end
  end

  describe "get_appearance_description/1" do
    test "returns nil for no clothing", %{game_state: game_state} do
      assert Clothing.get_appearance_description(game_state) == nil
    end

    test "returns single item description", %{game_state: game_state} do
      cloak = %{appearance_text: "wearing a red cloak", visibility: true}
      game_state = %{game_state | stats: %{equipment: %{clothing: %{cloak: cloak}}}}

      description = Clothing.get_appearance_description(game_state)

      assert description == "wearing a red cloak"
    end

    test "returns multiple items joined", %{game_state: game_state} do
      cloak = %{appearance_text: "wearing a red cloak", visibility: true, layer: :outer}
      hat = %{appearance_text: "wearing a hat", visibility: true, layer: :middle}

      game_state = %{game_state | stats: %{equipment: %{clothing: %{cloak: cloak, head: hat}}}}

      description = Clothing.get_appearance_description(game_state)

      assert description =~ "wearing a hat"
      assert description =~ "wearing a red cloak"
      assert description =~ ","
    end

    test "filters invisible items", %{game_state: game_state} do
      visible = %{appearance_text: "wearing a cloak", visibility: true}
      invisible = %{appearance_text: "wearing hidden armor", visibility: false}

      game_state = %{game_state | stats: %{equipment: %{clothing: %{cloak: visible, torso: invisible}}}}

      description = Clothing.get_appearance_description(game_state)

      assert description == "wearing a cloak"
    end

    test "sorts by layer order (under, middle, outer)", %{game_state: game_state} do
      outer = %{appearance_text: "outer cloak", visibility: true, layer: :outer}
      under = %{appearance_text: "under shirt", visibility: true, layer: :under}
      middle = %{appearance_text: "middle vest", visibility: true, layer: :middle}

      game_state = %{game_state | stats: %{equipment: %{clothing: %{cloak: outer, torso: middle, neck: under}}}}

      description = Clothing.get_appearance_description(game_state)

      # Should be ordered: under, middle, outer
      parts = String.split(description, ", ")
      assert Enum.at(parts, 0) == "under shirt"
      assert Enum.at(parts, 1) == "middle vest"
      assert Enum.at(parts, 2) == "outer cloak"
    end

    test "ignores items with empty appearance_text", %{game_state: game_state} do
      cloak = %{appearance_text: "wearing a cloak", visibility: true}
      empty = %{appearance_text: "", visibility: true}

      game_state = %{game_state | stats: %{equipment: %{clothing: %{cloak: cloak, head: empty}}}}

      description = Clothing.get_appearance_description(game_state)

      assert description == "wearing a cloak"
    end
  end

  describe "get_social_bonus/1" do
    test "returns 0 for no clothing", %{game_state: game_state} do
      assert Clothing.get_social_bonus(game_state) == 0
    end

    test "returns bonus from single item", %{game_state: game_state} do
      cloak = %{social_bonus: 5}
      game_state = %{game_state | stats: %{equipment: %{clothing: %{cloak: cloak}}}}

      assert Clothing.get_social_bonus(game_state) == 5
    end

    test "sums bonuses from multiple items", %{game_state: game_state} do
      cloak = %{social_bonus: 5}
      hat = %{social_bonus: 3}
      gloves = %{social_bonus: 2}

      game_state = %{game_state | stats: %{equipment: %{clothing: %{cloak: cloak, head: hat, hands: gloves}}}}

      assert Clothing.get_social_bonus(game_state) == 10
    end

    test "handles items without social_bonus", %{game_state: game_state} do
      cloak = %{social_bonus: 5}
      hat = %{}  # No social_bonus key

      game_state = %{game_state | stats: %{equipment: %{clothing: %{cloak: cloak, head: hat}}}}

      assert Clothing.get_social_bonus(game_state) == 5
    end
  end

  describe "get_warmth/1" do
    test "returns 0 for no clothing", %{game_state: game_state} do
      assert Clothing.get_warmth(game_state) == 0
    end

    test "returns warmth from single item", %{game_state: game_state} do
      cloak = %{warmth: 10}
      game_state = %{game_state | stats: %{equipment: %{clothing: %{cloak: cloak}}}}

      assert Clothing.get_warmth(game_state) == 10
    end

    test "sums warmth from multiple items", %{game_state: game_state} do
      cloak = %{warmth: 10}
      hat = %{warmth: 3}
      gloves = %{warmth: 2}

      game_state = %{game_state | stats: %{equipment: %{clothing: %{cloak: cloak, head: hat, hands: gloves}}}}

      assert Clothing.get_warmth(game_state) == 15
    end

    test "handles items without warmth", %{game_state: game_state} do
      cloak = %{warmth: 10}
      hat = %{}  # No warmth key

      game_state = %{game_state | stats: %{equipment: %{clothing: %{cloak: cloak, head: hat}}}}

      assert Clothing.get_warmth(game_state) == 10
    end
  end

  describe "get_active_disguise/1" do
    test "returns nil for no disguise", %{game_state: game_state} do
      cloak = %{faction_disguise: nil}
      game_state = %{game_state | stats: %{equipment: %{clothing: %{cloak: cloak}}}}

      assert Clothing.get_active_disguise(game_state) == nil
    end

    test "returns nil when no clothing worn", %{game_state: game_state} do
      assert Clothing.get_active_disguise(game_state) == nil
    end

    test "returns single faction disguise", %{game_state: game_state} do
      uniform = %{faction_disguise: "guards"}
      game_state = %{game_state | stats: %{equipment: %{clothing: %{torso: uniform}}}}

      assert Clothing.get_active_disguise(game_state) == "guards"
    end

    test "returns list when multiple different disguises", %{game_state: game_state} do
      guard_uniform = %{faction_disguise: "guards"}
      noble_cloak = %{faction_disguise: "nobility"}

      game_state = %{game_state | stats: %{equipment: %{clothing: %{torso: guard_uniform, cloak: noble_cloak}}}}

      result = Clothing.get_active_disguise(game_state)

      assert is_list(result)
      assert "guards" in result
      assert "nobility" in result
    end

    test "returns single disguise when same faction on multiple items", %{game_state: game_state} do
      guard_shirt = %{faction_disguise: "guards"}
      guard_pants = %{faction_disguise: "guards"}

      game_state = %{game_state | stats: %{equipment: %{clothing: %{torso: guard_shirt, legs: guard_pants}}}}

      assert Clothing.get_active_disguise(game_state) == "guards"
    end

    test "ignores items without faction_disguise", %{game_state: game_state} do
      uniform = %{faction_disguise: "guards"}
      hat = %{}

      game_state = %{game_state | stats: %{equipment: %{clothing: %{torso: uniform, head: hat}}}}

      assert Clothing.get_active_disguise(game_state) == "guards"
    end
  end

  describe "dye/3" do
    test "dyes dyeable item", %{game_state: game_state} do
      cloak = %{color: "red", dyeable: true}
      game_state = %{game_state | stats: %{equipment: %{clothing: %{cloak: cloak}}}}

      {:ok, updated_state} = Clothing.dye(game_state, :cloak, "blue")

      dyed_cloak = Clothing.get_slot(updated_state, :cloak)
      assert dyed_cloak.color == "blue"
    end

    test "returns error for non-dyeable item", %{game_state: game_state} do
      cloak = %{color: "red", dyeable: false}
      game_state = %{game_state | stats: %{equipment: %{clothing: %{cloak: cloak}}}}

      assert {:error, :not_dyeable} = Clothing.dye(game_state, :cloak, "blue")
    end

    test "returns error when nothing worn in slot", %{game_state: game_state} do
      assert {:error, :nothing_worn} = Clothing.dye(game_state, :cloak, "blue")
    end

    test "item without dyeable key defaults to not dyeable", %{game_state: game_state} do
      cloak = %{color: "red"}  # No dyeable key
      game_state = %{game_state | stats: %{equipment: %{clothing: %{cloak: cloak}}}}

      assert {:error, :not_dyeable} = Clothing.dye(game_state, :cloak, "blue")
    end
  end

  describe "clothing_slots/0" do
    test "returns list of valid slots" do
      slots = Clothing.clothing_slots()

      assert is_list(slots)
      assert :head in slots
      assert :face in slots
      assert :neck in slots
      assert :torso in slots
      assert :cloak in slots
      assert :hands in slots
      assert :waist in slots
      assert :legs in slots
      assert :feet in slots
    end

    test "returns 9 slots" do
      assert length(Clothing.clothing_slots()) == 9
    end
  end

  describe "layers/0" do
    test "returns list of valid layers" do
      layers = Clothing.layers()

      assert is_list(layers)
      assert :under in layers
      assert :middle in layers
      assert :outer in layers
    end

    test "returns 3 layers" do
      assert length(Clothing.layers()) == 3
    end
  end

  describe "integration tests" do
    test "complete outfit with multiple properties", %{game_state: game_state} do
      # Noble outfit with multiple bonuses
      crown = %{
        slot: :head,
        layer: :outer,
        appearance_text: "wearing a golden crown",
        social_bonus: 5,
        warmth: 0,
        visibility: true,
        faction_disguise: "nobility",
        dyeable: false,
        color: "gold"
      }

      cloak = %{
        slot: :cloak,
        layer: :outer,
        appearance_text: "wearing a purple velvet cloak",
        social_bonus: 3,
        warmth: 5,
        visibility: true,
        faction_disguise: "nobility",
        dyeable: true,
        color: "purple"
      }

      {:ok, game_state} = Clothing.wear(game_state, :head, crown)
      {:ok, game_state} = Clothing.wear(game_state, :cloak, cloak)

      # Check bonuses
      assert Clothing.get_social_bonus(game_state) == 8
      assert Clothing.get_warmth(game_state) == 5

      # Check appearance
      description = Clothing.get_appearance_description(game_state)
      assert description =~ "crown"
      assert description =~ "cloak"

      # Check disguise
      assert Clothing.get_active_disguise(game_state) == "nobility"

      # Dye the cloak
      {:ok, game_state} = Clothing.dye(game_state, :cloak, "red")
      updated_cloak = Clothing.get_slot(game_state, :cloak)
      assert updated_cloak.color == "red"

      # Can't dye the crown
      assert {:error, :not_dyeable} = Clothing.dye(game_state, :head, "silver")
    end
  end
end
