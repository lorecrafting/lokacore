defmodule Loka.Engine.Constants.EntityTypes do
  @moduledoc """
  Single source of truth for entity type definitions.

  All modules that work with entity types should reference this module
  instead of defining their own type lists.

  ## Entity Types

  ### World entities (have location, exist in-game)
  - `:room` - Physical locations in the game world
  - `:character` - Player characters
  - `:npc` - Non-player characters (NPCs, mobs)
  - `:item` - Objects that can be picked up/used
  - `:exit` - Connections between rooms

  ### Content entities (prototypes/definitions, no location)
  - `:quest` - Quest definitions
  - `:dialogue` - Dialogue trees
  - `:zone` - Zone definitions
  - `:storyline` - Storyline containers
  - `:skill` - Skill definitions
  - `:recipe` - Crafting recipes
  - `:resource` - Gatherable resource definitions
  - `:status` - Status effect definitions
  - `:script` - Reusable script definitions
  - `:social` - Social command definitions

  ### System entities (no location, background processes)
  - `:system` - System-level entities (weather, day/night, etc.)

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

  @types [
    # World entities
    :room,
    :character,
    :npc,
    :item,
    :exit,
    # Content entities
    :quest,
    :dialogue,
    :zone,
    :storyline,
    :skill,
    :recipe,
    :resource,
    :status,
    :script,
    :social,
    # System entities
    :system
  ]

  @type entity_type ::
          :room
          | :character
          | :npc
          | :item
          | :exit
          | :quest
          | :dialogue
          | :zone
          | :storyline
          | :skill
          | :recipe
          | :resource
          | :status
          | :system
          | :script
          | :social

  @doc "Returns all valid entity types."
  @spec all() :: [entity_type()]
  def all, do: @types

  @doc "Returns true if the given type is valid."
  @spec valid?(atom()) :: boolean()
  def valid?(type), do: type in @types
end
