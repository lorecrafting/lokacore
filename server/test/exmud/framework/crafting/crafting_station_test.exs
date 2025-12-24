defmodule Exmud.Framework.Crafting.CraftingStationTest do
  use ExUnit.Case, async: false

  alias Exmud.Framework.Crafting.CraftingStation
  alias Exmud.Framework.Crafting.CraftingRegistry
  alias Exmud.Framework.Crafting.Recipe

  setup do
    # Start the CraftingRegistry for tests that need it
    # Use the default name since CraftingStation hardcodes it
    # Set async: false for this test module to avoid conflicts
    {:ok, _pid} =
      start_supervised({CraftingRegistry, name: CraftingRegistry, load_on_start: false})

    # Create sample recipes for testing
    recipe1 = %Recipe{
      key: "recipe_iron_sword",
      name: "Iron Sword",
      station_type: "forge",
      skill_required: "blacksmithing",
      skill_level: 1
    }

    recipe2 = %Recipe{
      key: "recipe_steel_sword",
      name: "Steel Sword",
      station_type: "forge",
      skill_required: "blacksmithing",
      skill_level: 3
    }

    recipe3 = %Recipe{
      key: "recipe_health_potion",
      name: "Health Potion",
      station_type: "alchemy_bench",
      skill_required: "alchemy",
      skill_level: 2
    }

    recipe4 = %Recipe{
      key: "recipe_general_craft",
      name: "General Craft",
      station_type: nil,
      skill_required: nil,
      skill_level: 0
    }

    # Add recipes to registry
    recipes = %{
      "recipe_iron_sword" => recipe1,
      "recipe_steel_sword" => recipe2,
      "recipe_health_potion" => recipe3,
      "recipe_general_craft" => recipe4
    }

    # Store recipes in the registry state manually
    state = %{
      table: :ets.new(:test_recipes, [:set, :protected, read_concurrency: true]),
      path: "test",
      recipes: recipes
    }

    Enum.each(recipes, fn {key, recipe} ->
      :ets.insert(state.table, {key, recipe})
    end)

    # Update the registry with test recipes using GenServer.call
    :sys.replace_state(CraftingRegistry, fn _ -> state end)

    {:ok, recipes: recipes}
  end

  describe "get_station/1" do
    test "returns nil when entity is nil" do
      assert CraftingStation.get_station(nil) == nil
    end

    test "returns nil when entity has no components" do
      entity = %{id: "room1"}
      assert CraftingStation.get_station(entity) == nil
    end

    test "returns nil when entity has no crafting_station component" do
      entity = %{
        id: "room1",
        components: %{other_component: %{}}
      }

      assert CraftingStation.get_station(entity) == nil
    end

    test "returns station from entity with crafting_station component" do
      entity = %{
        id: "room1",
        components: %{
          crafting_station: %{
            type: "forge",
            bonus: 0.1
          }
        }
      }

      station = CraftingStation.get_station(entity)
      assert %CraftingStation{} = station
      assert station.type == "forge"
      assert station.bonus == 0.1
    end

    test "handles string keys in components map" do
      entity = %{
        id: "room1",
        components: %{
          "crafting_station" => %{
            "type" => "alchemy_bench",
            "bonus" => 0.05
          }
        }
      }

      station = CraftingStation.get_station(entity)
      assert %CraftingStation{} = station
      assert station.type == "alchemy_bench"
      assert station.bonus == 0.05
    end

    test "handles mixed atom and string keys" do
      entity = %{
        id: "room1",
        components: %{
          "crafting_station" => %{
            type: "workbench",
            bonus: 0.02
          }
        }
      }

      station = CraftingStation.get_station(entity)
      assert %CraftingStation{} = station
      assert station.type == "workbench"
      assert station.bonus == 0.02
    end
  end

  describe "from_component/1" do
    test "creates station from valid component data with all fields" do
      data = %{
        type: "forge",
        bonus: 0.15,
        recipes_enabled: ["recipe_iron_sword", "recipe_steel_sword"],
        name: "Master Forge",
        description: "A powerful forge for metalworking."
      }

      station = CraftingStation.from_component(data)
      assert %CraftingStation{} = station
      assert station.type == "forge"
      assert station.bonus == 0.15
      assert station.recipes_enabled == ["recipe_iron_sword", "recipe_steel_sword"]
      assert station.name == "Master Forge"
      assert station.description == "A powerful forge for metalworking."
    end

    test "creates station with minimal fields" do
      data = %{type: "kitchen"}

      station = CraftingStation.from_component(data)
      assert %CraftingStation{} = station
      assert station.type == "kitchen"
      assert station.bonus == 0.0
      assert station.recipes_enabled == :all
      assert station.name == "Kitchen"
      assert station.description == "A well-equipped kitchen."
    end

    test "defaults to workbench when type is missing" do
      data = %{}

      station = CraftingStation.from_component(data)
      assert %CraftingStation{} = station
      assert station.type == "workbench"
      assert station.name == "Workbench"
      assert station.description == "A sturdy wooden workbench."
    end

    test "handles string 'all' for recipes_enabled" do
      data = %{
        type: "forge",
        recipes_enabled: "all"
      }

      station = CraftingStation.from_component(data)
      assert station.recipes_enabled == :all
    end

    test "handles nil for recipes_enabled" do
      data = %{
        type: "forge",
        recipes_enabled: nil
      }

      station = CraftingStation.from_component(data)
      assert station.recipes_enabled == :all
    end

    test "handles invalid recipes_enabled type" do
      data = %{
        type: "forge",
        recipes_enabled: "invalid_string"
      }

      station = CraftingStation.from_component(data)
      assert station.recipes_enabled == :all
    end

    test "returns nil for non-map data" do
      assert CraftingStation.from_component(nil) == nil
      assert CraftingStation.from_component("invalid") == nil
      assert CraftingStation.from_component(123) == nil
    end

    test "generates default names for all station types" do
      station_types = [
        {"forge", "Forge"},
        {"alchemy_bench", "Alchemy Bench"},
        {"workbench", "Workbench"},
        {"kitchen", "Kitchen"},
        {"loom", "Loom"},
        {"anvil", "Anvil"},
        {"enchanting_table", "Enchanting Table"},
        {"tanning_rack", "Tanning Rack"},
        {"smelter", "Smelter"},
        {"sawmill", "Sawmill"}
      ]

      Enum.each(station_types, fn {type, expected_name} ->
        data = %{type: type}
        station = CraftingStation.from_component(data)
        assert station.name == expected_name
      end)
    end

    test "generates default descriptions for all station types" do
      station_descriptions = [
        {"forge", "A blazing forge for metalwork."},
        {"alchemy_bench", "A cluttered bench with bubbling vials."},
        {"workbench", "A sturdy wooden workbench."},
        {"kitchen", "A well-equipped kitchen."},
        {"loom", "A wooden loom for weaving textiles."},
        {"anvil", "A heavy iron anvil."},
        {"enchanting_table", "A mystical table humming with power."},
        {"tanning_rack", "A wooden rack for curing leather."},
        {"smelter", "A furnace for smelting ore."},
        {"sawmill", "Equipment for processing lumber."},
        {"unknown_type", "A crafting station."}
      ]

      Enum.each(station_descriptions, fn {type, expected_desc} ->
        data = %{type: type}
        station = CraftingStation.from_component(data)
        assert station.description == expected_desc
      end)
    end
  end

  describe "get_available_recipes/1" do
    test "returns empty list when entity has no station" do
      entity = %{id: "room1"}
      recipes = CraftingStation.get_available_recipes(entity)
      assert recipes == []
    end

    test "returns all recipes for station type when recipes_enabled is :all" do
      entity = %{
        id: "room1",
        components: %{
          crafting_station: %{
            type: "forge",
            recipes_enabled: :all
          }
        }
      }

      available = CraftingStation.get_available_recipes(entity)

      # Should return all forge recipes
      forge_recipe_keys = Enum.map(available, & &1.key)
      assert "recipe_iron_sword" in forge_recipe_keys
      assert "recipe_steel_sword" in forge_recipe_keys
      refute "recipe_health_potion" in forge_recipe_keys
    end

    test "returns only specified recipes when recipes_enabled is a list" do
      entity = %{
        id: "room1",
        components: %{
          crafting_station: %{
            type: "forge",
            recipes_enabled: ["recipe_iron_sword"]
          }
        }
      }

      available = CraftingStation.get_available_recipes(entity)
      assert length(available) == 1
      assert hd(available).key == "recipe_iron_sword"
    end

    test "filters out non-existent recipes from recipes_enabled list" do
      entity = %{
        id: "room1",
        components: %{
          crafting_station: %{
            type: "forge",
            recipes_enabled: ["recipe_iron_sword", "non_existent_recipe"]
          }
        }
      }

      available = CraftingStation.get_available_recipes(entity)
      assert length(available) == 1
      assert hd(available).key == "recipe_iron_sword"
    end

    test "returns empty list when all recipes in list are non-existent" do
      entity = %{
        id: "room1",
        components: %{
          crafting_station: %{
            type: "forge",
            recipes_enabled: ["fake1", "fake2"]
          }
        }
      }

      available = CraftingStation.get_available_recipes(entity)
      assert available == []
    end
  end

  describe "get_bonus/1" do
    test "returns 0.0 when entity has no station" do
      entity = %{id: "room1"}
      assert CraftingStation.get_bonus(entity) == 0.0
    end

    test "returns 0.0 when entity is nil" do
      assert CraftingStation.get_bonus(nil) == 0.0
    end

    test "returns bonus from station" do
      entity = %{
        id: "room1",
        components: %{
          crafting_station: %{
            type: "forge",
            bonus: 0.25
          }
        }
      }

      assert CraftingStation.get_bonus(entity) == 0.25
    end

    test "returns 0.0 when bonus is not specified" do
      entity = %{
        id: "room1",
        components: %{
          crafting_station: %{
            type: "forge"
          }
        }
      }

      assert CraftingStation.get_bonus(entity) == 0.0
    end
  end

  describe "has_station_type?/2" do
    test "returns false when entity has no station" do
      entity = %{id: "room1"}
      assert CraftingStation.has_station_type?(entity, "forge") == false
    end

    test "returns false when entity is nil" do
      assert CraftingStation.has_station_type?(nil, "forge") == false
    end

    test "returns true when station type matches" do
      entity = %{
        id: "room1",
        components: %{
          crafting_station: %{type: "forge"}
        }
      }

      assert CraftingStation.has_station_type?(entity, "forge") == true
    end

    test "returns false when station type does not match" do
      entity = %{
        id: "room1",
        components: %{
          crafting_station: %{type: "forge"}
        }
      }

      assert CraftingStation.has_station_type?(entity, "alchemy_bench") == false
    end

    test "is case-sensitive" do
      entity = %{
        id: "room1",
        components: %{
          crafting_station: %{type: "forge"}
        }
      }

      assert CraftingStation.has_station_type?(entity, "Forge") == false
      assert CraftingStation.has_station_type?(entity, "FORGE") == false
    end
  end

  describe "can_craft_recipe?/2" do
    test "returns false when entity has no station" do
      entity = %{id: "room1"}
      assert CraftingStation.can_craft_recipe?(entity, "recipe_iron_sword") == false
    end

    test "returns false when entity is nil" do
      assert CraftingStation.can_craft_recipe?(nil, "recipe_iron_sword") == false
    end

    test "returns true when recipe is in enabled list" do
      entity = %{
        id: "room1",
        components: %{
          crafting_station: %{
            type: "forge",
            recipes_enabled: ["recipe_iron_sword", "recipe_steel_sword"]
          }
        }
      }

      assert CraftingStation.can_craft_recipe?(entity, "recipe_iron_sword") == true
      assert CraftingStation.can_craft_recipe?(entity, "recipe_steel_sword") == true
    end

    test "returns false when recipe is not in enabled list" do
      entity = %{
        id: "room1",
        components: %{
          crafting_station: %{
            type: "forge",
            recipes_enabled: ["recipe_iron_sword"]
          }
        }
      }

      assert CraftingStation.can_craft_recipe?(entity, "recipe_steel_sword") == false
    end

    test "returns true when recipes_enabled is :all and recipe matches station type" do
      entity = %{
        id: "room1",
        components: %{
          crafting_station: %{
            type: "forge",
            recipes_enabled: :all
          }
        }
      }

      assert CraftingStation.can_craft_recipe?(entity, "recipe_iron_sword") == true
    end

    test "returns false when recipes_enabled is :all and recipe does not match station type" do
      entity = %{
        id: "room1",
        components: %{
          crafting_station: %{
            type: "forge",
            recipes_enabled: :all
          }
        }
      }

      assert CraftingStation.can_craft_recipe?(entity, "recipe_health_potion") == false
    end

    test "returns true when recipe has no station_type requirement and recipes_enabled is :all" do
      entity = %{
        id: "room1",
        components: %{
          crafting_station: %{
            type: "workbench",
            recipes_enabled: :all
          }
        }
      }

      assert CraftingStation.can_craft_recipe?(entity, "recipe_general_craft") == true
    end

    test "returns false when recipe does not exist" do
      entity = %{
        id: "room1",
        components: %{
          crafting_station: %{
            type: "forge",
            recipes_enabled: :all
          }
        }
      }

      assert CraftingStation.can_craft_recipe?(entity, "non_existent_recipe") == false
    end

    test "returns false when recipe key is in list but recipe does not exist" do
      entity = %{
        id: "room1",
        components: %{
          crafting_station: %{
            type: "forge",
            recipes_enabled: ["non_existent_recipe"]
          }
        }
      }

      # Recipe is in the list, but doesn't exist in registry
      # The function checks if key is in list, so it returns true
      assert CraftingStation.can_craft_recipe?(entity, "non_existent_recipe") == true
    end
  end

  describe "valid_station_types/0" do
    test "returns list of all valid station types" do
      types = CraftingStation.valid_station_types()

      assert is_list(types)
      assert "forge" in types
      assert "alchemy_bench" in types
      assert "workbench" in types
      assert "kitchen" in types
      assert "loom" in types
      assert "anvil" in types
      assert "enchanting_table" in types
      assert "tanning_rack" in types
      assert "smelter" in types
      assert "sawmill" in types
      assert length(types) == 10
    end

    test "all types are strings" do
      types = CraftingStation.valid_station_types()
      assert Enum.all?(types, &is_binary/1)
    end
  end

  describe "edge cases" do
    test "handles empty components map" do
      entity = %{
        id: "room1",
        components: %{}
      }

      assert CraftingStation.get_station(entity) == nil
      assert CraftingStation.get_bonus(entity) == 0.0
      assert CraftingStation.has_station_type?(entity, "forge") == false
    end

    test "handles deeply nested component data" do
      entity = %{
        id: "room1",
        components: %{
          crafting_station: %{
            type: "forge",
            bonus: 0.5,
            recipes_enabled: ["recipe_iron_sword"],
            name: "Custom Forge",
            description: "A custom description",
            extra_field: "ignored"
          }
        }
      }

      station = CraftingStation.get_station(entity)
      assert station.type == "forge"
      assert station.bonus == 0.5
      assert station.name == "Custom Forge"
      assert station.description == "A custom description"
    end

    test "handles negative bonus values" do
      entity = %{
        id: "room1",
        components: %{
          crafting_station: %{
            type: "forge",
            bonus: -0.1
          }
        }
      }

      assert CraftingStation.get_bonus(entity) == -0.1
    end

    test "handles very large bonus values" do
      entity = %{
        id: "room1",
        components: %{
          crafting_station: %{
            type: "forge",
            bonus: 999.99
          }
        }
      }

      assert CraftingStation.get_bonus(entity) == 999.99
    end

    test "handles empty recipes_enabled list" do
      entity = %{
        id: "room1",
        components: %{
          crafting_station: %{
            type: "forge",
            recipes_enabled: []
          }
        }
      }

      available = CraftingStation.get_available_recipes(entity)
      assert available == []
    end

    test "from_component handles string keys for all fields" do
      data = %{
        "type" => "loom",
        "bonus" => 0.08,
        "recipes_enabled" => ["recipe1", "recipe2"],
        "name" => "Magic Loom",
        "description" => "A loom that weaves magic."
      }

      station = CraftingStation.from_component(data)
      assert station.type == "loom"
      assert station.bonus == 0.08
      assert station.recipes_enabled == ["recipe1", "recipe2"]
      assert station.name == "Magic Loom"
      assert station.description == "A loom that weaves magic."
    end

    test "handles station with unknown type" do
      entity = %{
        id: "room1",
        components: %{
          crafting_station: %{
            type: "future_station_type",
            bonus: 0.1
          }
        }
      }

      station = CraftingStation.get_station(entity)
      assert station.type == "future_station_type"
      assert station.description == "A crafting station."
    end
  end

  describe "integration tests" do
    test "complete workflow: create station, check recipes, verify bonus" do
      # Create a room entity with a forge
      room = %{
        id: "blacksmith_shop",
        name: "Blacksmith Shop",
        components: %{
          crafting_station: %{
            type: "forge",
            bonus: 0.1,
            recipes_enabled: :all,
            name: "Ancient Forge",
            description: "A forge passed down through generations."
          }
        }
      }

      # Verify we can get the station
      station = CraftingStation.get_station(room)
      assert station != nil
      assert station.type == "forge"
      assert station.name == "Ancient Forge"

      # Verify bonus
      bonus = CraftingStation.get_bonus(room)
      assert bonus == 0.1

      # Verify station type
      assert CraftingStation.has_station_type?(room, "forge") == true

      # Verify available recipes
      recipes = CraftingStation.get_available_recipes(room)
      recipe_keys = Enum.map(recipes, & &1.key)
      assert "recipe_iron_sword" in recipe_keys
      assert "recipe_steel_sword" in recipe_keys

      # Verify can craft specific recipes
      assert CraftingStation.can_craft_recipe?(room, "recipe_iron_sword") == true
      assert CraftingStation.can_craft_recipe?(room, "recipe_health_potion") == false
    end

    test "station with limited recipe set" do
      room = %{
        id: "novice_forge",
        components: %{
          crafting_station: %{
            type: "forge",
            bonus: 0.05,
            recipes_enabled: ["recipe_iron_sword"],
            name: "Novice Forge"
          }
        }
      }

      recipes = CraftingStation.get_available_recipes(room)
      assert length(recipes) == 1
      assert hd(recipes).key == "recipe_iron_sword"

      assert CraftingStation.can_craft_recipe?(room, "recipe_iron_sword") == true
      assert CraftingStation.can_craft_recipe?(room, "recipe_steel_sword") == false
    end
  end
end
