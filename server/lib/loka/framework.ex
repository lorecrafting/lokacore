defmodule Loka.Framework do
  @moduledoc """
  Game systems built on top of the Engine layer.

  Framework provides the 31+ game subsystems that make Loka a full MUD engine:

  - Combat, abilities, status effects
  - Quest system (definitions, progress, rewards, chains)
  - Inventory, equipment, crafting, gathering, farming
  - Economy (shops, barter)
  - World systems (rooms, weather, atmosphere, day/night)
  - Dialogue system
  - Social systems (parties, channels, messaging, relationships)
  - Player progression, skills
  - Companion, faction, housing, hometown
  - Scripting integration (hook integration, world event handlers)
  - Content validation plugins

  ## Boundary Rules

  Framework depends on Engine for entity manipulation, hooks, events, and
  prototype access. It must NOT depend on Content, Session, or Web layers.
  """

  use Boundary, top_level?: true, exports: :all, check: [out: false]
end
