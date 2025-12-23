defmodule Exmud.Framework.Economy do
  @moduledoc """
  Core economy and trading execution logic.

  Handles buying from shops, selling to shops, and currency management.

  ## Usage

      alias Exmud.Framework.Economy

      # Buy from shop
      case Economy.buy(game_state, npc_entity, "health_potion", 2) do
        {:ok, result} -> "Bought 2 potions for \#{result.total_price} gold"
        {:error, reason} -> "Cannot buy: \#{inspect(reason)}"
      end

      # Sell to shop
      case Economy.sell(game_state, npc_entity, "iron_ore", 5) do
        {:ok, result} -> "Sold 5 ore for \#{result.total_price} gold"
        {:error, reason} -> "Cannot sell: \#{inspect(reason)}"
      end
  """

  alias Exmud.Framework.Economy.Shop
  alias Exmud.Framework.Player.GameState
  alias Exmud.Utils.MapHelpers

  @type transaction_result :: %{
          type: :buy | :sell,
          item: String.t(),
          quantity: pos_integer(),
          unit_price: non_neg_integer(),
          total_price: non_neg_integer(),
          message: String.t()
        }

  # Default base prices for items (would normally come from item definitions)
  @default_base_price 10

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Buys an item from a shop NPC.

  Returns `{:ok, result}` or `{:error, reason}`.
  """
  def buy(%GameState{} = game_state, npc_entity, item_key, quantity \\ 1) do
    with {:ok, shop} <- require_shop(npc_entity),
         :ok <- check_in_stock(shop, item_key, quantity),
         base_price <- get_base_price(item_key),
         unit_price <- calculate_buy_price(base_price, shop, game_state, npc_entity),
         total_price <- unit_price * quantity,
         :ok <- check_can_afford(game_state, shop.currency, total_price) do
      result = %{
        type: :buy,
        item: item_key,
        quantity: quantity,
        unit_price: unit_price,
        total_price: total_price,
        currency: shop.currency,
        message: "You purchase #{quantity} #{item_key} for #{total_price} #{shop.currency}."
      }

      {:ok, result}
    end
  end

  @doc """
  Sells an item to a shop NPC.

  Returns `{:ok, result}` or `{:error, reason}`.
  """
  def sell(%GameState{} = game_state, npc_entity, item_key, quantity \\ 1) do
    with {:ok, shop} <- require_shop(npc_entity),
         :ok <- check_has_items(game_state, item_key, quantity),
         base_price <- get_base_price(item_key),
         unit_price <- calculate_sell_price(base_price, shop, game_state, npc_entity),
         total_price <- unit_price * quantity do
      result = %{
        type: :sell,
        item: item_key,
        quantity: quantity,
        unit_price: unit_price,
        total_price: total_price,
        currency: shop.currency,
        message: "You sell #{quantity} #{item_key} for #{total_price} #{shop.currency}."
      }

      {:ok, result}
    end
  end

  @doc """
  Gets the player's current currency amount.
  """
  def get_currency(%GameState{} = game_state, currency_type \\ "gold") do
    currencies = MapHelpers.get_flexible(game_state.stats, :currencies, %{})
    Map.get(currencies, currency_type, 0)
  end

  @doc """
  Checks if player can afford a purchase.
  """
  def can_afford?(%GameState{} = game_state, currency_type, amount) do
    get_currency(game_state, currency_type) >= amount
  end

  @doc """
  Gets buy/sell prices for an item at a shop.
  """
  def get_prices(npc_entity, item_key, game_state \\ nil) do
    with {:ok, shop} <- require_shop(npc_entity) do
      base_price = get_base_price(item_key)

      buy_price =
        if game_state do
          calculate_buy_price(base_price, shop, game_state, npc_entity)
        else
          round(base_price * shop.sell_multiplier)
        end

      sell_price =
        if game_state do
          calculate_sell_price(base_price, shop, game_state, npc_entity)
        else
          round(base_price * shop.buy_multiplier)
        end

      {:ok,
       %{
         item: item_key,
         base_price: base_price,
         buy_price: buy_price,
         sell_price: sell_price,
         currency: shop.currency
       }}
    end
  end

  # =============================================================================
  # Validation
  # =============================================================================

  defp require_shop(npc_entity) do
    case Shop.get_shop(npc_entity) do
      nil -> {:error, :not_a_merchant}
      shop -> {:ok, shop}
    end
  end

  defp check_in_stock(shop, item_key, quantity) do
    case find_stock_item(shop, item_key) do
      nil ->
        {:error, {:not_in_stock, item_key}}

      stock_item ->
        if stock_item.unlimited or stock_item.quantity >= quantity do
          :ok
        else
          {:error, {:insufficient_stock, item_key, stock_item.quantity, quantity}}
        end
    end
  end

  defp check_can_afford(%GameState{} = game_state, currency, amount) do
    if can_afford?(game_state, currency, amount) do
      :ok
    else
      current = get_currency(game_state, currency)
      {:error, {:insufficient_funds, currency, current, amount}}
    end
  end

  defp check_has_items(%GameState{inventory: inventory}, item_key, quantity) do
    count =
      Enum.count(inventory, fn item_id ->
        item_id == item_key or String.starts_with?(to_string(item_id), item_key)
      end)

    if count >= quantity do
      :ok
    else
      {:error, {:insufficient_items, item_key, count, quantity}}
    end
  end

  # =============================================================================
  # Price Calculations
  # =============================================================================

  defp get_base_price(_item_key) do
    # In a full implementation, this would look up the item's base_price
    # from its prototype/definition
    @default_base_price
  end

  defp calculate_buy_price(base_price, shop, _game_state, _npc_entity) do
    # Price player pays to buy from shop
    # Could apply faction discounts here
    round(base_price * shop.sell_multiplier)
  end

  defp calculate_sell_price(base_price, shop, _game_state, _npc_entity) do
    # Price shop pays player for item
    # Could apply faction bonuses here
    round(base_price * shop.buy_multiplier)
  end

  defp find_stock_item(%Shop{stock: stock}, item_key) do
    Enum.find(stock, &(&1.item == item_key))
  end
end
