defmodule Loka.Framework.Economy do
  @moduledoc """
  Core economy and trading execution logic using the Value primitive.

  Handles buying from shops, selling to shops, and currency management.
  Uses the Value primitive for price calculations and gold-find modifiers.

  ## Usage

      alias Loka.Framework.Economy

      # Buy from shop
      case Economy.buy(game_state, npc_entity, "health_potion", 2) do
        {:ok, updated_state, receipt} -> "Bought 2 potions for \#{receipt.total_price} gold"
        {:error, reason} -> "Cannot buy: \#{inspect(reason)}"
      end

      # Sell to shop
      case Economy.sell(game_state, npc_entity, "iron_ore", 5) do
        {:ok, updated_state, receipt} -> "Sold 5 ore for \#{receipt.total_price} gold"
        {:error, reason} -> "Cannot sell: \#{inspect(reason)}"
      end

  ## Gold Find Modifiers

      # Add gold-find bonus to player
      {:ok, state} = Economy.add_gold_modifier(state, "lucky_ring", :percent, 0.1, "equipment")
      # Now all gold gains from selling are +10%
  """

  alias Loka.Engine.Entity
  alias Loka.Engine.TypedObject.Loader, as: TypedObjectLoader
  alias Loka.Framework.Economy.Shop
  alias Loka.Primitives.Value
  alias Loka.Utils.MapHelpers

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

  # Key for storing gold-find modifiers in game state
  @gold_modifiers_key :gold_modifiers

  # =============================================================================
  # Public API
  # =============================================================================

  @doc """
  Buys an item from a shop NPC.

  Returns `{:ok, updated_state, receipt}` or `{:error, reason}`.

  This function:
  - Deducts currency from player
  - Adds the item(s) to player inventory
  - Returns the updated game state
  """
  def buy(%Entity{} = game_state, npc_entity, item_key, quantity \\ 1) do
    with {:ok, shop} <- require_shop(npc_entity),
         :ok <- check_in_stock(shop, item_key, quantity),
         base_price <- get_base_price(item_key),
         unit_price <- calculate_buy_price(base_price, shop, game_state, npc_entity),
         total_price <- unit_price * quantity,
         :ok <- check_can_afford(game_state, shop.currency, total_price),
         {:ok, state_after_deduct} <- deduct_currency(game_state, shop.currency, total_price),
         {:ok, final_state} <- add_items_to_inventory(state_after_deduct, item_key, quantity) do
      receipt = %{
        type: :buy,
        item: item_key,
        quantity: quantity,
        unit_price: unit_price,
        total_price: total_price,
        currency: shop.currency,
        message: "You purchase #{quantity} #{item_key} for #{total_price} #{shop.currency}."
      }

      {:ok, final_state, receipt}
    end
  end

  @doc """
  Sells an item to a shop NPC.

  Returns `{:ok, updated_state, receipt}` or `{:error, reason}`.

  This function:
  - Removes item(s) from player inventory
  - Adds currency to player (with gold-find modifiers applied)
  - Returns the updated game state
  """
  def sell(%Entity{} = game_state, npc_entity, item_key, quantity \\ 1) do
    with {:ok, shop} <- require_shop(npc_entity),
         :ok <- check_has_items(game_state, item_key, quantity),
         base_price <- get_base_price(item_key),
         unit_price <- calculate_sell_price(base_price, shop, game_state, npc_entity),
         base_total <- unit_price * quantity,
         final_total <- apply_gold_modifiers(game_state, base_total),
         {:ok, state_after_remove} <- remove_items_from_inventory(game_state, item_key, quantity),
         {:ok, final_state} <- add_currency(state_after_remove, shop.currency, final_total) do
      gold_bonus = final_total - base_total

      receipt = %{
        type: :sell,
        item: item_key,
        quantity: quantity,
        unit_price: unit_price,
        base_total: base_total,
        total_price: final_total,
        gold_bonus: gold_bonus,
        currency: shop.currency,
        message: build_sell_message(item_key, quantity, base_total, final_total, shop.currency)
      }

      {:ok, final_state, receipt}
    end
  end

  defp build_sell_message(item_key, quantity, base_total, final_total, currency) do
    if final_total > base_total do
      bonus = final_total - base_total
      "You sell #{quantity} #{item_key} for #{final_total} #{currency} (+#{bonus} bonus)."
    else
      "You sell #{quantity} #{item_key} for #{final_total} #{currency}."
    end
  end

  @doc """
  Gets the player's current currency amount.
  """
  def get_currency(%Entity{} = game_state, currency_type \\ "gold") do
    stats = Entity.get_component(game_state, "stats") || %{}
    currencies = MapHelpers.get_flexible(stats, :currencies, %{})
    Map.get(currencies, currency_type, 0)
  end

  @doc """
  Checks if player can afford a purchase.
  """
  def can_afford?(%Entity{} = game_state, currency_type, amount) do
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

  defp check_can_afford(%Entity{} = game_state, currency, amount) do
    if can_afford?(game_state, currency, amount) do
      :ok
    else
      current = get_currency(game_state, currency)
      {:error, {:insufficient_funds, currency, current, amount}}
    end
  end

  defp check_has_items(%Entity{} = state, item_key, quantity) do
    inventory = Entity.get_component(state, "inventory") || []

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

  defp get_base_price(item_key) do
    # Look up item prototype for its base_price from the valuable component
    case TypedObjectLoader.get(item_key) do
      {:ok, prototype} ->
        # Get base_price from components.valuable.base_price
        valuable = MapHelpers.get_flexible(prototype.components, :valuable, %{})
        MapHelpers.get_flexible(valuable, :base_price, @default_base_price)

      {:error, :not_found} ->
        @default_base_price
    end
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

  # =============================================================================
  # Currency Mutations (in-memory only, caller handles persistence)
  # =============================================================================

  @doc """
  Deducts currency from player's game state.

  Returns the updated struct directly (caller handles persistence).
  """
  def deduct_currency(%Entity{} = state, currency_type, amount) do
    stats = Entity.get_component(state, "stats") || %{}
    currencies = MapHelpers.get_flexible(stats, :currencies, %{})
    current = Map.get(currencies, currency_type, 0)

    if current >= amount do
      new_currencies = Map.put(currencies, currency_type, current - amount)
      new_stats = update_currencies_in_stats(stats, new_currencies)
      {:ok, Entity.add_component(state, "stats", new_stats)}
    else
      {:error, {:insufficient_funds, currency_type, current, amount}}
    end
  end

  @doc """
  Adds currency to player's game state.

  Returns the updated struct directly (caller handles persistence).
  """
  def add_currency(%Entity{} = state, currency_type, amount) do
    stats = Entity.get_component(state, "stats") || %{}
    currencies = MapHelpers.get_flexible(stats, :currencies, %{})
    current = Map.get(currencies, currency_type, 0)
    new_currencies = Map.put(currencies, currency_type, current + amount)
    new_stats = update_currencies_in_stats(stats, new_currencies)
    {:ok, Entity.add_component(state, "stats", new_stats)}
  end

  defp update_currencies_in_stats(stats, new_currencies) do
    # Determine key format from existing stats
    keys = Map.keys(stats)

    if keys == [] or is_binary(List.first(keys)) do
      Map.put(stats, "currencies", new_currencies)
    else
      Map.put(stats, :currencies, new_currencies)
    end
  end

  # =============================================================================
  # Inventory Mutations (in-memory only, caller handles persistence)
  # =============================================================================

  defp add_items_to_inventory(state, item_key, quantity) do
    new_items = List.duplicate(item_key, quantity)
    inventory = Entity.get_component(state, "inventory") || []
    new_inventory = inventory ++ new_items
    {:ok, Entity.add_component(state, "inventory", new_inventory)}
  end

  defp remove_items_from_inventory(state, item_key, quantity) do
    inventory = Entity.get_component(state, "inventory") || []

    matching_items =
      Enum.filter(inventory, fn item_id ->
        item_id == item_key or String.starts_with?(to_string(item_id), item_key)
      end)

    if length(matching_items) >= quantity do
      items_to_remove = Enum.take(matching_items, quantity)

      new_inventory =
        Enum.reduce(items_to_remove, inventory, fn item, inv ->
          List.delete(inv, item)
        end)

      {:ok, Entity.add_component(state, "inventory", new_inventory)}
    else
      {:error, {:insufficient_items, item_key, length(matching_items), quantity}}
    end
  end

  # =============================================================================
  # Gold Find Modifiers (using Value primitive)
  # =============================================================================

  @doc """
  Adds a gold-find modifier to the player's game state.

  Gold-find modifiers affect all currency gains from selling.

  ## Examples

      {:ok, state} = Economy.add_gold_modifier(state, "lucky_ring", :percent, 0.1, "equipment")
      # +10% gold from all sources

      {:ok, state} = Economy.add_gold_modifier(state, "guild_bonus", :flat, 5, "guild")
      # +5 gold from all sources
  """
  def add_gold_modifier(%Entity{} = game_state, id, type, amount, source \\ nil) do
    gold_value = get_gold_value(game_state)
    {:ok, new_value, _audit} = Value.add_modifier(gold_value, id, type, amount, source)
    {:ok, put_gold_value(game_state, new_value)}
  end

  @doc """
  Removes a gold-find modifier by ID.
  """
  def remove_gold_modifier(%Entity{} = game_state, id) do
    gold_value = get_gold_value(game_state)
    {:ok, new_value, _audit} = Value.remove_modifier(gold_value, id)
    {:ok, put_gold_value(game_state, new_value)}
  end

  @doc """
  Gets the current gold-find bonus as a percentage.

  Returns 0 for no bonus, 0.1 for +10%, etc.
  """
  def get_gold_find_bonus(%Entity{} = game_state) do
    gold_value = get_gold_value(game_state)
    Value.percent_bonus(gold_value)
  end

  @doc """
  Lists all active gold-find modifiers.
  """
  def list_gold_modifiers(%Entity{} = game_state) do
    gold_value = get_gold_value(game_state)
    gold_value.modifiers
  end

  @doc """
  Applies gold-find modifiers to a loot amount.

  Use this when awarding gold from sources other than selling (e.g., monster drops).

  ## Examples

      gold_drop = Economy.apply_loot_gold_modifiers(game_state, 50)
      # Returns 55 if player has +10% gold find
  """
  def apply_loot_gold_modifiers(%Entity{} = game_state, base_amount) do
    apply_gold_modifiers(game_state, base_amount)
  end

  defp get_gold_value(%Entity{} = game_state) do
    stats = Entity.get_component(game_state, "stats") || %{}

    case MapHelpers.get_flexible(stats, @gold_modifiers_key, nil) do
      nil -> Value.new(0)
      %Value{} = value -> value
      map when is_map(map) -> Value.from_map(map)
    end
  end

  defp put_gold_value(%Entity{} = game_state, %Value{} = gold_value) do
    stats = Entity.get_component(game_state, "stats") || %{}

    new_stats =
      if is_binary(List.first(Map.keys(stats) || [])) do
        Map.put(stats, "gold_modifiers", Value.to_map(gold_value))
      else
        Map.put(stats, @gold_modifiers_key, gold_value)
      end

    Entity.add_component(game_state, "stats", new_stats)
  end

  defp apply_gold_modifiers(%Entity{} = game_state, base_amount) do
    gold_value = get_gold_value(game_state)

    # Create a temporary Value with the base amount and copy modifiers
    income_value = %Value{base: base_amount, modifiers: gold_value.modifiers}

    round(Value.compute(income_value))
  end
end
