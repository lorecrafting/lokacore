defmodule Loka.Framework.Economy do
  @moduledoc """
  Central economy system. ALL currency changes flow through here.

  No module should directly modify `components["wallet"]`. Use:

  - `mint/4` — gold enters the world (faucets: mob kills, quest rewards, vendor sells)
  - `burn/4` — gold leaves the world (sinks: shop buys, repair, fees)
  - `transfer/4` — gold moves between entities (trades, with optional tax)

  ## Architecture

  Economy is a framework-level module (not a script, not an entity).
  Config lives on a system entity (`economy_config`) for runtime tuning.
  Transaction log is an append-only DB table for auditing/reporting.

  ## Entity Transform API

  For action modules that build up entity changes in-memory (shop, quest rewards),
  use `credit/3` and `debit/3` which return updated entities without persisting.
  The caller is responsible for persisting AND calling `log/5` afterward.

  ## Direct API

  For direct operations (builder commands, scripts), use `mint/4` and `burn/4`
  which handle EntityServer update + logging in one call.
  """

  require Logger

  alias Loka.Engine.{Entities, Entity, EntityRegistry, EntityServer}
  alias Loka.Components.Wallet
  alias Loka.Framework.Economy.EconomyLog

  @config_key "economy_config"

  # =============================================================================
  # Direct API — updates EntityServer + logs in one call
  # =============================================================================

  @doc """
  Mint gold and deposit into an entity's wallet.

  This is the ONLY sanctioned way to create gold. Looks up the entity's
  EntityServer, updates the wallet component, and logs the transaction.

  ## Sources (faucet tags)
  `:mob_kill`, `:quest_reward`, `:vendor_sell`, `:gathering`, `:login_bonus`,
  `:admin_grant`, `:script`

  ## Examples

      Economy.mint(player_id, 50, :quest_reward, %{quest: "intro_welcome"})
      Economy.mint(player_id, 10, :mob_kill, %{mob: "goblin"})
  """
  @spec mint(String.t(), pos_integer(), atom(), map()) ::
          {:ok, %{amount: integer(), balance: integer()}} | {:error, term()}
  def mint(entity_id, amount, source, meta \\ %{})
      when is_integer(amount) and amount > 0 do
    with {:ok, adjusted} <- apply_faucet_multiplier(amount, source),
         {:ok, entity} <- update_wallet(entity_id, adjusted) do
      balance = Wallet.balance(entity)
      EconomyLog.append(:faucet, source, entity_id, adjusted, meta)
      emit(:minted, entity_id, adjusted, source, meta)
      {:ok, %{amount: adjusted, balance: balance}}
    end
  end

  @doc """
  Burn gold from an entity's wallet.

  This is the ONLY sanctioned way to destroy gold.

  ## Sinks
  `:shop_buy`, `:repair`, `:fast_travel`, `:crafting_fee`, `:tax`,
  `:death_penalty`, `:admin_charge`, `:script`

  ## Examples

      Economy.burn(player_id, 25, :shop_buy, %{item: "iron_sword"})
  """
  @spec burn(String.t(), pos_integer(), atom(), map()) ::
          {:ok, %{amount: integer(), balance: integer()}} | {:error, term()}
  def burn(entity_id, amount, sink, meta \\ %{})
      when is_integer(amount) and amount > 0 do
    case update_wallet(entity_id, -amount) do
      {:ok, entity} ->
        balance = Wallet.balance(entity)
        EconomyLog.append(:sink, sink, entity_id, amount, meta)
        emit(:burned, entity_id, amount, sink, meta)
        {:ok, %{amount: amount, balance: balance}}

      {:error, :insufficient_funds} = err ->
        err

      error ->
        error
    end
  end

  @doc """
  Transfer gold between entities. A tax may be deducted.

  The sender pays `amount`, the receiver gets `amount - tax`.
  The tax is burned (removed from the economy).
  """
  @spec transfer(String.t(), String.t(), pos_integer(), atom()) ::
          {:ok, %{sent: integer(), received: integer(), tax: integer()}} | {:error, term()}
  def transfer(from_id, to_id, amount, reason \\ :trade)
      when is_integer(amount) and amount > 0 do
    tax = compute_tax(reason, amount)
    net = amount - tax

    with {:ok, _from_entity} <- update_wallet(from_id, -amount) do
      case update_wallet(to_id, net) do
        {:ok, _to_entity} ->
          EconomyLog.append(:transfer, reason, from_id, amount, %{to: to_id, tax: tax})

          if tax > 0 do
            EconomyLog.append(:sink, :tax, from_id, tax, %{reason: to_string(reason)})
          end

          emit(:transferred, from_id, amount, reason, %{to: to_id, tax: tax})
          {:ok, %{sent: amount, received: net, tax: tax}}

        {:error, reason} ->
          # Compensate: refund the sender since receiver credit failed
          Logger.warning(
            "[Economy] Transfer failed, refunding sender #{from_id}: #{inspect(reason)}"
          )

          update_wallet(from_id, amount)
          {:error, reason}
      end
    end
  end

  # =============================================================================
  # Entity Transform API — for action modules building entity changes in-memory
  # =============================================================================

  @doc """
  Add gold to an entity struct in memory. Does NOT persist or log.

  Use this in action modules (shop, quest rewards) that build up entity
  changes before returning a Result. The caller MUST also call
  `Economy.log/5` to record the transaction.

  Returns `{:ok, updated_entity}`.
  """
  @spec credit(Entity.t(), pos_integer()) :: {:ok, Entity.t()}
  def credit(entity, amount) when is_integer(amount) and amount > 0 do
    wallet = Wallet.get(entity)
    current = Map.get(wallet, "gold", 0)
    new_wallet = Map.put(wallet, "gold", current + amount)
    {:ok, Wallet.put(entity, new_wallet)}
  end

  @doc """
  Remove gold from an entity struct in memory. Does NOT persist or log.

  Returns `{:ok, updated_entity}` or `{:error, :insufficient_funds}`.
  """
  @spec debit(Entity.t(), pos_integer()) ::
          {:ok, Entity.t()} | {:error, :insufficient_funds}
  def debit(entity, amount) when is_integer(amount) and amount > 0 do
    current = Wallet.balance(entity)

    if current < amount do
      {:error, :insufficient_funds}
    else
      wallet = Wallet.get(entity)
      new_wallet = Map.put(wallet, "gold", current - amount)
      {:ok, Wallet.put(entity, new_wallet)}
    end
  end

  @doc """
  Log a transaction after an entity transform. Call this after using
  `credit/3` or `debit/3` and persisting the entity.
  """
  @spec log(atom(), atom(), String.t(), pos_integer(), map()) :: :ok
  def log(type, category, entity_id, amount, meta \\ %{}) do
    EconomyLog.append(type, category, entity_id, amount, meta)
  end

  # =============================================================================
  # Queries
  # =============================================================================

  @doc """
  Returns the gold balance for an entity by looking up its EntityServer.
  """
  @spec balance(String.t()) :: non_neg_integer()
  def balance(entity_id) do
    case EntityRegistry.lookup(entity_id) do
      {:ok, pid} ->
        entity = EntityServer.get_entity(pid)
        Wallet.balance(entity)

      :not_found ->
        0
    end
  end

  @doc """
  Returns the gold balance from an entity struct (no DB/process lookup).
  """
  @spec balance_from_entity(Entity.t()) :: non_neg_integer()
  def balance_from_entity(entity), do: Wallet.balance(entity)

  @doc """
  Returns total money supply across all player entities.
  Uses SQL aggregate — does not load entities into memory.
  """
  @spec money_supply() :: non_neg_integer()
  def money_supply do
    import Ecto.Query

    result =
      from(e in Loka.Engine.Schema.EntitySchema,
        where: e.type == "character",
        select:
          sum(
            fragment(
              "CAST(json_extract(?, '$.wallet.gold') AS INTEGER)",
              e.components
            )
          )
      )
      |> Loka.Repo.one()

    result || 0
  end

  @doc "Returns today's economic summary."
  defdelegate daily_summary, to: EconomyLog

  @doc "Returns all-time totals."
  defdelegate totals, to: EconomyLog

  @doc "Returns recent transactions for an entity."
  defdelegate recent_transactions(entity_id, limit \\ 20), to: EconomyLog, as: :recent

  # =============================================================================
  # Config (reads from economy_config system entity)
  # =============================================================================

  @doc "Returns the economy config map, with defaults."
  def config do
    case Entities.find_one(key: @config_key, type: :system) do
      {:ok, entity} -> entity.components["economy"] || default_config()
      _ -> default_config()
    end
  end

  defp default_config do
    %{
      "tax_rates" => %{"trade" => 0.05, "auction" => 0.10},
      "faucet_multipliers" => %{},
      "daily_mint_cap" => nil
    }
  end

  # =============================================================================
  # Private
  # =============================================================================

  defp update_wallet(entity_id, delta) do
    case EntityRegistry.lookup(entity_id) do
      {:ok, pid} ->
        # Balance check and update are atomic — both happen inside the
        # GenServer's serialized call, preventing TOCTOU race conditions.
        EntityServer.update_protected(
          pid,
          fn entity ->
            wallet = Wallet.get(entity)
            current = Map.get(wallet, "gold", 0)
            new_balance = current + delta

            if new_balance < 0 do
              {:error, :insufficient_funds}
            else
              Wallet.put(entity, Map.put(wallet, "gold", new_balance))
            end
          end,
          force_save: true
        )

      :not_found ->
        {:error, :entity_not_found}
    end
  end

  defp apply_faucet_multiplier(amount, source) do
    multipliers = config()["faucet_multipliers"] || %{}
    multiplier = Map.get(multipliers, to_string(source), 1.0)
    adjusted = max(1, trunc(amount * multiplier))
    {:ok, adjusted}
  end

  defp compute_tax(reason, amount) do
    rates = config()["tax_rates"] || %{}
    rate = Map.get(rates, to_string(reason), 0.0)
    trunc(amount * rate)
  end

  defp emit(type, entity_id, amount, category, meta) do
    Phoenix.PubSub.broadcast(
      Loka.PubSub,
      "economy",
      {:economy, type, %{entity_id: entity_id, amount: amount, category: category, meta: meta}}
    )
  end
end
