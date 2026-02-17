defmodule Loka.Framework.EconomyTest do
  use Loka.DataCase

  alias Loka.Engine.{Entity, Entities, EntityServer}
  alias Loka.Framework.Economy
  alias Loka.Framework.Economy.EconomyLog
  alias Loka.Components.Wallet

  # Helper to create and start an entity with EntityServer
  defp create_player(key, gold \\ 0) do
    entity = %Entity{
      id: Ecto.UUID.generate(),
      type: :character,
      key: key,
      short_desc: "Test Player",
      keywords: [],
      is_prototype: false,
      version: 1,
      components: %{"wallet" => %{"gold" => gold}, "stats" => %{"level" => 1}}
    }

    {:ok, _saved} = Entities.save(entity)

    {:ok, pid} =
      EntityServer.start_link(entity.id,
        name: {:via, Registry, {Loka.Engine.EntityRegistry.Registry, entity.id}}
      )

    on_exit(fn -> if Process.alive?(pid), do: GenServer.stop(pid, :normal) end)
    {entity.id, pid}
  end

  describe "mint/4" do
    test "adds gold to entity wallet" do
      {id, _pid} = create_player("mint_test")

      assert {:ok, %{amount: 50, balance: 50}} = Economy.mint(id, 50, :quest_reward)
    end

    test "accumulates gold across multiple mints" do
      {id, _pid} = create_player("accumulate_test")

      assert {:ok, %{balance: 50}} = Economy.mint(id, 50, :mob_kill)
      assert {:ok, %{balance: 80}} = Economy.mint(id, 30, :quest_reward)
    end

    test "logs transaction to EconomyLog" do
      {id, _pid} = create_player("log_test")

      Economy.mint(id, 100, :quest_reward, %{quest: "intro"})

      txns = EconomyLog.recent(id)
      assert length(txns) == 1
      assert hd(txns).type == "faucet"
      assert hd(txns).category == "quest_reward"
      assert hd(txns).amount == 100
    end

    test "rejects non-positive amounts" do
      assert_raise FunctionClauseError, fn ->
        Economy.mint("any-id", 0, :test)
      end

      assert_raise FunctionClauseError, fn ->
        Economy.mint("any-id", -10, :test)
      end
    end

    test "returns error for non-existent entity" do
      assert {:error, :entity_not_found} = Economy.mint("nonexistent-id", 10, :test)
    end
  end

  describe "burn/4" do
    test "removes gold from entity wallet" do
      {id, _pid} = create_player("burn_test", 100)

      assert {:ok, %{amount: 30, balance: 70}} = Economy.burn(id, 30, :shop_buy)
    end

    test "returns insufficient_funds when not enough gold" do
      {id, _pid} = create_player("insufficient_test", 10)

      assert {:error, :insufficient_funds} = Economy.burn(id, 50, :shop_buy)
    end

    test "logs sink transaction" do
      {id, _pid} = create_player("sink_log_test", 100)

      Economy.burn(id, 25, :repair, %{item: "sword"})

      txns = EconomyLog.recent(id)
      assert length(txns) == 1
      assert hd(txns).type == "sink"
      assert hd(txns).category == "repair"
    end
  end

  describe "transfer/4" do
    test "moves gold between entities with tax" do
      {from_id, _} = create_player("sender", 100)
      {to_id, _} = create_player("receiver", 0)

      # Default trade tax is 5%
      assert {:ok, %{sent: 100, received: 95, tax: 5}} =
               Economy.transfer(from_id, to_id, 100, :trade)

      assert Economy.balance(from_id) == 0
      assert Economy.balance(to_id) == 95
    end

    test "fails when sender has insufficient funds" do
      {from_id, _} = create_player("poor_sender", 10)
      {to_id, _} = create_player("waiting_receiver", 0)

      assert {:error, :insufficient_funds} = Economy.transfer(from_id, to_id, 100, :trade)
    end
  end

  describe "balance/1" do
    test "returns gold balance from running entity" do
      {id, _pid} = create_player("balance_test", 42)

      assert Economy.balance(id) == 42
    end

    test "returns 0 for non-existent entity" do
      assert Economy.balance("nonexistent") == 0
    end
  end

  describe "credit/3 and debit/3 (entity transform API)" do
    test "credit adds gold to entity in memory" do
      entity = %Entity{
        id: "test",
        type: :character,
        key: "test",
        components: %{"wallet" => %{"gold" => 50}},
        keywords: [],
        is_prototype: false,
        version: 1
      }

      assert {:ok, updated} = Economy.credit(entity, 30, :quest_reward)
      assert Wallet.balance(updated) == 80
    end

    test "debit removes gold from entity in memory" do
      entity = %Entity{
        id: "test",
        type: :character,
        key: "test",
        components: %{"wallet" => %{"gold" => 50}},
        keywords: [],
        is_prototype: false,
        version: 1
      }

      assert {:ok, updated} = Economy.debit(entity, 20, :shop_buy)
      assert Wallet.balance(updated) == 30
    end

    test "debit returns error for insufficient funds" do
      entity = %Entity{
        id: "test",
        type: :character,
        key: "test",
        components: %{"wallet" => %{"gold" => 10}},
        keywords: [],
        is_prototype: false,
        version: 1
      }

      assert {:error, :insufficient_funds} = Economy.debit(entity, 50, :shop_buy)
    end

    test "credit works when entity has no wallet" do
      entity = %Entity{
        id: "test",
        type: :character,
        key: "test",
        components: %{},
        keywords: [],
        is_prototype: false,
        version: 1
      }

      assert {:ok, updated} = Economy.credit(entity, 100, :admin_grant)
      assert Wallet.balance(updated) == 100
    end
  end

  describe "EntityServer protected component guard" do
    test "rejects direct wallet modification via update/3" do
      {id, pid} = create_player("guard_test", 50)

      result =
        EntityServer.update(pid, fn entity ->
          Wallet.put(entity, %{"gold" => 9999})
        end)

      assert {:error, :protected_component, ["wallet"]} = result

      # Balance unchanged
      assert Economy.balance(id) == 50
    end

    test "allows non-wallet component updates via update/3" do
      {_id, pid} = create_player("nonwallet_test", 50)

      assert {:ok, updated} =
               EntityServer.update(pid, fn entity ->
                 %{entity | components: Map.put(entity.components, "stats", %{"level" => 5})}
               end)

      assert updated.components["stats"]["level"] == 5
    end
  end

  describe "EconomyLog" do
    test "daily_summary aggregates correctly" do
      {id, _} = create_player("summary_test")

      Economy.mint(id, 100, :mob_kill)
      Economy.mint(id, 50, :quest_reward)
      Economy.burn(id, 30, :repair)

      summary = EconomyLog.daily_summary()
      assert summary.total_minted == 150
      assert summary.total_burned == 30
      assert summary.net_flow == 120
      assert summary.faucets["mob_kill"] == 100
      assert summary.faucets["quest_reward"] == 50
      assert summary.sinks["repair"] == 30
    end

    test "totals tracks all-time figures" do
      {id, _} = create_player("totals_test")

      Economy.mint(id, 200, :admin_grant)
      Economy.burn(id, 50, :shop_buy)

      totals = EconomyLog.totals()
      assert totals.total_minted >= 200
      assert totals.total_burned >= 50
    end
  end
end
