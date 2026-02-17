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
  prototype access. It also calls Content modules (Quest, Dialogue, Script)
  but cannot declare them as deps due to a Content→Framework cycle. These
  cross-boundary calls are suppressed via `check: [out: false]` until the
  cycle is resolved (Content should depend on Engine only, not Framework).
  """

  use Boundary, top_level?: true, exports: :all, check: [out: false]
end
