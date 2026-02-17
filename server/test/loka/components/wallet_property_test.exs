defmodule Loka.Components.WalletPropertyTest do
  use ExUnit.Case, async: true
  use ExUnitProperties

  import Loka.Test.Generators

  alias Loka.Engine.Entity
  alias Loka.Components.Wallet

  defp entity_with_gold(amount) do
    Entity.new(type: :character, key: "test")
    |> Entity.add_component("wallet", %{"gold" => amount})
  end

  describe "balance properties" do
    property "balance reflects the gold in wallet" do
      check all(amount <- gold_balance()) do
        entity = entity_with_gold(amount)
        assert Wallet.balance(entity) == amount
      end
    end

    test "balance defaults to 0 without wallet" do
      entity = Entity.new(type: :character, key: "test")
      assert Wallet.balance(entity) == 0
    end

    property "balance for nonexistent currency is 0" do
      check all(amount <- gold_balance()) do
        entity = entity_with_gold(amount)
        assert Wallet.balance(entity, "gems") == 0
      end
    end
  end

  describe "put/get roundtrip" do
    property "put then get returns the same wallet data" do
      check all(
              gold <- gold_balance(),
              gems <- gold_balance()
            ) do
        wallet_data = %{"gold" => gold, "gems" => gems}
        entity = Entity.new(type: :character, key: "test")
        entity = Wallet.put(entity, wallet_data)
        assert Wallet.get(entity) == wallet_data
      end
    end
  end

  describe "has? properties" do
    property "has? is true after put, false before" do
      check all(amount <- gold_balance()) do
        empty = Entity.new(type: :character, key: "test")
        refute Wallet.has?(empty)

        with_wallet = entity_with_gold(amount)
        assert Wallet.has?(with_wallet)
      end
    end
  end

  describe "credit invariant (via manual wallet update)" do
    property "crediting increases balance by exact amount" do
      check all(
              initial <- gold_balance(),
              credit <- currency_amount()
            ) do
        entity = entity_with_gold(initial)
        wallet = Wallet.get(entity)
        new_wallet = Map.put(wallet, "gold", initial + credit)
        entity = Wallet.put(entity, new_wallet)
        assert Wallet.balance(entity) == initial + credit
      end
    end

    property "debiting decreases balance by exact amount (if sufficient)" do
      check all(
              initial <- integer(100..100_000),
              debit <- integer(1..100)
            ) do
        entity = entity_with_gold(initial)
        wallet = Wallet.get(entity)
        new_wallet = Map.put(wallet, "gold", initial - debit)
        entity = Wallet.put(entity, new_wallet)
        assert Wallet.balance(entity) == initial - debit
        assert Wallet.balance(entity) >= 0
      end
    end
  end
end
