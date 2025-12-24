defmodule Exmud.Framework.HousingTest do
  use Exmud.DataCase

  alias Exmud.Framework.Housing
  alias Exmud.Framework.Player.GameState

  import Exmud.AccountsFixtures

  # Helper to create a game state for testing
  defp game_state_fixture(player_id, attrs \\ %{}) do
    {:ok, state} = GameState.create_state(player_id)

    if map_size(attrs) > 0 do
      {:ok, state} = GameState.update_state(state, attrs)
      state
    else
      state
    end
  end

  # Helper to create a room entity with housing component
  defp create_housing_room(attrs \\ %{}) do
    {:ok, entity} =
      Exmud.Engine.Entities.create_entity(%{
        key: attrs[:key] || "room_#{System.unique_integer([:positive])}",
        name: attrs[:name] || "Test Cottage",
        description: attrs[:description] || "A cozy cottage",
        type: "room",
        components:
          attrs[:components] ||
            %{
              "housing" => %{
                "price" => 5000,
                "rent_weekly" => 100,
                "max_furniture" => 20,
                "max_storage" => 100,
                "upgradeable" => true
              }
            },
        tags: attrs[:tags] || []
      })

    entity
  end

  # Helper to create a non-housing room
  defp create_regular_room do
    {:ok, entity} =
      Exmud.Engine.Entities.create_entity(%{
        key: "regular_room_#{System.unique_integer([:positive])}",
        name: "Regular Room",
        description: "A regular room",
        type: "room",
        components: %{},
        tags: []
      })

    entity
  end

  describe "get_housing_state/1" do
    test "returns default housing state when none exists" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      housing = Housing.get_housing_state(state)

      assert housing.home_room_id == nil
      assert housing.furniture == []
      assert housing.storage == []
      assert housing.rent_paid_until == nil
      assert housing.upgrades == []
    end

    test "returns existing housing state" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{
            housing: %{
              home_room_id: "room_123",
              furniture: ["chair", "table"],
              storage: ["sword"],
              rent_paid_until: 1_234_567_890,
              upgrades: ["expanded_storage"]
            }
          }
        })

      housing = Housing.get_housing_state(state)

      assert housing.home_room_id == "room_123"
      assert housing.furniture == ["chair", "table"]
      assert housing.storage == ["sword"]
      assert housing.rent_paid_until == 1_234_567_890
      assert housing.upgrades == ["expanded_storage"]
    end
  end

  describe "get_home/1" do
    test "returns nil when player has no home" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert Housing.get_home(state) == nil
    end

    test "returns home room ID when player has home" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{housing: %{home_room_id: "room_123"}}
        })

      assert Housing.get_home(state) == "room_123"
    end
  end

  describe "has_home?/1" do
    test "returns false when player has no home" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert Housing.has_home?(state) == false
    end

    test "returns true when player has home" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{housing: %{home_room_id: "room_123"}}
        })

      assert Housing.has_home?(state) == true
    end
  end

  describe "rent_current?/1" do
    test "returns true when home is owned (no rent)" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{housing: %{home_room_id: "room_123", rent_paid_until: nil}}
        })

      assert Housing.rent_current?(state) == true
    end

    test "returns true when rent is paid and current" do
      player = player_fixture()
      # 1 day in future
      future_time = System.system_time(:second) + 86400

      state =
        game_state_fixture(player.id, %{
          stats: %{housing: %{home_room_id: "room_123", rent_paid_until: future_time}}
        })

      assert Housing.rent_current?(state) == true
    end

    test "returns false when rent is expired" do
      player = player_fixture()
      # 1 day in past
      past_time = System.system_time(:second) - 86400

      state =
        game_state_fixture(player.id, %{
          stats: %{housing: %{home_room_id: "room_123", rent_paid_until: past_time}}
        })

      assert Housing.rent_current?(state) == false
    end
  end

  describe "purchase/3" do
    test "purchases a house (buy mode)" do
      player = player_fixture()
      state = game_state_fixture(player.id)
      room = create_housing_room()

      # Convert entity struct to map for Access behavior
      room_map = %{
        id: room.id,
        components: room.components
      }

      assert {:ok, updated_state} = Housing.purchase(state, room_map, :buy)

      housing = Housing.get_housing_state(updated_state)
      assert housing.home_room_id == room.id
      assert housing.rent_paid_until == nil
    end

    test "rents a house (rent mode)" do
      player = player_fixture()
      state = game_state_fixture(player.id)
      room = create_housing_room()

      # Convert entity struct to map for Access behavior
      room_map = %{
        id: room.id,
        components: room.components
      }

      assert {:ok, updated_state} = Housing.purchase(state, room_map, :rent)

      housing = Housing.get_housing_state(updated_state)
      assert housing.home_room_id == room.id
      assert housing.rent_paid_until != nil
      # Rent should be paid for 1 week
      week_seconds = 7 * 24 * 60 * 60
      current_time = System.system_time(:second)
      assert_in_delta housing.rent_paid_until, current_time + week_seconds, 5
    end

    test "returns error for non-housing room" do
      player = player_fixture()
      state = game_state_fixture(player.id)
      room = create_regular_room()

      # Convert entity struct to map for Access behavior
      room_map = %{
        id: room.id,
        components: room.components
      }

      assert {:error, :not_purchasable} = Housing.purchase(state, room_map, :buy)
    end

    test "supports string keys in room entity" do
      player = player_fixture()
      state = game_state_fixture(player.id)
      room = create_housing_room()

      # Room entity with atom keys but string-keyed housing component
      # (this is what the implementation actually supports via MapHelpers.get_flexible)
      room_string_keys = %{
        id: room.id,
        components: %{"housing" => %{"price" => 5000}}
      }

      assert {:ok, updated_state} = Housing.purchase(state, room_string_keys, :buy)
      housing = Housing.get_housing_state(updated_state)
      assert housing.home_room_id == room.id
    end
  end

  describe "set_home/2" do
    test "sets the home room ID" do
      player = player_fixture()
      state = game_state_fixture(player.id)
      room_id = "room_123"

      assert {:ok, updated_state} = Housing.set_home(state, room_id)

      housing = Housing.get_housing_state(updated_state)
      assert housing.home_room_id == room_id
    end

    test "updates existing home" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{housing: %{home_room_id: "old_room"}}
        })

      assert {:ok, updated_state} = Housing.set_home(state, "new_room")

      housing = Housing.get_housing_state(updated_state)
      assert housing.home_room_id == "new_room"
    end
  end

  describe "abandon_home/1" do
    test "resets housing state to default" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{
            housing: %{
              home_room_id: "room_123",
              furniture: ["chair"],
              storage: ["sword"],
              rent_paid_until: 123_456,
              upgrades: ["expanded_storage"]
            }
          }
        })

      assert {:ok, updated_state} = Housing.abandon_home(state)

      housing = Housing.get_housing_state(updated_state)
      assert housing.home_room_id == nil
      assert housing.furniture == []
      assert housing.storage == []
      assert housing.rent_paid_until == nil
      assert housing.upgrades == []
    end
  end

  describe "pay_rent/2" do
    test "extends rent for one week by default" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{housing: %{home_room_id: "room_123", rent_paid_until: nil}}
        })

      current_time = System.system_time(:second)
      week_seconds = 7 * 24 * 60 * 60

      assert {:ok, updated_state} = Housing.pay_rent(state)

      housing = Housing.get_housing_state(updated_state)
      assert_in_delta housing.rent_paid_until, current_time + week_seconds, 5
    end

    test "extends rent for multiple weeks" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{housing: %{home_room_id: "room_123", rent_paid_until: nil}}
        })

      current_time = System.system_time(:second)
      week_seconds = 7 * 24 * 60 * 60

      assert {:ok, updated_state} = Housing.pay_rent(state, 3)

      housing = Housing.get_housing_state(updated_state)
      assert_in_delta housing.rent_paid_until, current_time + 3 * week_seconds, 5
    end

    test "extends from current rent_paid_until if in future" do
      player = player_fixture()
      current_time = System.system_time(:second)
      # 1 day in future
      future_time = current_time + 86400
      week_seconds = 7 * 24 * 60 * 60

      state =
        game_state_fixture(player.id, %{
          stats: %{housing: %{home_room_id: "room_123", rent_paid_until: future_time}}
        })

      assert {:ok, updated_state} = Housing.pay_rent(state)

      housing = Housing.get_housing_state(updated_state)
      # Should extend from future_time, not current_time
      assert_in_delta housing.rent_paid_until, future_time + week_seconds, 5
    end

    test "extends from current time if rent is expired" do
      player = player_fixture()
      current_time = System.system_time(:second)
      # 1 day in past
      past_time = current_time - 86400
      week_seconds = 7 * 24 * 60 * 60

      state =
        game_state_fixture(player.id, %{
          stats: %{housing: %{home_room_id: "room_123", rent_paid_until: past_time}}
        })

      assert {:ok, updated_state} = Housing.pay_rent(state)

      housing = Housing.get_housing_state(updated_state)
      # Should extend from current_time since rent was expired
      assert_in_delta housing.rent_paid_until, current_time + week_seconds, 5
    end
  end

  describe "place_furniture/3" do
    test "places furniture in home" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{
            housing: %{
              home_room_id: "room_123",
              furniture: [],
              storage: [],
              rent_paid_until: nil,
              upgrades: []
            }
          }
        })

      assert {:ok, updated_state} = Housing.place_furniture(state, "chair_01")

      housing = Housing.get_housing_state(updated_state)
      assert "chair_01" in housing.furniture
    end

    test "can place multiple furniture items" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{
            housing: %{
              home_room_id: "room_123",
              furniture: [],
              storage: [],
              rent_paid_until: nil,
              upgrades: []
            }
          }
        })

      {:ok, state} = Housing.place_furniture(state, "chair_01")
      {:ok, state} = Housing.place_furniture(state, "table_01")

      housing = Housing.get_housing_state(state)
      assert "chair_01" in housing.furniture
      assert "table_01" in housing.furniture
    end

    test "returns error when player has no home" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert {:error, :no_home} = Housing.place_furniture(state, "chair_01")
    end

    test "returns error when furniture limit reached" do
      player = player_fixture()
      existing_furniture = Enum.map(1..20, &"item_#{&1}")

      state =
        game_state_fixture(player.id, %{
          stats: %{housing: %{home_room_id: "room_123", furniture: existing_furniture}}
        })

      assert {:error, :furniture_limit_reached} = Housing.place_furniture(state, "chair_21")
    end

    test "respects custom max_furniture limit" do
      player = player_fixture()
      existing_furniture = Enum.map(1..10, &"item_#{&1}")

      state =
        game_state_fixture(player.id, %{
          stats: %{housing: %{home_room_id: "room_123", furniture: existing_furniture}}
        })

      assert {:error, :furniture_limit_reached} = Housing.place_furniture(state, "chair_11", 10)
    end
  end

  describe "remove_furniture/2" do
    test "removes furniture from home" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{housing: %{home_room_id: "room_123", furniture: ["chair_01", "table_01"]}}
        })

      assert {:ok, updated_state, removed_id} = Housing.remove_furniture(state, "chair_01")

      assert removed_id == "chair_01"
      housing = Housing.get_housing_state(updated_state)
      refute "chair_01" in housing.furniture
      assert "table_01" in housing.furniture
    end

    test "returns error when furniture not found" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{housing: %{home_room_id: "room_123", furniture: ["chair_01"]}}
        })

      assert {:error, :furniture_not_found} = Housing.remove_furniture(state, "table_01")
    end

    test "removes only one instance of duplicate furniture" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{housing: %{home_room_id: "room_123", furniture: ["chair", "chair", "table"]}}
        })

      {:ok, updated_state, _} = Housing.remove_furniture(state, "chair")

      housing = Housing.get_housing_state(updated_state)
      assert length(housing.furniture) == 2
      assert Enum.count(housing.furniture, &(&1 == "chair")) == 1
    end
  end

  describe "list_furniture/1" do
    test "returns empty list when no furniture" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{
            housing: %{
              home_room_id: "room_123",
              furniture: [],
              storage: [],
              rent_paid_until: nil,
              upgrades: []
            }
          }
        })

      assert Housing.list_furniture(state) == []
    end

    test "returns all furniture" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{housing: %{home_room_id: "room_123", furniture: ["chair", "table", "bed"]}}
        })

      furniture = Housing.list_furniture(state)
      assert length(furniture) == 3
      assert "chair" in furniture
      assert "table" in furniture
      assert "bed" in furniture
    end
  end

  describe "store_item/3" do
    test "stores item in home storage" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{
            housing: %{
              home_room_id: "room_123",
              furniture: [],
              storage: [],
              rent_paid_until: nil,
              upgrades: []
            }
          }
        })

      assert {:ok, updated_state} = Housing.store_item(state, "sword_01")

      housing = Housing.get_housing_state(updated_state)
      assert "sword_01" in housing.storage
    end

    test "can store multiple items" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{
            housing: %{
              home_room_id: "room_123",
              furniture: [],
              storage: [],
              rent_paid_until: nil,
              upgrades: []
            }
          }
        })

      {:ok, state} = Housing.store_item(state, "sword_01")
      {:ok, state} = Housing.store_item(state, "armor_01")

      housing = Housing.get_housing_state(state)
      assert "sword_01" in housing.storage
      assert "armor_01" in housing.storage
    end

    test "returns error when player has no home" do
      player = player_fixture()
      state = game_state_fixture(player.id)

      assert {:error, :no_home} = Housing.store_item(state, "sword_01")
    end

    test "returns error when storage is full" do
      player = player_fixture()
      existing_storage = Enum.map(1..100, &"item_#{&1}")

      state =
        game_state_fixture(player.id, %{
          stats: %{
            housing: %{
              home_room_id: "room_123",
              furniture: [],
              storage: existing_storage,
              rent_paid_until: nil,
              upgrades: []
            }
          }
        })

      assert {:error, :storage_full} = Housing.store_item(state, "sword_101")
    end

    test "respects custom max_storage limit" do
      player = player_fixture()
      existing_storage = Enum.map(1..50, &"item_#{&1}")

      state =
        game_state_fixture(player.id, %{
          stats: %{housing: %{home_room_id: "room_123", storage: existing_storage, upgrades: []}}
        })

      assert {:error, :storage_full} = Housing.store_item(state, "sword_51", 50)
    end

    test "applies expanded_storage upgrade bonus" do
      player = player_fixture()
      # With expanded_storage upgrade, limit becomes 100 + 50 = 150
      existing_storage = Enum.map(1..100, &"item_#{&1}")

      state =
        game_state_fixture(player.id, %{
          stats: %{
            housing: %{
              home_room_id: "room_123",
              storage: existing_storage,
              upgrades: ["expanded_storage"]
            }
          }
        })

      # Should succeed because of upgrade bonus
      assert {:ok, _updated_state} = Housing.store_item(state, "sword_101")
    end
  end

  describe "retrieve_item/2" do
    test "retrieves item from storage" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{housing: %{home_room_id: "room_123", storage: ["sword_01", "armor_01"]}}
        })

      assert {:ok, updated_state, retrieved_id} = Housing.retrieve_item(state, "sword_01")

      assert retrieved_id == "sword_01"
      housing = Housing.get_housing_state(updated_state)
      refute "sword_01" in housing.storage
      assert "armor_01" in housing.storage
    end

    test "returns error when item not found" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{housing: %{home_room_id: "room_123", storage: ["sword_01"]}}
        })

      assert {:error, :item_not_found} = Housing.retrieve_item(state, "armor_01")
    end

    test "removes only one instance of duplicate items" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{housing: %{home_room_id: "room_123", storage: ["potion", "potion", "sword"]}}
        })

      {:ok, updated_state, _} = Housing.retrieve_item(state, "potion")

      housing = Housing.get_housing_state(updated_state)
      assert length(housing.storage) == 2
      assert Enum.count(housing.storage, &(&1 == "potion")) == 1
    end
  end

  describe "list_storage/1" do
    test "returns empty list when no items in storage" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{
            housing: %{
              home_room_id: "room_123",
              furniture: [],
              storage: [],
              rent_paid_until: nil,
              upgrades: []
            }
          }
        })

      assert Housing.list_storage(state) == []
    end

    test "returns all stored items" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{housing: %{home_room_id: "room_123", storage: ["sword", "armor", "potion"]}}
        })

      storage = Housing.list_storage(state)
      assert length(storage) == 3
      assert "sword" in storage
      assert "armor" in storage
      assert "potion" in storage
    end
  end

  describe "purchase_upgrade/2" do
    test "purchases an upgrade" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{
            housing: %{
              home_room_id: "room_123",
              furniture: [],
              storage: [],
              rent_paid_until: nil,
              upgrades: []
            }
          }
        })

      assert {:ok, updated_state} = Housing.purchase_upgrade(state, "expanded_storage")

      housing = Housing.get_housing_state(updated_state)
      assert "expanded_storage" in housing.upgrades
    end

    test "can purchase multiple upgrades" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{
            housing: %{
              home_room_id: "room_123",
              furniture: [],
              storage: [],
              rent_paid_until: nil,
              upgrades: []
            }
          }
        })

      {:ok, state} = Housing.purchase_upgrade(state, "expanded_storage")
      {:ok, state} = Housing.purchase_upgrade(state, "garden")

      housing = Housing.get_housing_state(state)
      assert "expanded_storage" in housing.upgrades
      assert "garden" in housing.upgrades
    end

    test "returns error when upgrade already purchased" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{housing: %{home_room_id: "room_123", upgrades: ["expanded_storage"]}}
        })

      assert {:error, :already_purchased} = Housing.purchase_upgrade(state, "expanded_storage")
    end
  end

  describe "has_upgrade?/2" do
    test "returns true when player has upgrade" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{
            housing: %{
              home_room_id: nil,
              furniture: [],
              storage: [],
              rent_paid_until: nil,
              upgrades: ["expanded_storage", "garden"]
            }
          }
        })

      assert Housing.has_upgrade?(state, "expanded_storage") == true
      assert Housing.has_upgrade?(state, "garden") == true
    end

    test "returns false when player does not have upgrade" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{
            housing: %{
              home_room_id: nil,
              furniture: [],
              storage: [],
              rent_paid_until: nil,
              upgrades: ["expanded_storage"]
            }
          }
        })

      assert Housing.has_upgrade?(state, "garden") == false
    end

    test "returns false when no upgrades" do
      player = player_fixture()

      state =
        game_state_fixture(player.id, %{
          stats: %{
            housing: %{
              home_room_id: nil,
              furniture: [],
              storage: [],
              rent_paid_until: nil,
              upgrades: []
            }
          }
        })

      assert Housing.has_upgrade?(state, "expanded_storage") == false
    end
  end
end
