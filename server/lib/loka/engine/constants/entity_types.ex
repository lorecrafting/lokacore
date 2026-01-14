defmodule Loka.Engine.Constants.EntityTypes do
  @moduledoc """
  Single source of truth for entity type definitions.

  All modules that work with entity types should reference this module
  instead of defining their own type lists.

  ## Entity Types

  - `:room` - Physical locations in the game world
  - `:character` - Player characters
  - `:npc` - Non-player characters (NPCs, mobs)
  - `:item` - Objects that can be picked up/used
  - `:exit` - Connections between rooms

  ## Usage

      alias Loka.Engine.Constants.EntityTypes

      # Get all types
      EntityTypes.all()

      # Check if valid
      EntityTypes.valid?(:npc)  # true
      EntityTypes.valid?(:foo)  # false

      # For Ecto enum
      @entity_types EntityTypes.all()
      field :type, Ecto.Enum, values: @entity_types
  """

  @types [:room, :character, :npc, :item, :exit]

  @type entity_type :: :room | :character | :npc | :item | :exit

  @doc "Returns all valid entity types."
  @spec all() :: [entity_type()]
  def all, do: @types

  @doc "Returns true if the given type is valid."
  @spec valid?(atom()) :: boolean()
  def valid?(type), do: type in @types

  @doc "Returns spawnable entity types (can be instanced in game world)."
  @spec spawnable() :: [entity_type()]
  def spawnable, do: [:npc, :item]

  @doc "Returns location entity types (can contain other entities)."
  @spec containers() :: [entity_type()]
  def containers, do: [:room, :npc, :item, :character]

  @doc "Returns actor entity types (can perform actions)."
  @spec actors() :: [entity_type()]
  def actors, do: [:character, :npc]
end
