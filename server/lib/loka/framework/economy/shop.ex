defmodule Loka.Framework.Economy.Shop do
  @moduledoc """
  NPC shop component and trading logic.

  Shops are components on NPC entities that enable buying/selling items.
  Supports dynamic pricing, stock limits, and faction discounts.

  ## Shop Configuration (in NPC prototype YAML)

      components:
        shop:
          sells:
            - health_potion
            - rope
          buys:
            - iron_ore
            - wood

  Or with advanced options:

      components:
        shop:
          shop_type: general
          buy_multiplier: 0.5
          sell_multiplier: 1.0
          stock:
            - item: health_potion
              quantity: 10
              restock_time: 3600
            - item: rope
              quantity: 5
              unlimited: true
          currency: gold
          faction_discounts: true
          greeting: "Welcome to my shop!"
          farewell: "Come again!"

  ## Usage

      alias Loka.Framework.Economy.Shop

      # Get shop from NPC
      case Shop.get_shop(npc_entity) do
        nil -> "This NPC does not have a shop"
        shop -> "Found \#{shop.shop_type} shop"
      end

      # List stock
      items = Shop.list_stock(npc_entity)

      # Buy/sell
      {:ok, result} = Shop.buy(game_state, npc_entity, "health_potion", 1)
      {:ok, result} = Shop.sell(game_state, npc_entity, "iron_ore", 5)
  """

  alias Loka.Utils.MapHelpers

  @type stock_item :: %{
          item: String.t(),
          quantity: integer(),
          max_quantity: integer(),
          unlimited: boolean(),
          restock_time: non_neg_integer() | nil,
          restock_timer: integer() | nil
        }

  @type t :: %__MODULE__{
          shop_type: String.t(),
          buy_multiplier: float(),
          sell_multiplier: float(),
          stock: [stock_item()],
          currency: String.t(),
          faction_discounts: boolean(),
          greeting: String.t(),
          farewell: String.t()
        }

  defstruct shop_type: "general",
            buy_multiplier: 0.5,
            sell_multiplier: 1.0,
            stock: [],
            currency: "gold",
            faction_discounts: true,
            greeting: "Welcome to my shop!",
            farewell: "Come again!"

  @valid_shop_types ["general", "weapons", "armor", "magic", "alchemy", "food", "blacksmith"]

  @doc """
  Gets the shop component from an NPC entity.
  """
  def get_shop(nil), do: nil

  def get_shop(npc_entity) do
    components = Map.get(npc_entity, :components, %{})
    shop_data = MapHelpers.get_flexible(components, :shop, nil)

    case shop_data do
      nil -> nil
      data -> from_component(data)
    end
  end

  @doc """
  Parses a shop from component data.
  """
  def from_component(data) when is_map(data) do
    %__MODULE__{
      shop_type: MapHelpers.get_flexible(data, :shop_type, "general"),
      buy_multiplier: MapHelpers.get_flexible(data, :buy_multiplier, 0.5),
      sell_multiplier: MapHelpers.get_flexible(data, :sell_multiplier, 1.0),
      stock: parse_stock(data),
      currency: MapHelpers.get_flexible(data, :currency, "gold"),
      faction_discounts: MapHelpers.get_flexible(data, :faction_discounts, true),
      greeting: MapHelpers.get_flexible(data, :greeting, "Welcome to my shop!"),
      farewell: MapHelpers.get_flexible(data, :farewell, "Come again!")
    }
  end

  def from_component(_), do: nil

  defp parse_stock(data) do
    # First check for complex "stock" format
    stock = MapHelpers.get_flexible(data, :stock, nil)

    if stock do
      # Complex format: stock: [{item: "x", quantity: N, ...}, ...]
      Enum.map(stock, fn item_data ->
        quantity = MapHelpers.get_flexible(item_data, :quantity, 1)

        %{
          item: MapHelpers.get_flexible(item_data, :item, ""),
          quantity: quantity,
          max_quantity: quantity,
          unlimited: MapHelpers.get_flexible(item_data, :unlimited, false),
          restock_time: MapHelpers.get_flexible(item_data, :restock_time, nil),
          restock_timer: nil
        }
      end)
    else
      # Simple format: sells: ["item1", "item2", ...]
      sells = MapHelpers.get_flexible(data, :sells, [])

      Enum.map(sells, fn item_key ->
        %{
          item: item_key,
          quantity: 1,
          max_quantity: 1,
          unlimited: true,
          restock_time: nil,
          restock_timer: nil
        }
      end)
    end
  end

  @doc """
  Lists all available stock with current quantities and prices.
  """
  def list_stock(npc_entity, base_prices \\ %{}) do
    case get_shop(npc_entity) do
      nil ->
        []

      shop ->
        Enum.map(shop.stock, fn stock_item ->
          base_price = Map.get(base_prices, stock_item.item, 10)

          %{
            item: stock_item.item,
            quantity: if(stock_item.unlimited, do: :unlimited, else: stock_item.quantity),
            buy_price: calculate_buy_price(base_price, shop),
            sell_price: calculate_sell_price(base_price, shop)
          }
        end)
        |> Enum.filter(fn item ->
          item.quantity == :unlimited or item.quantity > 0
        end)
    end
  end

  @doc """
  Gets the price to buy an item from the shop.
  """
  def get_buy_price(npc_entity, _item_key, base_price, quantity \\ 1) do
    case get_shop(npc_entity) do
      nil -> {:error, :not_a_shop}
      shop -> {:ok, calculate_buy_price(base_price, shop) * quantity}
    end
  end

  @doc """
  Gets the price the shop will pay for an item.
  """
  def get_sell_price(npc_entity, _item_key, base_price, quantity \\ 1) do
    case get_shop(npc_entity) do
      nil -> {:error, :not_a_shop}
      shop -> {:ok, calculate_sell_price(base_price, shop) * quantity}
    end
  end

  @doc """
  Checks if an item is in stock.
  """
  def in_stock?(npc_entity, item_key, quantity \\ 1) do
    case get_shop(npc_entity) do
      nil ->
        false

      shop ->
        case find_stock_item(shop, item_key) do
          nil -> false
          stock_item -> stock_item.unlimited or stock_item.quantity >= quantity
        end
    end
  end

  @doc """
  Processes restock timers for a shop.
  """
  def tick_restock(npc_entity, current_time \\ nil) do
    current_time = current_time || System.system_time(:second)

    case get_shop(npc_entity) do
      nil ->
        {:ok, nil}

      shop ->
        updated_stock =
          Enum.map(shop.stock, fn stock_item ->
            process_restock(stock_item, current_time)
          end)

        {:ok, %{shop | stock: updated_stock}}
    end
  end

  # =============================================================================
  # Price Calculations
  # =============================================================================

  defp calculate_buy_price(base_price, %__MODULE__{sell_multiplier: mult}) do
    round(base_price * mult)
  end

  defp calculate_sell_price(base_price, %__MODULE__{buy_multiplier: mult}) do
    round(base_price * mult)
  end

  defp find_stock_item(%__MODULE__{stock: stock}, item_key) do
    Enum.find(stock, &(&1.item == item_key))
  end

  defp process_restock(stock_item, current_time) do
    cond do
      # Already at max or unlimited
      stock_item.unlimited ->
        stock_item

      stock_item.quantity >= stock_item.max_quantity ->
        %{stock_item | restock_timer: nil}

      # No restock configured
      is_nil(stock_item.restock_time) ->
        stock_item

      # No timer set, start one
      is_nil(stock_item.restock_timer) ->
        %{stock_item | restock_timer: current_time + stock_item.restock_time}

      # Timer elapsed, restock
      current_time >= stock_item.restock_timer ->
        %{stock_item | quantity: stock_item.max_quantity, restock_timer: nil}

      # Still waiting
      true ->
        stock_item
    end
  end

  @doc """
  Returns valid shop types.
  """
  def valid_shop_types, do: @valid_shop_types
end
