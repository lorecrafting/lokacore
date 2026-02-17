defmodule Loka.Components.WalletTest do
  use ExUnit.Case, async: true

  alias Loka.Components.Wallet
  alias Loka.Engine.Entity

  defp make_entity(components \\ %{}) do
    %Entity{
      id: "test-id",
      type: :character,
      key: "test_player",
      components: components,
      keywords: [],
      is_prototype: false,
      version: 1
    }
  end

  describe "balance/1" do
    test "returns 0 when no wallet component" do
      entity = make_entity()
      assert Wallet.balance(entity) == 0
    end

    test "returns gold amount from wallet" do
      entity = make_entity(%{"wallet" => %{"gold" => 150}})
      assert Wallet.balance(entity) == 150
    end

    test "returns 0 when wallet exists but no gold" do
      entity = make_entity(%{"wallet" => %{}})
      assert Wallet.balance(entity) == 0
    end
  end

  describe "balance/2" do
    test "returns specific currency" do
      entity = make_entity(%{"wallet" => %{"gold" => 100, "tokens" => 5}})
      assert Wallet.balance(entity, "gold") == 100
      assert Wallet.balance(entity, "tokens") == 5
      assert Wallet.balance(entity, "gems") == 0
    end
  end

  describe "get/1" do
    test "returns raw wallet map" do
      entity = make_entity(%{"wallet" => %{"gold" => 50}})
      assert Wallet.get(entity) == %{"gold" => 50}
    end

    test "returns empty map when no wallet" do
      entity = make_entity()
      assert Wallet.get(entity) == %{}
    end
  end

  describe "has?/1" do
    test "returns true when wallet exists" do
      entity = make_entity(%{"wallet" => %{}})
      assert Wallet.has?(entity)
    end

    test "returns false when no wallet" do
      entity = make_entity()
      refute Wallet.has?(entity)
    end
  end

  describe "put/2" do
    test "sets wallet component" do
      entity = make_entity()
      updated = Wallet.put(entity, %{"gold" => 100})
      assert updated.components["wallet"] == %{"gold" => 100}
    end

    test "replaces existing wallet" do
      entity = make_entity(%{"wallet" => %{"gold" => 50}})
      updated = Wallet.put(entity, %{"gold" => 200})
      assert Wallet.balance(updated) == 200
    end

    test "preserves other components" do
      entity = make_entity(%{"stats" => %{"level" => 5}, "wallet" => %{"gold" => 10}})
      updated = Wallet.put(entity, %{"gold" => 100})
      assert updated.components["stats"] == %{"level" => 5}
      assert Wallet.balance(updated) == 100
    end
  end
end
