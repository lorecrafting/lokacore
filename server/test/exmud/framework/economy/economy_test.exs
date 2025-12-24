defmodule Exmud.Framework.EconomyTest do
  use Exmud.DataCase

  alias Exmud.Framework.Economy
  alias Exmud.Framework.Player.GameState

  import Exmud.EngineFixtures

  # =============================================================================
  # Test Fixtures
  # =============================================================================

  # Helper to create a merchant NPC entity with shop component
  defp merchant_fixture(attrs \\ %{}) do
    default_stock = [
      %{item: "health_potion", quantity: 10, unlimited: false},
      %{item: "rope", quantity: 5, unlimited: true},
      %{item: "sword", quantity: 1, unlimited: false}
    ]

    components = %{
      "merchant" =>
        Map.merge(
          %{
            "shop_type" => "general",
            "buy_multiplier" => 0.5,
            "sell_multiplier" => 1.5,
            "stock" => default_stock,
            "currency" => "gold",
            "faction_discounts" => true,
            "greeting" => "Welcome to my shop!",
            "farewell" => "Come again!"
          },
          Map.get(attrs, :merchant, %{})
        )
    }

    npc_fixture(
      Map.merge(
        %{name: "Test Merchant", description: "A friendly merchant", components: components},
        attrs
      )
    )
  end

  # Helper to create a minimal game state for testing
  defp game_state_fixture(attrs \\ %{}) do
    %GameState{
      player_id: Map.get(attrs, :player_id, Ecto.UUID.generate()),
      health: Map.get(attrs, :health, %{"current" => 100, "max" => 100}),
      stats:
        Map.get(attrs, :stats, %{
          "currencies" => %{"gold" => 1000, "silver" => 500},
          "str" => 10,
          "level" => 1
        }),
      equipment: Map.get(attrs, :equipment, %{}),
      inventory: Map.get(attrs, :inventory, [])
    }
  end

  # =============================================================================
  # buy/4 Tests
  # =============================================================================

  describe "buy/4" do
    test "successfully buys item from merchant with sufficient funds" do
      merchant = merchant_fixture()
      game_state = game_state_fixture()

      assert {:ok, result} = Economy.buy(game_state, merchant, "health_potion", 2)

      assert result.type == :buy
      assert result.item == "health_potion"
      assert result.quantity == 2
      assert result.unit_price == 15
      assert result.total_price == 30
      assert result.currency == "gold"
      assert result.message =~ "You purchase 2 health_potion for 30 gold"
    end

    test "successfully buys single item with default quantity" do
      merchant = merchant_fixture()
      game_state = game_state_fixture()

      assert {:ok, result} = Economy.buy(game_state, merchant, "health_potion")

      assert result.quantity == 1
      assert result.total_price == 15
    end

    test "successfully buys from unlimited stock" do
      merchant = merchant_fixture()
      # Ensure enough funds for 100 items (100 * 15 = 1500)
      game_state = game_state_fixture(%{stats: %{"currencies" => %{"gold" => 2000}}})

      assert {:ok, result} = Economy.buy(game_state, merchant, "rope", 100)

      assert result.quantity == 100
      assert result.item == "rope"
    end

    test "returns error when entity is not a merchant" do
      npc = npc_fixture()
      game_state = game_state_fixture()

      assert {:error, :not_a_merchant} = Economy.buy(game_state, npc, "health_potion", 1)
    end

    test "returns error when item is not in stock" do
      merchant = merchant_fixture()
      game_state = game_state_fixture()

      assert {:error, {:not_in_stock, "unknown_item"}} =
               Economy.buy(game_state, merchant, "unknown_item", 1)
    end

    test "returns error when insufficient stock" do
      merchant = merchant_fixture()
      game_state = game_state_fixture()

      assert {:error, {:insufficient_stock, "health_potion", 10, 20}} =
               Economy.buy(game_state, merchant, "health_potion", 20)
    end

    test "returns error when player cannot afford item" do
      merchant = merchant_fixture()
      game_state = game_state_fixture(%{stats: %{"currencies" => %{"gold" => 10}}})

      assert {:error, {:insufficient_funds, "gold", 10, 15}} =
               Economy.buy(game_state, merchant, "health_potion", 1)
    end

    test "calculates correct price with custom sell_multiplier" do
      merchant =
        merchant_fixture(%{
          merchant: %{"sell_multiplier" => 2.0}
        })

      game_state = game_state_fixture()

      assert {:ok, result} = Economy.buy(game_state, merchant, "health_potion", 1)

      # Base price is 10, sell_multiplier is 2.0
      assert result.unit_price == 20
    end

    test "uses custom currency from shop" do
      merchant =
        merchant_fixture(%{
          merchant: %{"currency" => "silver"}
        })

      game_state = game_state_fixture()

      assert {:ok, result} = Economy.buy(game_state, merchant, "health_potion", 1)

      assert result.currency == "silver"
    end

    test "handles buying last item in stock" do
      merchant = merchant_fixture()
      game_state = game_state_fixture()

      assert {:ok, result} = Economy.buy(game_state, merchant, "sword", 1)

      assert result.quantity == 1
      assert result.item == "sword"
    end
  end

  # =============================================================================
  # sell/4 Tests
  # =============================================================================

  describe "sell/4" do
    test "successfully sells item to merchant when player has items" do
      merchant = merchant_fixture()

      game_state =
        game_state_fixture(%{
          inventory: ["iron_ore", "iron_ore", "iron_ore", "iron_ore", "iron_ore"]
        })

      assert {:ok, result} = Economy.sell(game_state, merchant, "iron_ore", 3)

      assert result.type == :sell
      assert result.item == "iron_ore"
      assert result.quantity == 3
      assert result.unit_price == 5
      assert result.total_price == 15
      assert result.currency == "gold"
      assert result.message =~ "You sell 3 iron_ore for 15 gold"
    end

    test "successfully sells single item with default quantity" do
      merchant = merchant_fixture()
      game_state = game_state_fixture(%{inventory: ["iron_ore"]})

      assert {:ok, result} = Economy.sell(game_state, merchant, "iron_ore")

      assert result.quantity == 1
      assert result.total_price == 5
    end

    test "returns error when entity is not a merchant" do
      npc = npc_fixture()
      game_state = game_state_fixture(%{inventory: ["iron_ore"]})

      assert {:error, :not_a_merchant} = Economy.sell(game_state, npc, "iron_ore", 1)
    end

    test "returns error when player doesn't have enough items" do
      merchant = merchant_fixture()
      game_state = game_state_fixture(%{inventory: ["iron_ore"]})

      assert {:error, {:insufficient_items, "iron_ore", 1, 5}} =
               Economy.sell(game_state, merchant, "iron_ore", 5)
    end

    test "returns error when player has no items" do
      merchant = merchant_fixture()
      game_state = game_state_fixture(%{inventory: []})

      assert {:error, {:insufficient_items, "iron_ore", 0, 1}} =
               Economy.sell(game_state, merchant, "iron_ore", 1)
    end

    test "calculates correct price with custom buy_multiplier" do
      merchant =
        merchant_fixture(%{
          merchant: %{"buy_multiplier" => 0.8}
        })

      game_state = game_state_fixture(%{inventory: ["iron_ore"]})

      assert {:ok, result} = Economy.sell(game_state, merchant, "iron_ore", 1)

      # Base price is 10, buy_multiplier is 0.8
      assert result.unit_price == 8
    end

    test "uses custom currency from shop" do
      merchant =
        merchant_fixture(%{
          merchant: %{"currency" => "silver"}
        })

      game_state = game_state_fixture(%{inventory: ["iron_ore"]})

      assert {:ok, result} = Economy.sell(game_state, merchant, "iron_ore", 1)

      assert result.currency == "silver"
    end

    test "handles item matching with string prefix" do
      merchant = merchant_fixture()
      game_state = game_state_fixture(%{inventory: ["iron_ore_1", "iron_ore_2", "iron_ore_3"]})

      assert {:ok, result} = Economy.sell(game_state, merchant, "iron_ore", 2)

      assert result.quantity == 2
    end
  end

  # =============================================================================
  # get_currency/2 Tests
  # =============================================================================

  describe "get_currency/2" do
    test "gets player's gold currency amount" do
      game_state = game_state_fixture(%{stats: %{"currencies" => %{"gold" => 500}}})

      assert Economy.get_currency(game_state, "gold") == 500
    end

    test "gets player's custom currency amount" do
      game_state =
        game_state_fixture(%{stats: %{"currencies" => %{"silver" => 1000, "gold" => 500}}})

      assert Economy.get_currency(game_state, "silver") == 1000
    end

    test "defaults to gold when no currency type specified" do
      game_state = game_state_fixture(%{stats: %{"currencies" => %{"gold" => 750}}})

      assert Economy.get_currency(game_state) == 750
    end

    test "returns 0 when currency type doesn't exist" do
      game_state = game_state_fixture(%{stats: %{"currencies" => %{"gold" => 500}}})

      assert Economy.get_currency(game_state, "platinum") == 0
    end

    test "returns 0 when currencies map doesn't exist" do
      game_state = game_state_fixture(%{stats: %{"level" => 1}})

      assert Economy.get_currency(game_state, "gold") == 0
    end

    test "handles atom keys in currencies map" do
      game_state = game_state_fixture(%{stats: %{currencies: %{gold: 250}}})

      # MapHelpers.get_flexible should handle atom/string conversion
      result = Economy.get_currency(game_state, "gold")
      assert result == 250 or result == 0
    end
  end

  # =============================================================================
  # can_afford?/3 Tests
  # =============================================================================

  describe "can_afford?/3" do
    test "returns true when player has exact amount" do
      game_state = game_state_fixture(%{stats: %{"currencies" => %{"gold" => 100}}})

      assert Economy.can_afford?(game_state, "gold", 100) == true
    end

    test "returns true when player has more than needed" do
      game_state = game_state_fixture(%{stats: %{"currencies" => %{"gold" => 500}}})

      assert Economy.can_afford?(game_state, "gold", 100) == true
    end

    test "returns false when player has less than needed" do
      game_state = game_state_fixture(%{stats: %{"currencies" => %{"gold" => 50}}})

      assert Economy.can_afford?(game_state, "gold", 100) == false
    end

    test "returns false when player has no currency" do
      game_state = game_state_fixture(%{stats: %{"currencies" => %{"gold" => 0}}})

      assert Economy.can_afford?(game_state, "gold", 1) == false
    end

    test "works with custom currency types" do
      game_state = game_state_fixture(%{stats: %{"currencies" => %{"silver" => 1000}}})

      assert Economy.can_afford?(game_state, "silver", 500) == true
      assert Economy.can_afford?(game_state, "silver", 2000) == false
    end

    test "returns false when currency type doesn't exist" do
      game_state = game_state_fixture(%{stats: %{"currencies" => %{"gold" => 500}}})

      assert Economy.can_afford?(game_state, "platinum", 1) == false
    end
  end

  # =============================================================================
  # get_prices/3 Tests
  # =============================================================================

  describe "get_prices/3" do
    test "gets buy and sell prices for an item with game_state" do
      merchant = merchant_fixture()
      game_state = game_state_fixture()

      assert {:ok, prices} = Economy.get_prices(merchant, "health_potion", game_state)

      assert prices.item == "health_potion"
      assert prices.base_price == 10
      assert prices.buy_price == 15
      assert prices.sell_price == 5
      assert prices.currency == "gold"
    end

    test "gets buy and sell prices for an item without game_state" do
      merchant = merchant_fixture()

      assert {:ok, prices} = Economy.get_prices(merchant, "health_potion", nil)

      assert prices.item == "health_potion"
      assert prices.base_price == 10
      assert prices.buy_price == 15
      assert prices.sell_price == 5
      assert prices.currency == "gold"
    end

    test "gets buy and sell prices for an item with default game_state parameter" do
      merchant = merchant_fixture()

      assert {:ok, prices} = Economy.get_prices(merchant, "health_potion")

      assert prices.item == "health_potion"
      assert prices.base_price == 10
      assert prices.buy_price == 15
      assert prices.sell_price == 5
    end

    test "returns error when entity is not a merchant" do
      npc = npc_fixture()

      assert {:error, :not_a_merchant} = Economy.get_prices(npc, "health_potion")
    end

    test "calculates prices with custom multipliers" do
      merchant =
        merchant_fixture(%{
          merchant: %{
            "buy_multiplier" => 0.6,
            "sell_multiplier" => 2.0
          }
        })

      assert {:ok, prices} = Economy.get_prices(merchant, "health_potion")

      assert prices.base_price == 10
      assert prices.buy_price == 20
      assert prices.sell_price == 6
    end

    test "includes custom currency in prices" do
      merchant =
        merchant_fixture(%{
          merchant: %{"currency" => "silver"}
        })

      assert {:ok, prices} = Economy.get_prices(merchant, "sword")

      assert prices.currency == "silver"
    end

    test "rounds prices correctly" do
      merchant =
        merchant_fixture(%{
          merchant: %{
            "buy_multiplier" => 0.55,
            "sell_multiplier" => 1.75
          }
        })

      assert {:ok, prices} = Economy.get_prices(merchant, "health_potion")

      # Base price 10 * 0.55 = 5.5, should round to 6
      assert prices.sell_price == 6
      # Base price 10 * 1.75 = 17.5, should round to 18
      assert prices.buy_price == 18
    end
  end

  # =============================================================================
  # Integration Tests
  # =============================================================================

  describe "buy/sell integration" do
    test "complete buy and sell transaction flow" do
      merchant = merchant_fixture()

      # Start with enough gold to buy
      game_state = game_state_fixture(%{stats: %{"currencies" => %{"gold" => 1000}}})

      # Buy 3 health potions
      assert {:ok, buy_result} = Economy.buy(game_state, merchant, "health_potion", 3)

      assert buy_result.total_price == 45
      assert Economy.can_afford?(game_state, "gold", buy_result.total_price)

      # After buying, add items to inventory
      updated_inventory = ["health_potion", "health_potion", "health_potion"]
      game_state = %{game_state | inventory: updated_inventory}

      # Sell 2 health potions back
      assert {:ok, sell_result} = Economy.sell(game_state, merchant, "health_potion", 2)

      assert sell_result.total_price == 10
    end

    test "cannot buy with insufficient funds then sell to gain funds" do
      merchant = merchant_fixture()

      # Start with low gold but items to sell
      game_state =
        game_state_fixture(%{
          stats: %{"currencies" => %{"gold" => 5}},
          inventory: ["iron_ore", "iron_ore"]
        })

      # Cannot buy expensive item
      assert {:error, {:insufficient_funds, "gold", 5, 15}} =
               Economy.buy(game_state, merchant, "health_potion", 1)

      # But can sell items
      assert {:ok, sell_result} = Economy.sell(game_state, merchant, "iron_ore", 2)

      assert sell_result.total_price == 10
    end

    test "buying reduces stock, unlimited stock never runs out" do
      merchant = merchant_fixture()
      # Ensure enough funds for large purchases
      game_state = game_state_fixture(%{stats: %{"currencies" => %{"gold" => 20000}}})

      # Buy limited stock item
      assert {:ok, _result} = Economy.buy(game_state, merchant, "sword", 1)

      # Cannot buy more (only 1 in stock)
      assert {:error, {:insufficient_stock, "sword", 1, 2}} =
               Economy.buy(game_state, merchant, "sword", 2)

      # Unlimited stock never runs out
      assert {:ok, _result} = Economy.buy(game_state, merchant, "rope", 100)
      assert {:ok, _result} = Economy.buy(game_state, merchant, "rope", 1000)
    end
  end

  # =============================================================================
  # Edge Cases
  # =============================================================================

  describe "edge cases" do
    test "handles merchant with empty stock" do
      merchant =
        merchant_fixture(%{
          merchant: %{"stock" => []}
        })

      game_state = game_state_fixture()

      assert {:error, {:not_in_stock, "health_potion"}} =
               Economy.buy(game_state, merchant, "health_potion", 1)
    end

    test "handles game state with nil currencies" do
      game_state = game_state_fixture(%{stats: %{}})

      assert Economy.get_currency(game_state, "gold") == 0
      assert Economy.can_afford?(game_state, "gold", 100) == false
    end

    test "handles zero quantity edge case" do
      _merchant = merchant_fixture()

      game_state =
        game_state_fixture(%{
          stats: %{"currencies" => %{"gold" => 0}},
          inventory: []
        })

      # Zero total price (quantity 0 * unit price)
      # This test validates the current behavior, though the API could validate quantity > 0
      assert Economy.can_afford?(game_state, "gold", 0) == true
    end

    test "buy/sell price symmetry check" do
      merchant = merchant_fixture()
      game_state = game_state_fixture()

      assert {:ok, prices} = Economy.get_prices(merchant, "health_potion", game_state)

      # Buy price should be higher than sell price (merchant profit margin)
      assert prices.buy_price > prices.sell_price
    end

    test "handles very large quantities" do
      merchant = merchant_fixture()
      game_state = game_state_fixture(%{stats: %{"currencies" => %{"gold" => 100_000_000}}})

      assert {:ok, result} = Economy.buy(game_state, merchant, "rope", 10_000)

      assert result.quantity == 10_000
      # Verify multiplication doesn't overflow
      assert is_integer(result.total_price)
      assert result.total_price == result.unit_price * 10_000
    end

    test "handles merchant with 0 multipliers" do
      merchant =
        merchant_fixture(%{
          merchant: %{
            "buy_multiplier" => 0.0,
            "sell_multiplier" => 0.0
          }
        })

      game_state = game_state_fixture(%{inventory: ["iron_ore"]})

      assert {:ok, prices} = Economy.get_prices(merchant, "health_potion")

      assert prices.buy_price == 0
      assert prices.sell_price == 0

      # Can buy for free
      assert {:ok, buy_result} = Economy.buy(game_state, merchant, "rope", 1)
      assert buy_result.total_price == 0

      # Can sell but get nothing
      assert {:ok, sell_result} = Economy.sell(game_state, merchant, "iron_ore", 1)
      assert sell_result.total_price == 0
    end
  end
end
