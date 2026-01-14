defmodule Loka.Framework.Quest.ObjectiveTypes do
  @moduledoc """
  Single source of truth for quest objective type definitions.

  All quest-related modules should reference this module instead of
  defining their own objective type lists.

  ## Objective Types

  - `:talk` - Talk to an NPC (optionally on a specific topic)
  - `:kill` - Defeat a certain number of enemies
  - `:get_item` - Obtain specific items
  - `:go_to` - Visit a specific location
  - `:craft` - Craft specific items

  ## Usage

      alias Loka.Framework.Quest.ObjectiveTypes

      # Get all types
      ObjectiveTypes.all()

      # Check if valid
      ObjectiveTypes.valid?(:talk)  # true
      ObjectiveTypes.valid?(:foo)   # false

      # Get description
      ObjectiveTypes.description(:kill)  # "Defeat enemies"
  """

  @types [:talk, :kill, :get_item, :go_to, :craft]

  @type objective_type :: :talk | :kill | :get_item | :go_to | :craft

  @doc "Returns all valid objective types."
  @spec all() :: [objective_type()]
  def all, do: @types

  @doc "Returns true if the given type is valid."
  @spec valid?(atom()) :: boolean()
  def valid?(type), do: type in @types

  @doc "Returns a human-readable description for an objective type."
  @spec description(objective_type()) :: String.t()
  def description(:talk), do: "Talk to NPC"
  def description(:kill), do: "Defeat enemies"
  def description(:get_item), do: "Obtain items"
  def description(:go_to), do: "Visit location"
  def description(:craft), do: "Craft items"
  def description(_), do: "Unknown objective"

  @doc "Returns types that track progress as a count."
  @spec countable() :: [objective_type()]
  def countable, do: [:kill, :get_item, :craft]

  @doc "Returns types that are binary (done/not done)."
  @spec binary() :: [objective_type()]
  def binary, do: [:talk, :go_to]
end
