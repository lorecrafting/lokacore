defmodule Exmud.Framework.Farming.CropTest do
  use ExUnit.Case, async: true

  alias Exmud.Framework.Farming.Crop

  describe "from_map/1" do
    test "creates crop with required fields only" do
      data = %{
        "key" => "wheat_crop",
        "name" => "Wheat",
        "seed_item" => "wheat_seeds"
      }

      assert {:ok, crop} = Crop.from_map(data)
      assert crop.key == "wheat_crop"
      assert crop.name == "Wheat"
      assert crop.seed_item == "wheat_seeds"
      assert crop.growth_stages == []
      assert crop.harvest_yield == []
      assert crop.requires_water == false
      assert crop.can_wither == false
      assert crop.wither_time == 1800
      assert crop.skill_required == nil
      assert crop.skill_level == 0
      assert crop.xp_reward == nil
      assert crop.plant_message == "You plant the seeds in the soil."
      assert crop.water_message == "You water the growing plants."
      assert crop.harvest_message == "You harvest the crop."
      assert crop.wither_message == "The plants have withered from neglect."
      assert crop.tags == []
    end

    test "creates crop with all custom fields" do
      data = %{
        "key" => "wheat_crop",
        "name" => "Wheat",
        "seed_item" => "wheat_seeds",
        "growth_stages" => [
          %{"stage" => "planted", "duration" => 300, "description" => "Seeds freshly planted."},
          %{"stage" => "sprouting", "duration" => 600, "description" => "Small green shoots."},
          %{"stage" => "harvestable", "duration" => nil, "description" => "Golden wheat ready."}
        ],
        "harvest_yield" => [
          %{"item" => "wheat", "quantity" => [3, 6], "chance" => 1.0},
          %{"item" => "wheat_seeds", "quantity" => 2, "chance" => 0.5}
        ],
        "requires_water" => true,
        "can_wither" => true,
        "wither_time" => 2400,
        "skill_required" => "farming",
        "skill_level" => 5,
        "xp_reward" => %{"skill" => "farming", "amount" => 15},
        "plant_message" => "You carefully plant the wheat seeds.",
        "water_message" => "You water the wheat crop.",
        "harvest_message" => "You harvest the golden wheat.",
        "wither_message" => "The wheat has withered away.",
        "tags" => ["grain", "basic"]
      }

      assert {:ok, crop} = Crop.from_map(data)
      assert crop.key == "wheat_crop"
      assert crop.name == "Wheat"
      assert crop.seed_item == "wheat_seeds"
      assert length(crop.growth_stages) == 3
      assert Enum.at(crop.growth_stages, 0).stage == "planted"
      assert Enum.at(crop.growth_stages, 0).duration == 300
      assert Enum.at(crop.growth_stages, 2).duration == nil
      assert length(crop.harvest_yield) == 2
      assert Enum.at(crop.harvest_yield, 0).item == "wheat"
      assert Enum.at(crop.harvest_yield, 0).quantity == {3, 6}
      assert Enum.at(crop.harvest_yield, 1).quantity == 2
      assert crop.requires_water == true
      assert crop.can_wither == true
      assert crop.wither_time == 2400
      assert crop.skill_required == "farming"
      assert crop.skill_level == 5
      assert crop.xp_reward == %{skill: "farming", amount: 15}
      assert crop.plant_message == "You carefully plant the wheat seeds."
      assert crop.water_message == "You water the wheat crop."
      assert crop.harvest_message == "You harvest the golden wheat."
      assert crop.wither_message == "The wheat has withered away."
      assert crop.tags == ["grain", "basic"]
    end

    test "accepts atom keys" do
      data = %{
        key: "corn_crop",
        name: "Corn",
        seed_item: "corn_seeds",
        requires_water: true
      }

      assert {:ok, crop} = Crop.from_map(data)
      assert crop.key == "corn_crop"
      assert crop.name == "Corn"
      assert crop.seed_item == "corn_seeds"
      assert crop.requires_water == true
    end

    test "returns error when key is missing" do
      data = %{"name" => "No Key", "seed_item" => "seeds"}

      assert {:error, {:missing_field, "key"}} = Crop.from_map(data)
    end

    test "returns error when name is missing" do
      data = %{"key" => "no_name", "seed_item" => "seeds"}

      assert {:error, {:missing_field, "name"}} = Crop.from_map(data)
    end

    test "returns error when seed_item is missing" do
      data = %{"key" => "no_seed", "name" => "No Seed"}

      assert {:error, {:missing_field, "seed_item"}} = Crop.from_map(data)
    end

    test "handles empty growth_stages list" do
      data = %{
        "key" => "simple_crop",
        "name" => "Simple Crop",
        "seed_item" => "simple_seeds",
        "growth_stages" => []
      }

      assert {:ok, crop} = Crop.from_map(data)
      assert crop.growth_stages == []
    end

    test "handles empty harvest_yield list" do
      data = %{
        "key" => "simple_crop",
        "name" => "Simple Crop",
        "seed_item" => "simple_seeds",
        "harvest_yield" => []
      }

      assert {:ok, crop} = Crop.from_map(data)
      assert crop.harvest_yield == []
    end

    test "parses growth stage with missing fields using defaults" do
      data = %{
        "key" => "test_crop",
        "name" => "Test",
        "seed_item" => "test_seeds",
        "growth_stages" => [
          %{}
        ]
      }

      assert {:ok, crop} = Crop.from_map(data)
      assert length(crop.growth_stages) == 1
      stage = Enum.at(crop.growth_stages, 0)
      assert stage.stage == "planted"
      assert stage.duration == nil
      assert stage.description == ""
    end

    test "parses harvest yield with missing fields using defaults" do
      data = %{
        "key" => "test_crop",
        "name" => "Test",
        "seed_item" => "test_seeds",
        "harvest_yield" => [
          %{}
        ]
      }

      assert {:ok, crop} = Crop.from_map(data)
      assert length(crop.harvest_yield) == 1
      yield = Enum.at(crop.harvest_yield, 0)
      assert yield.item == ""
      assert yield.quantity == 1
      assert yield.chance == 1.0
    end

    test "parses xp_reward as nil when not provided" do
      data = %{
        "key" => "test_crop",
        "name" => "Test",
        "seed_item" => "test_seeds"
      }

      assert {:ok, crop} = Crop.from_map(data)
      assert crop.xp_reward == nil
    end

    test "parses xp_reward with skill and amount" do
      data = %{
        "key" => "test_crop",
        "name" => "Test",
        "seed_item" => "test_seeds",
        "xp_reward" => %{"skill" => "farming", "amount" => 20}
      }

      assert {:ok, crop} = Crop.from_map(data)
      assert crop.xp_reward == %{skill: "farming", amount: 20}
    end

    test "parses xp_reward with missing fields using defaults" do
      data = %{
        "key" => "test_crop",
        "name" => "Test",
        "seed_item" => "test_seeds",
        "xp_reward" => %{}
      }

      assert {:ok, crop} = Crop.from_map(data)
      assert crop.xp_reward == %{skill: nil, amount: 0}
    end

    test "parses xp_reward as nil when not a map" do
      data = %{
        "key" => "test_crop",
        "name" => "Test",
        "seed_item" => "test_seeds",
        "xp_reward" => "invalid"
      }

      assert {:ok, crop} = Crop.from_map(data)
      assert crop.xp_reward == nil
    end

    test "parses quantity as tuple when list with two elements" do
      data = %{
        "key" => "test_crop",
        "name" => "Test",
        "seed_item" => "test_seeds",
        "harvest_yield" => [
          %{"item" => "grain", "quantity" => [5, 10]}
        ]
      }

      assert {:ok, crop} = Crop.from_map(data)
      yield = Enum.at(crop.harvest_yield, 0)
      assert yield.quantity == {5, 10}
    end

    test "parses quantity as integer when given integer" do
      data = %{
        "key" => "test_crop",
        "name" => "Test",
        "seed_item" => "test_seeds",
        "harvest_yield" => [
          %{"item" => "grain", "quantity" => 7}
        ]
      }

      assert {:ok, crop} = Crop.from_map(data)
      yield = Enum.at(crop.harvest_yield, 0)
      assert yield.quantity == 7
    end

    test "parses quantity as 1 when invalid format" do
      data = %{
        "key" => "test_crop",
        "name" => "Test",
        "seed_item" => "test_seeds",
        "harvest_yield" => [
          %{"item" => "grain", "quantity" => "invalid"}
        ]
      }

      assert {:ok, crop} = Crop.from_map(data)
      yield = Enum.at(crop.harvest_yield, 0)
      assert yield.quantity == 1
    end

    test "parses quantity as 1 when list has wrong length" do
      data = %{
        "key" => "test_crop",
        "name" => "Test",
        "seed_item" => "test_seeds",
        "harvest_yield" => [
          %{"item" => "grain", "quantity" => [1, 2, 3]}
        ]
      }

      assert {:ok, crop} = Crop.from_map(data)
      yield = Enum.at(crop.harvest_yield, 0)
      assert yield.quantity == 1
    end
  end

  describe "initial_stage/1" do
    test "returns the first growth stage name" do
      crop = %Crop{
        growth_stages: [
          %{stage: "planted", duration: 300, description: "Seeds planted."},
          %{stage: "sprouting", duration: 600, description: "Growing."},
          %{stage: "harvestable", duration: nil, description: "Ready."}
        ]
      }

      assert Crop.initial_stage(crop) == "planted"
    end

    test "returns 'planted' when growth_stages is empty" do
      crop = %Crop{growth_stages: []}

      assert Crop.initial_stage(crop) == "planted"
    end
  end

  describe "next_stage/2" do
    setup do
      crop = %Crop{
        growth_stages: [
          %{stage: "planted", duration: 300, description: "Seeds planted."},
          %{stage: "sprouting", duration: 600, description: "Growing."},
          %{stage: "mature", duration: 900, description: "Almost ready."},
          %{stage: "harvestable", duration: nil, description: "Ready."}
        ]
      }

      {:ok, crop: crop}
    end

    test "returns next stage from first stage", %{crop: crop} do
      next = Crop.next_stage(crop, "planted")

      assert next.stage == "sprouting"
      assert next.duration == 600
    end

    test "returns next stage from middle stage", %{crop: crop} do
      next = Crop.next_stage(crop, "sprouting")

      assert next.stage == "mature"
      assert next.duration == 900
    end

    test "returns next stage before final", %{crop: crop} do
      next = Crop.next_stage(crop, "mature")

      assert next.stage == "harvestable"
      assert next.duration == nil
    end

    test "returns nil when at final stage", %{crop: crop} do
      assert Crop.next_stage(crop, "harvestable") == nil
    end

    test "returns nil when stage name doesn't exist", %{crop: crop} do
      assert Crop.next_stage(crop, "nonexistent") == nil
    end

    test "returns nil when growth_stages is empty" do
      crop = %Crop{growth_stages: []}

      assert Crop.next_stage(crop, "planted") == nil
    end

    test "handles single stage crop" do
      crop = %Crop{
        growth_stages: [
          %{stage: "harvestable", duration: nil, description: "Ready."}
        ]
      }

      assert Crop.next_stage(crop, "harvestable") == nil
    end
  end

  describe "get_stage/2" do
    setup do
      crop = %Crop{
        growth_stages: [
          %{stage: "planted", duration: 300, description: "Seeds planted."},
          %{stage: "sprouting", duration: 600, description: "Growing."},
          %{stage: "harvestable", duration: nil, description: "Ready."}
        ]
      }

      {:ok, crop: crop}
    end

    test "returns stage by name", %{crop: crop} do
      stage = Crop.get_stage(crop, "sprouting")

      assert stage.stage == "sprouting"
      assert stage.duration == 600
      assert stage.description == "Growing."
    end

    test "returns first stage", %{crop: crop} do
      stage = Crop.get_stage(crop, "planted")

      assert stage.stage == "planted"
      assert stage.duration == 300
    end

    test "returns last stage", %{crop: crop} do
      stage = Crop.get_stage(crop, "harvestable")

      assert stage.stage == "harvestable"
      assert stage.duration == nil
    end

    test "returns nil when stage doesn't exist", %{crop: crop} do
      assert Crop.get_stage(crop, "nonexistent") == nil
    end

    test "returns nil when growth_stages is empty" do
      crop = %Crop{growth_stages: []}

      assert Crop.get_stage(crop, "planted") == nil
    end
  end

  describe "harvestable_stage?/2" do
    setup do
      crop = %Crop{
        growth_stages: [
          %{stage: "planted", duration: 300, description: "Seeds planted."},
          %{stage: "sprouting", duration: 600, description: "Growing."},
          %{stage: "harvestable", duration: nil, description: "Ready."}
        ]
      }

      {:ok, crop: crop}
    end

    test "returns true for stage with nil duration", %{crop: crop} do
      assert Crop.harvestable_stage?(crop, "harvestable") == true
    end

    test "returns false for stage with duration", %{crop: crop} do
      assert Crop.harvestable_stage?(crop, "planted") == false
      assert Crop.harvestable_stage?(crop, "sprouting") == false
    end

    test "returns false for nonexistent stage", %{crop: crop} do
      assert Crop.harvestable_stage?(crop, "nonexistent") == false
    end

    test "returns false when growth_stages is empty" do
      crop = %Crop{growth_stages: []}

      assert Crop.harvestable_stage?(crop, "harvestable") == false
    end

    test "handles multiple harvestable stages" do
      crop = %Crop{
        growth_stages: [
          %{stage: "early_harvest", duration: nil, description: "Can harvest early."},
          %{stage: "perfect_harvest", duration: nil, description: "Perfect harvest."}
        ]
      }

      assert Crop.harvestable_stage?(crop, "early_harvest") == true
      assert Crop.harvestable_stage?(crop, "perfect_harvest") == true
    end
  end

  describe "calculate_quantity/1" do
    test "returns random value in range for tuple" do
      # Run multiple times to check randomness is within bounds
      Enum.each(1..50, fn _ ->
        quantity = Crop.calculate_quantity({3, 8})
        assert quantity >= 3
        assert quantity <= 8
      end)
    end

    test "returns exact value for integer" do
      assert Crop.calculate_quantity(5) == 5
      assert Crop.calculate_quantity(1) == 1
      assert Crop.calculate_quantity(100) == 100
    end

    test "returns 1 for invalid input" do
      assert Crop.calculate_quantity("invalid") == 1
      assert Crop.calculate_quantity(nil) == 1
      assert Crop.calculate_quantity([1, 2, 3]) == 1
      assert Crop.calculate_quantity(%{}) == 1
    end

    test "handles single value tuple (min equals max)" do
      Enum.each(1..10, fn _ ->
        quantity = Crop.calculate_quantity({5, 5})
        assert quantity == 5
      end)
    end

    test "handles zero values" do
      assert Crop.calculate_quantity(0) == 0
      assert Crop.calculate_quantity({0, 0}) == 0
    end
  end

  describe "roll_harvest_yields/2" do
    test "returns all yields with 100% chance" do
      crop = %Crop{
        harvest_yield: [
          %{item: "wheat", quantity: 5, chance: 1.0},
          %{item: "seeds", quantity: 2, chance: 1.0}
        ]
      }

      yields = Crop.roll_harvest_yields(crop)

      assert length(yields) == 2
      assert Enum.any?(yields, fn y -> y.item == "wheat" end)
      assert Enum.any?(yields, fn y -> y.item == "seeds" end)
    end

    test "filters yields based on chance" do
      crop = %Crop{
        harvest_yield: [
          %{item: "wheat", quantity: 5, chance: 1.0},
          %{item: "rare_seed", quantity: 1, chance: 0.0}
        ]
      }

      # Run multiple times to verify
      Enum.each(1..10, fn _ ->
        yields = Crop.roll_harvest_yields(crop)

        # Should always get wheat, never get rare_seed
        assert length(yields) == 1
        wheat = Enum.at(yields, 0)
        assert wheat.item == "wheat"
      end)
    end

    test "applies quality bonus to quantities" do
      crop = %Crop{
        harvest_yield: [
          %{item: "wheat", quantity: 10, chance: 1.0}
        ]
      }

      yields = Crop.roll_harvest_yields(crop, 2.0)

      assert length(yields) == 1
      wheat = Enum.at(yields, 0)
      assert wheat.quantity == 20
    end

    test "ensures minimum quantity of 1 even with low bonus" do
      crop = %Crop{
        harvest_yield: [
          %{item: "wheat", quantity: 10, chance: 1.0}
        ]
      }

      yields = Crop.roll_harvest_yields(crop, 0.01)

      assert length(yields) == 1
      wheat = Enum.at(yields, 0)
      assert wheat.quantity >= 1
    end

    test "handles random quantity ranges" do
      crop = %Crop{
        harvest_yield: [
          %{item: "wheat", quantity: {3, 6}, chance: 1.0}
        ]
      }

      # Run multiple times to check bounds
      Enum.each(1..20, fn _ ->
        yields = Crop.roll_harvest_yields(crop)

        assert length(yields) == 1
        wheat = Enum.at(yields, 0)
        assert wheat.quantity >= 3
        assert wheat.quantity <= 6
      end)
    end

    test "applies quality bonus to random quantities" do
      crop = %Crop{
        harvest_yield: [
          %{item: "wheat", quantity: {2, 4}, chance: 1.0}
        ]
      }

      # With 2x bonus, should get 4-8
      Enum.each(1..20, fn _ ->
        yields = Crop.roll_harvest_yields(crop, 2.0)

        assert length(yields) == 1
        wheat = Enum.at(yields, 0)
        assert wheat.quantity >= 4
        assert wheat.quantity <= 8
      end)
    end

    test "returns empty list when no yields pass chance roll" do
      crop = %Crop{
        harvest_yield: [
          %{item: "impossible", quantity: 1, chance: 0.0}
        ]
      }

      Enum.each(1..10, fn _ ->
        yields = Crop.roll_harvest_yields(crop)
        assert yields == []
      end)
    end

    test "returns empty list when harvest_yield is empty" do
      crop = %Crop{harvest_yield: []}

      yields = Crop.roll_harvest_yields(crop)
      assert yields == []
    end

    test "handles multiple yields with different chances" do
      crop = %Crop{
        harvest_yield: [
          %{item: "common", quantity: 5, chance: 1.0},
          %{item: "uncommon", quantity: 3, chance: 0.5},
          %{item: "rare", quantity: 1, chance: 0.0}
        ]
      }

      # Run multiple times to check statistics
      results =
        Enum.map(1..100, fn _ ->
          Crop.roll_harvest_yields(crop)
        end)

      # Common should always appear
      assert Enum.all?(results, fn yields ->
               Enum.any?(yields, fn y -> y.item == "common" end)
             end)

      # Rare should never appear
      assert Enum.all?(results, fn yields ->
               not Enum.any?(yields, fn y -> y.item == "rare" end)
             end)
    end

    test "defaults quality bonus to 1.0 when not provided" do
      crop = %Crop{
        harvest_yield: [
          %{item: "wheat", quantity: 10, chance: 1.0}
        ]
      }

      yields = Crop.roll_harvest_yields(crop)

      assert length(yields) == 1
      wheat = Enum.at(yields, 0)
      assert wheat.quantity == 10
    end

    test "rounds fractional quantities correctly" do
      crop = %Crop{
        harvest_yield: [
          %{item: "wheat", quantity: 10, chance: 1.0}
        ]
      }

      # 10 * 1.5 = 15.0, should round to 15
      yields = Crop.roll_harvest_yields(crop, 1.5)
      wheat = Enum.at(yields, 0)
      assert wheat.quantity == 15

      # 10 * 1.4 = 14.0, should round to 14
      yields = Crop.roll_harvest_yields(crop, 1.4)
      wheat = Enum.at(yields, 0)
      assert wheat.quantity == 14

      # 10 * 1.6 = 16.0, should round to 16
      yields = Crop.roll_harvest_yields(crop, 1.6)
      wheat = Enum.at(yields, 0)
      assert wheat.quantity == 16
    end
  end
end
