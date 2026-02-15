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
  alias Loka.Engine.{Entity, Entities, Spawner}

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
               npc_name: Map.get(entity, :name) || Map.get(entity, :short_desc) || "Merchant",
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
    character = ctx.character
    shop_data = get_shop_data(npc_entity)
    item_info = Enum.find(shop_data.items, fn i -> i.key == item_key end)
    player_currency = get_currency(character)

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
            character_after_deduct = deduct_currency(character, item_info.price)

            inventory = Entity.get_component(character_after_deduct, "inventory") || []
            new_inventory = [item_entity.id | inventory]

            new_character =
              Entity.add_component(character_after_deduct, "inventory", new_inventory)

            Logger.info(
              "[SHOP] Purchase completed: player_id=#{ctx.player_id} item=#{item_key} cost=#{item_info.price} remaining_gold=#{get_currency(new_character)}"
            )

            stats = Entity.get_component(new_character, "stats")

            result =
              Result.new(
                state: %{character: new_character},
                events: [
                  {:event, "You purchased #{item_info.name} for #{item_info.price} gold."},
                  {:inventory_update, %{action: "add", item_id: item_entity.id}},
                  {:stats_update, %{stats: stats}}
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
    character = ctx.character
    shop_data = get_shop_data(npc_entity)
    item_entity = Entities.get_entity(item_id)
    inventory = Entity.get_component(character, "inventory") || []

    Logger.debug("[SHOP] Sell attempt: player_id=#{ctx.player_id} item_id=#{item_id}")

    cond do
      is_nil(item_entity) ->
        Logger.debug(
          "[SHOP] Sell failed - item entity not found: player_id=#{ctx.player_id} item_id=#{item_id}"
        )

        {:error, "You don't have that item."}

      item_id not in inventory ->
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
        character_after_add = add_currency(character, sell_price)
        cur_inventory = Entity.get_component(character_after_add, "inventory") || []
        new_inventory = List.delete(cur_inventory, item_id)
        new_character = Entity.add_component(character_after_add, "inventory", new_inventory)

        item_name = item_entity.short_desc || item_entity.key

        Logger.info(
          "[SHOP] Sale completed: player_id=#{ctx.player_id} item=#{item_entity.key} price=#{sell_price} new_gold=#{get_currency(new_character)}"
        )

        stats = Entity.get_component(new_character, "stats")

        result =
          Result.new(
            state: %{character: new_character},
            events: [
              {:event, "You sold #{item_name} for #{sell_price} gold."},
              {:inventory_update, %{action: "remove", item_id: item_id}},
              {:stats_update, %{stats: stats}}
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
    case Entities.find_one(key: item_key, type: :item) do
      {:ok, entity} ->
        price = get_item_price(entity)

        %{
          key: item_key,
          name: entity.short_desc || item_key,
          description: entity.long_desc || "",
          price: price
        }

      _ ->
        nil
    end
  end

  defp load_shop_item(_), do: nil

  defp get_item_price(entity) do
    components = entity.components || %{}
    valuable = Map.get(components, "valuable") || %{}
    Map.get(valuable, "base_price") || 10
  end

  defp get_sell_price(item_entity) do
    components = item_entity.components || item_entity["components"] || %{}
    valuable = Map.get(components, "valuable") || Map.get(components, :valuable) || %{}
    base_price = Map.get(valuable, "base_price") || Map.get(valuable, :base_price) || 10
    div(base_price, 2)
  end

  # Economy helpers (inline replacements for deleted Economy module)
  defp get_currency(character) do
    stats = Entity.get_component(character, "stats") || %{}
    Map.get(stats, "gold") || Map.get(stats, :gold) || 0
  end

  defp deduct_currency(character, amount) do
    stats = Entity.get_component(character, "stats") || %{}
    current = Map.get(stats, "gold") || Map.get(stats, :gold) || 0
    new_stats = Map.put(stats, "gold", max(0, current - amount))
    Entity.add_component(character, "stats", new_stats)
  end

  defp add_currency(character, amount) do
    stats = Entity.get_component(character, "stats") || %{}
    current = Map.get(stats, "gold") || Map.get(stats, :gold) || 0
    new_stats = Map.put(stats, "gold", current + amount)
    Entity.add_component(character, "stats", new_stats)
  end
end
