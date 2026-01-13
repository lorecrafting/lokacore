defmodule Loka.Framework.Economy.Barter do
  @moduledoc """
  Player-to-player and player-to-NPC bartering system.

  Enables direct item-for-item trades without currency, with optional
  NPC trade preferences and fair value calculations.

  ## Usage

      alias Loka.Framework.Economy.Barter

      # Start a trade offer
      offer = Barter.create_offer(player1_id, player2_id)

      # Add items to offer
      {:ok, offer} = Barter.add_to_offer(offer, :offerer, "iron_sword", 1)
      {:ok, offer} = Barter.add_to_offer(offer, :recipient, "gold_coins", 50)

      # Accept/decline
      {:ok, result} = Barter.accept(offer)
      {:ok, reason} = Barter.decline(offer)

  ## NPC Barter Preferences (YAML)

      components:
        barterer:
          wants:
            - item: rare_herb
              value_multiplier: 1.5
            - item: iron_ore
              value_multiplier: 1.0
          offers:
            - item: healing_salve
              quantity: 5
            - item: antidote
              quantity: 3
  """

  alias Loka.Utils.MapHelpers

  @type trade_item :: %{
          item: String.t(),
          quantity: pos_integer()
        }

  @type trade_offer :: %{
          id: String.t(),
          offerer_id: String.t(),
          recipient_id: String.t(),
          offerer_items: [trade_item()],
          recipient_items: [trade_item()],
          offerer_accepted: boolean(),
          recipient_accepted: boolean(),
          status: :pending | :accepted | :declined | :cancelled,
          created_at: integer()
        }

  @doc """
  Creates a new trade offer between two entities.
  """
  def create_offer(offerer_id, recipient_id) do
    %{
      id: generate_offer_id(),
      offerer_id: offerer_id,
      recipient_id: recipient_id,
      offerer_items: [],
      recipient_items: [],
      offerer_accepted: false,
      recipient_accepted: false,
      status: :pending,
      created_at: System.system_time(:second)
    }
  end

  @doc """
  Adds an item to one side of the trade.
  """
  def add_to_offer(offer, :offerer, item_key, quantity) do
    item = %{item: item_key, quantity: quantity}

    updated = %{
      offer
      | offerer_items: [item | offer.offerer_items],
        offerer_accepted: false,
        recipient_accepted: false
    }

    {:ok, updated}
  end

  def add_to_offer(offer, :recipient, item_key, quantity) do
    item = %{item: item_key, quantity: quantity}

    updated = %{
      offer
      | recipient_items: [item | offer.recipient_items],
        offerer_accepted: false,
        recipient_accepted: false
    }

    {:ok, updated}
  end

  @doc """
  Removes an item from one side of the trade.
  """
  def remove_from_offer(offer, :offerer, item_key) do
    updated_items = Enum.reject(offer.offerer_items, &(&1.item == item_key))

    {:ok,
     %{offer | offerer_items: updated_items, offerer_accepted: false, recipient_accepted: false}}
  end

  def remove_from_offer(offer, :recipient, item_key) do
    updated_items = Enum.reject(offer.recipient_items, &(&1.item == item_key))

    {:ok,
     %{offer | recipient_items: updated_items, offerer_accepted: false, recipient_accepted: false}}
  end

  @doc """
  Marks one party as accepting the current offer.
  """
  def mark_accepted(offer, :offerer) do
    {:ok, %{offer | offerer_accepted: true}}
  end

  def mark_accepted(offer, :recipient) do
    {:ok, %{offer | recipient_accepted: true}}
  end

  @doc """
  Checks if both parties have accepted.
  """
  def both_accepted?(%{offerer_accepted: true, recipient_accepted: true}), do: true
  def both_accepted?(_), do: false

  @doc """
  Completes the trade if both parties accepted.

  Returns `{:ok, result}` or `{:error, reason}`.
  """
  def complete_trade(offer) do
    if both_accepted?(offer) do
      result = %{
        status: :completed,
        offerer_receives: offer.recipient_items,
        recipient_receives: offer.offerer_items,
        message: "Trade completed successfully!"
      }

      {:ok, %{offer | status: :accepted}, result}
    else
      {:error, :not_both_accepted}
    end
  end

  @doc """
  Declines/cancels a trade offer.
  """
  def decline(offer, reason \\ "Trade declined") do
    {:ok, %{offer | status: :declined}, reason}
  end

  @doc """
  Calculates the estimated value of items in an offer.
  """
  def calculate_offer_value(items, base_prices \\ %{}) do
    Enum.reduce(items, 0, fn %{item: item_key, quantity: qty}, acc ->
      price = Map.get(base_prices, item_key, 10)
      acc + price * qty
    end)
  end

  @doc """
  Checks if a trade is roughly fair (within tolerance).
  """
  def fair_trade?(offer, base_prices \\ %{}, tolerance \\ 0.2) do
    offerer_value = calculate_offer_value(offer.offerer_items, base_prices)
    recipient_value = calculate_offer_value(offer.recipient_items, base_prices)

    if offerer_value == 0 and recipient_value == 0 do
      true
    else
      ratio = min(offerer_value, recipient_value) / max(offerer_value, recipient_value)
      ratio >= 1 - tolerance
    end
  end

  # =============================================================================
  # NPC Barter
  # =============================================================================

  @doc """
  Gets barter preferences from an NPC entity.
  """
  def get_npc_preferences(npc_entity) do
    components = Map.get(npc_entity, :components, %{})

    case MapHelpers.get_flexible(components, :barterer, nil) do
      nil -> nil
      data -> parse_barter_preferences(data)
    end
  end

  defp parse_barter_preferences(data) do
    %{
      wants: parse_want_list(MapHelpers.get_flexible(data, :wants, [])),
      offers: parse_offer_list(MapHelpers.get_flexible(data, :offers, []))
    }
  end

  defp parse_want_list(wants) do
    Enum.map(wants, fn want ->
      %{
        item: MapHelpers.get_flexible(want, :item, ""),
        value_multiplier: MapHelpers.get_flexible(want, :value_multiplier, 1.0)
      }
    end)
  end

  defp parse_offer_list(offers) do
    Enum.map(offers, fn offer ->
      %{
        item: MapHelpers.get_flexible(offer, :item, ""),
        quantity: MapHelpers.get_flexible(offer, :quantity, 1)
      }
    end)
  end

  @doc """
  Checks if an NPC wants a specific item.
  """
  def npc_wants?(npc_entity, item_key) do
    case get_npc_preferences(npc_entity) do
      nil -> false
      prefs -> Enum.any?(prefs.wants, &(&1.item == item_key))
    end
  end

  @doc """
  Gets the value multiplier an NPC applies to an item they want.
  """
  def npc_value_multiplier(npc_entity, item_key) do
    case get_npc_preferences(npc_entity) do
      nil ->
        1.0

      prefs ->
        case Enum.find(prefs.wants, &(&1.item == item_key)) do
          nil -> 1.0
          want -> want.value_multiplier
        end
    end
  end

  # =============================================================================
  # Private Helpers
  # =============================================================================

  defp generate_offer_id do
    :crypto.strong_rand_bytes(8) |> Base.encode16(case: :lower)
  end
end
