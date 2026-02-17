defmodule Loka.Test.Generators do
  @moduledoc """
  Shared StreamData generators for property-based tests.

  Uses ExUnitProperties generators for entity types, components,
  inventory items, resource pools, and other domain objects.

  ## Usage

      use ExUnitProperties
      import Loka.Test.Generators

      property "entity types are valid" do
        check all type <- entity_type() do
          assert Loka.Engine.Entity.valid_type?(type)
        end
      end
  """

  use ExUnitProperties

  alias Loka.Engine.Constants.EntityTypes

  # =============================================================================
  # Entity Generators
  # =============================================================================

  @doc "Generates a valid entity type atom."
  def entity_type do
    member_of(EntityTypes.all())
  end

  @doc "Generates a minimal valid entity struct."
  def entity do
    gen all(
          type <- entity_type(),
          key <- string(:alphanumeric, min_length: 1, max_length: 30),
          short_desc <- string(:printable, min_length: 1, max_length: 50)
        ) do
      Loka.Engine.Entity.new(
        type: type,
        key: key,
        short_desc: short_desc
      )
    end
  end

  @doc "Generates a valid component key string."
  def component_key do
    member_of([
      "combatant",
      "wallet",
      "inventory",
      "quest_progress",
      "resource_pools",
      "cooldowns",
      "physical",
      "equipment",
      "data",
      "exit",
      "tick"
    ])
  end

  @doc "Generates component data (a simple map with string keys)."
  def component_data do
    gen all(
          pairs <-
            list_of(tuple({string(:alphanumeric, min_length: 1), integer()}),
              min_length: 0,
              max_length: 5
            )
        ) do
      Map.new(pairs)
    end
  end

  # =============================================================================
  # Resource Pool Generators
  # =============================================================================

  @doc "Generates a resource pool map with current <= max."
  def resource_pool do
    gen all(
          max <- integer(1..1000),
          current <- integer(0..max)
        ) do
      %{"current" => current, "max" => max}
    end
  end

  # =============================================================================
  # Inventory Generators
  # =============================================================================

  @doc "Generates a flat inventory list of item keys."
  def inventory_list do
    list_of(
      member_of(["health_potion", "mana_potion", "sword", "shield", "arrow", "gem", "key"]),
      min_length: 0,
      max_length: 20
    )
  end

  @doc "Generates a positive quantity for add/remove operations."
  def quantity do
    integer(1..10)
  end

  # =============================================================================
  # State Machine Generators
  # =============================================================================

  @doc "Generates a state string from a predefined set."
  def state_name do
    member_of([
      "idle",
      "active",
      "engaged",
      "defending",
      "fleeing",
      "dead",
      "available",
      "accepted",
      "in_progress",
      "completed",
      "failed",
      "abandoned"
    ])
  end

  # =============================================================================
  # Currency / Wallet Generators
  # =============================================================================

  @doc "Generates a non-negative gold balance."
  def gold_balance do
    integer(0..100_000)
  end

  @doc "Generates a positive currency amount for credit/debit."
  def currency_amount do
    integer(1..10_000)
  end
end
