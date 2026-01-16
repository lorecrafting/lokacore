defmodule Loka.Game.Actions.Shop do
  @moduledoc """
  Shop-related game actions.

  Handles buying from and selling to NPC merchants.

  ## Actions

  - `:open_shop` - Open shop interface with merchant
  - `:buy_item` - Purchase item from shop
  - `:sell_item` - Sell item to shop
  - `:close_shop` - Close shop interface
  """

  require Logger

  alias Loka.Game.Actions.{Context, Result}
  alias Loka.Framework.Player.GameState, as: PlayerGameState
  alias Loka.Framework.Economy
  alias Loka.Engine.{Entities, PrototypeLoader, Spawner}

  @doc """
  Open a shop with an NPC merchant.
  """
  @spec open_shop(Context.t(), String.t(), map()) :: {:ok, Result.t()} | {:error, String.t()}
  def open_shop(ctx, entity_id, entity) do
    shop_data = get_shop_data(entity)

    Logger.debug(
      "[SHOP] Opening shop: player_id=#{ctx.player_id} npc=#{entity_id} items=#{length(shop_data.items)} buys=#{length(shop_data.buys)}"
    )

    if Enum.empty?(shop_data.items) and Enum.empty?(shop_data.buys) do
      Logger.debug("[SHOP] Shop empty: npc=#{entity_id}")
      {:error, "This merchant has nothing to trade."}
    else
      result =
        Result.new(
          events: [
            {:shop_open,
             %{
               npc_id: entity_id,
               npc_name: entity.name || entity.short_desc || "Merchant",
               items: shop_data.items,
               buys: shop_data.buys
             }}
          ]
        )

      {:ok, result}
    end
  end

  @doc """
  Buy an item from a shop.
  """
  @spec buy_item(Context.t(), String.t(), String.t(), map()) ::
          {:ok, Result.t()} | {:error, String.t()}
  def buy_item(ctx, npc_id, item_key, npc_entity) do
    game_state = ctx.game_state
    shop_data = get_shop_data(npc_entity)
    item_info = Enum.find(shop_data.items, fn i -> i.key == item_key end)
    player_currency = Economy.get_currency(game_state)

    Logger.debug(
      "[SHOP] Buy attempt: player_id=#{ctx.player_id} item=#{item_key} gold=#{player_currency}"
    )

    cond do
      is_nil(item_info) ->
        Logger.debug(
          "[SHOP] Buy failed - item not available: player_id=#{ctx.player_id} item=#{item_key} npc=#{npc_id}"
        )

        {:error, "That item is not available."}

      player_currency < item_info.price ->
        Logger.debug(
          "[SHOP] Buy failed - insufficient gold: player_id=#{ctx.player_id} item=#{item_key} cost=#{item_info.price} have=#{player_currency}"
        )

        {:error, "You don't have enough gold."}

      true ->
        case Spawner.spawn(item_key) do
          {:ok, item_entity} ->
            {:ok, state_after_deduct} =
              Economy.deduct_currency(game_state, "gold", item_info.price)

            new_inventory = [item_entity.id | state_after_deduct.inventory || []]

            {:ok, new_game_state} =
              PlayerGameState.update_state(state_after_deduct, %{inventory: new_inventory})

            Logger.info(
              "[SHOP] Purchase completed: player_id=#{ctx.player_id} item=#{item_key} cost=#{item_info.price} remaining_gold=#{Economy.get_currency(new_game_state)}"
            )

            result =
              Result.new(
                state: %{game_state: new_game_state},
                events: [
                  {:event, "You purchased #{item_info.name} for #{item_info.price} gold."},
                  {:inventory_update, %{action: "add", item_id: item_entity.id}},
                  {:stats_update, %{stats: new_game_state.stats}}
                ]
              )

            {:ok, result}

          {:error, spawn_error} ->
            Logger.error(
              "[SHOP] Buy failed - spawn error: player_id=#{ctx.player_id} item=#{item_key} error=#{inspect(spawn_error)}"
            )

            {:error, "Failed to acquire item."}
        end
    end
  end

  @doc """
  Sell an item to a shop.
  """
  @spec sell_item(Context.t(), String.t(), String.t(), map()) ::
          {:ok, Result.t()} | {:error, String.t()}
  def sell_item(ctx, npc_id, item_id, npc_entity) do
    game_state = ctx.game_state
    shop_data = get_shop_data(npc_entity)
    item_entity = Entities.get_entity(item_id)

    Logger.debug("[SHOP] Sell attempt: player_id=#{ctx.player_id} item_id=#{item_id}")

    cond do
      is_nil(item_entity) ->
        Logger.debug(
          "[SHOP] Sell failed - item entity not found: player_id=#{ctx.player_id} item_id=#{item_id}"
        )

        {:error, "You don't have that item."}

      item_id not in (game_state.inventory || []) ->
        Logger.debug(
          "[SHOP] Sell failed - not in inventory: player_id=#{ctx.player_id} item_id=#{item_id}"
        )

        {:error, "You don't have that item."}

      item_entity.key not in shop_data.buys ->
        Logger.debug(
          "[SHOP] Sell failed - merchant not interested: player_id=#{ctx.player_id} item=#{item_entity.key} npc=#{npc_id}"
        )

        {:error, "The merchant is not interested in that item."}

      true ->
        sell_price = get_sell_price(item_entity)
        {:ok, state_after_add} = Economy.add_currency(game_state, "gold", sell_price)
        new_inventory = List.delete(state_after_add.inventory || [], item_id)

        {:ok, new_game_state} =
          PlayerGameState.update_state(state_after_add, %{inventory: new_inventory})

        item_name = item_entity.short_desc || item_entity.key

        Logger.info(
          "[SHOP] Sale completed: player_id=#{ctx.player_id} item=#{item_entity.key} price=#{sell_price} new_gold=#{Economy.get_currency(new_game_state)}"
        )

        result =
          Result.new(
            state: %{game_state: new_game_state},
            events: [
              {:event, "You sold #{item_name} for #{sell_price} gold."},
              {:inventory_update, %{action: "remove", item_id: item_id}},
              {:stats_update, %{stats: new_game_state.stats}}
            ]
          )

        {:ok, result}
    end
  end

  @doc """
  Close the shop interface.
  """
  @spec close_shop(Context.t()) :: {:ok, Result.t()}
  def close_shop(_ctx) do
    result = Result.new(events: [{:shop_close, %{}}])
    {:ok, result}
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp get_shop_data(npc_entity) do
    components = npc_entity.components || npc_entity["components"] || %{}
    shop = Map.get(components, "shop") || Map.get(components, :shop) || %{}

    sells = Map.get(shop, "sells") || Map.get(shop, :sells) || []
    buys = Map.get(shop, "buys") || Map.get(shop, :buys) || []

    items =
      sells
      |> Enum.map(&load_shop_item/1)
      |> Enum.reject(&is_nil/1)

    %{items: items, buys: buys}
  end

  defp load_shop_item(item_key) when is_binary(item_key) do
    case PrototypeLoader.get(item_key) do
      {:ok, prototype} ->
        price = get_item_price(prototype)

        %{
          key: item_key,
          name: prototype.name || prototype.short_desc || item_key,
          description: prototype.long_desc || prototype.description || "",
          price: price
        }

      _ ->
        nil
    end
  end

  defp load_shop_item(_), do: nil

  defp get_item_price(prototype) do
    components = prototype.components || %{}
    valuable = Map.get(components, "valuable") || Map.get(components, :valuable) || %{}
    Map.get(valuable, "base_price") || Map.get(valuable, :base_price) || 10
  end

  defp get_sell_price(item_entity) do
    components = item_entity.components || item_entity["components"] || %{}
    valuable = Map.get(components, "valuable") || Map.get(components, :valuable) || %{}
    base_price = Map.get(valuable, "base_price") || Map.get(valuable, :base_price) || 10
    div(base_price, 2)
  end
end
