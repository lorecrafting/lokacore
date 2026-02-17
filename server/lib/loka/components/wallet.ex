defmodule Loka.Components.Wallet do
  @moduledoc """
  Typed access to the `wallet` component.

  Stores currency balances. IMPORTANT: Never modify this component directly.
  All currency changes MUST go through `Loka.Framework.Economy`.

  ## Data Shape

      entity.components["wallet"] = %{
        "gold" => 150
      }

  ## Usage

      alias Loka.Components.Wallet

      Wallet.balance(entity)           # => 150
      Wallet.balance(entity, "gold")   # => 150
  """

  @component_key "wallet"

  alias Loka.Engine.Entity

  @doc "Returns the raw wallet map or empty map."
  @spec get(Entity.t()) :: map()
  def get(entity), do: Map.get(entity.components, @component_key, %{})

  @doc "Returns true if the entity has a wallet component."
  @spec has?(Entity.t()) :: boolean()
  def has?(entity), do: Map.has_key?(entity.components, @component_key)

  @doc "Sets the entire wallet map on the entity. Internal use only."
  @spec put(Entity.t(), map()) :: Entity.t()
  def put(entity, data) when is_map(data),
    do: %{entity | components: Map.put(entity.components, @component_key, data)}

  @doc "Returns the component key string."
  @spec component_key() :: String.t()
  def component_key, do: @component_key

  @doc """
  Returns the gold balance for an entity.

  Defaults to 0 if no wallet exists.
  """
  @spec balance(Entity.t()) :: non_neg_integer()
  def balance(entity), do: balance(entity, "gold")

  @doc """
  Returns the balance of a specific currency.

  Defaults to 0 if the currency doesn't exist.
  """
  @spec balance(Entity.t(), String.t()) :: non_neg_integer()
  def balance(entity, currency) do
    get(entity) |> Map.get(currency, 0)
  end
end
