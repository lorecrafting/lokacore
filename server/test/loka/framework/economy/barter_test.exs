defmodule Loka.Framework.Economy.BarterTest do
  use ExUnit.Case, async: true

  alias Loka.Framework.Economy.Barter

  describe "create_offer/2" do
    test "creates a new trade offer with correct initial state" do
      offer = Barter.create_offer("player1", "player2")

      assert offer.offerer_id == "player1"
      assert offer.recipient_id == "player2"
      assert offer.offerer_items == []
      assert offer.recipient_items == []
      assert offer.offerer_accepted == false
      assert offer.recipient_accepted == false
      assert offer.status == :pending
      assert is_binary(offer.id)
      assert is_integer(offer.created_at)
    end

    test "generates unique IDs for different offers" do
      offer1 = Barter.create_offer("player1", "player2")
      offer2 = Barter.create_offer("player1", "player2")

      assert offer1.id != offer2.id
    end

    test "sets timestamp to current system time" do
      before_time = System.system_time(:second)
      offer = Barter.create_offer("player1", "player2")
      after_time = System.system_time(:second)

      assert offer.created_at >= before_time
      assert offer.created_at <= after_time
    end
  end

  describe "add_to_offer/4" do
    setup do
      offer = Barter.create_offer("player1", "player2")
      {:ok, offer: offer}
    end

    test "adds item to offerer's side", %{offer: offer} do
      {:ok, updated} = Barter.add_to_offer(offer, :offerer, "iron_sword", 1)

      assert length(updated.offerer_items) == 1
      assert hd(updated.offerer_items) == %{item: "iron_sword", quantity: 1}
      assert updated.recipient_items == []
    end

    test "adds item to recipient's side", %{offer: offer} do
      {:ok, updated} = Barter.add_to_offer(offer, :recipient, "gold_coins", 50)

      assert length(updated.recipient_items) == 1
      assert hd(updated.recipient_items) == %{item: "gold_coins", quantity: 50}
      assert updated.offerer_items == []
    end

    test "can add multiple items to offerer", %{offer: offer} do
      {:ok, offer} = Barter.add_to_offer(offer, :offerer, "iron_sword", 1)
      {:ok, offer} = Barter.add_to_offer(offer, :offerer, "health_potion", 5)
      {:ok, offer} = Barter.add_to_offer(offer, :offerer, "shield", 1)

      assert length(offer.offerer_items) == 3
    end

    test "can add multiple items to recipient", %{offer: offer} do
      {:ok, offer} = Barter.add_to_offer(offer, :recipient, "gold_coins", 100)
      {:ok, offer} = Barter.add_to_offer(offer, :recipient, "rare_gem", 3)

      assert length(offer.recipient_items) == 2
    end

    test "resets acceptances when adding to offerer", %{offer: offer} do
      {:ok, offer} = Barter.mark_accepted(offer, :offerer)
      {:ok, offer} = Barter.mark_accepted(offer, :recipient)

      assert offer.offerer_accepted == true
      assert offer.recipient_accepted == true

      {:ok, updated} = Barter.add_to_offer(offer, :offerer, "new_item", 1)

      assert updated.offerer_accepted == false
      assert updated.recipient_accepted == false
    end

    test "resets acceptances when adding to recipient", %{offer: offer} do
      {:ok, offer} = Barter.mark_accepted(offer, :offerer)
      {:ok, offer} = Barter.mark_accepted(offer, :recipient)

      {:ok, updated} = Barter.add_to_offer(offer, :recipient, "new_item", 1)

      assert updated.offerer_accepted == false
      assert updated.recipient_accepted == false
    end

    test "allows adding the same item multiple times", %{offer: offer} do
      {:ok, offer} = Barter.add_to_offer(offer, :offerer, "potion", 1)
      {:ok, offer} = Barter.add_to_offer(offer, :offerer, "potion", 3)

      assert length(offer.offerer_items) == 2
    end

    test "handles large quantities", %{offer: offer} do
      {:ok, updated} = Barter.add_to_offer(offer, :offerer, "arrows", 9999)

      assert hd(updated.offerer_items).quantity == 9999
    end
  end

  describe "remove_from_offer/3" do
    setup do
      offer = Barter.create_offer("player1", "player2")
      {:ok, offer} = Barter.add_to_offer(offer, :offerer, "sword", 1)
      {:ok, offer} = Barter.add_to_offer(offer, :offerer, "shield", 1)
      {:ok, offer} = Barter.add_to_offer(offer, :recipient, "gold", 100)
      {:ok, offer: offer}
    end

    test "removes item from offerer's side", %{offer: offer} do
      {:ok, updated} = Barter.remove_from_offer(offer, :offerer, "sword")

      assert length(updated.offerer_items) == 1
      refute Enum.any?(updated.offerer_items, &(&1.item == "sword"))
      assert Enum.any?(updated.offerer_items, &(&1.item == "shield"))
    end

    test "removes item from recipient's side", %{offer: offer} do
      {:ok, updated} = Barter.remove_from_offer(offer, :recipient, "gold")

      assert updated.recipient_items == []
    end

    test "handles removing non-existent item", %{offer: offer} do
      {:ok, updated} = Barter.remove_from_offer(offer, :offerer, "nonexistent")

      assert length(updated.offerer_items) == 2
    end

    test "resets acceptances when removing from offerer", %{offer: offer} do
      {:ok, offer} = Barter.mark_accepted(offer, :offerer)
      {:ok, offer} = Barter.mark_accepted(offer, :recipient)

      {:ok, updated} = Barter.remove_from_offer(offer, :offerer, "sword")

      assert updated.offerer_accepted == false
      assert updated.recipient_accepted == false
    end

    test "resets acceptances when removing from recipient", %{offer: offer} do
      {:ok, offer} = Barter.mark_accepted(offer, :offerer)
      {:ok, offer} = Barter.mark_accepted(offer, :recipient)

      {:ok, updated} = Barter.remove_from_offer(offer, :recipient, "gold")

      assert updated.offerer_accepted == false
      assert updated.recipient_accepted == false
    end

    test "removes all items with matching key", %{offer: offer} do
      {:ok, offer} = Barter.add_to_offer(offer, :offerer, "potion", 1)
      {:ok, offer} = Barter.add_to_offer(offer, :offerer, "potion", 3)

      assert length(offer.offerer_items) == 4

      {:ok, updated} = Barter.remove_from_offer(offer, :offerer, "potion")

      assert length(updated.offerer_items) == 2
      refute Enum.any?(updated.offerer_items, &(&1.item == "potion"))
    end
  end

  describe "mark_accepted/2" do
    setup do
      offer = Barter.create_offer("player1", "player2")
      {:ok, offer: offer}
    end

    test "marks offerer as accepted", %{offer: offer} do
      {:ok, updated} = Barter.mark_accepted(offer, :offerer)

      assert updated.offerer_accepted == true
      assert updated.recipient_accepted == false
    end

    test "marks recipient as accepted", %{offer: offer} do
      {:ok, updated} = Barter.mark_accepted(offer, :recipient)

      assert updated.offerer_accepted == false
      assert updated.recipient_accepted == true
    end

    test "can mark both parties as accepted", %{offer: offer} do
      {:ok, offer} = Barter.mark_accepted(offer, :offerer)
      {:ok, offer} = Barter.mark_accepted(offer, :recipient)

      assert offer.offerer_accepted == true
      assert offer.recipient_accepted == true
    end
  end

  describe "both_accepted?/1" do
    setup do
      offer = Barter.create_offer("player1", "player2")
      {:ok, offer: offer}
    end

    test "returns false when neither party accepted", %{offer: offer} do
      assert Barter.both_accepted?(offer) == false
    end

    test "returns false when only offerer accepted", %{offer: offer} do
      {:ok, offer} = Barter.mark_accepted(offer, :offerer)

      assert Barter.both_accepted?(offer) == false
    end

    test "returns false when only recipient accepted", %{offer: offer} do
      {:ok, offer} = Barter.mark_accepted(offer, :recipient)

      assert Barter.both_accepted?(offer) == false
    end

    test "returns true when both parties accepted", %{offer: offer} do
      {:ok, offer} = Barter.mark_accepted(offer, :offerer)
      {:ok, offer} = Barter.mark_accepted(offer, :recipient)

      assert Barter.both_accepted?(offer) == true
    end
  end

  describe "complete_trade/1" do
    setup do
      offer = Barter.create_offer("player1", "player2")
      {:ok, offer} = Barter.add_to_offer(offer, :offerer, "sword", 1)
      {:ok, offer} = Barter.add_to_offer(offer, :recipient, "gold", 100)
      {:ok, offer: offer}
    end

    test "completes trade when both parties accepted", %{offer: offer} do
      {:ok, offer} = Barter.mark_accepted(offer, :offerer)
      {:ok, offer} = Barter.mark_accepted(offer, :recipient)

      assert {:ok, updated_offer, result} = Barter.complete_trade(offer)

      assert updated_offer.status == :accepted
      assert result.status == :completed
      assert result.message == "Trade completed successfully!"
      assert result.offerer_receives == offer.recipient_items
      assert result.recipient_receives == offer.offerer_items
    end

    test "returns error when not both accepted", %{offer: offer} do
      {:ok, offer} = Barter.mark_accepted(offer, :offerer)

      assert {:error, :not_both_accepted} = Barter.complete_trade(offer)
    end

    test "returns error when neither accepted", %{offer: offer} do
      assert {:error, :not_both_accepted} = Barter.complete_trade(offer)
    end

    test "result includes all items for exchange", %{offer: offer} do
      {:ok, offer} = Barter.add_to_offer(offer, :offerer, "shield", 1)
      {:ok, offer} = Barter.add_to_offer(offer, :recipient, "potion", 5)
      {:ok, offer} = Barter.mark_accepted(offer, :offerer)
      {:ok, offer} = Barter.mark_accepted(offer, :recipient)

      {:ok, _updated_offer, result} = Barter.complete_trade(offer)

      assert length(result.offerer_receives) == 2
      assert length(result.recipient_receives) == 2
    end

    test "handles empty trade", %{offer: _offer} do
      empty_offer = Barter.create_offer("player1", "player2")
      {:ok, empty_offer} = Barter.mark_accepted(empty_offer, :offerer)
      {:ok, empty_offer} = Barter.mark_accepted(empty_offer, :recipient)

      {:ok, _updated_offer, result} = Barter.complete_trade(empty_offer)

      assert result.offerer_receives == []
      assert result.recipient_receives == []
    end
  end

  describe "decline/2" do
    setup do
      offer = Barter.create_offer("player1", "player2")
      {:ok, offer: offer}
    end

    test "declines trade with default reason", %{offer: offer} do
      {:ok, updated, reason} = Barter.decline(offer)

      assert updated.status == :declined
      assert reason == "Trade declined"
    end

    test "declines trade with custom reason", %{offer: offer} do
      custom_reason = "Not interested in this trade"
      {:ok, updated, reason} = Barter.decline(offer, custom_reason)

      assert updated.status == :declined
      assert reason == custom_reason
    end

    test "can decline even after both accepted", %{offer: offer} do
      {:ok, offer} = Barter.mark_accepted(offer, :offerer)
      {:ok, offer} = Barter.mark_accepted(offer, :recipient)

      {:ok, updated, _reason} = Barter.decline(offer)

      assert updated.status == :declined
    end

    test "preserves offer data when declined", %{offer: offer} do
      {:ok, offer} = Barter.add_to_offer(offer, :offerer, "sword", 1)
      {:ok, offer} = Barter.add_to_offer(offer, :recipient, "gold", 100)

      {:ok, updated, _reason} = Barter.decline(offer)

      assert length(updated.offerer_items) == 1
      assert length(updated.recipient_items) == 1
    end
  end

  describe "calculate_offer_value/2" do
    test "calculates value with provided base prices" do
      items = [
        %{item: "sword", quantity: 1},
        %{item: "potion", quantity: 5}
      ]

      base_prices = %{"sword" => 100, "potion" => 20}

      value = Barter.calculate_offer_value(items, base_prices)

      assert value == 200
    end

    test "uses default value of 10 for unknown items" do
      items = [
        %{item: "unknown_item", quantity: 3}
      ]

      value = Barter.calculate_offer_value(items, %{})

      assert value == 30
    end

    test "returns 0 for empty items list" do
      value = Barter.calculate_offer_value([], %{})

      assert value == 0
    end

    test "handles mixed known and unknown items" do
      items = [
        %{item: "known", quantity: 2},
        %{item: "unknown", quantity: 3}
      ]

      base_prices = %{"known" => 50}

      value = Barter.calculate_offer_value(items, base_prices)

      assert value == 130
    end

    test "handles large quantities" do
      items = [%{item: "common_item", quantity: 1000}]
      base_prices = %{"common_item" => 5}

      value = Barter.calculate_offer_value(items, base_prices)

      assert value == 5000
    end

    test "works without providing base_prices argument" do
      items = [%{item: "item", quantity: 5}]

      value = Barter.calculate_offer_value(items)

      assert value == 50
    end
  end

  describe "fair_trade?/3" do
    test "returns true for equal value trades" do
      offer = Barter.create_offer("p1", "p2")
      {:ok, offer} = Barter.add_to_offer(offer, :offerer, "sword", 1)
      {:ok, offer} = Barter.add_to_offer(offer, :recipient, "shield", 1)

      base_prices = %{"sword" => 100, "shield" => 100}

      assert Barter.fair_trade?(offer, base_prices) == true
    end

    test "returns true for trades within default tolerance (20%)" do
      offer = Barter.create_offer("p1", "p2")
      {:ok, offer} = Barter.add_to_offer(offer, :offerer, "sword", 1)
      {:ok, offer} = Barter.add_to_offer(offer, :recipient, "potion", 1)

      base_prices = %{"sword" => 100, "potion" => 85}

      assert Barter.fair_trade?(offer, base_prices) == true
    end

    test "returns false for trades outside tolerance" do
      offer = Barter.create_offer("p1", "p2")
      {:ok, offer} = Barter.add_to_offer(offer, :offerer, "sword", 1)
      {:ok, offer} = Barter.add_to_offer(offer, :recipient, "potion", 1)

      base_prices = %{"sword" => 100, "potion" => 50}

      assert Barter.fair_trade?(offer, base_prices) == false
    end

    test "respects custom tolerance" do
      offer = Barter.create_offer("p1", "p2")
      {:ok, offer} = Barter.add_to_offer(offer, :offerer, "sword", 1)
      {:ok, offer} = Barter.add_to_offer(offer, :recipient, "potion", 1)

      base_prices = %{"sword" => 100, "potion" => 60}

      assert Barter.fair_trade?(offer, base_prices, 0.1) == false
      assert Barter.fair_trade?(offer, base_prices, 0.5) == true
    end

    test "returns true for empty trade (both sides empty)" do
      offer = Barter.create_offer("p1", "p2")

      assert Barter.fair_trade?(offer, %{}) == true
    end

    test "handles one-sided trades" do
      offer = Barter.create_offer("p1", "p2")
      {:ok, offer} = Barter.add_to_offer(offer, :offerer, "gift", 1)

      base_prices = %{"gift" => 100}

      # One-sided trade should be unfair unless tolerance is very high
      assert Barter.fair_trade?(offer, base_prices, 0.2) == false
      assert Barter.fair_trade?(offer, base_prices, 1.0) == true
    end

    test "handles very close values" do
      offer = Barter.create_offer("p1", "p2")
      {:ok, offer} = Barter.add_to_offer(offer, :offerer, "item1", 1)
      {:ok, offer} = Barter.add_to_offer(offer, :recipient, "item2", 1)

      base_prices = %{"item1" => 100, "item2" => 99}

      assert Barter.fair_trade?(offer, base_prices, 0.01) == true
    end

    test "works without providing arguments except offer" do
      offer = Barter.create_offer("p1", "p2")
      {:ok, offer} = Barter.add_to_offer(offer, :offerer, "item1", 1)
      {:ok, offer} = Barter.add_to_offer(offer, :recipient, "item2", 1)

      # Both should be valued at default 10
      assert Barter.fair_trade?(offer) == true
    end
  end

  describe "get_npc_preferences/1" do
    test "returns nil when entity has no barterer component" do
      npc = %{components: %{}}

      assert Barter.get_npc_preferences(npc) == nil
    end

    test "returns nil when entity has no components" do
      npc = %{}

      assert Barter.get_npc_preferences(npc) == nil
    end

    test "parses barterer component with wants and offers" do
      npc = %{
        components: %{
          "barterer" => %{
            "wants" => [
              %{"item" => "rare_herb", "value_multiplier" => 1.5}
            ],
            "offers" => [
              %{"item" => "healing_salve", "quantity" => 5}
            ]
          }
        }
      }

      prefs = Barter.get_npc_preferences(npc)

      assert prefs != nil
      assert length(prefs.wants) == 1
      assert length(prefs.offers) == 1
      assert hd(prefs.wants).item == "rare_herb"
      assert hd(prefs.wants).value_multiplier == 1.5
      assert hd(prefs.offers).item == "healing_salve"
      assert hd(prefs.offers).quantity == 5
    end

    test "handles atom keys in components" do
      npc = %{
        components: %{
          barterer: %{
            wants: [
              %{item: "herb", value_multiplier: 2.0}
            ],
            offers: []
          }
        }
      }

      prefs = Barter.get_npc_preferences(npc)

      assert prefs != nil
      assert hd(prefs.wants).item == "herb"
    end

    test "handles empty wants and offers lists" do
      npc = %{
        components: %{
          "barterer" => %{
            "wants" => [],
            "offers" => []
          }
        }
      }

      prefs = Barter.get_npc_preferences(npc)

      assert prefs.wants == []
      assert prefs.offers == []
    end

    test "handles multiple wants and offers" do
      npc = %{
        components: %{
          "barterer" => %{
            "wants" => [
              %{"item" => "herb1", "value_multiplier" => 1.5},
              %{"item" => "herb2", "value_multiplier" => 2.0},
              %{"item" => "herb3", "value_multiplier" => 1.0}
            ],
            "offers" => [
              %{"item" => "potion1", "quantity" => 5},
              %{"item" => "potion2", "quantity" => 3}
            ]
          }
        }
      }

      prefs = Barter.get_npc_preferences(npc)

      assert length(prefs.wants) == 3
      assert length(prefs.offers) == 2
    end

    test "uses default values for missing fields" do
      npc = %{
        components: %{
          "barterer" => %{
            "wants" => [
              %{"item" => "herb"}
            ],
            "offers" => [
              %{"item" => "potion"}
            ]
          }
        }
      }

      prefs = Barter.get_npc_preferences(npc)

      assert hd(prefs.wants).value_multiplier == 1.0
      assert hd(prefs.offers).quantity == 1
    end

    test "handles completely missing wants field" do
      npc = %{
        components: %{
          "barterer" => %{
            "offers" => [%{"item" => "potion", "quantity" => 1}]
          }
        }
      }

      prefs = Barter.get_npc_preferences(npc)

      assert prefs.wants == []
      assert length(prefs.offers) == 1
    end

    test "handles completely missing offers field" do
      npc = %{
        components: %{
          "barterer" => %{
            "wants" => [%{"item" => "herb", "value_multiplier" => 1.5}]
          }
        }
      }

      prefs = Barter.get_npc_preferences(npc)

      assert length(prefs.wants) == 1
      assert prefs.offers == []
    end
  end

  describe "npc_wants?/2" do
    test "returns true when NPC wants the item" do
      npc = %{
        components: %{
          "barterer" => %{
            "wants" => [
              %{"item" => "rare_herb", "value_multiplier" => 1.5}
            ]
          }
        }
      }

      assert Barter.npc_wants?(npc, "rare_herb") == true
    end

    test "returns false when NPC doesn't want the item" do
      npc = %{
        components: %{
          "barterer" => %{
            "wants" => [
              %{"item" => "rare_herb", "value_multiplier" => 1.5}
            ]
          }
        }
      }

      assert Barter.npc_wants?(npc, "common_item") == false
    end

    test "returns false when NPC has no barterer component" do
      npc = %{components: %{}}

      assert Barter.npc_wants?(npc, "any_item") == false
    end

    test "returns false when NPC wants list is empty" do
      npc = %{
        components: %{
          "barterer" => %{
            "wants" => []
          }
        }
      }

      assert Barter.npc_wants?(npc, "any_item") == false
    end

    test "handles multiple wanted items" do
      npc = %{
        components: %{
          "barterer" => %{
            "wants" => [
              %{"item" => "herb1", "value_multiplier" => 1.5},
              %{"item" => "herb2", "value_multiplier" => 2.0}
            ]
          }
        }
      }

      assert Barter.npc_wants?(npc, "herb1") == true
      assert Barter.npc_wants?(npc, "herb2") == true
      assert Barter.npc_wants?(npc, "herb3") == false
    end
  end

  describe "npc_value_multiplier/2" do
    test "returns multiplier for wanted item" do
      npc = %{
        components: %{
          "barterer" => %{
            "wants" => [
              %{"item" => "rare_herb", "value_multiplier" => 1.5}
            ]
          }
        }
      }

      assert Barter.npc_value_multiplier(npc, "rare_herb") == 1.5
    end

    test "returns 1.0 for non-wanted item" do
      npc = %{
        components: %{
          "barterer" => %{
            "wants" => [
              %{"item" => "rare_herb", "value_multiplier" => 1.5}
            ]
          }
        }
      }

      assert Barter.npc_value_multiplier(npc, "common_item") == 1.0
    end

    test "returns 1.0 when NPC has no barterer component" do
      npc = %{components: %{}}

      assert Barter.npc_value_multiplier(npc, "any_item") == 1.0
    end

    test "handles different multiplier values" do
      npc = %{
        components: %{
          "barterer" => %{
            "wants" => [
              %{"item" => "item1", "value_multiplier" => 0.5},
              %{"item" => "item2", "value_multiplier" => 2.0},
              %{"item" => "item3", "value_multiplier" => 1.0}
            ]
          }
        }
      }

      assert Barter.npc_value_multiplier(npc, "item1") == 0.5
      assert Barter.npc_value_multiplier(npc, "item2") == 2.0
      assert Barter.npc_value_multiplier(npc, "item3") == 1.0
    end

    test "uses default multiplier when not specified" do
      npc = %{
        components: %{
          "barterer" => %{
            "wants" => [
              %{"item" => "herb"}
            ]
          }
        }
      }

      assert Barter.npc_value_multiplier(npc, "herb") == 1.0
    end
  end

  describe "edge cases and integration" do
    test "complete trade workflow" do
      # Create offer
      offer = Barter.create_offer("merchant", "player")

      # Add items
      {:ok, offer} = Barter.add_to_offer(offer, :offerer, "magic_sword", 1)
      {:ok, offer} = Barter.add_to_offer(offer, :recipient, "gold_coins", 500)

      # Check fairness
      prices = %{"magic_sword" => 500, "gold_coins" => 1}
      assert Barter.fair_trade?(offer, prices) == true

      # Both accept
      {:ok, offer} = Barter.mark_accepted(offer, :offerer)
      {:ok, offer} = Barter.mark_accepted(offer, :recipient)

      # Complete trade
      {:ok, final_offer, result} = Barter.complete_trade(offer)

      assert final_offer.status == :accepted
      assert result.status == :completed
    end

    test "changing mind workflow - remove and re-add items" do
      offer = Barter.create_offer("p1", "p2")

      {:ok, offer} = Barter.add_to_offer(offer, :offerer, "item1", 1)
      {:ok, offer} = Barter.mark_accepted(offer, :offerer)
      assert offer.offerer_accepted == true

      {:ok, offer} = Barter.remove_from_offer(offer, :offerer, "item1")
      assert offer.offerer_accepted == false

      {:ok, offer} = Barter.add_to_offer(offer, :offerer, "item2", 1)
      assert offer.offerer_accepted == false
    end

    test "NPC barter integration" do
      npc = %{
        components: %{
          "barterer" => %{
            "wants" => [
              %{"item" => "rare_herb", "value_multiplier" => 2.0}
            ],
            "offers" => [
              %{"item" => "healing_potion", "quantity" => 5}
            ]
          }
        }
      }

      # Check NPC preferences
      assert Barter.npc_wants?(npc, "rare_herb") == true
      assert Barter.npc_value_multiplier(npc, "rare_herb") == 2.0

      # Create trade considering NPC preferences
      offer = Barter.create_offer("player", "npc")
      {:ok, offer} = Barter.add_to_offer(offer, :offerer, "rare_herb", 1)

      prefs = Barter.get_npc_preferences(npc)
      npc_offers = hd(prefs.offers)
      {:ok, offer} = Barter.add_to_offer(offer, :recipient, npc_offers.item, npc_offers.quantity)

      # Value calculation with multiplier
      base_prices = %{"rare_herb" => 50, "healing_potion" => 20}
      offerer_value = Barter.calculate_offer_value(offer.offerer_items, base_prices)

      assert offerer_value == 50
    end
  end
end
